import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import TrainRun from './TrainRun.vue'
import { buildRoute, leadCells } from '../trainRoute'
import { levels } from '../testLevels'

// Position (en cases) de chaque voiture, lue dans le SVG rendu.
function carPositions(w: ReturnType<typeof mount>): { x: number; y: number }[] {
  return w.findAll('g[transform]').map((g) => {
    const m = /translate\(([-\d.e]+) ([-\d.e]+)\)/.exec(g.attributes('transform')!)!
    return { x: Number(m[1]), y: Number(m[2]) }
  })
}

describe.each(levels.map((l) => [l.id, l] as const))('TrainRun niveau %i', (_id, l) => {
  it('les wagons ne se percutent jamais et le train sort de l\'écran', async () => {
    vi.useFakeTimers()
    const vp = { width: 390, height: 844 }
    const rect = { left: 39, top: 120, width: 312 }
    const size = l.puzzle.size
    const cell = rect.width / (size + 1)
    const route = buildRoute(l.solution, l.puzzle, {
      entry: leadCells(l.puzzle.entry.dir, rect, size, vp),
      exit: leadCells(l.puzzle.exit.dir, rect, size, vp),
    })
    const w = mount(TrainRun, { props: { route, size } })
    let minGap = Infinity
    let done = false
    for (let t = 0; t < 120 && !done; t++) {
      await vi.advanceTimersByTimeAsync(250)
      const cars = carPositions(w)
      for (let i = 1; i < cars.length; i++) {
        minGap = Math.min(minGap, Math.hypot(cars[i].x - cars[i - 1].x, cars[i].y - cars[i - 1].y))
      }
      done = w.emitted('done') !== undefined
    }
    expect(done, 'le train finit son trajet').toBe(true)
    // écart attendu 0,66 ; dans un virage la corde est un peu plus courte
    expect(minGap).toBeGreaterThan(0.5)
    // à la fin, même le dernier wagon est hors de l'écran (px)
    const last = carPositions(w).at(-1)!
    const px = { x: rect.left + last.x * cell, y: rect.top + last.y * cell }
    const outside = px.x < 0 || px.x > vp.width || px.y < 0 || px.y > vp.height
    expect(outside, `dernier wagon à (${Math.round(px.x)}, ${Math.round(px.y)})`).toBe(true)
    w.unmount()
    vi.useRealTimers()
  })
})
