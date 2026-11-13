// Générateur de puzzles Train Tracks à solution UNIQUE.
//
// Méthode : on tire au hasard une voie (chemin sans croisement de l'entrée à la sortie), on en déduit les
// compteurs, puis le solveur compte les solutions. Si la grille en a plusieurs, on la rend plus précise en
// imposant quelques rails de la voie (le moins possible) ; sinon on retire un autre tirage.
//
// Déterministe : une même graine donne toujours la même grille, sur n'importe quelle machine (nombres
// entiers uniquement). C'est ce qui permet d'avoir « le puzzle du jour » sans le stocker à l'avance.
import type { Side } from './cell.js'
import type { Given, Puzzle, Rock } from './puzzle.js'
import { solve } from './solver.js'

export type Cell = [number, number]

// --- Nombres pseudo-aléatoires à partir d'une graine (texte) -----------------------------------------------
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return (h ^= h >>> 16) >>> 0
  }
}
export function makeRng(seed: string): () => number {
  let a = xmur3(seed)()
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const int = (rand: () => number, n: number) => Math.floor(rand() * n)
function shuffle<T>(rand: () => number, a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = int(rand, i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// --- Tirage d'une voie ------------------------------------------------------------------------------------
const STEPS: Cell[] = [[0, 1], [1, 0], [-1, 0], [0, -1]]
const NODE_BUDGET = 4000

function randomPath(rand: () => number, size: number, entry: Cell, exit: Cell, minLen: number, maxLen: number): Cell[] | null {
  const seen = Array.from({ length: size }, () => Array(size).fill(false))
  const path: Cell[] = []
  let nodes = 0
  const walk = (r: number, c: number): boolean => {
    if (++nodes > NODE_BUDGET) return false
    seen[r][c] = true
    path.push([r, c])
    if (r === exit[0] && c === exit[1]) {
      if (path.length >= minLen) return true
    } else if (path.length < maxLen) {
      for (const [dr, dc] of shuffle(rand, [...STEPS])) {
        const nr = r + dr
        const nc = c + dc
        if (nr < 0 || nc < 0 || nr >= size || nc >= size || seen[nr][nc]) continue
        if (walk(nr, nc)) return true
        if (nodes > NODE_BUDGET) break
      }
    }
    seen[r][c] = false
    path.pop()
    return false
  }
  return walk(entry[0], entry[1]) ? path : null
}

const sideTo = (a: Cell, b: Cell): Side => (b[0] < a[0] ? 'top' : b[0] > a[0] ? 'bottom' : b[1] < a[1] ? 'left' : 'right')

function givenAt(path: Cell[], i: number): Given {
  return { row: path[i][0], col: path[i][1], sides: [sideTo(path[i], path[i - 1]), sideTo(path[i], path[i + 1])] }
}

export interface Generated {
  puzzle: Puzzle
  solution: Cell[]
  givens: number // rails imposés (0 = grille « pure »)
  rocks: number // rochers (0 = aucun)
  attempts: number
  difficulty: number // cases explorées par le solveur pour trancher : mesure grossière, sert à ordonner les niveaux
}

export const MIN_SIZE = 4
export const MAX_SIZE = 8

// `maxGivens` : combien de rails imposés au plus pour garantir l'unicité (le moins possible est préféré).
// `minGivens` : nombre de rails imposés posés d'office (niveaux « avec rails imposés »).
// `needGivens` : la grille doit être AMBIGUË sans ses rails imposés (ils servent vraiment, ce ne sont pas des cadeaux inutiles).
// `rocks` : si présent, la grille a entre `min` et `max` rochers, et ils servent vraiment (sans eux, plusieurs solutions).
// Vrai si les règles présentes servent : sans elles la grille a plusieurs solutions.
export function rulesAreUseful(puzzle: Puzzle, needGivens = true): boolean {
  const g = (puzzle.givens?.length ?? 0) > 0
  const k = (puzzle.rocks?.length ?? 0) > 0
  if (g && k) return solve({ ...puzzle, givens: undefined, rocks: undefined }, 2).count >= 2
  if (k) return solve({ ...puzzle, rocks: undefined }, 2).count >= 2
  if (g && needGivens) return solve({ ...puzzle, givens: undefined }, 2).count >= 2
  return true
}

export interface RockOptions {
  min: number
  max: number
}

export function generate(seed: string, size: number, maxGivens = 4, minGivens = 0, needGivens = false, rockOpts?: RockOptions): Generated {
  if (!Number.isInteger(size) || size < MIN_SIZE || size > MAX_SIZE) throw new Error(`taille ${size} hors de ${MIN_SIZE}-${MAX_SIZE}`)
  const rand = makeRng(`${seed}|${size}`)
  const minLen = Math.ceil(size * size * 0.4)
  const maxLen = Math.floor(size * size * 0.7)

  for (let attempt = 1; attempt <= 600; attempt++) {
    // Les premiers tirages cherchent une grille sans rail imposé ; on en accepte de plus en plus au fil des essais.
    const allowed = Math.max(minGivens, Math.min(maxGivens, Math.floor(attempt / 30)))
    const entry: Cell = [int(rand, size), 0]
    const toRight = rand() < 0.5
    const exit: Cell = toRight ? [int(rand, size), size - 1] : [size - 1, int(rand, size)]
    if (entry[0] === exit[0] && entry[1] === exit[1]) continue
    const path = randomPath(rand, size, entry, exit, minLen, maxLen)
    if (!path) continue

    const rowClues = Array(size).fill(0)
    const colClues = Array(size).fill(0)
    for (const [r, c] of path) {
      rowClues[r]++
      colClues[c]++
    }
    const base: Puzzle = {
      size,
      rowClues,
      colClues,
      entry: { row: entry[0], col: 0, dir: 'left' },
      exit: { row: exit[0], col: exit[1], dir: toRight ? 'right' : 'down' },
    }

    if (needGivens && solve(base, 2).count === 1) continue // déjà unique sans rails imposés : ils ne serviraient à rien

    // Les rails imposés possibles : cases intérieures de la voie (jamais l'entrée ni la sortie).
    const candidates = shuffle(rand, path.map((_, i) => i).filter((i) => i > 0 && i < path.length - 1))
    const givens: Given[] = []
    while (givens.length < minGivens && candidates.length) givens.push(givenAt(path, candidates.pop()!))
    if (givens.length < minGivens) continue

    // Les rochers possibles : cases hors de la voie, de préférence voisines d'elle (sinon ils ne servent à rien).
    const onPath = new Set(path.map(([r, c]) => `${r}:${c}`))
    const rockCands: Rock[] = []
    if (rockOpts) {
      const near = new Set<string>()
      for (const [r, c] of path) for (const [dr, dc] of STEPS) {
        const nr = r + dr
        const nc = c + dc
        if (nr >= 0 && nc >= 0 && nr < size && nc < size && !onPath.has(`${nr}:${nc}`)) near.add(`${nr}:${nc}`)
      }
      for (const k of shuffle(rand, [...near])) {
        const [r, c] = k.split(':').map(Number)
        rockCands.push({ row: r, col: c })
      }
    }
    const rocks: Rock[] = []
    while (rockOpts && rocks.length < rockOpts.min && rockCands.length) rocks.push(rockCands.pop()!)
    if (rockOpts && rocks.length < rockOpts.min) continue
    const build = (): Puzzle => ({ ...base, ...(givens.length ? { givens: [...givens] } : {}), ...(rocks.length ? { rocks: [...rocks] } : {}) })

    for (let k = givens.length; k <= allowed; k++) {
      let puzzle = build()
      let res = solve(puzzle, 2)
      // Les rochers passent avant les rails imposés : on en ajoute jusqu'à `max` tant que la grille a plusieurs solutions.
      while (res.count > 1 && rockOpts && rocks.length < rockOpts.max && rockCands.length) {
        rocks.push(rockCands.pop()!)
        puzzle = build()
        res = solve(puzzle, 2)
      }
      if (res.count === 1) {
        // Les règles doivent servir : seule, une règle rend la grille unique (sans elle : plusieurs solutions) ;
        // combinées, c'est l'ensemble qui compte.
        if (!rulesAreUseful(puzzle, needGivens)) break
        return { puzzle, solution: path, givens: givens.length, rocks: rocks.length, attempts: attempt, difficulty: res.nodes }
      }
      if (res.count === 0) throw new Error('le solveur ne retrouve pas la voie tirée') // ne doit jamais arriver
      if (k === allowed || !candidates.length) break
      givens.push(givenAt(path, candidates.pop()!))
    }
  }
  throw new Error(`aucune grille ${size}×${size} à solution unique trouvée pour « ${seed} »`)
}
