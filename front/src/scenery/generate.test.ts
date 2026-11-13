import { describe, it, expect } from 'vitest'
import { levels } from '../testLevels'
import { buildScenery, themeForLevel, THEMES } from './generate'

describe('décor des niveaux gagnés', () => {
  it('un environnement par chapitre de 10 niveaux, puis il change', () => {
    expect(themeForLevel(1)).toBe('plaine')
    expect(themeForLevel(10)).toBe('plaine')
    expect(themeForLevel(11)).toBe('foret')
    expect(new Set([1, 11, 21, 31, 41].map(themeForLevel)).size).toBe(THEMES.length)
    expect(themeForLevel(51)).toBe('plaine') // la boucle recommence
  })

  it('est déterministe : le même niveau donne toujours le même tableau', () => {
    const lv = levels[3]
    const a = buildScenery(lv.puzzle, lv.solution, 'automne')
    const b = buildScenery(lv.puzzle, lv.solution, 'automne')
    expect(JSON.stringify(a.tiles)).toBe(JSON.stringify(b.tiles))
    expect(a.river).toEqual(b.river)
  })

  it('rien n\'est posé sur la voie, ni sur l\'eau, et les rochers deviennent des montagnes', () => {
    for (const lv of levels) {
      const th = themeForLevel(lv.id)
      const s = buildScenery(lv.puzzle, lv.solution, th)
      const onPath = new Set(lv.solution.map(([r, c]) => `${r},${c}`))
      s.tiles.forEach((row, r) =>
        row.forEach((t, c) => {
          if (onPath.has(`${r},${c}`)) expect(t.kind, `niveau ${lv.id}`).toBe('rail')
          else expect(t.kind).not.toBe('rail')
          if (s.water.has(`${r},${c}`)) expect(onPath.has(`${r},${c}`)).toBe(false)
        }),
      )
      for (const k of lv.puzzle.rocks ?? []) expect(s.tiles[k.row][k.col].kind).toBe('mountain')
    }
  })

  it('une rivière ne croise la voie que par un pont sur une case droite, à angle droit', () => {
    let rivers = 0
    for (const lv of levels) {
      const s = buildScenery(lv.puzzle, lv.solution, 'plaine')
      if (s.river) rivers++
      const path = lv.solution
      for (const b of s.bridges.keys()) {
        const i = path.findIndex(([r, c]) => `${r},${c}` === b)
        expect(i).toBeGreaterThan(0)
        expect(i).toBeLessThan(path.length - 1)
        const [pr, pc] = path[i - 1]
        const [nr, nc] = path[i + 1]
        expect(pr === nr || pc === nc).toBe(true) // voie droite
      }
    }
    expect(rivers).toBeGreaterThan(levels.length / 2)
  })

  it('les champs voisins d\'un même groupe ont le même sens et la même culture', () => {
    for (const lv of levels.slice(0, 60)) {
      const s = buildScenery(lv.puzzle, lv.solution, 'plaine')
      s.tiles.forEach((row, r) =>
        row.forEach((t, c) => {
          if (t.kind !== 'field') return
          for (const [dr, dc] of [[0, 1], [1, 0]]) {
            const o = s.tiles[r + dr]?.[c + dc]
            if (o?.kind === 'field') expect([o.dir, o.v]).toEqual([t.dir, t.v])
          }
        }),
      )
    }
  })

  it('une route ne croise la voie que par un passage à niveau droit, jamais sur l\'eau ni un rocher', () => {
    let roads = 0
    let crossings = 0
    for (const lv of levels) {
      for (const th of THEMES) {
        const s = buildScenery(lv.puzzle, lv.solution, th)
        if (!s.road) continue
        roads++
        const onPath = new Set(lv.solution.map(([r, c]) => `${r},${c}`))
        let cross = 0
        for (let i = 0; i < s.size; i++) {
          const [r, c] = s.road.axis === 'v' ? [i, s.road.line] : [s.road.line, i]
          const k = `${r},${c}`
          expect(s.water.has(k), `niveau ${lv.id} ${th}`).toBe(false)
          expect(s.bridges.has(k)).toBe(false)
          expect((lv.puzzle.rocks ?? []).some((x) => x.row === r && x.col === c)).toBe(false)
          if (onPath.has(k)) {
            cross++
            const j = lv.solution.findIndex(([a, b]) => a === r && b === c)
            const [pr, pc] = lv.solution[j - 1]
            const [nr, nc] = lv.solution[j + 1]
            // route verticale : voie horizontale (même ligne avant et après), et inversement
            expect(s.road.axis === 'v' ? pr === nr : pc === nc).toBe(true)
            expect(s.road.crossing).toEqual([r, c])
          } else expect(s.tiles[r][c].kind).toBe('road')
        }
        expect(cross).toBeLessThanOrEqual(1)
        expect(s.road.crossing === null).toBe(cross === 0)
        crossings += cross
      }
    }
    expect(roads).toBeGreaterThan(50)
    expect(crossings).toBeGreaterThan(20)
  })

  it('le moulin à vent n\'apparaît qu\'en plaine', () => {
    const lv = levels[5]
    const kinds = (th: (typeof THEMES)[number]) => buildScenery(lv.puzzle, lv.solution, th).tiles.flat().map((t) => t.kind)
    expect(kinds('plaine')).toContain('windmill')
    expect(kinds('foret')).not.toContain('windmill')
  })
})
