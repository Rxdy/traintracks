import { afterEach, describe, expect, it } from 'vitest'
import { buildApp } from './app.js'
import { challengeOf, createGoogleClient, type GoogleClient, type GoogleProfile } from './google.js'
import { closeAll, makeCtx, STRONG } from './helpers.test-util.js'
import { deleteAccount } from './auth.js'

afterEach(closeAll)

// Un faux Google : le « code » reçu au retour désigne le profil à renvoyer (aucun réseau).
function fauxGoogle(profils: Record<string, GoogleProfile | null>): GoogleClient & { derniers: { code: string; verifier: string }[] } {
  const derniers: { code: string; verifier: string }[] = []
  return {
    derniers,
    authUrl: (state, challenge) => `https://google.test/auth?state=${state}&challenge=${challenge}`,
    exchange: async (code, verifier) => {
      derniers.push({ code, verifier })
      return profils[code] ?? null
    },
  }
}

const ALICE: GoogleProfile = { sub: 'g-alice', email: 'Alice@Gmail.com', emailVerified: true }

async function setup(profils: Record<string, GoogleProfile | null> = { alice: ALICE }, avecGoogle = true) {
  const c = await makeCtx()
  const google = fauxGoogle(profils)
  const app = buildApp({ ...c.ctx, exportSecret: 'secret-de-test', google: avecGoogle ? google : undefined })
  const get = (url: string, cookie?: string) => app.inject({ method: 'GET', url, headers: cookie ? { cookie } : {} })
  const post = (url: string, payload: object, cookie?: string) => app.inject({ method: 'POST', url, payload, headers: cookie ? { cookie } : {} })
  const cookies = (r: { headers: Record<string, unknown> }) => [r.headers['set-cookie']].flat().filter(Boolean).map(String)
  const cookieNamed = (r: { headers: Record<string, unknown> }, n: string) => cookies(r).find((x) => x.startsWith(n + '='))?.split(';')[0]
  // lance la connexion et revient de Google avec ce code ; renvoie la réponse du retour et le cookie de session éventuel
  const connecter = async (code: string, opts: { state?: string; sansCookie?: boolean } = {}) => {
    const start = await get('/api/auth/google/start')
    const state = /state=([^&]+)/.exec(String(start.headers.location))![1]
    const oauth = cookieNamed(start, 'tt_oauth')!
    const retour = await get(`/api/auth/google/callback?code=${code}&state=${opts.state ?? state}`, opts.sansCookie ? undefined : oauth)
    return { start, retour, session: cookieNamed(retour, 'tt_session') }
  }
  const compteLocal = async (pseudo: string, email: string, confirmer: boolean) => {
    expect((await post('/api/auth/register', { pseudo, email, password: STRONG })).statusCode).toBe(201)
    if (confirmer) expect((await post('/api/auth/confirm', { token: c.tokenOf() })).statusCode).toBe(200)
  }
  return { ...c, app, google, get, post, connecter, compteLocal }
}

describe('connexion avec Google : démarrage', () => {
  it('sans identifiants configurés la fonction est désactivée', async () => {
    const { get } = await setup({}, false)
    expect((await get('/api/auth/providers')).json()).toEqual({ google: false })
    expect((await get('/api/auth/google/start')).statusCode).toBe(404)
  })

  it('configurée : annoncée au front, et le démarrage redirige vers Google avec un état et un défi PKCE', async () => {
    const { get, google } = await setup()
    expect((await get('/api/auth/providers')).json()).toEqual({ google: true })
    const r = await get('/api/auth/google/start')
    expect(r.statusCode).toBe(302)
    expect(String(r.headers.location)).toMatch(/^https:\/\/google\.test\/auth\?state=/)
    const cookie = [r.headers['set-cookie']].flat().map(String).find((x) => x.startsWith('tt_oauth='))!
    expect(cookie).toMatch(/HttpOnly/i)
    const [state, verifier] = cookie.split(';')[0].slice('tt_oauth='.length).split('.')
    expect(String(r.headers.location)).toContain(`state=${state}`)
    expect(String(r.headers.location)).toContain(`challenge=${challengeOf(verifier)}`) // Google reçoit le défi, jamais le vérificateur
    expect(google.derniers).toEqual([])
  })
})

describe('connexion avec Google : retour', () => {
  it('nouveau compte : pseudo neutre, adresse confirmée, 100 pièces, connecté, redirigé vers le site pour choisir son pseudo', async () => {
    const { connecter, get, db } = await setup()
    const { retour, session } = await connecter('alice')
    expect(retour.statusCode).toBe(302)
    expect(retour.headers.location).toBe('http://site.test/?bienvenue=1') // le site ouvre le choix du pseudo
    expect(session).toBeTruthy()
    const me = (await get('/api/me', session)).json().user
    expect(me).toMatchObject({ email: 'alice@gmail.com', provider: 'google', localLogin: false })
    expect(me.pseudo).toMatch(/^[A-Za-zéÉ]+\d{4}$/) // jamais le nom ni l'adresse
    expect(me.pseudo.toLowerCase()).not.toContain('alice')
    const w = await db.query<{ coins: number }>('SELECT coins FROM wallets WHERE owner = $1', [`u:${me.id}`])
    expect(w.rows[0].coins).toBe(100)
    const u = await db.query<{ email_confirmed_at: Date | null; password_hash: string | null }>('SELECT email_confirmed_at, password_hash FROM users WHERE id = $1', [me.id])
    expect(u.rows[0].email_confirmed_at).not.toBeNull()
    expect(u.rows[0].password_hash).toBeNull()
  })

  it('reconnexion : le même compte Google retrouve le même compte, sans doublon ni nouvelles pièces', async () => {
    const { connecter, get, db } = await setup()
    const a = await connecter('alice')
    const b = await connecter('alice')
    expect(b.retour.headers.location).toBe('http://site.test/') // compte déjà là : pas de nouvelle proposition de pseudo
    expect((await get('/api/me', a.session)).json().user.id).toBe((await get('/api/me', b.session)).json().user.id)
    expect((await db.query('SELECT 1 FROM users')).rows).toHaveLength(1)
    expect((await db.query('SELECT 1 FROM identities')).rows).toHaveLength(1)
    expect((await db.query<{ coins: number }>('SELECT coins FROM wallets')).rows[0].coins).toBe(100)
  })

  it('l\'adresse change chez Google : le compte reste reconnu par son identifiant stable', async () => {
    const { connecter, get } = await setup({ ancien: ALICE, nouveau: { ...ALICE, email: 'alice.nouvelle@gmail.com' } })
    const a = await connecter('ancien')
    const b = await connecter('nouveau')
    expect((await get('/api/me', b.session)).json().user.id).toBe((await get('/api/me', a.session)).json().user.id)
  })

  it('un compte existant (adresse confirmée) avec la même adresse est rattaché, et son mot de passe marche toujours', async () => {
    const { connecter, get, post, compteLocal, db } = await setup()
    await compteLocal('Alice', 'alice@gmail.com', true)
    const idLocal = (await db.query<{ id: string }>('SELECT id FROM users')).rows[0].id
    const { session } = await connecter('alice')
    expect((await get('/api/me', session)).json().user).toMatchObject({ id: idLocal, pseudo: 'Alice', localLogin: true })
    expect((await db.query('SELECT 1 FROM users')).rows).toHaveLength(1)
    expect((await post('/api/auth/login', { email: 'alice@gmail.com', password: STRONG })).statusCode).toBe(200)
  })

  it('rattachement par la clé d\'adresse : points Gmail et étiquettes +… désignent le même compte', async () => {
    const { connecter, compteLocal, db } = await setup({ alice: { ...ALICE, email: 'al.ice+jeu@gmail.com' } })
    await compteLocal('Alice', 'alice@gmail.com', true)
    await connecter('alice')
    expect((await db.query('SELECT 1 FROM users')).rows).toHaveLength(1)
  })

  it('compte jamais confirmé : Google prouve l\'adresse, le mot de passe posé avant par un tiers est supprimé', async () => {
    const { connecter, post, get, compteLocal, db } = await setup()
    await compteLocal('Pirate', 'alice@gmail.com', false) // quelqu'un s'inscrit avec l'adresse d'Alice, sans pouvoir la confirmer
    const { session } = await connecter('alice') // Alice se connecte vraiment avec Google
    expect((await get('/api/me', session)).json().user).toMatchObject({ pseudo: 'Pirate', localLogin: false })
    expect((await post('/api/auth/login', { email: 'alice@gmail.com', password: STRONG })).statusCode).toBe(401) // le pirate n'entre plus
    expect((await db.query<{ email_confirmed_at: Date | null }>('SELECT email_confirmed_at FROM users')).rows[0].email_confirmed_at).not.toBeNull()
  })

  it('adresse non certifiée par Google : refus, aucun compte créé', async () => {
    const { connecter, db } = await setup({ alice: { ...ALICE, emailVerified: false } })
    const { retour, session } = await connecter('alice')
    expect(retour.headers.location).toBe('http://site.test/?auth_error=google_email')
    expect(session).toBeUndefined()
    expect((await db.query('SELECT 1 FROM users')).rows).toHaveLength(0)
  })

  it('état qui ne correspond pas, cookie absent ou échange refusé : refus, aucun compte créé', async () => {
    const { connecter, db, google } = await setup({ alice: ALICE })
    const mauvaisEtat = await connecter('alice', { state: 'autre-etat' })
    expect(mauvaisEtat.retour.headers.location).toBe('http://site.test/?auth_error=google')
    expect(mauvaisEtat.session).toBeUndefined()
    const sansCookie = await connecter('alice', { sansCookie: true })
    expect(sansCookie.retour.headers.location).toBe('http://site.test/?auth_error=google')
    expect(google.derniers).toEqual([]) // Google n'est même pas interrogé
    const refuse = await connecter('code-inconnu')
    expect(refuse.retour.headers.location).toBe('http://site.test/?auth_error=google')
    expect((await db.query('SELECT 1 FROM users')).rows).toHaveLength(0)
  })

  it('le vérificateur PKCE envoyé à Google est celui du cookie du navigateur', async () => {
    const { connecter, google } = await setup()
    const { start: s } = await connecter('alice')
    const verifier = [s.headers['set-cookie']].flat().map(String).find((x) => x.startsWith('tt_oauth='))!.split(';')[0].split('.')[1]
    expect(google.derniers.at(-1)).toEqual({ code: 'alice', verifier })
  })
})

describe('compte créé par Google : mot de passe et suppression', () => {
  it('« mot de passe oublié » permet à un compte Google de se donner un mot de passe', async () => {
    const { connecter, post, mails, get } = await setup()
    await connecter('alice')
    mails.length = 0
    await post('/api/auth/forgot', { email: 'alice@gmail.com' })
    expect(mails).toHaveLength(1)
    const token = /\?reset=([\w-]+)/.exec(mails[0].text)![1]
    expect((await post('/api/auth/reset', { token, password: STRONG })).statusCode).toBe(200)
    const l = await post('/api/auth/login', { email: 'alice@gmail.com', password: STRONG })
    expect(l.statusCode).toBe(200)
    const session = [l.headers['set-cookie']].flat().map(String).find((x) => x.startsWith('tt_session='))!.split(';')[0]
    expect((await get('/api/me', session)).json().user).toMatchObject({ provider: 'google', localLogin: true })
  })

  it('sans mot de passe, supprimer le compte est impossible ; une fois défini, la suppression efface aussi la connexion Google', async () => {
    const { connecter, post, mails, ctx, db, get } = await setup()
    const { session } = await connecter('alice')
    const id = (await get('/api/me', session)).json().user.id
    expect((await post('/api/auth/delete-account', { password: STRONG }, session)).statusCode).toBe(403)
    mails.length = 0
    await post('/api/auth/forgot', { email: 'alice@gmail.com' })
    await post('/api/auth/reset', { token: /\?reset=([\w-]+)/.exec(mails[0].text)![1], password: STRONG })
    expect(await deleteAccount(ctx, { userId: id, password: STRONG, ip: '1.1.1.1' })).toEqual({ ok: true })
    expect((await db.query('SELECT 1 FROM identities')).rows).toHaveLength(0)
    expect((await db.query('SELECT 1 FROM users')).rows).toHaveLength(0)
  })
})

describe('client Google réel (réseau simulé)', () => {
  const options = { clientId: 'cid', clientSecret: 'secret', redirectUri: 'https://site.test/api/auth/google/callback' }
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

  it('l\'adresse d\'autorisation ne demande que l\'identité (openid, e-mail), avec PKCE', () => {
    const url = new URL(createGoogleClient(options).authUrl('etat', 'defi'))
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(url.searchParams.get('scope')).toBe('openid email')
    expect(url.searchParams.get('code_challenge')).toBe('defi')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('redirect_uri')).toBe(options.redirectUri)
    expect(url.searchParams.get('client_secret')).toBeNull() // le secret ne quitte jamais le serveur
  })

  it('échange le code puis lit l\'identité ; envoie le secret et le vérificateur à Google', async () => {
    const appels: { url: string; body?: string; auth?: string }[] = []
    const client = createGoogleClient({
      ...options,
      fetchImpl: (async (url: string, init?: RequestInit) => {
        appels.push({ url, body: String(init?.body ?? ''), auth: (init?.headers as Record<string, string> | undefined)?.authorization })
        return url.includes('/token') ? json({ access_token: 'at' }) : json({ sub: 's1', email: 'a@b.fr', email_verified: true })
      }) as typeof fetch,
    })
    expect(await client.exchange('le-code', 'le-verificateur')).toEqual({ sub: 's1', email: 'a@b.fr', emailVerified: true })
    const corps = new URLSearchParams(appels[0].body)
    expect(corps.get('code')).toBe('le-code')
    expect(corps.get('code_verifier')).toBe('le-verificateur')
    expect(corps.get('client_secret')).toBe('secret')
    expect(corps.get('grant_type')).toBe('authorization_code')
    expect(appels[1].auth).toBe('Bearer at')
  })

  it('une réponse refusée, incomplète ou une panne réseau donnent null', async () => {
    const avec = (f: typeof fetch) => createGoogleClient({ ...options, fetchImpl: f }).exchange('c', 'v')
    expect(await avec((async () => json({ error: 'invalid_grant' }, 400)) as typeof fetch)).toBeNull()
    expect(await avec((async () => json({})) as typeof fetch)).toBeNull()
    expect(await avec((async (url: string) => (url.includes('/token') ? json({ access_token: 'at' }) : json({ sub: 's' }))) as typeof fetch)).toBeNull() // pas d'adresse
    expect(await avec((async () => { throw new Error('réseau') }) as typeof fetch)).toBeNull()
  })

  it('une adresse non certifiée est transmise comme telle (emailVerified faux)', async () => {
    const client = createGoogleClient({
      ...options,
      fetchImpl: (async (url: string) => (url.includes('/token') ? json({ access_token: 'at' }) : json({ sub: 's', email: 'a@b.fr', email_verified: 'true' }))) as typeof fetch,
    })
    expect((await client.exchange('c', 'v'))?.emailVerified).toBe(false) // seule la valeur booléenne vraie compte
  })
})
