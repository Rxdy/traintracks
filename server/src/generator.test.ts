import { describe, it, expect } from 'vitest'
import { generate, makeRng } from '../../shared/generator.js'
import { isConsistent, isEntry, isExit } from '../../shared/puzzle.js'
import { solve } from '../../shared/solver.js'
import { edgeKey, isSolved } from '../../shared/track.js'

function edgesOf(path: [number, number][]): Set<string> {
  const s = new Set<string>()
  for (let i = 1; i < path.length; i++) s.add(edgeKey(path[i - 1][0], path[i - 1][1], path[i][0], path[i][1])!)
  return s
}

describe('nombres pseudo-aléatoires', () => {
  it('même graine = même suite, graines différentes = suites différentes', () => {
    const a = makeRng('2026-11-12')
    const b = makeRng('2026-11-12')
    const c = makeRng('2026-11-13')
    const xs = Array.from({ length: 8 }, () => a())
    expect(Array.from({ length: 8 }, () => b())).toEqual(xs)
    expect(Array.from({ length: 8 }, () => c())).not.toEqual(xs)
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true)
  })
})

describe('générateur de puzzles', () => {
  it.each([4, 5, 6])('grilles %i×%i : valides, à solution UNIQUE, et c\'est la voie tirée', (size) => {
    for (let d = 1; d <= 25; d++) {
      const g = generate(`test-${d}`, size)
      const { puzzle, solution } = g
      expect(puzzle.size).toBe(size)
      expect(isConsistent(puzzle)).toBe(true)
      expect(isEntry(puzzle, solution[0][0], solution[0][1])).toBe(true)
      expect(isExit(puzzle, solution.at(-1)![0], solution.at(-1)![1])).toBe(true)
      expect(new Set(solution.map(([r, c]) => `${r}:${c}`)).size).toBe(solution.length) // sans croisement
      const res = solve(puzzle, 3)
      expect(res.count, `graine test-${d}`).toBe(1)
      expect(res.solutions[0]).toEqual(solution)
      expect(isSolved(edgesOf(solution), puzzle)).toBe(true)
    }
  })
  it('compteurs : somme des lignes = somme des colonnes = longueur de la voie', () => {
    const { puzzle, solution } = generate('x', 6)
    expect(puzzle.rowClues.reduce((a, b) => a + b, 0)).toBe(solution.length)
    expect(puzzle.colClues.reduce((a, b) => a + b, 0)).toBe(solution.length)
  })
  it('entrée sur le bord gauche, sortie à droite ou en bas', () => {
    for (let d = 0; d < 20; d++) {
      const { puzzle } = generate(`bord-${d}`, 5)
      expect(puzzle.entry).toMatchObject({ col: 0, dir: 'left' })
      const e = puzzle.exit
      expect((e.dir === 'right' && e.col === 4) || (e.dir === 'down' && e.row === 4)).toBe(true)
    }
  })
  it('déterministe : même graine = même grille, sur n\'importe quelle machine', () => {
    expect(generate('daily:2026-11-12', 6)).toEqual(generate('daily:2026-11-12', 6))
  })
  it('des graines différentes donnent des grilles différentes', () => {
    const keys = new Set(Array.from({ length: 30 }, (_, d) => JSON.stringify(generate(`jour-${d}`, 6).puzzle)))
    expect(keys.size).toBeGreaterThanOrEqual(28)
  })
  it('les rails imposés, s\'il en faut, sont sur la voie et jamais sur l\'entrée ni la sortie', () => {
    let withGivens = 0
    for (let d = 0; d < 60; d++) {
      const g = generate(`g-${d}`, 6, 4)
      if (!g.puzzle.givens) continue
      withGivens++
      for (const gv of g.puzzle.givens) {
        expect(g.solution.some(([r, c]) => r === gv.row && c === gv.col)).toBe(true)
        expect(isEntry(g.puzzle, gv.row, gv.col) || isExit(g.puzzle, gv.row, gv.col)).toBe(false)
      }
    }
    expect(withGivens).toBeGreaterThanOrEqual(0)
  })
  it('les rochers : hors de la voie, solution unique, et ils servent vraiment', () => {
    for (let i = 0; i < 12; i++) {
      const size = 5 + (i % 2)
      const g = generate(`rochers:${i}`, size, 0, 0, false, { min: 2, max: 4 })
      expect(g.rocks).toBeGreaterThanOrEqual(2)
      expect(g.rocks).toBeLessThanOrEqual(4)
      expect(g.puzzle.rocks).toHaveLength(g.rocks)
      for (const k of g.puzzle.rocks!) {
        expect(g.solution.some(([r, c]) => r === k.row && c === k.col)).toBe(false)
        expect(isEntry(g.puzzle, k.row, k.col) || isExit(g.puzzle, k.row, k.col)).toBe(false)
      }
      expect(isConsistent(g.puzzle)).toBe(true)
      expect(solve(g.puzzle, 3).count).toBe(1)
      expect(solve({ ...g.puzzle, rocks: undefined }, 2).count).toBeGreaterThan(1)
    }
  })
  it('rochers + rails imposés : l\'ensemble sert, et la grille reste unique', () => {
    for (let i = 0; i < 8; i++) {
      const g = generate(`mix:${i}`, 5, 5, 2, true, { min: 1, max: 3 })
      expect(solve(g.puzzle, 3).count).toBe(1)
      expect(solve({ ...g.puzzle, givens: undefined, rocks: undefined }, 2).count).toBeGreaterThan(1)
    }
  })
  it('sans option de rochers, rien ne change (mêmes grilles qu\'avant)', () => {
    expect(generate('x', 5).puzzle.rocks).toBeUndefined()
    expect(generate('x', 5).puzzle).toEqual(generate('x', 5, 4, 0, false, undefined).puzzle)
  })
  it('refuse une taille hors limites', () => {
    expect(() => generate('x', 3)).toThrow(/taille/)
    expect(() => generate('x', 9)).toThrow(/taille/)
    expect(() => generate('x', 5.5)).toThrow(/taille/)
  })
  it('assez rapide pour être lancé à la demande (30 grilles 6×6)', () => {
    const t = Date.now()
    for (let d = 0; d < 30; d++) generate(`perf-${d}`, 6)
    expect(Date.now() - t).toBeLessThan(5000)
  })
})
