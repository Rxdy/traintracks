import { describe, it, expect } from 'vitest'
import { auditLevels, buildLevels, hashLevel, lockViolations, makeLock, progressInSize, spearman } from './levelBuilder.js'

describe('constructeur de niveaux', () => {
  it('déterministe : relancer donne exactement les mêmes niveaux', () => {
    expect(buildLevels({ to: 40 })).toEqual(buildLevels({ to: 40 }))
  })
  it('les niveaux gelés ne sont jamais refaits, et la suite est identique à une fabrication d\'un seul tenant', () => {
    const all = buildLevels({ to: 45 })
    const frozen = all.slice(0, 30)
    const again = buildLevels({ to: 45, keep: frozen })
    expect(again.slice(0, 30)).toEqual(frozen)
    expect(again).toEqual(all)
  })
  it('on peut étendre une liste existante sans toucher à ce qui est déjà là (ajout de niveaux après publication)', () => {
    const published = buildLevels({ to: 70 })
    const extended = buildLevels({ to: 85, keep: published })
    expect(extended.length).toBe(85)
    expect(extended.slice(0, 70)).toEqual(published)
    expect(auditLevels(extended).issues).toEqual([])
  })
  it('refuse des niveaux conservés qui ne se suivent pas', () => {
    const l = buildLevels({ to: 5 })
    expect(() => buildLevels({ to: 8, keep: [l[0], l[2]] })).toThrow(/non contigus/)
  })
  it('refuse de fabriquer un niveau dont la règle n\'est pas jouable', () => {
    expect(() => buildLevels({ to: 351 })).toThrow(/pas encore jouable|règle/)
  })
  it('la difficulté monte au fil d\'un palier de taille', () => {
    const levels = buildLevels({ to: 60 })
    const a = auditLevels(levels)
    expect(a.issues).toEqual([])
    expect(a.trend.find((t) => t.size === 4)!.spearman).toBeGreaterThan(0.6)
  })
  it('position dans un palier de taille : 0 au premier niveau, 1 au dernier', () => {
    expect(progressInSize(1)).toBe(0)
    expect(progressInSize(60)).toBe(1)
    expect(progressInSize(61)).toBe(0)
    expect(progressInSize(210)).toBe(1)
    expect(progressInSize(211)).toBe(0)
  })
})

describe('verrou des niveaux publiés', () => {
  const levels = buildLevels({ to: 20 })
  it('un verrou frais ne signale rien', () => {
    expect(lockViolations(levels, makeLock(levels))).toEqual([])
  })
  it('détecte un niveau publié modifié (même d\'un seul rail)', () => {
    const lock = makeLock(levels)
    const hacked = levels.map((l) => (l.id === 7 ? { ...l, puzzle: { ...l.puzzle, rowClues: [...l.puzzle.rowClues].reverse(), colClues: [9, 9, 9, 9] } } : l))
    expect(lockViolations(hacked, lock)).toEqual([7])
    const swapped = levels.map((l) => (l.id === 3 ? { ...l, solution: [...l.solution].reverse() } : l))
    expect(lockViolations(swapped, lock)).toEqual([3])
  })
  it('détecte un niveau publié supprimé ou renuméroté', () => {
    const lock = makeLock(levels)
    expect(lockViolations(levels.filter((l) => l.id !== 5), lock)).toContain(5)
    expect(lockViolations(levels.map((l) => (l.id === 5 ? { ...l, id: 99 } : l)), lock)).toContain(5)
  })
  it('ajouter des niveaux APRÈS les publiés est autorisé', () => {
    const lock = makeLock(levels.slice(0, 15))
    expect(lockViolations(levels, lock)).toEqual([])
  })
  it('l\'empreinte ne dépend pas de l\'ordre des clés', () => {
    const l = levels[0]
    const reordered = { solution: l.solution, puzzle: Object.fromEntries(Object.entries(l.puzzle).reverse()) as typeof l.puzzle }
    expect(hashLevel(reordered)).toBe(hashLevel(l))
  })
})

describe('audit', () => {
  it('repère une taille hors plan, un doublon et une solution unique violée', () => {
    const levels = buildLevels({ to: 12 })
    const dup = levels.map((l) => (l.id === 9 ? { ...l, puzzle: levels[1].puzzle, solution: levels[1].solution } : l))
    expect(auditLevels(dup).issues.join(' ')).toMatch(/identique au niveau 2/)
    const wrongSize = levels.map((l) => (l.id === 4 ? { ...l, puzzle: { ...l.puzzle, size: 5 } } : l))
    expect(auditLevels(wrongSize).issues.join(' ')).toMatch(/niveau 4 : taille 5×5/)
    const gap = levels.filter((l) => l.id !== 6)
    expect(auditLevels(gap).issues.join(' ')).toMatch(/non contigus/)
  })
})

describe('corrélation de rang', () => {
  it('1 si ça monte toujours, -1 si ça descend, proche de 0 au hasard', () => {
    expect(spearman([1, 2, 3, 4, 5], [10, 20, 30, 40, 50])).toBeCloseTo(1)
    expect(spearman([1, 2, 3, 4, 5], [50, 40, 30, 20, 10])).toBeCloseTo(-1)
    expect(Math.abs(spearman([1, 2, 3, 4, 5, 6], [3, 6, 1, 5, 2, 4]))).toBeLessThan(0.6)
  })
})
