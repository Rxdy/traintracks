import { describe, it, expect } from 'vitest'
import { lineStatus, lineStatuses } from './lines'

const E = 'empty', R = 'rail', X = 'cross'

describe('lineStatus', () => {
  it('done quand le compte est atteint', () => {
    expect(lineStatus([R, R, E, E], 2)).toBe('done')
  })
  it('forced quand les cases libres = compteur (croix posées)', () => {
    expect(lineStatus([X, E, X, E], 2)).toBe('forced')
    expect(lineStatus([X, R, X, E], 2)).toBe('forced')
  })
  it('over quand trop de rails ou pas assez de place', () => {
    expect(lineStatus([R, R, R, E], 2)).toBe('over')
    expect(lineStatus([X, X, X, E], 2)).toBe('over')
  })
  it('open sinon', () => {
    expect(lineStatus([E, E, E, E], 2)).toBe('open')
  })
})

describe('aide seulement après une marque du joueur', () => {
  it('rien n\'est coloré tant que le joueur n\'a rien posé sur la ligne', () => {
    expect(lineStatus([E, E, E, E], 4, false)).toBe('open') // 4 sur 4 cases
    expect(lineStatus([E, E, E, E], 0, false)).toBe('open') // un « 0 »
    expect(lineStatus([E, E, E, E], 0, true)).toBe('done')
  })
  it('lineStatuses : une ligne non jouée reste neutre, même avec un 0', () => {
    const grid = [[E, E], [E, E]] as never
    const none = [[false, false], [false, false]]
    expect(lineStatuses(grid, [0, 2], [0, 2], none)).toEqual({ rows: ['open', 'open'], cols: ['open', 'open'] })
    const played = [[false, false], [true, false]] // le joueur a touché ligne 2 / colonne 1
    const s = lineStatuses([[E, E], [R, E]] as never, [0, 2], [0, 2], played)
    expect(s.rows).toEqual(['open', 'forced'])
    expect(s.cols).toEqual(['over', 'open']) // un rail dans une colonne à 0 : impossible
  })
})

describe('lineStatuses', () => {
  it('calcule lignes et colonnes', () => {
    const g = [[R, E], [E, X]] as const
    const s = lineStatuses(g.map((r) => [...r]) as never, [1, 1], [1, 2])
    expect(s.rows).toEqual(['done', 'forced'])
    expect(s.cols).toEqual(['done', 'over'])
  })
})
