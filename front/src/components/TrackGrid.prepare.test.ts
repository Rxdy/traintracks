import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { samplePuzzle, sampleSolution } from '../puzzle'

// L'appareil sait faire de la 3D ; le décor 3D est remplacé par une doublure qui compte ses montages et garde ses réglages.
vi.mock('../decor', async (orig) => ({ ...(await orig<typeof import('../decor')>()), webglAvailable: () => true }))
const mounts: { held?: boolean; scenery: unknown }[] = []
const Fake3D = defineComponent({
  props: ['scenery', 'route', 'held', 'train', 'life'],
  setup(props) {
    mounts.push(props as never)
    return () => h('canvas', { 'data-test': 'scenery-3d', 'data-held': String(!!props.held) })
  },
})

async function grid() {
  const { default: TrackGrid } = await import('./TrackGrid.vue')
  return mount(TrackGrid, { props: { puzzle: samplePuzzle }, attachTo: document.body, global: { stubs: { Scenery3D: Fake3D } } })
}
async function trace(w: Awaited<ReturnType<typeof grid>>) {
  const cell = (r: number, c: number) => w.find(`[data-r="${r}"][data-c="${c}"]`)
  const [r0, c0] = sampleSolution[0]
  await cell(r0, c0).trigger('pointerdown')
  for (const [r, c] of sampleSolution.slice(1)) await cell(r, c).trigger('pointerenter')
  window.dispatchEvent(new Event('pointerup'))
  await w.vm.$nextTick()
}

afterEach(() => {
  mounts.length = 0
  vi.useRealTimers()
})

describe('TrackGrid : décor 3D préparé pendant le Plateau', () => {
  it('peu après l\'arrivée du Plateau, le décor 3D est préparé en cachette (en pause), avant que le joueur ait tracé la voie', async () => {
    vi.useFakeTimers()
    const w = await grid()
    expect(w.find('[data-test=scenery-3d]').exists()).toBe(false) // pas tout de suite : le Plateau arrive d'abord
    await vi.advanceTimersByTimeAsync(1000)
    expect(w.find('[data-test=scenery-3d]').attributes('data-held')).toBe('true')
    expect(mounts).toHaveLength(1)
    w.unmount()
  })

  it('à la victoire, c\'est CE décor qui apparaît : pas reconstruit, pas remonté, il sort seulement de sa pause', async () => {
    vi.useFakeTimers()
    const w = await grid()
    await vi.advanceTimersByTimeAsync(1000)
    const preparedScenery = mounts[0]!.scenery
    await trace(w)
    expect(w.emitted('solved')).toHaveLength(1)
    expect(mounts).toHaveLength(1) // le même composant : rien n'est refait au premier passage du train
    expect(w.find('[data-test=scenery-3d]').attributes('data-held')).toBe('false')
    expect(mounts[0]!.scenery).toStrictEqual(preparedScenery)
    w.unmount()
  })

  it('si le joueur gagne avant la fin de la préparation, le décor est construit à la victoire comme avant', async () => {
    vi.useFakeTimers()
    const w = await grid()
    await trace(w)
    expect(mounts).toHaveLength(1)
    expect(w.find('[data-test=scenery-3d]').attributes('data-held')).toBe('false')
    await vi.advanceTimersByTimeAsync(2000) // la préparation prévue n'a plus lieu
    expect(mounts).toHaveLength(1)
    w.unmount()
  })
})
