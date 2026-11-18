import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { levels } from '../testLevels'
import { buildScenery, seedOf, type Scenery } from '../scenery/generate'
import { offBoardBridges } from './bridgeRails'
import SceneryLayer from '../components/SceneryLayer.vue'

// Contrôle de #38 : sur les ponts et les passages à niveau, la voie doit rester visible quand le décor est affiché.
// Dans la grille, les rails de la grille (DOM) passent par-dessus le décor. Hors de la grille, la voie est un prolongement
// dessiné par le décor lui-même : c'est là que ponts, eau et route peuvent la recouvrir.

// marges d'un grand écran et d'un téléphone (le décor déborde de la grille de jeu)
const MARGINS = [
  { x: 3, y: 3 },
  { x: 1, y: 2, top: 2, below: 1 },
]
const scenes: { n: number; sc: Scenery }[] = []
for (const lv of levels) for (const m of MARGINS) scenes.push({ n: lv.id, sc: buildScenery(lv.puzzle, lv.solution, undefined, seedOf(lv.puzzle), m) })

const board = (sc: Scenery) => sc.rows - sc.margin.y - sc.margin.b
const inBoard = (sc: Scenery, r: number, c: number) => r >= sc.margin.y && r < sc.margin.y + board(sc) && c >= sc.margin.x && c < sc.margin.x + board(sc)
// la case (r, c) est-elle traversée par un prolongement de la voie, dans l'axe donné ?
const onExt = (sc: Scenery, r: number, c: number, axis: 'h' | 'v') =>
  sc.ext.some(([a, b]) => {
    const horiz = Math.abs(a.y - b.y) < 1e-9
    if ((axis === 'h') !== horiz) return false
    const [lo, hi] = horiz ? [Math.min(a.x, b.x), Math.max(a.x, b.x)] : [Math.min(a.y, b.y), Math.max(a.y, b.y)]
    const [along, across, mid] = horiz ? [c + 0.5, r + 0.5, a.y] : [r + 0.5, c + 0.5, a.x]
    return Math.abs(across - mid) < 1e-9 && along > lo && along < hi
  })

describe('décor : la voie reste visible sur les ponts et les passages à niveau', () => {
  it('chaque pont et chaque passage à niveau hors de la grille est sur un prolongement de la voie', () => {
    let offBridges = 0
    let offCrossings = 0
    for (const { n, sc } of scenes) {
      for (const [k, axis] of sc.bridges) {
        const [r, c] = k.split(',').map(Number)
        if (inBoard(sc, r, c)) continue
        offBridges++
        expect(onExt(sc, r, c, axis), `niveau ${n}, pont ${k}`).toBe(true)
      }
      const x = sc.road?.crossing
      if (x && !inBoard(sc, x[0], x[1])) {
        offCrossings++
        expect(onExt(sc, x[0], x[1], sc.road!.axis === 'v' ? 'h' : 'v'), `niveau ${n}, passage ${x}`).toBe(true)
      }
    }
    // le contrôle n'a de sens que si les cas existent dans les niveaux
    expect(offBridges).toBeGreaterThan(10)
    expect(offCrossings).toBeGreaterThan(10)
  })

  it('3D : le monde repose des rails sur tous les ponts hors de la grille, et seulement sur ceux-là', () => {
    for (const { n, sc } of scenes) {
      const got = offBoardBridges(sc).map(({ r, c }) => `${r},${c}`).sort()
      const want = [...sc.bridges.keys()].filter((k) => !inBoard(sc, ...(k.split(',').map(Number) as [number, number]))).sort()
      expect(got, `niveau ${n}`).toEqual(want)
    }
  })

  it('SVG : les rails des prolongements sont dessinés après les ponts et la route', () => {
    const found = scenes.find(({ sc }) => offBoardBridges(sc).length && sc.road?.crossing)
    expect(found).toBeTruthy()
    const w = mount(SceneryLayer, { props: { scenery: found!.sc, route: null } })
    const rail = w.find('[data-test=ext-rail]').element
    for (const sel of ['[data-test=bridge]', '[data-test=road]']) {
      for (const el of w.findAll(sel)) expect(el.element.compareDocumentPosition(rail) & Node.DOCUMENT_POSITION_FOLLOWING, sel).toBeTruthy()
    }
    w.unmount()
  })
})
