import { describe, it, expect } from 'vitest'
import { aidState } from './aids.js'
import { login } from './auth.js'
import { status } from './journey.js'
import { createDevPlayer, DEV_PASSWORD } from './devPlayer.js'
import { balance } from './wallet.js'
import { makeGame } from './helpers.test-util.js'

describe('comptes d\'essai', () => {
  it('arrive au niveau demandé, avec ses pièces, e-mail confirmé : on peut se connecter', async () => {
    const { ctx, db } = await makeGame()
    const p = await createDevPlayer(db, { level: 70, coins: 250 })
    expect(p).toMatchObject({ pseudo: 'test70', email: 'test70@local.test', level: 70, coins: 250 })
    const r = await login(ctx, { email: p.email, password: DEV_PASSWORD, ip: '1.1.1.1' })
    if (!r.ok) throw new Error('connexion attendue')
    expect(await status(db, `u:${r.user.id}`)).toMatchObject({ level: 70 })
    expect(await balance(db, `u:${r.user.id}`)).toBe(250)
  })
  it('les aides déjà débloquées à ce niveau sont là (3 en stock + essai offert), pas les autres', async () => {
    const { db } = await makeGame()
    const p = await createDevPlayer(db, { level: 70 })
    const id = (await db.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [p.email])).rows[0].id
    const a = (await aidState(db, `u:${id}`)).aids
    expect(a.filter((x) => x.unlocked).map((x) => x.id)).toEqual(['colors', 'cell'])
    expect(a[0]).toMatchObject({ stock: 3, demoPending: true })
    expect(a[2]).toMatchObject({ unlocked: false, stock: 0 })
  })
  it('relancer remet le compte à zéro à ce niveau (pas de doublon)', async () => {
    const { db } = await makeGame()
    await createDevPlayer(db, { level: 30, coins: 10 })
    const p = await createDevPlayer(db, { level: 30, coins: 500 })
    expect((await db.query('SELECT 1 FROM users WHERE email = $1', [p.email])).rows).toHaveLength(1)
    const id = (await db.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [p.email])).rows[0].id
    expect(await balance(db, `u:${id}`)).toBe(500)
    expect((await db.query('SELECT 1 FROM progress WHERE owner = $1', [`u:${id}`])).rows).toHaveLength(29)
  })
  it('refuse un niveau qui n\'existe pas', async () => {
    const { db } = await makeGame()
    await expect(createDevPlayer(db, { level: 0 })).rejects.toThrow(/invalide/)
    await expect(createDevPlayer(db, { level: 99999 })).rejects.toThrow(/n'existe pas/)
  })
})
