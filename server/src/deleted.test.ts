import { afterEach, describe, expect, it } from 'vitest'
import { confirmEmail, deleteAccount, login, register } from './auth.js'
import { applyRegistry, exportRegistry, OWNER_TABLES, ownerOf, recordDeletion, REGISTRY_TTL_MS } from './deleted.js'
import { closeAll, makeCtx, STRONG } from './helpers.test-util.js'

afterEach(closeAll)

async function compte(c: Awaited<ReturnType<typeof makeCtx>>, pseudo: string, email: string) {
  expect(await register(c.ctx, { pseudo, email, password: STRONG })).toEqual({ ok: true })
  const conf = await confirmEmail(c.ctx, c.tokenOf())
  if (!conf.ok) throw new Error('confirmation refusée')
  const l = await login(c.ctx, { email, password: STRONG, ip: '1.1.1.1' })
  if (!l.ok) throw new Error('connexion refusée')
  return l.user.id
}

describe('suppression de compte : toutes les tables du joueur', () => {
  it('OWNER_TABLES couvre toutes les tables qui ont une colonne « owner » (sinon une suppression laisserait des données)', async () => {
    const { db } = await makeCtx()
    const { rows } = await db.query<{ table_name: string }>(
      `SELECT DISTINCT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'owner'`,
    )
    // le registre lui-même a une colonne « owner » mais doit survivre à la suppression : c'est la seule exception
    const reelles = rows.map((r) => r.table_name).filter((t) => t !== 'deleted_owners').sort()
    expect(reelles).toEqual([...OWNER_TABLES].sort())
  })
})

describe('registre des suppressions', () => {
  it('une suppression y laisse seulement l\'identifiant et la date, jamais l\'adresse ni le pseudo', async () => {
    const c = await makeCtx()
    const id = await compte(c, 'Alice', 'alice@x.fr')
    expect(await deleteAccount(c.ctx, { userId: id, password: STRONG, ip: '1.1.1.1' })).toEqual({ ok: true })
    const reg = await exportRegistry(c.db)
    expect(reg).toHaveLength(1)
    expect(reg[0].owner).toBe(ownerOf(id))
    expect(JSON.stringify(reg)).not.toMatch(/alice/i)
    // aucune donnée personnelle dans la table elle-même
    const cols = await c.db.query<{ column_name: string }>(`SELECT column_name FROM information_schema.columns WHERE table_name = 'deleted_owners' ORDER BY column_name`)
    expect(cols.rows.map((r) => r.column_name)).toEqual(['deleted_at', 'owner'])
  })

  it('un mot de passe faux ne supprime rien et ne remplit pas le registre', async () => {
    const c = await makeCtx()
    const id = await compte(c, 'Bob', 'bob@x.fr')
    expect(await deleteAccount(c.ctx, { userId: id, password: 'faux', ip: '1.1.1.1' })).toEqual({ ok: false, code: 'invalid' })
    expect(await exportRegistry(c.db)).toEqual([])
    expect((await c.db.query('SELECT 1 FROM users WHERE id = $1', [id])).rows).toHaveLength(1)
  })

  it('après une restauration, applyRegistry re-supprime le compte et toutes ses données', async () => {
    const c = await makeCtx()
    const id = await compte(c, 'Carole', 'carole@x.fr')
    const garde = await compte(c, 'David', 'david@x.fr')
    const owner = ownerOf(id)
    // données de jeu de Carole, comme dans une sauvegarde faite AVANT sa suppression
    // (la confirmation d'e-mail a déjà créé un portefeuille avec les pièces de bienvenue)
    await c.db.query('UPDATE wallets SET coins = 55 WHERE owner = $1', [owner])
    expect((await c.db.query('SELECT 1 FROM wallets WHERE owner = $1', [owner])).rows).toHaveLength(1)
    expect(await deleteAccount(c.ctx, { userId: id, password: STRONG, ip: '1.1.1.1' })).toEqual({ ok: true })

    // « restauration » : la sauvegarde ancienne remet le compte et ses données
    await c.db.query(
      `INSERT INTO users (id, pseudo, pseudo_key, email, password_hash, provider, created_at) VALUES ($1,'Carole','carole','carole@x.fr','x','local',now())`,
      [id],
    )
    await c.db.query('INSERT INTO wallets (owner, coins) VALUES ($1, 55)', [owner])
    expect((await c.db.query('SELECT 1 FROM users WHERE id = $1', [id])).rows).toHaveLength(1)

    expect(await applyRegistry(c.db)).toBe(1)
    expect((await c.db.query('SELECT 1 FROM users WHERE id = $1', [id])).rows).toHaveLength(0)
    expect((await c.db.query('SELECT 1 FROM wallets WHERE owner = $1', [owner])).rows).toHaveLength(0)
    // les autres joueurs ne sont pas touchés
    expect((await c.db.query('SELECT 1 FROM users WHERE id = $1', [garde])).rows).toHaveLength(1)
    expect((await c.db.query('SELECT coins FROM wallets WHERE owner = $1', [ownerOf(garde)])).rows).toHaveLength(1)
  })

  it('applyRegistry accepte un registre exporté avant la restauration, et refuse tout ce qui n\'est pas un identifiant de joueur', async () => {
    const c = await makeCtx()
    const id = await compte(c, 'Eve', 'eve@x.fr')
    const garde = await compte(c, 'Franck', 'franck@x.fr')
    const n = await applyRegistry(c.db, [
      { owner: ownerOf(id), deleted_at: '2026-01-01T00:00:00.000Z' },
      { owner: "u:1'; DROP TABLE users; --", deleted_at: '2026-01-01T00:00:00.000Z' }, // ignoré
      { owner: ownerOf('00000000-0000-0000-0000-000000000000'), deleted_at: '2026-01-01T00:00:00.000Z' }, // inconnu : sans effet
    ])
    expect(n).toBe(2)
    expect((await c.db.query('SELECT 1 FROM users WHERE id = $1', [id])).rows).toHaveLength(0)
    expect((await c.db.query('SELECT 1 FROM users WHERE id = $1', [garde])).rows).toHaveLength(1)
    expect((await c.db.query('SELECT 1 FROM users')).rows).toHaveLength(1) // la table users existe toujours
  })

  it('les entrées plus vieilles que les sauvegardes (35 jours) sont retirées du registre', async () => {
    const c = await makeCtx()
    const maintenant = new Date(c.clock.t)
    await recordDeletion(c.db, 'u:00000000-0000-0000-0000-00000000000a', new Date(maintenant.getTime() - REGISTRY_TTL_MS - 1000))
    await recordDeletion(c.db, 'u:00000000-0000-0000-0000-00000000000b', new Date(maintenant.getTime() - 3600_000))
    await recordDeletion(c.db, 'u:00000000-0000-0000-0000-00000000000c', maintenant) // déclenche la purge
    const restants = (await exportRegistry(c.db)).map((e) => e.owner).sort()
    expect(restants).toEqual(['u:00000000-0000-0000-0000-00000000000b', 'u:00000000-0000-0000-0000-00000000000c'])
  })
})
