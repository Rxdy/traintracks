// Solveur exhaustif de Train Tracks.
//
// Cherche TOUS les chemins simples de l'entrée à la sortie dont le nombre de
// cases par ligne / colonne égale les compteurs. Sert à vérifier qu'un niveau
// est réalisable et que sa solution est UNIQUE (et, plus tard, à générer les
// puzzles quotidiens).
import { oppositeSide, type Side } from './cell.js'
import type { Puzzle } from './puzzle.js'

export interface SolveResult {
  count: number // nombre de solutions trouvées (arrêt à `limit`)
  solutions: [number, number][][]
  // Cases explorées par la recherche : mesure GROSSIÈRE de la difficulté (un humain raisonne autrement qu'un solveur).
  nodes: number
}

const STEPS: { dr: number; dc: number; side: Side }[] = [
  { dr: 0, dc: 1, side: 'right' },
  { dr: 1, dc: 0, side: 'bottom' },
  { dr: -1, dc: 0, side: 'top' },
  { dr: 0, dc: -1, side: 'left' },
]

export function solve(puzzle: Puzzle, limit = 2): SolveResult {
  const { size, rowClues, colClues, entry, exit } = puzzle
  const rows = Array(size).fill(0)
  const cols = Array(size).fill(0)
  const seen = Array.from({ length: size }, () => Array(size).fill(false))
  const path: [number, number][] = []
  // rails imposés : la voie y entre par un de leurs côtés et sort par l'autre
  const givens = new Map<string, [Side, Side]>()
  for (const g of puzzle.givens ?? []) givens.set(`${g.row}:${g.col}`, g.sides)
  const rocks = new Set((puzzle.rocks ?? []).map((k) => `${k.row}:${k.col}`)) // la voie ne les traverse jamais
  let givenVisited = 0
  let nodes = 0
  const solutions: [number, number][][] = []

  function visit(r: number, c: number): boolean {
    // le compteur ne doit jamais être dépassé
    if (rows[r] + 1 > rowClues[r] || cols[c] + 1 > colClues[c]) return false
    nodes++
    rows[r]++
    cols[c]++
    seen[r][c] = true
    path.push([r, c])
    if (givens.has(`${r}:${c}`)) givenVisited++
    return true
  }
  function leave(r: number, c: number): void {
    rows[r]--
    cols[c]--
    seen[r][c] = false
    path.pop()
    if (givens.has(`${r}:${c}`)) givenVisited--
  }

  // `from` : côté de la case actuelle par lequel la voie est arrivée
  function dfs(r: number, c: number, from: Side): void {
    if (solutions.length >= limit) return
    if (r === exit.row && c === exit.col) {
      // la voie s'arrête à la sortie : tous les compteurs et rails imposés atteints
      if (
        givenVisited === givens.size &&
        rows.every((n, i) => n === rowClues[i]) &&
        cols.every((n, i) => n === colClues[i])
      ) {
        solutions.push(path.map(([a, b]) => [a, b] as [number, number]))
      }
      return
    }
    const here = givens.get(`${r}:${c}`)
    for (const { dr, dc, side } of STEPS) {
      if (side === from) continue
      // sur un rail imposé, on ne peut sortir que par son autre côté
      if (here && !(here.includes(from) && here.includes(side))) continue
      const nr = r + dr
      const nc = c + dc
      if (nr < 0 || nc < 0 || nr >= size || nc >= size || seen[nr][nc] || rocks.has(`${nr}:${nc}`)) continue
      // en entrant sur un rail imposé, il faut arriver par un de ses côtés
      const target = givens.get(`${nr}:${nc}`)
      if (target && !target.includes(oppositeSide(side))) continue
      if (!visit(nr, nc)) continue
      dfs(nr, nc, oppositeSide(side))
      leave(nr, nc)
    }
  }

  const entrySide: Side = entry.dir === 'up' ? 'top' : entry.dir === 'down' ? 'bottom' : entry.dir
  if (visit(entry.row, entry.col)) dfs(entry.row, entry.col, entrySide)
  return { count: solutions.length, solutions, nodes }
}
