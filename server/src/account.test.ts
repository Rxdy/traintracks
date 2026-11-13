import { describe, it, expect } from 'vitest'
import { confirmEmail, deleteAccount, forgotPassword, login, register, resetPassword, userForSession } from './auth.js'
import { makeGame, STRONG } from './helpers.test-util.js'

const NEW_PASS = 'orage-lampe-sentier-pomme-quartz'
const sign = { pseudo: 'Rudy', email: 'rudy@example.fr', password: STRONG }

async function account() {
  const c = await makeGame()
  await register(c.ctx, sign)
  await confirmEmail(c.ctx, c.tokenOf())
  const id = (await c.db.query<{ id: string }>('SELECT id FROM users')).rows[0].id
  return { ...c, id }
}
const resetToken = (mails: { text: string }[]) => /\?reset=([\w-]+)/.exec(mails.at(-1)!.text)![1]

describe('mot de passe oublié', () => {
  it('envoie un lien à l\'adresse d\'un compte, et rien (sans le dire) pour une adresse inconnue', async () => {
    const { ctx, mails } = await account()
    const before = mails.length
    await forgotPassword(ctx, { email: 'inconnu@example.fr' })
    expect(mails).toHaveLength(before)
    await forgotPassword(ctx, { email: 'RUDY@example.fr' })
    expect(mails).toHaveLength(before + 1)
    expect(mails.at(-1)!.subject).toContain('nouveau mot de passe')
    expect(resetToken(mails)).toBeTruthy()
  })

  it('pas plus d\'un e-mail par minute', async () => {
    const { ctx, mails, clock } = await account()
    await forgotPassword(ctx, { email: sign.email })
    await forgotPassword(ctx, { email: sign.email })
    expect(mails.filter((m) => m.subject.includes('nouveau mot de passe'))).toHaveLength(1)
    clock.t += 61_000
    await forgotPassword(ctx, { email: sign.email })
    expect(mails.filter((m) => m.subject.includes('nouveau mot de passe'))).toHaveLength(2)
  })

  it('le nouveau mot de passe remplace l\'ancien, le lien ne sert qu\'une fois, les sessions sont fermées', async () => {
    const { ctx, mails } = await account()
    const s = await login(ctx, { email: sign.email, password: STRONG, ip: '1.1.1.1' })
    if (!s.ok) throw new Error('connexion')
    await forgotPassword(ctx, { email: sign.email })
    const token = resetToken(mails)
    expect(await resetPassword(ctx, { token, password: NEW_PASS })).toEqual({ ok: true })
    expect(await userForSession(ctx, s.sessionToken)).toBeNull()
    expect(await login(ctx, { email: sign.email, password: STRONG, ip: '1.1.1.1' })).toMatchObject({ ok: false, code: 'invalid' })
    expect(await login(ctx, { email: sign.email, password: NEW_PASS, ip: '1.1.1.1' })).toMatchObject({ ok: true })
    expect(await resetPassword(ctx, { token, password: NEW_PASS + 'x' })).toEqual({ ok: false, code: 'invalid_token' })
    expect(mails.at(-1)!.subject).toContain('mot de passe modifié')
  })

  it('refuse un mot de passe faible sans consommer le lien, et un lien expiré ou inventé', async () => {
    const { ctx, mails, clock } = await account()
    await forgotPassword(ctx, { email: sign.email })
    const token = resetToken(mails)
    expect(await resetPassword(ctx, { token, password: 'Password123!' })).toMatchObject({ ok: false, code: 'weak' })
    expect(await resetPassword(ctx, { token: 'inventé', password: NEW_PASS })).toEqual({ ok: false, code: 'invalid_token' })
    clock.t += 3600_000 + 1000
    expect(await resetPassword(ctx, { token, password: NEW_PASS })).toEqual({ ok: false, code: 'invalid_token' })
  })
})

describe('suppression du compte', () => {
  it('exige le bon mot de passe', async () => {
    const { ctx, db, id } = await account()
    expect(await deleteAccount(ctx, { userId: id, password: 'faux', ip: '1.1.1.1' })).toEqual({ ok: false, code: 'invalid' })
    expect((await db.query('SELECT 1 FROM users')).rows).toHaveLength(1)
  })

  it('efface le compte et TOUTES ses données, sans toucher aux autres joueurs', async () => {
    const { ctx, db, id } = await account()
    const owner = `u:${id}`
    const other = 'a:autre'
    for (const o of [owner, other]) {
      await db.query('INSERT INTO progress (owner, level, solved_at, time_ms) VALUES ($1,1,now(),1000)', [o])
      await db.query('INSERT INTO level_runs (owner, level, started_at) VALUES ($1,2,now())', [o])
      await db.query("INSERT INTO aid_stock (owner, aid, qty) VALUES ($1,'colors',1)", [o])
      await db.query("INSERT INTO aid_gifts (owner, aid) VALUES ($1,'colors')", [o])
      await db.query("INSERT INTO daily_runs (owner, date, started_at) VALUES ($1,'2026-01-01',now())", [o])
      await db.query("INSERT INTO daily_results (owner, date, time_ms, solved_at) VALUES ($1,'2026-01-01',5000,now())", [o])
      await db.query("INSERT INTO rewards (owner, kind, ref, amount, created_at) VALUES ($1,'level','x',5,now()) ON CONFLICT DO NOTHING", [o])
      await db.query('INSERT INTO wallets (owner, coins) VALUES ($1,5) ON CONFLICT (owner) DO NOTHING', [o])
    }
    const s = await login(ctx, { email: sign.email, password: STRONG, ip: '1.1.1.1' })
    if (!s.ok) throw new Error('connexion')

    expect(await deleteAccount(ctx, { userId: id, password: STRONG, ip: '1.1.1.1' })).toEqual({ ok: true })

    for (const t of ['users', 'sessions', 'email_tokens', 'reset_tokens']) expect((await db.query(`SELECT 1 FROM ${t}`)).rows, t).toHaveLength(0)
    for (const t of ['progress', 'level_runs', 'wallets', 'rewards', 'aid_stock', 'aid_gifts', 'daily_runs', 'daily_results']) {
      expect((await db.query(`SELECT 1 FROM ${t} WHERE owner = $1`, [owner])).rows, t).toHaveLength(0)
      expect((await db.query(`SELECT 1 FROM ${t} WHERE owner = $1`, [other])).rows, t + ' (autre joueur)').toHaveLength(1)
    }
    expect(await userForSession(ctx, s.sessionToken)).toBeNull()
  })

  it('les mauvais mots de passe sont comptés comme à la connexion (blocage)', async () => {
    const { ctx, id } = await account()
    for (let i = 0; i < 5; i++) await deleteAccount(ctx, { userId: id, password: 'faux' + i, ip: '2.2.2.2' })
    expect(await deleteAccount(ctx, { userId: id, password: STRONG, ip: '2.2.2.2' })).toMatchObject({ ok: false, code: 'locked' })
  })
})
