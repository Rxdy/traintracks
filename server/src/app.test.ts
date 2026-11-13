import { describe, it, expect } from 'vitest'
import { buildApp } from './app.js'
import { edgesOf, makeGame, STRONG, LEVELS } from './helpers.test-util.js'
import { generate } from '../../shared/generator.js'
import { edgeKey } from '../../shared/track.js'

async function setup() {
  const c = await makeGame()
  return { ...c, app: buildApp(c.ctx) }
}
const post = (app: ReturnType<typeof buildApp>, url: string, payload: object, cookie?: string) =>
  app.inject({ method: 'POST', url, payload, headers: cookie ? { cookie } : {} })

describe('API des comptes', () => {
  it('parcours complet : inscription, confirmation, connexion, /me, déconnexion', async () => {
    const { app, tokenOf } = await setup()
    expect((await post(app, '/api/auth/register', { pseudo: 'Rudy', email: 'r@x.fr', password: STRONG })).statusCode).toBe(201)
    expect((await post(app, '/api/auth/login', { email: 'r@x.fr', password: STRONG })).statusCode).toBe(403)
    expect((await post(app, '/api/auth/confirm', { token: tokenOf() })).statusCode).toBe(200)
    const login = await post(app, '/api/auth/login', { email: 'r@x.fr', password: STRONG })
    expect(login.statusCode).toBe(200)
    const set = String(login.headers['set-cookie'])
    expect(set).toMatch(/tt_session=/)
    expect(set).toMatch(/HttpOnly/i)
    expect(set).toMatch(/SameSite=Lax/i)
    const cookie = set.split(';')[0]
    const me = await app.inject({ method: 'GET', url: '/api/me', headers: { cookie } })
    expect(me.json()).toMatchObject({ user: { pseudo: 'Rudy', email: 'r@x.fr' } })
    expect(JSON.stringify(me.json())).not.toMatch(/hash|password/i)
    await post(app, '/api/auth/logout', {}, cookie)
    expect((await app.inject({ method: 'GET', url: '/api/me', headers: { cookie } })).statusCode).toBe(401)
  })
  it('refuse un mot de passe faible avec les bits et le seuil', async () => {
    const { app } = await setup()
    const r = await post(app, '/api/auth/register', { pseudo: 'Rudy', email: 'r@x.fr', password: 'Password123!' })
    expect(r.statusCode).toBe(422)
    expect(r.json()).toMatchObject({ error: 'weak', min: 50 })
    expect(r.json().bits).toBeLessThan(50)
  })
  it('pseudo pris : 409 ; données invalides : 400', async () => {
    const { app } = await setup()
    await post(app, '/api/auth/register', { pseudo: 'Rudy', email: 'r@x.fr', password: STRONG })
    expect((await post(app, '/api/auth/register', { pseudo: 'rudy', email: 's@x.fr', password: STRONG })).statusCode).toBe(409)
    expect((await post(app, '/api/auth/register', { pseudo: 'Rudy', email: 'nope', password: STRONG })).statusCode).toBe(400)
  })
  it('429 avec Retry-After après 5 échecs', async () => {
    const { app, tokenOf } = await setup()
    await post(app, '/api/auth/register', { pseudo: 'Rudy', email: 'r@x.fr', password: STRONG })
    await post(app, '/api/auth/confirm', { token: tokenOf() })
    for (let i = 0; i < 5; i++) expect((await post(app, '/api/auth/login', { email: 'r@x.fr', password: 'non' })).statusCode).toBe(401)
    const r = await post(app, '/api/auth/login', { email: 'r@x.fr', password: STRONG })
    expect(r.statusCode).toBe(429)
    expect(Number(r.headers['retry-after'])).toBeGreaterThan(0)
    expect(r.headers['set-cookie']).toBeUndefined()
  })
  it('ne prend pas de formulaire classique (protège contre les envois depuis un autre site)', async () => {
    const { app } = await setup()
    const r = await app.inject({ method: 'POST', url: '/api/auth/login', payload: 'email=a&password=b', headers: { 'content-type': 'application/x-www-form-urlencoded' } })
    expect(r.statusCode).toBe(415)
  })
  it('/me sans session : 401', async () => {
    const { app } = await setup()
    expect((await app.inject({ method: 'GET', url: '/api/me' })).statusCode).toBe(401)
  })
})

describe('plusieurs comptes sur un même appareil', () => {
  const cookieOf = (r: { headers: Record<string, unknown> }, name: string) => [r.headers['set-cookie']].flat().map(String).find((c) => c.startsWith(name + '='))?.split(';')[0]

  it('inscription → confirmation → connexion → déconnexion → un AUTRE compte : chacun garde sa progression et ses pièces', async () => {
    const { app, tokenOf } = await setup()
    const signup = async (pseudo: string, email: string) => {
      expect((await post(app, '/api/auth/register', { pseudo, email, password: STRONG })).statusCode).toBe(201)
      expect((await post(app, '/api/auth/confirm', { token: tokenOf() })).statusCode).toBe(200)
    }
    const signin = async (email: string) => {
      const r = await post(app, '/api/auth/login', { email, password: STRONG })
      expect(r.statusCode).toBe(200)
      return cookieOf(r, 'tt_session')!
    }
    const get = (url: string, cookie: string) => app.inject({ method: 'GET', url, headers: { cookie } })

    await signup('Alice', 'alice@x.fr')
    await signup('Bob', 'bob@x.fr')

    // Alice joue le niveau 1
    const alice = await signin('alice@x.fr')
    expect((await get('/api/me', alice)).json().user).toMatchObject({ pseudo: 'Alice', email: 'alice@x.fr' })
    await post(app, '/api/journey/start', {}, alice)
    const won = await post(app, '/api/journey/submit', { level: 1, edges: edgesOf(1) }, alice)
    expect(won.json()).toMatchObject({ ok: true, next: { level: 2 } })
    const aliceCoins = (await get('/api/aids', alice)).json().coins
    expect(aliceCoins).toBeGreaterThan(100) // 100 de bienvenue + le gain du niveau

    // elle se déconnecte : son cookie ne vaut plus rien
    await post(app, '/api/auth/logout', {}, alice)
    expect((await get('/api/me', alice)).statusCode).toBe(401)

    // Bob se connecte sur le même appareil : il repart du niveau 1, avec ses propres pièces
    const bob = await signin('bob@x.fr')
    expect((await get('/api/me', bob)).json().user).toMatchObject({ pseudo: 'Bob', email: 'bob@x.fr' })
    expect((await get('/api/journey', bob)).json().level).toBe(1)
    expect((await get('/api/aids', bob)).json().coins).toBe(100)
    // …et ce que Bob fait n'est pas à Alice
    await post(app, '/api/journey/start', {}, bob)
    await post(app, '/api/journey/submit', { level: 1, edges: edgesOf(1) }, bob)
    await post(app, '/api/auth/logout', {}, bob)

    // Alice revient : tout est là (niveau 2, ses pièces), rien n'a bougé à cause de Bob
    const again = await signin('alice@x.fr')
    expect((await get('/api/journey', again)).json().level).toBe(2)
    expect((await get('/api/aids', again)).json().coins).toBe(aliceCoins)
  })
  it('une adresse = un compte : la 2e inscription est refusée (409 email_taken), même écrite autrement', async () => {
    const { app } = await setup()
    expect((await post(app, '/api/auth/register', { pseudo: 'Alice', email: 'alice@x.fr', password: STRONG })).statusCode).toBe(201)
    for (const email of ['alice@x.fr', 'ALICE@X.FR', 'alice+2@x.fr']) {
      const r = await post(app, '/api/auth/register', { pseudo: 'Autre' + email.length, email, password: STRONG })
      expect(r.statusCode, email).toBe(409)
      expect(r.json(), email).toEqual({ error: 'email_taken' })
    }
    // un pseudo déjà pris garde son propre message
    const p = await post(app, '/api/auth/register', { pseudo: 'alice', email: 'neuf@x.fr', password: STRONG })
    expect(p.json()).toEqual({ error: 'pseudo_taken' })
  })
})

describe('API du Voyage', () => {
  const cookieOf = (r: { headers: Record<string, unknown> }, name: string) => [r.headers['set-cookie']].flat().map(String).find((c) => c.startsWith(name + '='))?.split(';')[0]

  it('un joueur anonyme joue : cookie anonyme, grille sans solution, validation, niveau suivant', async () => {
    const { app } = await setup()
    expect((await app.inject({ method: 'GET', url: '/api/journey' })).json()).toEqual({ level: 1, total: LEVELS.length, allDone: false })
    const st = await post(app, '/api/journey/start', {})
    const anon = cookieOf(st, 'tt_anon')
    expect(anon).toBeTruthy()
    expect(String(st.headers['set-cookie'])).toMatch(/HttpOnly/i)
    expect(st.json().level.id).toBe(1)
    expect(st.body).not.toMatch(/solution/i)
    const bad = await post(app, '/api/journey/submit', { level: 1, edges: [] }, anon)
    expect(bad.statusCode).toBe(422)
    const ok = await post(app, '/api/journey/submit', { level: 1, edges: edgesOf(1) }, anon)
    expect(ok.statusCode).toBe(200)
    expect(ok.json()).toMatchObject({ ok: true, next: { level: 2 } })
    expect(ok.body).not.toMatch(/solution/i)
    const again = await app.inject({ method: 'GET', url: '/api/journey', headers: { cookie: anon! } })
    expect(again.json().level).toBe(2)
  })
  it('premier geste : enregistré une fois, le temps compte de là', async () => {
    const { app } = await setup()
    const anon = cookieOf(await post(app, '/api/journey/start', {}), 'tt_anon')!
    expect((await post(app, '/api/journey/begin', {}, anon)).json()).toEqual({ ok: true })
    expect((await post(app, '/api/journey/begin', {}, anon)).json()).toEqual({ ok: false }) // déjà noté
  })
  it('refuse de sauter un niveau (409) et les données mal formées (400)', async () => {
    const { app } = await setup()
    const anon = cookieOf(await post(app, '/api/journey/start', {}), 'tt_anon')
    expect((await post(app, '/api/journey/submit', { level: 5, edges: edgesOf(5) }, anon)).statusCode).toBe(409)
    expect((await post(app, '/api/journey/submit', { level: 1, edges: 'x' }, anon)).statusCode).toBe(400)
  })
  it('à la connexion, la progression anonyme passe au compte et le cookie anonyme disparaît', async () => {
    const { app, tokenOf } = await setup()
    const anon = cookieOf(await post(app, '/api/journey/start', {}), 'tt_anon')
    await post(app, '/api/journey/submit', { level: 1, edges: edgesOf(1) }, anon)
    await post(app, '/api/auth/register', { pseudo: 'Rudy', email: 'r@x.fr', password: STRONG })
    await post(app, '/api/auth/confirm', { token: tokenOf() })
    const login = await post(app, '/api/auth/login', { email: 'r@x.fr', password: STRONG }, anon)
    expect(login.statusCode).toBe(200)
    expect([login.headers['set-cookie']].flat().map(String).find((c) => c.startsWith('tt_anon='))).toMatch(/tt_anon=;|Max-Age=0|Expires=/i)
    const session = cookieOf(login, 'tt_session')!
    expect((await app.inject({ method: 'GET', url: '/api/journey', headers: { cookie: session } })).json().level).toBe(2)
    // et plus rien côté anonyme
    expect((await app.inject({ method: 'GET', url: '/api/journey', headers: { cookie: anon! } })).json().level).toBe(1)
  })
  it('un cookie anonyme falsifié n\'ouvre rien : il est ignoré', async () => {
    const { app } = await setup()
    const r = await post(app, '/api/journey/start', {}, "tt_anon='; DROP TABLE progress;--")
    expect(r.statusCode).toBe(200)
    expect(cookieOf(r, 'tt_anon')).toMatch(/^tt_anon=[0-9a-f-]{36}$/)
  })
})

describe('API des pièces et aides', () => {
  const cookieOf = (r: { headers: Record<string, unknown> }) => [r.headers['set-cookie']].flat().map(String).find((c) => c.startsWith('tt_anon='))?.split(';')[0]

  it('état au départ : 0 pièce, aucune aide ouverte ; le gain apparaît après une victoire', async () => {
    const { app } = await setup()
    expect((await app.inject({ method: 'GET', url: '/api/aids' })).json()).toMatchObject({ coins: 0, aids: [{ id: 'colors', unlocked: false, price: 10 }, { id: 'cell', price: 20 }, { id: 'cannon', price: 30 }, { id: 'line', price: 50 }] })
    const anon = cookieOf(await post(app, '/api/journey/start', {}))!
    const w = await post(app, '/api/journey/submit', { level: 1, edges: edgesOf(1) }, anon)
    expect(w.json()).toMatchObject({ ok: true, coins: 15, earned: { base: 10, bonus: 5 } })
    expect((await app.inject({ method: 'GET', url: '/api/aids', headers: { cookie: anon } })).json().coins).toBe(15)
  })
  it('codes HTTP : aide verrouillée 403, achat verrouillé 403, mal formé 400', async () => {
    const { app } = await setup()
    const anon = cookieOf(await post(app, '/api/journey/start', {}))!
    expect((await post(app, '/api/journey/aid', { aid: 'cannon' }, anon)).statusCode).toBe(403)
    expect((await post(app, '/api/aids/buy', { aid: 'cannon' }, anon)).statusCode).toBe(403)
    expect((await post(app, '/api/aids/buy', { aid: 'x' }, anon)).statusCode).toBe(400)
    expect((await post(app, '/api/journey/aid', { aid: 'x' }, anon)).statusCode).toBe(400)
  })
})

describe('API du puzzle du jour et des statistiques', () => {
  async function loggedIn() {
    const c = await setup()
    await post(c.app, '/api/auth/register', { pseudo: 'Rudy', email: 'r@x.fr', password: STRONG })
    await post(c.app, '/api/auth/confirm', { token: c.tokenOf() })
    const login = await post(c.app, '/api/auth/login', { email: 'r@x.fr', password: STRONG })
    const cookie = String(login.headers['set-cookie']).split(';')[0]
    return { ...c, cookie }
  }
  const dailyEdges = () => {
    const sol = generate('daily:2026-01-01', 5).solution // l'horloge de test est le 1er janvier 2026
    return sol.slice(1).map((c, i) => edgeKey(sol[i][0], sol[i][1], c[0], c[1])!)
  }

  it('réservé aux joueurs inscrits : 401 sans compte', async () => {
    const { app } = await setup()
    for (const url of ['/api/daily', '/api/stats']) expect((await app.inject({ method: 'GET', url })).statusCode).toBe(401)
    expect((await post(app, '/api/daily/start', {})).statusCode).toBe(401)
    expect((await post(app, '/api/daily/begin', {})).statusCode).toBe(401)
    expect((await post(app, '/api/daily/submit', { edges: [] })).statusCode).toBe(401)
  })
  it('parcours : statut, démarrage sans solution, tracé juste, 20 pièces, statistiques', async () => {
    const { app, cookie } = await loggedIn()
    expect((await app.inject({ method: 'GET', url: '/api/daily', headers: { cookie } })).json()).toMatchObject({ date: '2026-01-01', done: false, streak: 0 })
    const st = await post(app, '/api/daily/start', {}, cookie)
    expect(st.statusCode).toBe(200)
    expect(st.json().puzzle.size).toBe(5)
    expect(st.body).not.toMatch(/solution/i)
    expect((await post(app, '/api/daily/submit', { edges: [] }, cookie)).statusCode).toBe(422)
    const ok = await post(app, '/api/daily/submit', { edges: dailyEdges() }, cookie)
    expect(ok.statusCode).toBe(200)
    expect(ok.json()).toMatchObject({ ok: true, counted: true, earned: { base: 20, streakBonus: 0 }, coins: 120 }) // 100 de bienvenue + 20
    const stats = (await app.inject({ method: 'GET', url: '/api/stats', headers: { cookie } })).json()
    expect(stats).toMatchObject({ journey: { level: 1 }, daily: { count: 1, streak: 1 } })
  })
  it('sans démarrage : 409 ; données mal formées : 400', async () => {
    const { app, cookie } = await loggedIn()
    expect((await post(app, '/api/daily/submit', { edges: dailyEdges() }, cookie)).statusCode).toBe(409)
    await post(app, '/api/daily/start', {}, cookie)
    expect((await post(app, '/api/daily/submit', { edges: 'x' }, cookie)).statusCode).toBe(400)
  })
  it('les aides du Voyage ne servent pas dans le puzzle du jour (même débloquées)', async () => {
    const { app, cookie, db } = await loggedIn()
    const me = (await app.inject({ method: 'GET', url: '/api/me', headers: { cookie } })).json().user
    for (let l = 1; l < 20; l++) await db.query('INSERT INTO progress (owner, level, solved_at, time_ms) VALUES ($1,$2,now(),1)', [`u:${me.id}`, l])
    expect((await app.inject({ method: 'GET', url: '/api/aids', headers: { cookie } })).json().aids[0]).toMatchObject({ id: 'colors', unlocked: true, stock: 3 })
    await post(app, '/api/daily/start', {}, cookie) // une partie du jour est en cours, mais aucun niveau du Voyage
    const r = await post(app, '/api/journey/aid', { aid: 'colors', edges: [] }, cookie)
    expect(r.statusCode).toBe(409)
    expect(r.json().error).toBe('not_started')
    expect((await app.inject({ method: 'GET', url: '/api/aids', headers: { cookie } })).json().aids[0].stock).toBe(3) // rien consommé
  })
})

describe('API : mot de passe oublié, suppression de compte, mentions légales', () => {
  it('parcours complet : oublié → lien → nouveau mot de passe → connexion', async () => {
    const { app, tokenOf, mails } = await setup()
    await post(app, '/api/auth/register', { pseudo: 'Rudy', email: 'r@x.fr', password: STRONG })
    await post(app, '/api/auth/confirm', { token: tokenOf() })
    expect((await post(app, '/api/auth/forgot', { email: 'inconnu@x.fr' })).json()).toEqual({ ok: true }) // même réponse
    expect((await post(app, '/api/auth/forgot', { email: 'r@x.fr' })).json()).toEqual({ ok: true })
    const token = /\?reset=([\w-]+)/.exec(mails.at(-1)!.text)![1]
    expect((await post(app, '/api/auth/reset', { token, password: 'Password123!' })).statusCode).toBe(422)
    expect((await post(app, '/api/auth/reset', { token, password: 'orage-lampe-sentier-pomme-quartz' })).statusCode).toBe(200)
    expect((await post(app, '/api/auth/reset', { token, password: 'orage-lampe-sentier-pomme-quartz' })).statusCode).toBe(400)
    expect((await post(app, '/api/auth/login', { email: 'r@x.fr', password: 'orage-lampe-sentier-pomme-quartz' })).statusCode).toBe(200)
  })

  it('suppression : connexion et mot de passe exigés, puis le compte n\'existe plus', async () => {
    const { app, tokenOf } = await setup()
    await post(app, '/api/auth/register', { pseudo: 'Rudy', email: 'r@x.fr', password: STRONG })
    await post(app, '/api/auth/confirm', { token: tokenOf() })
    expect((await post(app, '/api/auth/delete-account', { password: STRONG })).statusCode).toBe(401)
    const cookie = String((await post(app, '/api/auth/login', { email: 'r@x.fr', password: STRONG })).headers['set-cookie']).split(';')[0]
    expect((await post(app, '/api/auth/delete-account', { password: 'faux' }, cookie)).statusCode).toBe(403)
    expect((await post(app, '/api/auth/delete-account', { password: STRONG }, cookie)).statusCode).toBe(200)
    expect((await app.inject({ method: 'GET', url: '/api/me', headers: { cookie } })).statusCode).toBe(401)
    expect((await post(app, '/api/auth/login', { email: 'r@x.fr', password: STRONG })).statusCode).toBe(401)
  })

  it('mentions légales : les informations de l\'éditeur viennent de la configuration', async () => {
    const c = await makeGame()
    const app = buildApp({ ...c.ctx, legal: { name: 'Jeanne Dupont', contact: 'contact@exemple.fr', host: 'l\'éditeur' } })
    expect((await app.inject({ method: 'GET', url: '/api/legal' })).json()).toEqual({ name: 'Jeanne Dupont', contact: 'contact@exemple.fr', host: 'l\'éditeur' })
  })
})
