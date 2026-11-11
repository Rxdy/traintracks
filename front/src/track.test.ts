import { describe, it, expect } from 'vitest'
import {
  edgeKey,
  connectedSides,
  isCrossed,
  isRail,
  toggleCross,
  tapCell,
  clearCell,
  incidentEdges,
  dragStep,
  type Connections,
  type Crosses,
  type Rails,
} from './track'
import type { Puzzle } from './puzzle'

function makePuzzle(): Puzzle {
  return {
    size: 4,
    rowClues: [0, 0, 0, 0],
    colClues: [0, 0, 0, 0],
    entry: { row: 0, col: 0, dir: 'left' },
    exit: { row: 3, col: 3, dir: 'down' },
  }
}

describe('edgeKey', () => {
  it('relie deux cases horizontalement (clé canonique)', () => {
    expect(edgeKey(1, 1, 1, 2)).toBe('h:1:1')
    expect(edgeKey(1, 2, 1, 1)).toBe('h:1:1') // même arête, ordre inverse
  })

  it('relie deux cases verticalement', () => {
    expect(edgeKey(1, 1, 2, 1)).toBe('v:1:1')
    expect(edgeKey(2, 1, 1, 1)).toBe('v:1:1')
  })

  it('renvoie null pour des cases non adjacentes', () => {
    expect(edgeKey(1, 1, 1, 3)).toBeNull()
    expect(edgeKey(1, 1, 2, 2)).toBeNull()
    expect(edgeKey(1, 1, 1, 1)).toBeNull()
  })
})

describe('connectedSides', () => {
  it("une case sans liaison n'a aucun côté", () => {
    const conn: Connections = new Set()
    expect(connectedSides(conn, makePuzzle(), 1, 1)).toEqual([])
  })

  it('reflète les liaisons tracées', () => {
    const conn: Connections = new Set(['h:1:1', 'v:1:1']) // droite + bas de (1,1)
    expect(connectedSides(conn, makePuzzle(), 1, 1)).toEqual(['right', 'bottom'])
  })

  it("l'entrée ajoute toujours son côté de bord", () => {
    const conn: Connections = new Set()
    // entrée (0,0) dir left → côté gauche imposé
    expect(connectedSides(conn, makePuzzle(), 0, 0)).toEqual(['left'])
  })

  it('deux virages voisins sans liaison partagée ne se relient PAS', () => {
    const puzzle = makePuzzle()
    // (1,1) : haut + gauche (virage) ; (2,1) : bas + droite (virage)
    const conn: Connections = new Set([
      'v:0:1', // haut de (1,1)
      'h:1:0', // gauche de (1,1)
      'v:2:1', // bas de (2,1)
      'h:2:1', // droite de (2,1)
    ])
    expect(connectedSides(conn, puzzle, 1, 1)).toEqual(['top', 'left'])
    expect(connectedSides(conn, puzzle, 2, 1)).toEqual(['right', 'bottom'])
    // l'arête entre (1,1) et (2,1) n'existe pas → aucune connexion mutuelle
    expect(conn.has('v:1:1')).toBe(false)
  })
})

describe('toggleCross', () => {
  it('pose puis enlève une croix sur une case vide', () => {
    const conn: Connections = new Set()
    const crosses: Crosses = new Set()
    const p = makePuzzle()
    toggleCross(crosses, conn, p, 1, 1)
    expect(isCrossed(crosses, 1, 1)).toBe(true)
    toggleCross(crosses, conn, p, 1, 1)
    expect(isCrossed(crosses, 1, 1)).toBe(false)
  })

  it('refuse la croix sur une case qui porte un rail', () => {
    const conn: Connections = new Set(['h:1:1'])
    const crosses: Crosses = new Set()
    toggleCross(crosses, conn, makePuzzle(), 1, 1)
    expect(isCrossed(crosses, 1, 1)).toBe(false)
  })
})

describe('clearCell', () => {
  it('supprime toutes les liaisons de la case', () => {
    // (1,1) relié en haut, bas, gauche, droite
    const conn: Connections = new Set(['v:0:1', 'v:1:1', 'h:1:0', 'h:1:1'])
    const changed = clearCell(conn, makePuzzle(), 1, 1)
    expect(changed).toBe(true)
    expect(connectedSides(conn, makePuzzle(), 1, 1)).toEqual([])
  })

  it('ne change rien sur une case sans liaison', () => {
    const conn: Connections = new Set()
    expect(clearCell(conn, makePuzzle(), 1, 1)).toBe(false)
  })

  it('n\'affecte que la case visée (les voisins perdent l\'arête partagée)', () => {
    const conn: Connections = new Set(['h:1:1']) // relie (1,1) et (1,2)
    clearCell(conn, makePuzzle(), 1, 1)
    expect(connectedSides(conn, makePuzzle(), 1, 2)).toEqual([])
  })
})

describe('incidentEdges', () => {
  it('donne 4 arêtes au centre, moins sur les bords', () => {
    expect(incidentEdges(4, 1, 1)).toHaveLength(4)
    expect(incidentEdges(4, 0, 0)).toHaveLength(2)
  })
})

describe('dragStep', () => {
  it('trace une liaison quand elle est absente', () => {
    const conn: Connections = new Set()
    const mode = dragStep(conn, null, 1, 1, 1, 2)
    expect(mode).toBe('draw')
    expect(conn.has('h:1:1')).toBe(true)
  })

  it('efface quand le glisser commence sur une liaison existante', () => {
    const conn: Connections = new Set(['h:1:1'])
    const mode = dragStep(conn, null, 1, 1, 1, 2)
    expect(mode).toBe('erase')
    expect(conn.has('h:1:1')).toBe(false)
  })

  it('garde le mode décidé pour tout le glisser', () => {
    const conn: Connections = new Set()
    let mode = dragStep(conn, null, 0, 0, 0, 1) // draw
    mode = dragStep(conn, mode, 0, 1, 0, 2)
    expect(mode).toBe('draw')
    expect(conn.has('h:0:0')).toBe(true)
    expect(conn.has('h:0:1')).toBe(true)
  })

  it('ignore un pas entre cases non adjacentes', () => {
    const conn: Connections = new Set()
    const mode = dragStep(conn, null, 0, 0, 2, 2)
    expect(mode).toBeNull()
    expect(conn.size).toBe(0)
  })
})
