import { afterEach, describe, expect, it } from 'vitest'
import { buildApp } from './app.js'
import { AVATARS, AVATAR_IDS, FREE_AVATARS, avatarOf } from '../../shared/avatars.js'
import { deleteAccount } from './auth.js'
import { balance, credit } from './wallet.js'
import { closeAll, edgesOf, makeGame, STRONG } from './helpers.test-util.js'

afterEach(closeAll)

async function setup() {
  const c = await makeGame()
  const app = buildApp({ ...c.ctx, exportSecret: 'secret-de-test' })
  const post = (url: string, payload: object, cookie?: string) => app.inject({ method: 'POST', url, payload, headers: cookie ? { cookie } : {} })
  const get = (url: string, cookie?: string) => app.inject({ method: 'GET', url, headers: cookie ? { cookie } : {} })
  const cookieOf = (r: { headers: Record<string, unknown> }) => [r.headers['set-cookie']].flat().map(String).find((x) => x.startsWith('tt_session='))?.split(';')[0]!
  const compte = async (pseudo: string, email: string) => {
    expect((await post('/api/auth/register', { pseudo, email, password: STRONG })).statusCode).toBe(201)
    expect((await post('/api/auth/confirm', { token: c.tokenOf() })).statusCode).toBe(200)
    const cookie = cookieOf(await post('/api/auth/login', { email, password: STRONG }))
    const id = (await get('/api/me', cookie)).json().user.id as string
    return { cookie, id }
  }
  const donner = (id: string, n: number, ref = 'test') => credit(c.db, `u:${id}`, n, 'test', ref, c.ctx.now())
  return { ...c, app, post, get, compte, donner }
}

describe('la liste des avatars', () => {
  it('40 avatars uniques, 8 gratuits, des prix par paliers', () => {
    expect(AVATARS).toHaveLength(40)
    expect(new Set(AVATAR_IDS).size).toBe(40)
    expect(FREE_AVATARS).toHaveLength(8)
    expect(new Set(AVATARS.map((a) => a.price))).toEqual(new Set([0, 150, 300, 500]))
    expect(avatarOf('inconnu')).toBeUndefined()
    expect(avatarOf({ id: 'loco' })).toBeUndefined() // seulement un identifiant texte connu
  })
})

describe('avatar d\'un compte', () => {
  it('un nouveau compte reçoit un avatar gratuit, visible dans /api/me, et ne possède encore rien d\'acheté', async () => {
    const { compte, get } = await setup()
    const { cookie } = await compte('Alice', 'alice@x.fr')
    const me = (await get('/api/me', cookie)).json().user
    expect(FREE_AVATARS).toContain(me.avatar)
    const st = (await get('/api/avatars', cookie)).json()
    expect(st).toEqual({ current: me.avatar, owned: [], coins: 100 })
  })

  it('il faut être connecté', async () => {
    const { get, post } = await setup()
    expect((await get('/api/avatars')).statusCode).toBe(401)
    expect((await post('/api/avatars/buy', { id: 'cerf' })).statusCode).toBe(401)
    expect((await post('/api/avatars/select', { id: 'loco' })).statusCode).toBe(401)
  })
})

describe('choisir un avatar', () => {
  it('un gratuit se choisit librement', async () => {
    const { compte, post, get } = await setup()
    const { cookie } = await compte('Alice', 'alice@x.fr')
    const r = await post('/api/avatars/select', { id: 'canard' }, cookie)
    expect(r.statusCode).toBe(200)
    expect(r.json()).toMatchObject({ ok: true, current: 'canard' })
    expect((await get('/api/me', cookie)).json().user.avatar).toBe('canard')
  })

  it('un payant qu\'on n\'a pas acheté est refusé ; un identifiant inconnu aussi', async () => {
    const { compte, post, get } = await setup()
    const { cookie } = await compte('Alice', 'alice@x.fr')
    const avant = (await get('/api/me', cookie)).json().user.avatar
    expect((await post('/api/avatars/select', { id: 'loup' }, cookie)).statusCode).toBe(403)
    expect((await post('/api/avatars/select', { id: 'nimporte-quoi' }, cookie)).statusCode).toBe(400)
    expect((await post('/api/avatars/select', { id: ['loup'] }, cookie)).statusCode).toBe(400)
    expect((await post('/api/avatars/select', {}, cookie)).statusCode).toBe(400)
    expect((await get('/api/me', cookie)).json().user.avatar).toBe(avant) // rien n'a changé
  })
})

describe('acheter un avatar', () => {
  it('pas assez de pièces : refusé, rien n\'est débité ni acquis', async () => {
    const { compte, post, get, db } = await setup()
    const { cookie, id } = await compte('Alice', 'alice@x.fr') // 100 pièces, le moins cher coûte 150
    const r = await post('/api/avatars/buy', { id: 'ecureuil' }, cookie)
    expect(r.statusCode).toBe(402)
    expect(r.json()).toEqual({ error: 'poor' })
    expect(await balance(db, `u:${id}`)).toBe(100)
    expect((await get('/api/avatars', cookie)).json().owned).toEqual([])
  })

  it('assez de pièces : le prix exact est débité, l\'avatar est à moi, je peux le choisir', async () => {
    const { compte, post, get, donner, db } = await setup()
    const { cookie, id } = await compte('Alice', 'alice@x.fr')
    await donner(id, 450) // 100 + 450 = 550
    const r = await post('/api/avatars/buy', { id: 'loup' }, cookie) // 500
    expect(r.statusCode).toBe(200)
    expect(r.json()).toMatchObject({ ok: true, owned: ['loup'], coins: 50 })
    expect(await balance(db, `u:${id}`)).toBe(50)
    expect((await post('/api/avatars/select', { id: 'loup' }, cookie)).json()).toMatchObject({ current: 'loup' })
    expect((await get('/api/me', cookie)).json().user.avatar).toBe('loup')
  })

  it('acheter deux fois le même avatar : refusé la seconde fois, sans nouveau débit', async () => {
    const { compte, post, donner, db } = await setup()
    const { cookie, id } = await compte('Alice', 'alice@x.fr')
    await donner(id, 900)
    expect((await post('/api/avatars/buy', { id: 'cerf' }, cookie)).statusCode).toBe(200) // 300
    const second = await post('/api/avatars/buy', { id: 'cerf' }, cookie)
    expect(second.statusCode).toBe(409)
    expect(second.json()).toEqual({ error: 'owned' })
    expect(await balance(db, `u:${id}`)).toBe(700)
  })

  it('deux clics en même temps : un seul achat, un seul débit', async () => {
    const { compte, post, donner, db } = await setup()
    const { cookie, id } = await compte('Alice', 'alice@x.fr')
    await donner(id, 900) // 1000 pièces
    const [a, b] = await Promise.all([post('/api/avatars/buy', { id: 'aigle' }, cookie), post('/api/avatars/buy', { id: 'aigle' }, cookie)])
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409])
    expect(await balance(db, `u:${id}`)).toBe(700)
    expect((await db.query('SELECT 1 FROM avatars_owned WHERE user_id = $1', [id])).rows).toHaveLength(1)
  })

  it('un avatar gratuit ne s\'achète pas ; un identifiant inconnu non plus', async () => {
    const { compte, post } = await setup()
    const { cookie } = await compte('Alice', 'alice@x.fr')
    expect((await post('/api/avatars/buy', { id: 'loco' }, cookie)).json()).toEqual({ error: 'free' })
    expect((await post('/api/avatars/buy', { id: 'inconnu' }, cookie)).json()).toEqual({ error: 'invalid' })
    expect((await post('/api/avatars/buy', { id: 42 }, cookie)).json()).toEqual({ error: 'invalid' })
  })

  it('les avatars achetés sont à un seul compte', async () => {
    const { compte, post, get, donner } = await setup()
    const a = await compte('Alice', 'alice@x.fr')
    const b = await compte('Bob', 'bob@x.fr')
    await donner(a.id, 200)
    await post('/api/avatars/buy', { id: 'hibou' }, a.cookie)
    expect((await get('/api/avatars', b.cookie)).json().owned).toEqual([])
    expect((await post('/api/avatars/select', { id: 'hibou' }, b.cookie)).statusCode).toBe(403)
  })
})

describe('avatars et suppression de compte, classement', () => {
  it('supprimer le compte efface aussi ses avatars achetés', async () => {
    const { compte, post, donner, db, ctx } = await setup()
    const { cookie, id } = await compte('Alice', 'alice@x.fr')
    await donner(id, 300)
    await post('/api/avatars/buy', { id: 'cerf' }, cookie)
    expect((await db.query('SELECT 1 FROM avatars_owned')).rows).toHaveLength(1)
    expect(await deleteAccount(ctx, { userId: id, password: STRONG, ip: '1.1.1.1' })).toEqual({ ok: true })
    expect((await db.query('SELECT 1 FROM avatars_owned')).rows).toHaveLength(0)
  })

  it('le classement montre l\'avatar choisi à côté du pseudo', async () => {
    const { compte, post, get, clock } = await setup()
    const { cookie } = await compte('Alice', 'alice@x.fr')
    await post('/api/avatars/select', { id: 'chat' }, cookie)
    await post('/api/journey/start', {}, cookie)
    clock.t += 20_000
    expect((await post('/api/journey/submit', { level: 1, edges: edgesOf(1) }, cookie)).statusCode).toBe(200)
    const board = (await get('/api/leaderboard?board=voyage', cookie)).json()
    expect(board.entries).toHaveLength(1)
    expect(board.entries[0]).toMatchObject({ pseudo: 'Alice', avatar: 'chat' })
  })
})
