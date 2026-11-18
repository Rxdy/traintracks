import { describe, it, expect } from 'vitest'
import { levels } from '../testLevels'
import { buildScenery, seedOf, THEMES } from './generate'

// Sentiers de terre de la plaine : relient maisons et moulin à la route, et ne traversent que de l'herbe.
const MARGIN = { x: 3, y: 3 }
const build = (lv: (typeof levels)[number], theme: 'plaine' | 'foret' = 'plaine') => buildScenery(lv.puzzle, lv.solution, theme, seedOf(lv.puzzle), MARGIN)

describe('sentiers', () => {
  it('la plaine en a, les autres environnements non', () => {
    const n = levels.filter((lv) => build(lv).paths.length > 0).length
    expect(n).toBeGreaterThan(levels.length / 4)
    for (const th of THEMES.filter((t) => t !== 'plaine')) expect(buildScenery(levels[0].puzzle, levels[0].solution, th, seedOf(levels[0].puzzle), MARGIN).paths).toEqual([])
  })

  it('chaque sentier part d\'une maison ou d\'un moulin, finit sur la route, un autre sentier ou une autre maison, et ne passe que sur des cases « path »', () => {
    let checked = 0
    for (const lv of levels) {
      const sc = build(lv)
      for (const p of sc.paths) {
        checked++
        const cell = (q: { x: number; y: number }) => sc.tiles[Math.floor(q.y)][Math.floor(q.x)]
        expect(['house', 'windmill', 'building'], `niveau ${lv.id}`).toContain(cell(p[0]).kind)
        expect(['road', 'path', 'house', 'windmill', 'building'], `niveau ${lv.id}`).toContain(cell(p[p.length - 1]).kind)
        for (const q of p.slice(1, -1)) expect(cell(q).kind, `niveau ${lv.id}`).toBe('path')
        expect(p.length).toBeLessThanOrEqual(10)
      }
    }
    expect(checked).toBeGreaterThan(20)
  })

  it('le décor est le même à chaque génération (déterministe)', () => {
    for (const lv of levels.slice(0, 40)) expect(build(lv).paths).toEqual(build(lv).paths)
  })
})

describe('tunnels', () => {
  it('au bout de chaque voie, un tunnel quand le décor laisse la place, jamais sur une route, une maison, un champ, un sentier ou l\'eau', () => {
    let both = 0
    for (const lv of levels) {
      const sc = buildScenery(lv.puzzle, lv.solution, 'plaine', seedOf(lv.puzzle), { x: 9, y: 9 })
      const { entry, exit } = sc.tunnels
      if (entry && exit) both++
      for (const tn of [entry, exit]) {
        if (!tn) continue
        expect(tn.inset, `niveau ${lv.id}`).toBeGreaterThanOrEqual(0.5)
        // la montagne, de l'entrée au bord du décor : rien d'autre dessous
        for (let a = 0; a <= tn.inset; a += 0.5) for (let b = -0.9; b <= 0.9; b += 0.45) {
          const r = Math.floor(tn.y + tn.out.y * a - tn.out.x * b), c = Math.floor(tn.x + tn.out.x * a + tn.out.y * b)
          const t = sc.tiles[r]?.[c]
          if (!t) continue
          expect(['road', 'house', 'windmill', 'field', 'path'], `niveau ${lv.id} : tunnel sur ${t.kind}`).not.toContain(t.kind)
          expect(sc.water.has(`${r},${c}`), `niveau ${lv.id} : tunnel dans l'eau`).toBe(false)
        }
      }
    }
    expect(both).toBeGreaterThan(levels.length / 2)
  }, 60000)
})
