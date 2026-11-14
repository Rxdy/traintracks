import { describe, it, expect } from 'vitest'
import { confirmEmail, emailKeyOf, login, logout, register, userForSession } from './auth.js'
import { makeCtx, STRONG } from './helpers.test-util.js'

const sign = { pseudo: 'Rudy', email: 'Rudy@Example.fr', password: STRONG }

describe('inscription', () => {
  it('crée un compte non confirmé et envoie le lien de confirmation', async () => {
    const { ctx, db, mails } = await makeCtx()
    expect(await register(ctx, sign)).toEqual({ ok: true })
    const u = (await db.query<{ email: string; email_confirmed_at: unknown; password_hash: string }>('SELECT * FROM users')).rows
    expect(u).toHaveLength(1)
    expect(u[0].email).toBe('rudy@example.fr')
    expect(u[0].email_confirmed_at).toBeNull()
    expect(u[0].password_hash).toMatch(/^\$argon2id\$/)
    expect(mails).toHaveLength(1)
    expect(mails[0].to).toBe('rudy@example.fr')
  })
  it('refuse un mot de passe sous le seuil, sans créer de compte', async () => {
    const { ctx, db, mails } = await makeCtx()
    const r = await register(ctx, { ...sign, password: 'Password123!' })
    expect(r).toMatchObject({ ok: false, code: 'weak', min: 36 })
    expect((await db.query('SELECT 1 FROM users')).rows).toHaveLength(0)
    expect(mails).toHaveLength(0)
  })
  it('refuse un mot de passe qui contient le pseudo', async () => {
    const { ctx } = await makeCtx()
    const r = await register(ctx, { pseudo: 'Dragonfly', email: 'a@b.fr', password: 'dragonfly2024xx' })
    expect(r).toMatchObject({ ok: false, code: 'weak' })
  })
  it('valide pseudo, e-mail et mot de passe', async () => {
    const { ctx } = await makeCtx()
    expect(await register(ctx, { ...sign, pseudo: 'a' })).toMatchObject({ code: 'invalid', field: 'pseudo' })
    expect(await register(ctx, { ...sign, pseudo: 'un pseudo' })).toMatchObject({ code: 'invalid', field: 'pseudo' })
    expect(await register(ctx, { ...sign, email: 'pas-un-mail' })).toMatchObject({ code: 'invalid', field: 'email' })
    expect(await register(ctx, { ...sign, password: '' })).toMatchObject({ code: 'invalid', field: 'password' })
  })
  it('le pseudo est unique sans tenir compte de la casse', async () => {
    const { ctx } = await makeCtx()
    await register(ctx, sign)
    expect(await register(ctx, { ...sign, pseudo: 'RUDY', email: 'autre@x.fr' })).toEqual({ ok: false, code: 'pseudo_taken' })
  })
  it('une adresse = un compte : refus clair, aucun doublon', async () => {
    const { ctx, db } = await makeCtx()
    expect(await register(ctx, sign)).toEqual({ ok: true })
    expect(await register(ctx, { ...sign, pseudo: 'Autre' })).toEqual({ ok: false, code: 'email_taken' })
    expect((await db.query('SELECT 1 FROM users')).rows).toHaveLength(1)
  })
  it('même boîte mail, écrite autrement : majuscules, +étiquette, points et googlemail chez Gmail', async () => {
    const { ctx, db } = await makeCtx()
    expect(await register(ctx, { pseudo: 'Alice', email: 'Alice.Dupont@Gmail.com', password: STRONG })).toEqual({ ok: true })
    for (const [i, email] of ['alicedupont@gmail.com', 'alice.dupont+jeu@gmail.com', 'a.l.i.c.e.dupont@googlemail.com', 'ALICEDUPONT@GMAIL.COM'].entries()) {
      expect(await register(ctx, { pseudo: `Autre${i}`, email, password: STRONG }), email).toEqual({ ok: false, code: 'email_taken' })
    }
    // hors Gmail les points comptent, mais pas les +étiquettes
    expect(await register(ctx, { pseudo: 'Bob', email: 'b.ob@x.fr', password: STRONG })).toEqual({ ok: true })
    expect(await register(ctx, { pseudo: 'Bob2', email: 'bob@x.fr', password: STRONG })).toEqual({ ok: true })
    expect(await register(ctx, { pseudo: 'Bob3', email: 'bob+2@x.fr', password: STRONG })).toEqual({ ok: false, code: 'email_taken' })
    expect((await db.query('SELECT 1 FROM users')).rows).toHaveLength(3)
  })
})

describe('confirmation de l\'e-mail', () => {
  it('le lien sert une seule fois', async () => {
    const { ctx, tokenOf } = await makeCtx()
    await register(ctx, sign)
    const t = tokenOf()
    expect(await confirmEmail(ctx, t)).toMatchObject({ ok: true })
    expect(await confirmEmail(ctx, t)).toEqual({ ok: false })
  })
  it('expire au bout de 24 h et refuse un jeton inventé', async () => {
    const { ctx, clock, tokenOf } = await makeCtx()
    await register(ctx, sign)
    clock.t += 24 * 3600_000 + 1000
    expect(await confirmEmail(ctx, tokenOf())).toEqual({ ok: false })
    expect(await confirmEmail(ctx, 'inventé')).toEqual({ ok: false })
  })
})

describe('connexion et sessions', () => {
  const creds = { email: 'rudy@example.fr', password: STRONG, ip: '1.1.1.1' }
  it('refuse tant que l\'e-mail n\'est pas confirmé, puis accepte', async () => {
    const { ctx, tokenOf } = await makeCtx()
    await register(ctx, sign)
    expect(await login(ctx, creds)).toEqual({ ok: false, code: 'unconfirmed' })
    await confirmEmail(ctx, tokenOf())
    const r = await login(ctx, { ...creds, email: ' RUDY@example.fr ' })
    expect(r.ok).toBe(true)
  })
  it('la session identifie le joueur jusqu\'à la déconnexion', async () => {
    const { ctx, tokenOf } = await makeCtx()
    await register(ctx, sign)
    await confirmEmail(ctx, tokenOf())
    const r = await login(ctx, creds)
    if (!r.ok) throw new Error('connexion attendue')
    expect(await userForSession(ctx, r.sessionToken)).toMatchObject({ pseudo: 'Rudy', email: 'rudy@example.fr' })
    await logout(ctx, r.sessionToken)
    expect(await userForSession(ctx, r.sessionToken)).toBeNull()
    expect(await userForSession(ctx, undefined)).toBeNull()
  })
  it('la session expire au bout de 30 jours', async () => {
    const { ctx, clock, tokenOf } = await makeCtx()
    await register(ctx, sign)
    await confirmEmail(ctx, tokenOf())
    const r = await login(ctx, creds)
    if (!r.ok) throw new Error('connexion attendue')
    clock.t += 31 * 24 * 3600_000
    expect(await userForSession(ctx, r.sessionToken)).toBeNull()
  })
})

describe('blocage des essais', () => {
  const bad = { email: 'rudy@example.fr', password: 'mauvais', ip: '2.2.2.2' }
  async function confirmed() {
    const c = await makeCtx()
    await register(c.ctx, sign)
    await confirmEmail(c.ctx, c.tokenOf())
    return c
  }
  it('5 échecs bloquent 15 min, même avec le bon mot de passe ensuite', async () => {
    const { ctx } = await confirmed()
    for (let i = 0; i < 5; i++) expect(await login(ctx, bad)).toEqual({ ok: false, code: 'invalid' })
    const r = await login(ctx, { ...bad, password: STRONG })
    expect(r).toMatchObject({ ok: false, code: 'locked' })
    expect((r as { retryAfterSec: number }).retryAfterSec).toBeGreaterThan(14 * 60)
    expect((r as { retryAfterSec: number }).retryAfterSec).toBeLessThanOrEqual(15 * 60)
  })
  it('se débloque après 15 min ; le blocage suivant dure le double', async () => {
    const { ctx, clock } = await confirmed()
    for (let i = 0; i < 5; i++) await login(ctx, bad)
    clock.t += 15 * 60_000 + 1000
    expect((await login(ctx, { ...bad, password: STRONG })).ok).toBe(true) // libre, et le succès remet à zéro l'e-mail
    for (let i = 0; i < 5; i++) await login(ctx, bad)
    const r = await login(ctx, bad)
    expect(r).toMatchObject({ code: 'locked' })
  })
  it('sans succès entre-temps, chaque blocage dure le double, plafonné à 24 h', async () => {
    const { ctx, clock } = await confirmed()
    const lockSec = async () => {
      for (let i = 0; i < 5; i++) await login(ctx, bad)
      return (await login(ctx, bad)) as { code: string; retryAfterSec: number }
    }
    expect((await lockSec()).retryAfterSec).toBeLessThanOrEqual(15 * 60)
    clock.t += 15 * 60_000 + 1000
    const second = await lockSec()
    expect(second.retryAfterSec).toBeGreaterThan(29 * 60)
    expect(second.retryAfterSec).toBeLessThanOrEqual(30 * 60)
    for (let k = 0; k < 12; k++) { clock.t += 25 * 3600_000; await lockSec() }
    clock.t += 25 * 3600_000
    expect((await lockSec()).retryAfterSec).toBeLessThanOrEqual(24 * 3600)
  })
  it('un succès avant le 5e échec remet le compteur à zéro', async () => {
    const { ctx } = await confirmed()
    for (let i = 0; i < 4; i++) await login(ctx, bad)
    expect((await login(ctx, { ...bad, password: STRONG })).ok).toBe(true)
    for (let i = 0; i < 4; i++) expect(await login(ctx, bad)).toEqual({ ok: false, code: 'invalid' })
  })
  it('un e-mail inconnu est bloqué comme les autres (rien ne révèle qui a un compte)', async () => {
    const { ctx } = await makeCtx()
    const ghost = { email: 'fantome@x.fr', password: 'x', ip: '3.3.3.3' }
    for (let i = 0; i < 5; i++) expect(await login(ctx, ghost)).toEqual({ ok: false, code: 'invalid' })
    expect(await login(ctx, ghost)).toMatchObject({ code: 'locked' })
  })
  it('20 échecs depuis une même adresse IP bloquent cette adresse, quels que soient les e-mails', async () => {
    const { ctx } = await makeCtx()
    for (let i = 0; i < 20; i++) await login(ctx, { email: `u${i}@x.fr`, password: 'x', ip: '9.9.9.9' })
    expect(await login(ctx, { email: 'nouveau@x.fr', password: 'x', ip: '9.9.9.9' })).toMatchObject({ code: 'locked' })
    expect(await login(ctx, { email: 'nouveau@x.fr', password: 'x', ip: '8.8.8.8' })).toEqual({ ok: false, code: 'invalid' })
  })
})

describe('clé d\'unicité des adresses', () => {
  it('la fonction du serveur et celle de la base donnent la même clé', async () => {
    const { db } = await makeCtx()
    const sample = ['alice@x.fr', 'a.l+jeu@gmail.com', 'ab.c@googlemail.com', 'x+y@example.org', 'Zed@Mail.FR']
    for (const e of sample) {
      const lower = e.toLowerCase()
      const sql = (await db.query<{ k: string }>('SELECT email_key_of($1) AS k', [lower])).rows[0].k
      expect(emailKeyOf(e), e).toBe(sql)
    }
  })
  it('la base calcule la clé toute seule, même pour une insertion directe, et refuse un doublon', async () => {
    const { db } = await makeCtx()
    await db.query("INSERT INTO users (id, pseudo, pseudo_key, email, provider, created_at) VALUES ('11111111-1111-1111-1111-111111111111','A','a','x.y+1@gmail.com','local',now())")
    expect((await db.query<{ email_key: string }>('SELECT email_key FROM users')).rows[0].email_key).toBe('xy@gmail.com')
    await expect(db.query("INSERT INTO users (id, pseudo, pseudo_key, email, provider, created_at) VALUES ('22222222-2222-2222-2222-222222222222','B','b','xy@googlemail.com','local',now())")).rejects.toThrow()
  })
})
