// Modèle de la voie : on stocke les LIAISONS entre cases, pas des « marques ».
//
// Une liaison est une arête entre deux cases voisines :
//   - `h:r:c` relie (r, c) et (r, c+1)   (arête verticale, connexion horizontale)
//   - `v:r:c` relie (r, c) et (r+1, c)   (arête horizontale, connexion verticale)
// L'entrée et la sortie ajoutent une liaison FIXE vers le bord de la grille.
//
// La forme d'une case découle de ses côtés connectés : deux virages voisins
// sans liaison partagée ne se relient pas. C'est ce qui permet, par exemple,
// un rail haut→gauche au-dessus d'un rail droite→bas sans qu'ils se collent.

import { oppositeSide, type Side } from './cell.js'
import { isEntry, isExit, isGiven, isRock, type Direction, type Puzzle } from './puzzle.js'

// Ensembles de clés : liaisons tracées (arêtes), croix posées (cases), et
// rails marqués sans orientation connue (cases).
export type Connections = Set<string>
export type Crosses = Set<string>
export type Rails = Set<string>

const SIDE_PRIORITY: Side[] = ['top', 'right', 'bottom', 'left']

function dirToSide(dir: Direction): Side {
  switch (dir) {
    case 'up':
      return 'top'
    case 'down':
      return 'bottom'
    case 'left':
      return 'left'
    case 'right':
      return 'right'
  }
}

// Clé canonique de l'arête entre deux cases voisines, ou null si non adjacentes.
export function edgeKey(
  r1: number,
  c1: number,
  r2: number,
  c2: number,
): string | null {
  if (r1 === r2 && Math.abs(c1 - c2) === 1) return `h:${r1}:${Math.min(c1, c2)}`
  if (c1 === c2 && Math.abs(r1 - r2) === 1) return `v:${Math.min(r1, r2)}:${c1}`
  return null
}

export function cellKey(r: number, c: number): string {
  return `${r}:${c}`
}

// Arêtes imposées par les rails donnés : présentes dès le départ, jamais
// effaçables, et aucune autre arête ne peut toucher une case imposée.
const lockedCache = new WeakMap<Puzzle, Set<string>>()
export function lockedEdges(puzzle: Puzzle): Set<string> {
  let set = lockedCache.get(puzzle)
  if (!set) {
    set = new Set<string>()
    for (const g of puzzle.givens ?? []) {
      for (const side of g.sides) {
        const r2 = g.row + (side === 'top' ? -1 : side === 'bottom' ? 1 : 0)
        const c2 = g.col + (side === 'left' ? -1 : side === 'right' ? 1 : 0)
        const key = edgeKey(g.row, g.col, r2, c2)
        if (key) set.add(key)
      }
    }
    lockedCache.set(puzzle, set)
  }
  return set
}

// Les deux cases reliées par une arête.
function edgeCells(key: string): [[number, number], [number, number]] {
  const [kind, r, c] = key.split(':')
  const rr = Number(r)
  const cc = Number(c)
  return kind === 'h' ? [[rr, cc], [rr, cc + 1]] : [[rr, cc], [rr + 1, cc]]
}

// Une arête non imposée qui toucherait une case imposée est interdite.
function touchesGiven(puzzle: Puzzle, key: string): boolean {
  return edgeCells(key).some(([r, c]) => isGiven(puzzle, r, c) || isRock(puzzle, r, c))
}

// Côtés connectés d'une case (liaisons tracées + entrée / sortie).
export function connectedSides(
  connections: Connections,
  puzzle: Puzzle,
  r: number,
  c: number,
): Side[] {
  const size = puzzle.size
  const sides = new Set<Side>()

  if (r > 0 && connections.has(`v:${r - 1}:${c}`)) sides.add('top')
  if (r < size - 1 && connections.has(`v:${r}:${c}`)) sides.add('bottom')
  if (c > 0 && connections.has(`h:${r}:${c - 1}`)) sides.add('left')
  if (c < size - 1 && connections.has(`h:${r}:${c}`)) sides.add('right')

  if (isEntry(puzzle, r, c)) sides.add(dirToSide(puzzle.entry.dir))
  if (isExit(puzzle, r, c)) sides.add(dirToSide(puzzle.exit.dir))

  return SIDE_PRIORITY.filter((s) => sides.has(s))
}

export function isCrossed(crosses: Crosses, r: number, c: number): boolean {
  return crosses.has(cellKey(r, c))
}

// Une case porte-t-elle un rail ? (entrée / sortie, liaison tracée, ou rail
// marqué à la main sans orientation connue).
export function isRail(
  connections: Connections,
  rails: Rails,
  puzzle: Puzzle,
  r: number,
  c: number,
): boolean {
  if (isEntry(puzzle, r, c) || isExit(puzzle, r, c)) return true
  if (rails.has(cellKey(r, c))) return true
  return connectedSides(connections, puzzle, r, c).length > 0
}

// Bascule une croix ✕ — sauf si la case porte déjà un rail.
export function toggleCross(
  crosses: Crosses,
  connections: Connections,
  rails: Rails,
  puzzle: Puzzle,
  r: number,
  c: number,
): void {
  if (isRock(puzzle, r, c) || isRail(connections, rails, puzzle, r, c)) return
  const key = cellKey(r, c)
  if (crosses.has(key)) crosses.delete(key)
  else crosses.add(key)
}

// Tap sur une case : bascule rail ⇄ vide.
//   - case vide (ou croix) → rail marqué (orientation inconnue)
//   - case rail → effacée (liaisons + marque retirées)
// Sans effet sur l'entrée / la sortie (verrouillées).
export function tapCell(
  rails: Rails,
  connections: Connections,
  crosses: Crosses,
  puzzle: Puzzle,
  r: number,
  c: number,
): void {
  if (isEntry(puzzle, r, c) || isExit(puzzle, r, c) || isGiven(puzzle, r, c) || isRock(puzzle, r, c)) return
  const key = cellKey(r, c)
  if (isRail(connections, rails, puzzle, r, c)) {
    rails.delete(key)
    clearCell(connections, puzzle, r, c)
  } else {
    crosses.delete(key)
    rails.add(key)
  }
}

// Arêtes incidentes à une case (ses liaisons possibles avec ses voisins).
export function incidentEdges(size: number, r: number, c: number): string[] {
  const keys: string[] = []
  if (r > 0) keys.push(`v:${r - 1}:${c}`)
  if (r < size - 1) keys.push(`v:${r}:${c}`)
  if (c > 0) keys.push(`h:${r}:${c - 1}`)
  if (c < size - 1) keys.push(`h:${r}:${c}`)
  return keys
}

// Efface toutes les liaisons d'une case (suppression directe au milieu du
// parcours). Renvoie true si quelque chose a changé. Mute `connections`.
export function clearCell(
  connections: Connections,
  puzzle: Puzzle,
  r: number,
  c: number,
): boolean {
  let changed = false
  const locked = lockedEdges(puzzle)
  for (const key of incidentEdges(puzzle.size, r, c)) {
    if (locked.has(key)) continue // les rails imposés ne s'effacent pas
    if (connections.delete(key)) changed = true
  }
  return changed
}

export type DragMode = 'draw' | 'erase'

// Un pas de glisser d'une case voisine à l'autre : décide le mode au premier
// segment (efface si l'arête existe, sinon trace) puis l'applique. Renvoie le
// mode courant. Mute `connections`.
export function dragStep(
  connections: Connections,
  mode: DragMode | null,
  r1: number,
  c1: number,
  r2: number,
  c2: number,
  puzzle?: Puzzle,
): DragMode | null {
  const key = edgeKey(r1, c1, r2, c2)
  if (!key) return mode
  // Rails imposés : on ne les efface pas, et on ne peut rien y raccorder d'autre.
  if (puzzle && (lockedEdges(puzzle).has(key) || touchesGiven(puzzle, key))) return mode
  const applied: DragMode = mode ?? (connections.has(key) ? 'erase' : 'draw')
  if (applied === 'draw') connections.add(key)
  else connections.delete(key)
  return applied
}

// Suit la voie tracée de l'entrée vers la sortie. Rend la liste des cases,
// ou null si la voie est interrompue, bifurque ou fait une boucle.
export function tracePath(
  connections: Connections,
  puzzle: Puzzle,
): [number, number][] | null {
  const path: [number, number][] = []
  const seen = new Set<string>()
  let r = puzzle.entry.row
  let c = puzzle.entry.col
  let from: Side | null = dirToSide(puzzle.entry.dir)
  for (;;) {
    const key = cellKey(r, c)
    if (seen.has(key)) return null
    seen.add(key)
    path.push([r, c])
    const sides = connectedSides(connections, puzzle, r, c)
    if (sides.length !== 2 || !from || !sides.includes(from)) return null
    const next = sides.find((s) => s !== from)!
    if (isExit(puzzle, r, c) && next === dirToSide(puzzle.exit.dir)) return path
    if (next === 'top') r--
    else if (next === 'bottom') r++
    else if (next === 'left') c--
    else c++
    if (r < 0 || c < 0 || r >= puzzle.size || c >= puzzle.size) return null
    from = oppositeSide(next)
  }
}

// Puzzle résolu : voie continue de l'entrée à la sortie, et chaque compteur
// de ligne / colonne respecté.
export function isSolved(connections: Connections, puzzle: Puzzle): boolean {
  const path = tracePath(connections, puzzle)
  if (!path) return false
  // la voie ne traverse jamais un rocher
  for (const k of puzzle.rocks ?? []) {
    if (path.some(([r, c]) => r === k.row && c === k.col)) return false
  }
  // la voie doit passer par TOUS les rails imposés
  for (const g of puzzle.givens ?? []) {
    if (!path.some(([r, c]) => r === g.row && c === g.col)) return false
  }
  const rows = Array(puzzle.size).fill(0)
  const cols = Array(puzzle.size).fill(0)
  for (const [r, c] of path) {
    rows[r]++
    cols[c]++
  }
  return (
    rows.every((n, i) => n === puzzle.rowClues[i]) &&
    cols.every((n, i) => n === puzzle.colClues[i])
  )
}
