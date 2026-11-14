import { afterEach, describe, expect, it } from 'vitest'
import { buildApp } from './app.js'
import { closeAll, makeCtx, STRONG } from './helpers.test-util.js'

afterEach(closeAll)

const NOUVEAU = 'orange-tableau-lampe-riviere-sable'

async function setup() {
  const c = await makeCtx()
  const app = buildApp({ ...c.ctx, exportSecret: 'secret-de-test' })
  const post = (url: string, payload: object, cookie?: string) => app.inject({ method: 'POST', url, payload, headers: cookie ? { cookie } : {} })
  const get = (url: string, cookie?: string) => app.inject({ method: 'GET', url, headers: cookie ? { cookie } : {} })
  const cookieOf = (r: { headers: Record<string, unknown> }) => [r.headers['set-cookie']].flat().map(String).find((x) => x.startsWith('tt_session='))?.split(';')[0]!
  const connecte = async (email: string) => {
    const r = await post('/api/auth/login', { email, password: STRONG })
    expect(r.statusCode).toBe(200)
    return cookieOf(r)
  }
  const compte = async (pseudo: string, email: string) => {
    expect((await post('/api/auth/register', { pseudo, email, password: STRONG })).statusCode).toBe(201)
    expect((await post('/api/auth/confirm', { token: c.tokenOf() })).statusCode).toBe(200)
    return connecte(email)
  }
  return { ...c, app, post, get, compte, connecte }
}

describe('changer de mot de passe (connecté)', () => {
  it('il faut être connecté', async () => {
    const { post } = await setup()
    expect((await post('/api/account/password', { currentPassword: STRONG, newPassword: NOUVEAU })).statusCode).toBe(401)
  })

  it('un ancien mot de passe faux est refusé et rien ne change', async () => {
    const { post, compte } = await setup()
    const a = await compte('Alice', 'alice@x.fr')
    const r = await post('/api/account/password', { currentPassword: 'faux-faux-faux', newPassword: NOUVEAU }, a)
    expect(r.statusCode).toBe(403)
    expect(r.json()).toEqual({ error: 'wrong_password' })
    expect((await post('/api/auth/login', { email: 'alice@x.fr', password: STRONG })).statusCode).toBe(200) // l'ancien marche toujours
  })

  it('un nouveau mot de passe trop faible, vide ou identique à l\'ancien est refusé', async () => {
    const { post, compte } = await setup()
    const a = await compte('Bob', 'bob@x.fr')
    const faible = await post('/api/account/password', { currentPassword: STRONG, newPassword: 'Password123!' }, a)
    expect(faible.statusCode).toBe(400)
    expect(faible.json()).toMatchObject({ error: 'weak', min: 36 })
    expect((await post('/api/account/password', { currentPassword: STRONG, newPassword: '' }, a)).json()).toEqual({ error: 'invalid' })
    expect((await post('/api/account/password', { currentPassword: STRONG, newPassword: 'x'.repeat(201) }, a)).json()).toEqual({ error: 'invalid' })
    expect((await post('/api/account/password', { currentPassword: STRONG, newPassword: STRONG }, a)).json()).toEqual({ error: 'same' })
  })

  it('un mot de passe qui contient le pseudo ou l\'adresse compte comme faible', async () => {
    const { post, compte } = await setup()
    const a = await compte('Caroline', 'caroline@x.fr')
    const r = await post('/api/account/password', { currentPassword: STRONG, newPassword: 'caroline2026' }, a)
    expect(r.statusCode).toBe(400)
    expect(r.json()).toMatchObject({ error: 'weak' })
  })

  it('succès : le nouveau marche, l\'ancien non, les autres appareils sont déconnectés, la session en cours reste ouverte', async () => {
    const { post, get, compte, connecte, mails } = await setup()
    const telephone = await compte('David', 'david@x.fr')
    const ordinateur = await connecte('david@x.fr')
    mails.length = 0
    expect((await post('/api/account/password', { currentPassword: STRONG, newPassword: NOUVEAU }, ordinateur)).json()).toEqual({ ok: true })

    expect((await get('/api/me', ordinateur)).statusCode).toBe(200) // l'appareil qui a changé reste connecté
    expect((await get('/api/me', telephone)).statusCode).toBe(401) // l'autre appareil doit se reconnecter
    expect((await post('/api/auth/login', { email: 'david@x.fr', password: STRONG })).statusCode).toBe(401)
    expect((await post('/api/auth/login', { email: 'david@x.fr', password: NOUVEAU })).statusCode).toBe(200)

    // un mail prévient le titulaire, sans contenir de mot de passe
    expect(mails).toHaveLength(1)
    expect(mails[0].to).toBe('david@x.fr')
    expect(mails[0].subject).toMatch(/mot de passe modifié/i)
    expect(mails[0].text).not.toContain(NOUVEAU)
    expect(mails[0].text).not.toContain(STRONG)
  })

  it('après 5 essais faux, le changement est bloqué (comme la connexion)', async () => {
    const { post, compte } = await setup()
    const a = await compte('Eve', 'eve@x.fr')
    for (let i = 0; i < 5; i++) await post('/api/account/password', { currentPassword: 'faux' + i, newPassword: NOUVEAU }, a)
    const r = await post('/api/account/password', { currentPassword: STRONG, newPassword: NOUVEAU }, a)
    expect(r.statusCode).toBe(429)
    expect(r.json()).toMatchObject({ error: 'locked' })
  })
})
