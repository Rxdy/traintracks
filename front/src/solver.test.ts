import { describe, it, expect } from 'vitest'
import { solve } from './solver'
import { levels } from './testLevels'
import { samplePuzzle, sampleSolution, type Puzzle } from './puzzle'

describe('solver', () => {
  it('trouve la solution du puzzle d\'exemple, et elle est unique', () => {
    const r = solve(samplePuzzle, 5)
    expect(r.count).toBe(1)
    expect(r.solutions[0]).toEqual(sampleSolution)
  })

  it('rend 0 pour un puzzle impossible (l\'ancien niveau 1 cassé)', () => {
    const broken: Puzzle = {
      size: 8,
      rowClues: [3, 2, 5, 2, 3, 4, 5, 4],
      colClues: [1, 4, 5, 3, 4, 2, 5, 4],
      entry: { row: 2, col: 0, dir: 'left' },
      exit: { row: 7, col: 3, dir: 'down' },
    }
    expect(solve(broken).count).toBe(0)
  })

  it('détecte plusieurs solutions quand les compteurs ne suffisent pas', () => {
    // 4×4 trouvé par énumération : ces compteurs admettent 4 chemins différents
    const ambiguous: Puzzle = {
      size: 4,
      rowClues: [4, 3, 3, 3],
      colClues: [1, 4, 4, 4],
      entry: { row: 0, col: 0, dir: 'left' },
      exit: { row: 3, col: 3, dir: 'down' },
    }
    expect(solve(ambiguous, 10).count).toBe(4)
    expect(solve(ambiguous, 2).count).toBe(2) // s'arrête à la limite demandée
  })
})

describe('solveur : rails imposés', () => {
  it('un rail imposé restreint les solutions (et peut les rendre uniques)', () => {
    // premier niveau à rails imposés (70) : ambigu SANS ses rails imposés, unique AVEC
    const l = levels.find((x) => x.id === 70)!
    const without = { ...l.puzzle, givens: undefined }
    expect(solve(without, 5).count).toBeGreaterThan(1)
    expect(solve(l.puzzle, 5).count).toBe(1)
  })

  it('un rail imposé hors de toute solution rend le puzzle impossible', () => {
    const l = levels.find((x) => x.id === 70)!
    const g = l.puzzle.givens![0]
    // même case mais côtés différents de ceux de la solution → plus aucune solution
    const wrong = g.sides[0] === 'top' || g.sides[1] === 'top'
      ? (['left', 'right'] as ['left', 'right'])
      : (['top', 'bottom'] as ['top', 'bottom'])
    const broken = { ...l.puzzle, givens: [{ ...g, sides: wrong }, ...l.puzzle.givens!.slice(1)] }
    expect(solve(broken, 5).count).toBe(0)
  })

  it('chaque niveau à rails imposés est ambigu sans eux : ils servent vraiment (combinés à des rochers : sans les deux)', () => {
    for (const l of levels.filter((x) => x.puzzle.givens)) {
      const without = l.puzzle.rocks ? { ...l.puzzle, givens: undefined, rocks: undefined } : { ...l.puzzle, givens: undefined }
      expect(solve(without, 2).count, 'niveau ' + l.id).toBeGreaterThan(1)
    }
  })
})
