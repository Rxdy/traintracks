import { afterEach, describe, expect, it } from 'vitest'
import { buildApp } from './app.js'
import { COLLECTION_TOTAL, DRAW_PRICE, drawPool, leftToWin, MAX_PER_WAGON, STARTER_TRAIN, validTrain, WAGON_DEFS, WAGON_IDS } from '../../shared/wagons.js'
import { drawWagon, setTrain, trainState } from './wagons.js'
import { mergeAnonymous } from './journey.js'
import { balance, credit } from './wallet.js'
import { closeAll, makeGame, STRONG } from './helpers.test-util.js'

afterEach(closeAll)

async function setup() {
  const c = await makeGame()
  const app = buildApp({ ...c.ctx, exportSecret: 'secret-de-test' })
  const post = (url: string, payload: object, cookie?: string) => app.inject({ method: 'POST', url, payload, headers: cookie ? { cookie } : {} })
  const get = (url: string, cookie?: string) => app.inject({ method: 'GET', url, headers: cookie ? { cookie } : {} })
  const cookieOf = (r: { headers: Record<string, unknown> }, name: string) => [r.headers['set-cookie']].flat().map(String).find((x) => x.startsWith(name + '='))?.split(';')[0]
  const compte = async (pseudo: string, email: string) => {
    expect((await post('/api/auth/register', { pseudo, email, password: STRONG })).statusCode).toBe(201)
    expect((await post('/api/auth/confirm', { token: c.tokenOf() })).statusCode).toBe(200)
    const cookie = cookieOf(await post('/api/auth/login', { email, password: STRONG }), 'tt_session')!
    const id = (await get('/api/me', cookie)).json().user.id as string
    return { cookie, id, owner: `u:${id}` }
  }
  const donner = (owner: string, n: number, ref = 'test') => credit(c.db, owner, n, 'test', ref, c.ctx.now())
  return { ...c, app, post, get, compte, donner, cookieOf }
}

describe('le catalogue des wagons', () => {
  it('des wagons courts (un type et un coloris chacun) et des wagons de fret plus longs, identifiants uniques', () => {
    const base = WAGON_DEFS.filter((w) => w.family === 'base')
    const fret = WAGON_DEFS.filter((w) => w.family === 'fret')
    expect(base.length).toBeGreaterThanOrEqual(12)
    expect(new Set(base.map((w) => w.kind)).size).toBe(base.length)
    expect(new Set(base.map((w) => w.color)).size).toBe(base.length)
    expect(new Set(WAGON_DEFS.map((w) => w.kind)).size).toBe(WAGON_DEFS.length)
    expect(base.every((w) => w.length === 1)).toBe(true)
    expect(fret.length).toBeGreaterThanOrEqual(6)
    expect(fret.every((w) => w.length >= 1.5 && w.length <= 2)).toBe(true)
    expect(new Set(WAGON_IDS).size).toBe(WAGON_IDS.length)
    expect(STARTER_TRAIN).toEqual(['ambre', 'vert', 'violet'])
  })

  it('la machine ne donne plus un wagon qu\'on a 6 fois ; le compteur dit combien il en reste à gagner', () => {
    const owned = { ambre: 6, vert: 2 }
    expect(drawPool(owned)).not.toContain('ambre')
    expect(drawPool(owned)).toContain('vert')
    expect(leftToWin({})).toBe(COLLECTION_TOTAL)
    expect(leftToWin(owned)).toBe(COLLECTION_TOTAL - 8)
    expect(drawPool(Object.fromEntries(WAGON_IDS.map((id) => [id, MAX_PER_WAGON])))).toEqual([])
  })

  it('un ordre de train : 6 wagons au plus, chacun pas plus de fois qu\'on ne l\'a', () => {
    const owned = { ambre: 2, vert: 1 }
    expect(validTrain(['ambre', 'vert', 'ambre'], owned)).toBe(true)
    expect(validTrain([], owned)).toBe(true)
    expect(validTrain(['ambre', 'ambre', 'ambre'], owned)).toBe(false) // seulement 2 ambre
    expect(validTrain(['bleu'], owned)).toBe(false) // pas à lui
    expect(validTrain(['inconnu'], { inconnu: 1 })).toBe(false)
    expect(validTrain('ambre', owned)).toBe(false)
    expect(validTrain(Array(7).fill('ambre'), { ambre: 6 })).toBe(false)
  })
})

describe('l\'état du train', () => {
  it('un joueur jamais vu a le train de départ, sans que rien ne soit écrit', async () => {
    const { db, get } = await setup()
    const st = (await get('/api/train')).json()
    expect(st).toMatchObject({ train: STARTER_TRAIN, owned: { ambre: 1, vert: 1, violet: 1 }, price: DRAW_PRICE, left: COLLECTION_TOTAL - 3, coins: 0 })
    expect((await db.query('SELECT count(*)::int AS n FROM train_layout')).rows[0].n).toBe(0)
  })
})

describe('la machine « Wagon surprise »', () => {
  it('un tirage coûte 50 pièces, donne toujours un wagon, l\'ajoute à la collection et au bout du train s\'il reste une place', async () => {
    const { db, compte, post } = await setup()
    const { cookie, owner } = await compte('Alice', 'alice@x.fr')
    const avant = await balance(db, owner)
    const r = (await post('/api/train/draw', {}, cookie)).json()
    expect(r.ok).toBe(true)
    expect(WAGON_IDS).toContain(r.wagon)
    expect(r.added).toBe(true)
    expect(r.state.coins).toBe(avant - DRAW_PRICE)
    expect(r.state.train).toEqual([...STARTER_TRAIN, r.wagon])
    expect(r.state.owned[r.wagon]).toBe(STARTER_TRAIN.includes(r.wagon) ? 2 : 1)
    expect(r.state.left).toBe(COLLECTION_TOTAL - 4)
  })

  it('sans assez de pièces : refusé (402), rien ne change', async () => {
    const { post } = await setup()
    const first = await post('/api/train/draw', {})
    expect(first.statusCode).toBe(402)
    expect(first.json()).toEqual({ ok: false, error: 'poor' })
  })

  it('le hasard choisit parmi les wagons pas encore à 6 ; train plein : le wagon va seulement dans la collection', async () => {
    const { db, ctx, donner } = await setup()
    const owner = 'a:test'
    await donner(owner, 10 * DRAW_PRICE)
    const got: string[] = []
    for (let k = 0; k < 4; k++) {
      const r = await drawWagon(db, owner, ctx.now(), () => 0) // toujours le premier de la liste encore possible
      if (!r.ok) throw new Error(r.code)
      got.push(r.wagon)
      expect(r.added).toBe(k < 3) // 3 wagons de départ + 3 places libres
    }
    expect(got).toEqual(['ambre', 'ambre', 'ambre', 'ambre'])
    const st = await trainState(db, owner)
    expect(st.owned.ambre).toBe(5)
    expect(st.train).toHaveLength(6)
    const r = await drawWagon(db, owner, ctx.now(), () => 0)
    expect(r.ok && r.wagon).toBe('ambre') // le 6e
    const r2 = await drawWagon(db, owner, ctx.now(), () => 0)
    expect(r2.ok && r2.wagon).toBe('vert') // l'ambre est complet : il ne sort plus
  })

  it('collection complète : la machine le dit et ne prend pas de pièces', async () => {
    const { db, ctx, donner } = await setup()
    const owner = 'a:complet'
    await donner(owner, 1000)
    await trainState(db, owner)
    await setTrain(db, owner, [], ctx.now())
    for (const id of WAGON_IDS) await db.query('INSERT INTO wagons_owned (owner, wagon, qty) VALUES ($1,$2,6) ON CONFLICT (owner, wagon) DO UPDATE SET qty = 6', [owner, id])
    expect(await drawWagon(db, owner, ctx.now())).toEqual({ ok: false, code: 'complete' })
    expect(await balance(db, owner)).toBe(1000)
    expect((await trainState(db, owner)).left).toBe(0)
  })
})

describe('l\'ordre du train', () => {
  it('on range ses wagons dans l\'ordre voulu ; un wagon qu\'on n\'a pas ou en trop est refusé', async () => {
    const { compte, post, get } = await setup()
    const { cookie } = await compte('Alice', 'alice@x.fr')
    const ok = await post('/api/train/layout', { cars: ['violet', 'ambre'] }, cookie)
    expect(ok.statusCode).toBe(200)
    expect(ok.json().state.train).toEqual(['violet', 'ambre'])
    expect((await get('/api/train', cookie)).json().train).toEqual(['violet', 'ambre'])
    expect((await post('/api/train/layout', { cars: ['violet', 'violet'] }, cookie)).statusCode).toBe(400)
    expect((await post('/api/train/layout', { cars: ['bleu'] }, cookie)).statusCode).toBe(400)
    expect((await post('/api/train/layout', { cars: 'ambre' }, cookie)).statusCode).toBe(400)
    expect((await get('/api/train', cookie)).json().train).toEqual(['violet', 'ambre'])
  })
})

describe('les 3 trains enregistrés', () => {
  it('au départ, les 3 sont le train de départ ; on en range un autre sans toucher à celui qui roule, puis on le fait rouler', async () => {
    const { compte, post, get } = await setup()
    const { cookie } = await compte('Alice', 'alice@x.fr')
    const st0 = (await get('/api/train', cookie)).json()
    expect(st0.presets).toEqual([STARTER_TRAIN, STARTER_TRAIN, STARTER_TRAIN])
    expect(st0.active).toBe(0)
    const r = (await post('/api/train/layout', { cars: ['violet'], slot: 2 }, cookie)).json()
    expect(r.state.presets[2]).toEqual(['violet'])
    expect(r.state.train).toEqual(STARTER_TRAIN) // le n° 1 roule toujours
    const a = (await post('/api/train/active', { slot: 2 }, cookie)).json()
    expect(a.state).toMatchObject({ active: 2, train: ['violet'] })
    // ranger sans emplacement : celui qui roule (ici le n° 3)
    const b = (await post('/api/train/layout', { cars: ['vert', 'violet'] }, cookie)).json()
    expect(b.state.presets).toEqual([STARTER_TRAIN, STARTER_TRAIN, ['vert', 'violet']])
    expect(b.state.train).toEqual(['vert', 'violet'])
    expect((await post('/api/train/active', { slot: 3 }, cookie)).statusCode).toBe(400)
    expect((await post('/api/train/layout', { cars: [], slot: -1 }, cookie)).statusCode).toBe(400)
  })

  it('un wagon gagné va au bout du train qui roule, et dans son emplacement', async () => {
    const { db, ctx, donner } = await setup()
    const owner = 'a:presets'
    await donner(owner, DRAW_PRICE)
    await trainState(db, owner)
    await setTrain(db, owner, ['vert'], ctx.now(), 1)
    await db.query('UPDATE train_layout SET active = 1, cars = presets -> 1 WHERE owner = $1', [owner])
    const r = await drawWagon(db, owner, ctx.now(), () => 0)
    if (!r.ok) throw new Error(r.code)
    expect(r.state.train).toEqual(['vert', 'ambre'])
    expect(r.state.presets[1]).toEqual(['vert', 'ambre'])
    expect(r.state.presets[0]).toEqual(STARTER_TRAIN)
  })
})

describe('un invité qui se connecte', () => {
  it('garde ses wagons gagnés (additionnés, 6 au plus) ; le compte garde son ordre de train', async () => {
    const { db, ctx, donner, compte } = await setup()
    const { owner, id } = await compte('Alice', 'alice@x.fr')
    await setTrain(db, owner, ['vert'], ctx.now())
    const anon = '11111111-1111-4111-8111-111111111111'
    await donner(`a:${anon}`, 2 * DRAW_PRICE, 'invite')
    await drawWagon(db, `a:${anon}`, ctx.now(), () => 0)
    await drawWagon(db, `a:${anon}`, ctx.now(), () => 0)
    await mergeAnonymous(db, anon, id)
    const st = await trainState(db, owner)
    expect(st.owned.ambre).toBe(4) // 1 (départ du compte) + 1 (départ de l'invité) + 2 gagnés par l'invité
    expect(st.train).toEqual(['vert'])
    expect((await db.query('SELECT count(*)::int AS n FROM wagons_owned WHERE owner = $1', [`a:${anon}`])).rows[0].n).toBe(0)
  })
})
