import { describe, it, expect } from 'vitest'
import { buildApp } from './app.js'
import { edgesOf, makeGame, STRONG } from './helpers.test-util.js'
import { makeCtx } from './helpers.test-util.js'
import { register } from './auth.js'
import { changePseudo } from './accountData.js'

async function setup() {
  const c = await makeGame()
  const app = buildApp({ ...c.ctx, exportSecret: 'secret-de-test' })
  const post = (url: string, payload: object, cookie?: string) => app.inject({ method: 'POST', url, payload, headers: cookie ? { cookie } : {} })
  const get = (url: string, cookie?: string) => app.inject({ method: 'GET', url, headers: cookie ? { cookie } : {} })
  const cookieOf = (r: { headers: Record<string, unknown> }) => [r.headers['set-cookie']].flat().map(String).find((x) => x.startsWith('tt_session='))?.split(';')[0]!
  // crée un compte confirmé et connecté
  const account = async (pseudo: string, email: string) => {
    expect((await post('/api/auth/register', { pseudo, email, password: STRONG })).statusCode).toBe(201)
    expect((await post('/api/auth/confirm', { token: c.tokenOf() })).statusCode).toBe(200)
    const r = await post('/api/auth/login', { email, password: STRONG })
    expect(r.statusCode).toBe(200)
    return cookieOf(r)
  }
  const play = async (cookie: string, levels: number[]) => {
    for (const l of levels) {
      await post('/api/journey/start', {}, cookie)
      c.clock.t += 20_000
      expect((await post('/api/journey/submit', { level: l, edges: edgesOf(l) }, cookie)).statusCode).toBe(200)
    }
  }
  return { ...c, app, post, get, account, play }
}

describe('changer d\'adresse e-mail', () => {
  it('mot de passe exigé, lien envoyé à la NOUVELLE boîte, l\'ancienne est prévenue, l\'adresse ne change qu\'à la confirmation', async () => {
    const { post, get, account, mails } = await setup()
    const a = await account('Alice', 'alice@x.fr')
    expect((await post('/api/account/email', { email: 'neuve@x.fr', password: 'mauvais' }, a)).statusCode).toBe(403)
    expect((await post('/api/account/email', { email: 'pas-une-adresse', password: STRONG }, a)).statusCode).toBe(400)
    expect((await post('/api/account/email', { email: 'ALICE+jeu@x.fr', password: STRONG }, a)).json()).toEqual({ error: 'same' })
    mails.length = 0
    expect((await post('/api/account/email', { email: 'Neuve@X.fr', password: STRONG }, a)).json()).toEqual({ ok: true })
    expect(mails.map((m) => m.to).sort()).toEqual(['alice@x.fr', 'neuve@x.fr'])
    const link = mails.find((m) => m.to === 'neuve@x.fr')!
    expect(link.text).toMatch(/\?email-change=/)
    expect((await get('/api/me', a)).json().user.email).toBe('alice@x.fr') // pas encore changée
    const token = /\?email-change=([\w-]+)/.exec(link.text)![1]
    expect((await post('/api/account/email/confirm', { token })).json()).toEqual({ ok: true })
    expect((await get('/api/me', a)).json().user.email).toBe('neuve@x.fr')
    expect(mails.at(-1)!.to).toBe('alice@x.fr') // l'ancienne adresse est prévenue
    // le lien ne sert qu'une fois ; l'ancienne adresse ne connecte plus, la nouvelle oui
    expect((await post('/api/account/email/confirm', { token })).statusCode).toBe(400)
    expect((await post('/api/auth/login', { email: 'alice@x.fr', password: STRONG })).statusCode).toBe(401)
    expect((await post('/api/auth/login', { email: 'neuve@x.fr', password: STRONG })).statusCode).toBe(200)
  })
  it('une adresse déjà prise (même écrite autrement) est refusée ; lien expiré refusé ; sans connexion 401', async () => {
    const { post, account, clock, mails } = await setup()
    const a = await account('Alice', 'alice@x.fr')
    await account('Bob', 'bob@gmail.com')
    expect((await post('/api/account/email', { email: 'b.o.b+x@gmail.com', password: STRONG }, a)).json()).toEqual({ error: 'email_taken' })
    expect((await post('/api/account/email', { email: 'a2@x.fr', password: STRONG })).statusCode).toBe(401)
    await post('/api/account/email', { email: 'a2@x.fr', password: STRONG }, a)
    const token = /\?email-change=([\w-]+)/.exec(mails.find((m) => m.to === 'a2@x.fr')!.text)![1]
    clock.t += 2 * 3600_000
    expect((await post('/api/account/email/confirm', { token })).statusCode).toBe(400)
  })
  it('une seule demande en cours : la plus récente annule la précédente', async () => {
    const { post, account, mails } = await setup()
    const a = await account('Alice', 'alice@x.fr')
    await post('/api/account/email', { email: 'un@x.fr', password: STRONG }, a)
    const t1 = /\?email-change=([\w-]+)/.exec(mails.find((m) => m.to === 'un@x.fr')!.text)![1]
    await post('/api/account/email', { email: 'deux@x.fr', password: STRONG }, a)
    expect((await post('/api/account/email/confirm', { token: t1 })).statusCode).toBe(400)
  })
})

describe('export et import des données', () => {
  it('export signé : le profil, la progression, le puzzle du jour, les pièces ; réservé aux comptes', async () => {
    const { get, account, play } = await setup()
    expect((await get('/api/account/export')).statusCode).toBe(401)
    const a = await account('Alice', 'alice@x.fr')
    await play(a, [1, 2])
    const r = await get('/api/account/export', a)
    expect(r.headers['content-disposition']).toMatch(/attachment/)
    const f = r.json()
    expect(f).toMatchObject({ format: 'traintracks-export', version: 1, account: { pseudo: 'Alice', email: 'alice@x.fr' } })
    expect(f.journey.map((j: { level: number }) => j.level)).toEqual([1, 2])
    expect(f.wallet.coins).toBeGreaterThan(100)
    expect(f.signature).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(f)).not.toMatch(/password|hash|solution/i)
  })
  it('import : la progression passe sur un autre compte (meilleur temps gardé), pièces non copiées, un fichier = une fois', async () => {
    const { post, get, account, play } = await setup()
    const a = await account('Alice', 'alice@x.fr')
    await play(a, [1, 2, 3])
    const file = (await get('/api/account/export', a)).json()
    const b = await account('Bob', 'bob@x.fr')
    expect((await get('/api/journey', b)).json().level).toBe(1)
    const coinsBefore = (await get('/api/aids', b)).json().coins
    const r = await post('/api/account/import', file, b)
    expect(r.json()).toMatchObject({ ok: true, levels: 3 })
    expect((await get('/api/journey', b)).json().level).toBe(4)
    expect((await get('/api/aids', b)).json().coins).toBe(coinsBefore) // pas de pièces importées
    // le même fichier ne s'importe pas deux fois, ni chez Bob ni chez quelqu'un d'autre
    expect((await post('/api/account/import', file, b)).statusCode).toBe(409)
    const c = await account('Carl', 'carl@x.fr')
    expect((await post('/api/account/import', file, c)).statusCode).toBe(409)
    expect((await get('/api/journey', c)).json().level).toBe(1)
  })
  it('import : fichier modifié à la main (progression inventée) refusé, fichier mal formé refusé', async () => {
    const { post, get, account, play } = await setup()
    const a = await account('Alice', 'alice@x.fr')
    await play(a, [1])
    const file = (await get('/api/account/export', a)).json()
    const b = await account('Bob', 'bob@x.fr')
    const cheat = { ...file, journey: [...file.journey, { level: 2, timeMs: 1000, solvedAt: file.journey[0].solvedAt }] }
    expect((await post('/api/account/import', cheat, b)).json()).toEqual({ error: 'bad_signature' })
    expect((await post('/api/account/import', { ...file, signature: '00'.repeat(32) }, b)).statusCode).toBe(403)
    expect((await post('/api/account/import', { format: 'autre' }, b)).statusCode).toBe(400)
    expect((await post('/api/account/import', { ...file, journey: [{ level: 'x' }] }, b)).statusCode).toBe(400)
    expect((await get('/api/journey', b)).json().level).toBe(1)
  })
  it('import dans le MÊME compte : on garde toujours le meilleur temps, jamais de recul', async () => {
    const { post, get, account, play, db } = await setup()
    const a = await account('Alice', 'alice@x.fr')
    await play(a, [1])
    const file = (await get('/api/account/export', a)).json()
    await db.query("UPDATE progress SET time_ms = 999999 WHERE level = 1") // son temps actuel est devenu moins bon
    await post('/api/account/import', file, a)
    expect((await db.query<{ time_ms: number }>('SELECT time_ms FROM progress WHERE level = 1')).rows[0].time_ms).toBe(file.journey[0].timeMs)
    // et l'inverse : un temps plus lent dans le fichier n'écrase pas un meilleur temps
    await db.query("UPDATE progress SET time_ms = 1 WHERE level = 1")
    const f2 = (await get('/api/account/export', a)).json()
    await db.query("DELETE FROM imports")
    await post('/api/account/import', f2, a)
    expect((await db.query<{ time_ms: number }>('SELECT time_ms FROM progress WHERE level = 1')).rows[0].time_ms).toBe(1)
  })
})

describe('statistiques et classements', () => {
  it('statistiques du Voyage : niveaux faits, temps, records, par taille de grille, pièces', async () => {
    const { get, account, play } = await setup()
    const a = await account('Alice', 'alice@x.fr')
    await play(a, [1, 2, 3])
    const s = (await get('/api/stats', a)).json().journey
    expect(s).toMatchObject({ level: 4, solved: 3 })
    expect(s.totalTimeMs).toBeGreaterThan(0)
    expect(s.fastest.timeMs).toBeLessThanOrEqual(s.slowest.timeMs)
    expect(s.bySize.reduce((n: number, x: { count: number }) => n + x.count, 0)).toBe(3)
    expect(s.coinsEarned).toBeGreaterThanOrEqual(100)
    expect(s.coins).toBeGreaterThan(100)
  })
  it('classement du Voyage : plus haut niveau d\'abord, ma place même hors du top, public en lecture', async () => {
    const { get, post, account, play } = await setup()
    const a = await account('Alice', 'alice@x.fr')
    const b = await account('Bob', 'bob@x.fr')
    const c = await account('Carl', 'carl@x.fr')
    await play(a, [1, 2, 3])
    await play(b, [1])
    await play(c, [1, 2, 3]) // Carl atteint le niveau 3 après Alice : derrière elle
    const pub = (await get('/api/leaderboard?board=voyage')).json()
    expect(pub.entries.map((e: { pseudo: string; value: number }) => [e.pseudo, e.value])).toEqual([['Alice', 3], ['Carl', 3], ['Bob', 1]])
    expect(pub.me).toBeNull()
    expect(pub.entries.every((e: { me: boolean }) => !e.me)).toBe(true)
    const mine = (await get('/api/leaderboard?board=voyage', b)).json()
    expect(mine.me).toMatchObject({ rank: 3, value: 1, pseudo: 'Bob' }) // ma ligne complète, montrée sous les 10 premiers
    expect(mine.entries.find((e: { pseudo: string }) => e.pseudo === 'Bob').me).toBe(true)
    expect(JSON.stringify(pub)).not.toMatch(/@|email|id"/)
    // Alice se masque : elle disparaît du classement
    expect((await post('/api/account/leaderboard', { visible: false }, a)).json()).toEqual({ ok: true, visible: false })
    expect((await get('/api/me', a)).json().user.leaderboard).toBe(false)
    const after = (await get('/api/leaderboard?board=voyage', b)).json()
    expect(after.entries.map((e: { pseudo: string }) => e.pseudo)).toEqual(['Carl', 'Bob'])
    expect((await get('/api/leaderboard?board=voyage', a)).json().me).toBeNull()
    expect((await post('/api/account/leaderboard', { visible: 'oui' }, a)).statusCode).toBe(400)
    expect((await get('/api/leaderboard?board=nimporte')).statusCode).toBe(400)
  })
  it('hors du top 10 : les 2 joueurs juste devant moi et les 2 juste derrière, jamais ceux déjà dans le top', async () => {
    const { get, account, play } = await setup()
    const ps: string[] = []
    for (let k = 0; k < 14; k++) {
      const p = await account('Joueur' + k, `j${k}@x.fr`)
      await play(p, [1]) // tous au niveau 1 : départagés par l'heure d'arrivée, Joueur0 premier
      ps.push(p)
    }
    const names = (b: { around: { pseudo: string; rank: number; me: boolean }[] }) => b.around.map((e) => [e.rank, e.pseudo, e.me])
    const far = (await get('/api/leaderboard?board=voyage', ps[12]!)).json()
    expect(far.entries).toHaveLength(10)
    expect(names(far)).toEqual([[11, 'Joueur10', false], [12, 'Joueur11', false], [13, 'Joueur12', true], [14, 'Joueur13', false]])
    const edge = (await get('/api/leaderboard?board=voyage', ps[10]!)).json()
    expect(names(edge)).toEqual([[11, 'Joueur10', true], [12, 'Joueur11', false], [13, 'Joueur12', false]])
    expect((await get('/api/leaderboard?board=voyage', ps[3]!)).json().around).toEqual([]) // dans le top 10
    expect((await get('/api/leaderboard?board=voyage')).json().around).toEqual([]) // pas connecté
  })
  it('classement du jour : les temps du jour, du plus rapide au plus lent ; série en cours', async () => {
    const { get, post, account, clock, db } = await setup()
    const a = await account('Alice', 'alice@x.fr')
    const b = await account('Bob', 'bob@x.fr')
    const today = (await get('/api/daily', a)).json().date ?? new Date(clock.t).toISOString().slice(0, 10)
    const ids = (await db.query<{ id: string; pseudo: string }>('SELECT id, pseudo FROM users')).rows
    const idOf = (p: string) => ids.find((x) => x.pseudo === p)!.id
    const day = new Date(clock.t).toISOString().slice(0, 10)
    const prev = new Date(clock.t - 86_400_000).toISOString().slice(0, 10)
    await db.query("INSERT INTO daily_results (owner, date, time_ms, solved_at) VALUES ($1,$2,90000,now()),($3,$2,60000,now()),($1,$4,50000,now())", [`u:${idOf('Alice')}`, day, `u:${idOf('Bob')}`, prev])
    const j = (await get('/api/leaderboard?board=jour', a)).json()
    expect(j.entries.map((e: { pseudo: string; value: number }) => [e.pseudo, e.value])).toEqual([['Bob', 60000], ['Alice', 90000]])
    expect(j.me).toMatchObject({ rank: 2, value: 90000 })
    const s = (await get('/api/leaderboard?board=serie', a)).json()
    expect(s.entries[0]).toMatchObject({ pseudo: 'Alice', value: 2 }) // hier + aujourd'hui
    expect(s.entries[1]).toMatchObject({ pseudo: 'Bob', value: 1 })
    void post; void b; void today
  })
  it('classement des séries : le record reste après une série perdue, jusqu\'à ce qu\'il soit dépassé', async () => {
    const { get, account, clock, db } = await setup()
    const a = await account('Alice', 'alice@x.fr')
    const b = await account('Bob', 'bob@x.fr')
    const ids = (await db.query<{ id: string; pseudo: string }>('SELECT id, pseudo FROM users')).rows
    const own = (p: string) => `u:${ids.find((x) => x.pseudo === p)!.id}`
    const ago = (n: number) => new Date(clock.t - n * 86_400_000).toISOString().slice(0, 10)
    // Alice : 4 jours de suite il y a 10 à 7 jours, puis rien depuis (série perdue). Bob : 2 jours d'affilée jusqu'à aujourd'hui.
    for (const n of [10, 9, 8, 7]) await db.query('INSERT INTO daily_results (owner, date, time_ms, solved_at) VALUES ($1,$2,1000,now())', [own('Alice'), ago(n)])
    for (const n of [1, 0]) await db.query('INSERT INTO daily_results (owner, date, time_ms, solved_at) VALUES ($1,$2,1000,now())', [own('Bob'), ago(n)])
    let s = (await get('/api/leaderboard?board=serie', a)).json()
    expect(s.entries.map((e: { pseudo: string; value: number }) => [e.pseudo, e.value])).toEqual([['Alice', 4], ['Bob', 2]])
    expect(s.me).toMatchObject({ rank: 1, value: 4 })
    // Bob dépasse Alice : son score remplace l'ancien rang d'Alice.
    for (const n of [2, 3, 4]) await db.query('INSERT INTO daily_results (owner, date, time_ms, solved_at) VALUES ($1,$2,1000,now())', [own('Bob'), ago(n)])
    s = (await get('/api/leaderboard?board=serie', b)).json()
    expect(s.entries.map((e: { pseudo: string; value: number }) => [e.pseudo, e.value])).toEqual([['Bob', 5], ['Alice', 4]])
  })
})

describe('changer de pseudo', () => {
  it('tout compte peut changer de pseudo ; règles de l\'inscription ; pas de doublon (sans tenir compte des majuscules)', async () => {
    const { ctx, db } = await makeCtx()
    const id = (pseudo: string) => db.query<{ id: string }>('SELECT id FROM users WHERE pseudo = $1', [pseudo]).then((r) => r.rows[0].id)
    for (const [p, e] of [['Alice', 'alice@x.fr'], ['Bob', 'bob@x.fr']]) await register(ctx, { pseudo: p, email: e, password: STRONG })
    const a = await id('Alice')
    expect(await changePseudo(ctx, a, '  Cheminote_42 ')).toEqual({ ok: true, pseudo: 'Cheminote_42' })
    expect((await db.query('SELECT pseudo, pseudo_key FROM users WHERE id = $1', [a])).rows[0]).toEqual({ pseudo: 'Cheminote_42', pseudo_key: 'cheminote_42' })
    expect(await changePseudo(ctx, a, 'bob')).toEqual({ ok: false, code: 'pseudo_taken' })
    expect(await changePseudo(ctx, a, 'x')).toEqual({ ok: false, code: 'invalid' })
    expect(await changePseudo(ctx, a, 'avec espace')).toEqual({ ok: false, code: 'invalid' })
    expect(await changePseudo(ctx, a, 'CHEMINOTE_42')).toEqual({ ok: true, pseudo: 'CHEMINOTE_42' }) // le sien, autre casse : permis
  })
})
