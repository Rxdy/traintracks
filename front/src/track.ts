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

import type { Side } from './cell'
import { isEntry, isExit, type Direction, type Puzzle } from './puzzle'

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
  if (isRail(connections, rails, puzzle, r, c)) return
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
  if (isEntry(puzzle, r, c) || isExit(puzzle, r, c)) return
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
  for (const key of incidentEdges(puzzle.size, r, c)) {
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
): DragMode | null {
  const key = edgeKey(r1, c1, r2, c2)
  if (!key) return mode
  const applied: DragMode = mode ?? (connections.has(key) ? 'erase' : 'draw')
  if (applied === 'draw') connections.add(key)
  else connections.delete(key)
  return applied
}
