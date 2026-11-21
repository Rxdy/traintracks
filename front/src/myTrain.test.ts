import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import MyTrain from './components/MyTrain.vue'
import WagonMachine from './components/WagonMachine.vue'
import TrainRun from './components/TrainRun.vue'
import { myTrain, trainWagons, freeCount, setTrain } from './myTrain'
import { carOffsets, CAR_SPACING, styleOf, STARTER, trainTail, wagonLabel } from './trainStyle'
import { coins } from './wallet'
import { COLLECTION_TOTAL, DRAW_PRICE, STARTER_TRAIN, WAGON_DEFS } from '../../shared/wagons.js'
import type { Route } from './trainRoute'

enableAutoUnmount(afterEach)
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function route(table: Record<string, { status: number; body?: object }>) {
  const calls: { key: string; body?: unknown }[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${url}`
    calls.push({ key, body: init?.body ? JSON.parse(String(init.body)) : undefined })
    const r = table[key] ?? { status: 404 }
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status })
  }))
  return calls
}
const state = (owned: Record<string, number>, train: string[]) => ({ owned, train, left: COLLECTION_TOTAL - Object.values(owned).reduce((a, b) => a + b, 0), price: DRAW_PRICE, coins: 120 })

beforeEach(() => {
  myTrain.value = { owned: { ambre: 1, vert: 1, violet: 1 }, train: [...STARTER_TRAIN], left: COLLECTION_TOTAL - 3, price: DRAW_PRICE }
  coins.value = 120
})

describe('la longueur du train', () => {
  it('le train de départ garde ses écarts d\'avant (0,62 case entre deux voitures)', () => {
    expect(carOffsets(STARTER)).toEqual([0, CAR_SPACING, 2 * CAR_SPACING, 3 * CAR_SPACING].map((x) => expect.closeTo(x, 9)))
    expect(trainTail(STARTER)).toBeCloseTo(3 * CAR_SPACING, 9)
  })

  it('un wagon de fret est plus long : le train s\'allonge, il compte pourtant pour une seule place', () => {
    const fret = WAGON_DEFS.find((w) => w.length === 2)!
    const off = carOffsets([fret, styleOf('vert')])
    expect(off[1]! - off[0]!).toBeCloseTo((CAR_SPACING + 2 * CAR_SPACING) / 2, 9)
    expect(off[2]! - off[1]!).toBeCloseTo((2 * CAR_SPACING + CAR_SPACING) / 2, 9)
    expect(trainTail([fret, styleOf('vert')])).toBeGreaterThan(trainTail([styleOf('ambre'), styleOf('vert')]))
  })

  it('dans le Trajet, le train qui roule est celui du joueur', () => {
    myTrain.value = { ...myTrain.value, owned: { ...myTrain.value.owned, grumes: 1 }, train: ['grumes', 'vert'] }
    const r = { points: [{ x: -2, y: 0.5 }, { x: 8, y: 0.5 }], cum: [0, 10], length: 10 } as unknown as Route
    const w = mount(TrainRun, { props: { route: r, size: 4 } })
    expect(w.props('wagons')!.map((x: { id: string }) => x.id)).toEqual(['grumes', 'vert'])
  })

  it('les noms dits au joueur', () => {
    expect(wagonLabel('ambre')).toBe('fourgon à bagages ambre')
    expect(wagonLabel('vaches')).toBe('wagon à bétail (vaches)')
  })
})

describe('Mon train', () => {
  it('affiche le train, la collection en n/6 et le nombre de wagons encore à gagner', async () => {
    route({ 'GET /api/train': { status: 200, body: state({ ambre: 2, vert: 1, violet: 1 }, ['ambre', 'vert']) } })
    const w = mount(MyTrain)
    await flushPromises()
    expect(w.find('[data-test=train-car-0]').exists()).toBe(true)
    expect(w.find('[data-test=train-car-1]').exists()).toBe(true)
    expect(w.find('[data-test=train-slot-2]').exists()).toBe(true)
    expect(w.find('[data-test=coll-ambre] [data-test=coll-count]').text()).toBe('2/6')
    expect(w.find('[data-test=coll-bleu] [data-test=coll-count]').text()).toBe('0/6')
    expect(w.find('[data-test=coll-bleu]').attributes('disabled')).toBeDefined()
    expect(w.find('[data-test=train-left]').text()).toBe(`Encore ${COLLECTION_TOTAL - 4} wagons à gagner`)
  })

  it('toucher un wagon de la collection l\'ajoute au bout ; ✕ le range ; deux touchers échangent l\'ordre', async () => {
    const calls = route({
      'GET /api/train': { status: 200, body: state({ ambre: 2, vert: 1, violet: 1 }, ['ambre', 'vert', 'violet']) },
      'POST /api/train/layout': { status: 200, body: { ok: true, state: state({ ambre: 2, vert: 1, violet: 1 }, ['ambre']) } },
    })
    const w = mount(MyTrain)
    await flushPromises()
    await w.find('[data-test=coll-ambre]').trigger('click')
    await flushPromises()
    expect(calls.at(-1)).toEqual({ key: 'POST /api/train/layout', body: { cars: ['ambre', 'vert', 'violet', 'ambre'] } })
    myTrain.value = { ...myTrain.value, train: ['ambre', 'vert', 'violet'] }
    await w.vm.$nextTick()
    await w.find('[data-test=train-remove-1]').trigger('click')
    await flushPromises()
    expect(calls.at(-1)!.body).toEqual({ cars: ['ambre', 'violet'] })
    myTrain.value = { ...myTrain.value, train: ['ambre', 'vert', 'violet'] }
    await w.vm.$nextTick()
    await w.find('[data-test=train-car-0]').trigger('click')
    await w.find('[data-test=train-car-2]').trigger('click')
    expect(calls.at(-1)!.body).toEqual({ cars: ['vert', 'violet', 'ambre'] })
  })

  it('pas plus de wagons d\'un type que ceux qu\'on a ; train plein : un message', async () => {
    route({ 'GET /api/train': { status: 200, body: state({ ambre: 1, vert: 1, violet: 1 }, ['ambre', 'vert', 'violet']) } })
    const w = mount(MyTrain)
    await flushPromises()
    expect(freeCount('ambre')).toBe(0)
    await w.find('[data-test=coll-ambre]').trigger('click')
    expect(w.find('[data-test=train-msg]').text()).toContain('déjà dans le train')
    myTrain.value = { ...myTrain.value, owned: { ambre: 6 }, train: Array(6).fill('ambre') }
    await w.vm.$nextTick()
    await w.find('[data-test=coll-ambre]').trigger('click')
    expect(w.find('[data-test=train-msg]').text()).toContain('plein')
  })

  it('un refus du serveur remet l\'ordre d\'avant', async () => {
    route({ 'POST /api/train/layout': { status: 400, body: { ok: false, error: 'invalid' } } })
    expect(await setTrain(['violet'])).toBe(false)
    expect(myTrain.value.train).toEqual(STARTER_TRAIN)
  })
})

describe('la machine « Wagon surprise »', () => {
  it('on tire la manette : les 3 rouleaux s\'arrêtent tous sur le wagon gagné, au milieu ; le compteur baisse', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => setTimeout(() => f(0), 0))
    const after = state({ ambre: 1, vert: 1, violet: 1, ciel: 1 }, ['ambre', 'vert', 'violet', 'ciel'])
    const calls = route({ 'POST /api/train/draw': { status: 200, body: { ok: true, wagon: 'ciel', added: true, state: { ...after, coins: 70 } } } })
    const w = mount(WagonMachine, { attachTo: document.body })
    expect(document.querySelector('[data-test=machine-left]')!.textContent).toContain(`Encore ${COLLECTION_TOTAL - 3} wagons`)
    ;(document.querySelector('[data-test=machine-pull]') as HTMLButtonElement).click()
    await vi.advanceTimersByTimeAsync(10)
    await flushPromises()
    expect(calls.map((c) => c.key)).toEqual(['POST /api/train/draw'])
    await vi.advanceTimersByTimeAsync(4000)
    await flushPromises()
    const mids = [...document.querySelectorAll('[data-test=reel-mid]')].map((e) => (e as HTMLElement).dataset.wagon)
    expect(mids).toEqual(['ciel', 'ciel', 'ciel'])
    // chaque rouleau montre aussi un wagon au-dessus et au-dessous du gain
    for (const reel of document.querySelectorAll('[data-test=reel]')) expect(reel.querySelectorAll('.cell').length).toBeGreaterThanOrEqual(3)
    expect(document.querySelector('[data-test=machine-prize]')!.textContent).toContain('voiture panoramique ciel')
    expect(document.querySelector('[data-test=machine-left]')!.textContent).toContain(`Encore ${COLLECTION_TOTAL - 4} wagons`)
    expect(coins.value).toBe(70)
    expect(trainWagons.value.map((x) => x.id)).toEqual(['ambre', 'vert', 'violet', 'ciel'])
    w.unmount()
  })

  it('sans assez de pièces : un message, et rien n\'est demandé au serveur', async () => {
    coins.value = 10
    const calls = route({})
    const w = mount(WagonMachine, { attachTo: document.body })
    ;(document.querySelector('[data-test=machine-pull]') as HTMLButtonElement).click()
    await flushPromises()
    expect(document.querySelector('[data-test=machine-msg]')!.textContent).toContain(`${DRAW_PRICE} pièces`)
    expect(calls).toEqual([])
    w.unmount()
  })
})
