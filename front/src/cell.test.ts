import { describe, it, expect } from 'vitest'
import {
  TRACK_PIECES,
  PIECE_CONNECTIONS,
  oppositeSide,
  pieceForSides,
  type Side,
} from './cell'

describe('PIECE_CONNECTIONS', () => {
  it('définit exactement 2 côtés pour chaque forme', () => {
    for (const piece of TRACK_PIECES) {
      expect(PIECE_CONNECTIONS[piece]).toHaveLength(2)
    }
  })

  it('relie les bons côtés pour les droits', () => {
    expect(PIECE_CONNECTIONS.horizontal).toEqual(['left', 'right'])
    expect(PIECE_CONNECTIONS.vertical).toEqual(['top', 'bottom'])
  })
})

describe('oppositeSide', () => {
  it('renvoie le côté opposé', () => {
    expect(oppositeSide('top')).toBe('bottom')
    expect(oppositeSide('bottom')).toBe('top')
    expect(oppositeSide('left')).toBe('right')
    expect(oppositeSide('right')).toBe('left')
  })
})

describe('pieceForSides', () => {
  it('déduit les rails droits', () => {
    expect(pieceForSides('left', 'right')).toBe('horizontal')
    expect(pieceForSides('top', 'bottom')).toBe('vertical')
  })

  it('déduit les virages (dans les deux ordres)', () => {
    expect(pieceForSides('top', 'left')).toBe('curve-tl')
    expect(pieceForSides('left', 'top')).toBe('curve-tl')
    expect(pieceForSides('top', 'right')).toBe('curve-tr')
    expect(pieceForSides('bottom', 'left')).toBe('curve-bl')
    expect(pieceForSides('bottom', 'right')).toBe('curve-br')
  })

  it('couvre toutes les formes', () => {
    const seen = new Set<string>()
    const combos: [Side, Side][] = [
      ['left', 'right'],
      ['top', 'bottom'],
      ['top', 'left'],
      ['top', 'right'],
      ['bottom', 'left'],
      ['bottom', 'right'],
    ]
    for (const [a, b] of combos) seen.add(pieceForSides(a, b))
    expect(seen.size).toBe(TRACK_PIECES.length)
  })
})
