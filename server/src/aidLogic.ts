// Calcul du résultat de chaque aide à partir de la solution. Fonctions pures : aucune base, aucun hasard.
// Le joueur choisit toujours la cible ; le résultat est toujours le même pour une même grille et un même choix.
import type { Side } from '../../shared/cell.js'
import type { Given, Puzzle } from '../../shared/puzzle.js'
import { edgeKey } from '../../shared/track.js'

export type Cell = [number, number]

const sideTo = (a: Cell, b: Cell): Side => (b[0] < a[0] ? 'top' : b[0] > a[0] ? 'bottom' : b[1] < a[1] ? 'left' : 'right')
const dirSide = (d: 'left' | 'right' | 'up' | 'down'): Side => (d === 'up' ? 'top' : d === 'down' ? 'bottom' : d)

// Les deux côtés par lesquels la voie traverse la i-ème case de la solution (entrée et sortie comprises).
export function sidesAt(puzzle: Puzzle, solution: Cell[], i: number): [Side, Side] {
  const from = i === 0 ? dirSide(puzzle.entry.dir) : sideTo(solution[i], solution[i - 1])
  const to = i === solution.length - 1 ? dirSide(puzzle.exit.dir) : sideTo(solution[i], solution[i + 1])
  return [from, to]
}

export const givenAtIndex = (puzzle: Puzzle, solution: Cell[], i: number): Given => ({
  row: solution[i][0],
  col: solution[i][1],
  sides: sidesAt(puzzle, solution, i),
})

export function solutionEdges(solution: Cell[]): Set<string> {
  const s = new Set<string>()
  for (let i = 1; i < solution.length; i++) s.add(edgeKey(solution[i - 1][0], solution[i - 1][1], solution[i][0], solution[i][1])!)
  return s
}

// --- 2. Révéler une case ----------------------------------------------------------------------------------
export function revealCell(puzzle: Puzzle, solution: Cell[], row: number, col: number): { given: Given } | { cross: { row: number; col: number } } {
  const i = solution.findIndex(([r, c]) => r === row && c === col)
  return i < 0 ? { cross: { row, col } } : { given: givenAtIndex(puzzle, solution, i) }
}

// Une case est « bien posée » quand les deux liaisons de la solution qui la touchent sont tracées.
function placedAt(solution: Cell[], have: Set<string>, i: number): boolean {
  if (i > 0 && !have.has(edgeKey(solution[i - 1][0], solution[i - 1][1], solution[i][0], solution[i][1])!)) return false
  if (i < solution.length - 1 && !have.has(edgeKey(solution[i][0], solution[i][1], solution[i + 1][0], solution[i + 1][1])!)) return false
  return true
}

// --- 3. Canon -----------------------------------------------------------------------------------------------
// Révèle des cases de la voie au hasard, mais seulement des cases que le joueur n'a pas déjà bien posées : le tir
// apprend toujours quelque chose. Le nombre suit la taille de la grille pour rester utile sur les grandes.
export const cannonCount = (size: number): number => (size <= 4 ? 3 : size === 5 ? 4 : size <= 7 ? 5 : 6)

export function cannon(puzzle: Puzzle, solution: Cell[], edges: string[], taken: Set<string>, rng: () => number): Given[] {
  const have = new Set(edges)
  const pool = solution.map((_, i) => i).filter((i) => !taken.has(`${solution[i][0]}:${solution[i][1]}`) && !placedAt(solution, have, i))
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  const want = cannonCount(puzzle.size)
  // D'abord une case par ligne et par colonne (impacts bien répartis), puis on complète avec le reste.
  const rows = new Set<number>()
  const cols = new Set<number>()
  const picked: number[] = []
  for (const i of pool) {
    if (picked.length >= want) break
    const [r, c] = solution[i]
    if (rows.has(r) || cols.has(c)) continue
    rows.add(r)
    cols.add(c)
    picked.push(i)
  }
  for (const i of pool) {
    if (picked.length >= want) break
    if (!picked.includes(i)) picked.push(i)
  }
  return picked.sort((x, y) => x - y).map((i) => givenAtIndex(puzzle, solution, i))
}

// --- 4. Révéler une ligne ---------------------------------------------------------------------------------
export function revealLine(puzzle: Puzzle, solution: Cell[], axis: 'row' | 'col', index: number): Given[] {
  const out: Given[] = []
  solution.forEach(([r, c], i) => {
    if ((axis === 'row' ? r : c) === index) out.push(givenAtIndex(puzzle, solution, i))
  })
  return out
}
