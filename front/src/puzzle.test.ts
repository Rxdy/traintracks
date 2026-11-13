import { describe, it, expect } from 'vitest'
import {
  STANDARD_SIZE,
  samplePuzzle,
  range,
  sumClues,
  isEntry,
  isExit,
  isLocked,
  railVariant,
  isConsistent,
  type Puzzle,
} from './puzzle'

describe('range', () => {
  it('retourne [0..n-1]', () => {
    expect(range(4)).toEqual([0, 1, 2, 3])
  })

  it('retourne un tableau vide pour 0', () => {
    expect(range(0)).toEqual([])
  })
})

describe('sumClues', () => {
  it('additionne les compteurs', () => {
    expect(sumClues([1, 2, 3])).toBe(6)
  })

  it('vaut 0 pour un tableau vide', () => {
    expect(sumClues([])).toBe(0)
  })
})

describe('entrée / sortie', () => {
  it("repère la case d'entrée", () => {
    expect(isEntry(samplePuzzle, 2, 0)).toBe(true)
    expect(isEntry(samplePuzzle, 0, 0)).toBe(false)
  })

  it('repère la case de sortie', () => {
    expect(isExit(samplePuzzle, 7, 3)).toBe(true)
    expect(isExit(samplePuzzle, 0, 0)).toBe(false)
  })

  it('verrouille entrée et sortie, pas les autres', () => {
    expect(isLocked(samplePuzzle, 2, 0)).toBe(true)
    expect(isLocked(samplePuzzle, 7, 3)).toBe(true)
    expect(isLocked(samplePuzzle, 4, 4)).toBe(false)
  })

  it('donne la bonne couleur / nature de rail', () => {
    expect(railVariant(samplePuzzle, 2, 0)).toBe('entry')
    expect(railVariant(samplePuzzle, 7, 3)).toBe('exit')
    expect(railVariant(samplePuzzle, 4, 4)).toBe('user')
  })
})

describe('isConsistent', () => {
  it('valide le puzzle standard fourni', () => {
    expect(isConsistent(samplePuzzle)).toBe(true)
  })

  it('rejette des sommes lignes/colonnes différentes', () => {
    const bad: Puzzle = { ...samplePuzzle, rowClues: [8, 0, 0, 0, 0, 0, 0, 0] }
    expect(isConsistent(bad)).toBe(false)
  })

  it('rejette un mauvais nombre de compteurs', () => {
    const bad: Puzzle = { ...samplePuzzle, colClues: [1, 2, 3] }
    expect(isConsistent(bad)).toBe(false)
  })
})

describe('samplePuzzle', () => {
  it('est une grille standard 8×8', () => {
    expect(samplePuzzle.size).toBe(STANDARD_SIZE)
    expect(samplePuzzle.rowClues).toHaveLength(STANDARD_SIZE)
    expect(samplePuzzle.colClues).toHaveLength(STANDARD_SIZE)
  })
})

describe('sampleSolution', () => {
  it('respecte les compteurs et relie l\'entrée à la sortie', async () => {
    const { sampleSolution } = await import('./puzzle')
    const rows = Array(8).fill(0), cols = Array(8).fill(0)
    for (const [r, c] of sampleSolution) { rows[r]++; cols[c]++ }
    expect(rows).toEqual(samplePuzzle.rowClues)
    expect(cols).toEqual(samplePuzzle.colClues)
    expect(sampleSolution[0]).toEqual([samplePuzzle.entry.row, samplePuzzle.entry.col])
    expect(sampleSolution.at(-1)).toEqual([samplePuzzle.exit.row, samplePuzzle.exit.col])
    sampleSolution.slice(1).forEach(([r, c], i) => {
      const [pr, pc] = sampleSolution[i]
      expect(Math.abs(r - pr) + Math.abs(c - pc)).toBe(1)
    })
  })
})
