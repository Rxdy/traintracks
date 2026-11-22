import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { levels } from '../testLevels'
import { buildScenery, seedOf, PAL, THEMES } from '../scenery'
import SceneryLayer from '../components/SceneryLayer.vue'
import TrackGrid from '../components/TrackGrid.vue'
import { samplePuzzle, sampleSolution } from '../puzzle'

// Contrôle de #46 : la voie a le même rendu dans la grille, dans le décor et sur ses prolongements. Les trois prennent leurs
// couleurs dans la palette du thème (rail.rail, rail.tie) ; ce test fige le lien pour tous les thèmes.
describe('cohérence des rails : grille, décor et prolongements', () => {
  it('les prolongements SVG ont la couleur de rail du thème, pour chaque thème', () => {
    const lv = levels[0]
    for (const theme of THEMES) {
      const sc = buildScenery(lv.puzzle, lv.solution, theme, seedOf(lv.puzzle), { x: 3, y: 3 })
      const w = mount(SceneryLayer, { props: { scenery: sc, route: null } })
      const rails = w.findAll('[data-test=ext-rail]')
      expect(rails.length, theme).toBeGreaterThan(0)
      for (const r of rails) expect(r.attributes('stroke'), theme).toBe(PAL[theme].rail.rail)
      w.unmount()
    }
  })

  it('la grille gagnée prend les couleurs de rail du même thème que le décor', async () => {
    for (const theme of THEMES) {
      const w = mount(TrackGrid, { props: { puzzle: samplePuzzle, theme }, attachTo: document.body })
      const cell = (r: number, c: number) => w.find(`[data-r="${r}"][data-c="${c}"]`)
      await cell(sampleSolution[0][0], sampleSolution[0][1]).trigger('pointerdown')
      for (const [r, c] of sampleSolution.slice(1)) await cell(r, c).trigger('pointerenter')
      window.dispatchEvent(new Event('pointerup'))
      await w.vm.$nextTick()
      const style = w.get('.board').attributes('style') ?? ''
      expect(style, theme).toContain(PAL[theme].rail.rail)
      expect(style, theme).toContain(PAL[theme].rail.tie)
      w.unmount()
    }
  }, 30000)
})
