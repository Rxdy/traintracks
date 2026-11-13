// Décor d'un niveau gagné : pendant la partie la grille reste nue ; une fois la voie posée, on « habille » le
// paysage autour. Tout est déterministe : un même niveau donne toujours le même tableau (graine tirée du
// puzzle lui-même), et rien ici ne révèle la solution avant la victoire (on part du tracé du joueur).
//
// Règles de cohérence :
//   - une rivière traverse la grille d'un bord à l'autre ; elle passe sous la voie par un pont, seulement
//     là où la voie est droite et la croise à angle droit ;
//   - les maisons forment un hameau le long de la voie ;
//   - les champs sont des groupes de cases voisines, tous labourés dans le même sens ;
//   - les rochers deviennent des montagnes, avec des sapins à leurs pieds ;
//   - le reste est de l'herbe, avec des arbres selon le thème.
import type { Puzzle } from '../puzzle'
import { PARAMS, THEMES, type Theme } from './themes'

export { THEMES, themeForLevel, LEVELS_PER_THEME, timing, type Theme } from './themes'


export type TileKind = 'rail' | 'grass' | 'tree' | 'pine' | 'house' | 'field' | 'mountain' | 'boulder' | 'snowman'

export interface Tile {
  kind: TileKind
  v: number // variante (couleur, forme) : 0..n
  dir?: 'h' | 'v' // sens des sillons d'un champ
}
export interface Pt {
  x: number
  y: number
}
export interface Scenery {
  size: number
  theme: Theme
  tiles: Tile[][]
  water: Set<string> // cases d'eau « sous le sol » (rivière / étang) : "r,c"
  river: Pt[] | null // ligne de la rivière, en unités de case (hors grille aux deux bouts)
  pond: [number, number][] // étang de repli quand aucune rivière ne passe
  bridges: Map<string, 'h' | 'v'> // cases de voie posées sur la rivière → axe de la voie (le pont la porte)
}

type Cell = [number, number]
const key = (r: number, c: number) => `${r},${c}`
const DIRS: Cell[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
]

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}
function rng(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function shuffle<T>(a: T[], rand: () => number): T[] {
  const out = [...a]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function seedOf(p: Puzzle): number {
  return hash(JSON.stringify([p.size, p.rowClues, p.colClues, p.entry, p.exit, p.rocks ?? []]))
}

export function buildScenery(puzzle: Puzzle, path: Cell[], theme?: Theme, seed = seedOf(puzzle)): Scenery {
  const n = puzzle.size
  const rand = rng(seed)
  const th: Theme = theme ?? THEMES[Math.floor(rand() * THEMES.length)]
  const P = PARAMS[th]

  const onPath = new Set(path.map(([r, c]) => key(r, c)))
  const rocks = new Set((puzzle.rocks ?? []).map((k) => key(k.row, k.col)))
  const inside = (r: number, c: number) => r >= 0 && c >= 0 && r < n && c < n
  const isFree = (r: number, c: number) => inside(r, c) && !onPath.has(key(r, c)) && !rocks.has(key(r, c))

  // Case de voie droite : [axe] 'h' (gauche-droite) ou 'v' ; entrée et sortie exclues (la voie y sort du cadre).
  const straight = new Map<string, 'h' | 'v'>()
  path.forEach(([r, c], i) => {
    if (i === 0 || i === path.length - 1) return
    const [pr, pc] = path[i - 1]
    const [nr, nc] = path[i + 1]
    if (pr === nr) straight.set(key(r, c), 'h')
    else if (pc === nc) straight.set(key(r, c), 'v')
  })

  // --- Rivière : plus court chemin d'un bord à un autre, par cases libres ou ponts ---
  const water = new Set<string>()
  const bridges = new Map<string, 'h' | 'v'>()
  let river: Pt[] | null = null
  const wantsRiver = rand() < P.river
  if (wantsRiver) {
    const borders: { cell: Cell; out: Cell }[] = []
    for (let i = 0; i < n; i++) {
      borders.push({ cell: [0, i], out: [-1, 0] }, { cell: [n - 1, i], out: [1, 0] })
      borders.push({ cell: [i, 0], out: [0, -1] }, { cell: [i, n - 1], out: [0, 1] })
    }
    const starts = shuffle(borders.filter((b) => isFree(b.cell[0], b.cell[1])), rand)
    let best: { cells: Cell[]; bridgeAt: string[]; s: (typeof starts)[0]; e: (typeof starts)[0] } | null = null
    for (const s of starts.slice(0, 8)) {
      // BFS depuis s.cell
      const prev = new Map<string, { from: string; bridge?: string }>()
      const seen = new Set([key(...s.cell)])
      const queue: Cell[] = [s.cell]
      let found: { cell: Cell; out: Cell } | null = null
      while (queue.length && !found) {
        const [r, c] = queue.shift()!
        // arrivée : case de bord, sur un côté différent de celui du départ
        const exits = borders.filter((b) => b.cell[0] === r && b.cell[1] === c && (b.out[0] !== s.out[0] || b.out[1] !== s.out[1]))
        const dist = pathLen(prev, key(r, c), key(...s.cell))
        if (exits.length && dist >= Math.max(2, n - 2)) {
          found = exits[Math.floor(rand() * exits.length)]
          break
        }
        for (const [dr, dc] of DIRS) {
          const nr = r + dr
          const nc = c + dc
          if (isFree(nr, nc) && !seen.has(key(nr, nc))) {
            seen.add(key(nr, nc))
            prev.set(key(nr, nc), { from: key(r, c) })
            queue.push([nr, nc])
          } else if (inside(nr, nc) && straight.has(key(nr, nc))) {
            const ax = straight.get(key(nr, nc))!
            // la voie doit être perpendiculaire au sens du fleuve
            if ((ax === 'h') !== (dr === 0) && isFree(r + 2 * dr, c + 2 * dc) && !seen.has(key(r + 2 * dr, c + 2 * dc))) {
              const to: Cell = [r + 2 * dr, c + 2 * dc]
              seen.add(key(...to))
              prev.set(key(...to), { from: key(r, c), bridge: key(nr, nc) })
              queue.push(to)
            }
          }
        }
      }
      if (found) {
        // reconstruction
        const cells: Cell[] = []
        const bridgeAt: string[] = []
        let cur = key(...found.cell)
        while (cur) {
          const [r, c] = cur.split(',').map(Number)
          cells.unshift([r, c])
          const p = prev.get(cur)
          if (!p) break
          if (p.bridge) bridgeAt.push(p.bridge)
          cur = p.from
        }
        if (!best || cells.length > best.cells.length) best = { cells, bridgeAt, s, e: found }
        if (best.cells.length >= n) break
      }
    }
    if (best) {
      const pts: Pt[] = [{ x: best.s.cell[1] + 0.5 + best.s.out[1], y: best.s.cell[0] + 0.5 + best.s.out[0] }]
      best.cells.forEach(([r, c], i) => {
        pts.push({ x: c + 0.5, y: r + 0.5 })
        water.add(key(r, c))
        // pont : le point du milieu de la case de voie est sur la ligne droite entre les deux cases libres
        if (i < best!.cells.length - 1) {
          const [nr, nc] = best!.cells[i + 1]
          if (Math.abs(nr - r) + Math.abs(nc - c) === 2) pts.push({ x: (c + nc) / 2 + 0.5, y: (r + nr) / 2 + 0.5 })
        }
      })
      pts.push({ x: best.e.cell[1] + 0.5 + best.e.out[1], y: best.e.cell[0] + 0.5 + best.e.out[0] })
      river = pts
      best.bridgeAt.forEach((b) => bridges.set(b, straight.get(b)!))
    }
  }

  // --- Étang de repli : deux cases voisines libres ---
  const pond: Cell[] = []
  if (!river && wantsRiver) {
    const free: Cell[] = []
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (isFree(r, c)) free.push([r, c])
    const pairs: Cell[][] = []
    free.forEach(([r, c]) => {
      if (isFree(r, c + 1)) pairs.push([[r, c], [r, c + 1]])
      if (isFree(r + 1, c)) pairs.push([[r, c], [r + 1, c]])
    })
    if (pairs.length >= 1 && free.length >= 5) {
      const p = pairs[Math.floor(rand() * pairs.length)]
      p.forEach(([r, c]) => {
        pond.push([r, c])
        water.add(key(r, c))
      })
    }
  }

  const tiles: Tile[][] = Array.from({ length: n }, () => Array.from({ length: n }, () => ({ kind: 'grass' as TileKind, v: 0 })))
  path.forEach(([r, c]) => (tiles[r][c] = { kind: 'rail', v: 0 }))
  const taken = new Set<string>(water)
  const free = (r: number, c: number) => isFree(r, c) && !taken.has(key(r, c))

  // --- Montagnes : les rochers ---
  rocks.forEach((k) => {
    const [r, c] = k.split(',').map(Number)
    tiles[r][c] = { kind: 'mountain', v: Math.floor(rand() * 3) }
    taken.add(k)
  })

  // --- Hameau le long de la voie ---
  const freeCells: Cell[] = []
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (free(r, c)) freeCells.push([r, c])
  const nearPath = (r: number, c: number) => DIRS.some(([dr, dc]) => onPath.has(key(r + dr, c + dc)))
  const houseCount = Math.min(P.houseBase + Math.floor(freeCells.length * P.houseRatio), freeCells.length)
  const houses: Cell[] = []
  for (let i = 0; i < houseCount; i++) {
    const cands = freeCells.filter(([r, c]) => free(r, c) && (houses.length ? DIRS.some(([dr, dc]) => houses.some(([hr, hc]) => hr === r + dr && hc === c + dc)) : nearPath(r, c)) && nearPath(r, c))
    const pool = cands.length ? cands : freeCells.filter(([r, c]) => free(r, c) && nearPath(r, c))
    if (!pool.length) break
    const [r, c] = pool[Math.floor(rand() * pool.length)]
    tiles[r][c] = { kind: 'house', v: Math.floor(rand() * 4) }
    taken.add(key(r, c))
    houses.push([r, c])
  }

  // --- Champs : groupes de 2 à 3 cases voisines, même sens, même culture ---
  const touchesField = (r: number, c: number) => DIRS.some(([dr, dc]) => tiles[r + dr]?.[c + dc]?.kind === 'field')
  for (let g = 0; g < P.fields; g++) {
    const seeds = freeCells.filter(([r, c]) => free(r, c) && !touchesField(r, c))
    if (!seeds.length) break
    const [sr, sc] = seeds[Math.floor(rand() * seeds.length)]
    const v = Math.floor(rand() * 3)
    const dir: 'h' | 'v' = rand() < 0.5 ? 'h' : 'v'
    const group: Cell[] = [[sr, sc]]
    taken.add(key(sr, sc))
    const want = 2 + Math.floor(rand() * 2)
    while (group.length < want) {
      const nb: Cell[] = []
      group.forEach(([r, c]) => DIRS.forEach(([dr, dc]) => free(r + dr, c + dc) && !touchesField(r + dr, c + dc) && nb.push([r + dr, c + dc])))
      if (!nb.length) break
      const [r, c] = nb[Math.floor(rand() * nb.length)]
      group.push([r, c])
      taken.add(key(r, c))
    }
    group.forEach(([r, c]) => (tiles[r][c] = { kind: 'field', v, dir }))
  }

  // --- Reste : montagnes d'arrière-plan, arbres, sapins, rochers, bonshommes de neige, herbe ---
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!free(r, c)) continue
      const nearRock = DIRS.some(([dr, dc]) => rocks.has(key(r + dr, c + dc)))
      const nearHouse = DIRS.some(([dr, dc]) => tiles[r + dr]?.[c + dc]?.kind === 'house')
      const roll = rand()
      const variant = Math.floor(rand() * 3)
      if ((!nearPath(r, c) || P.peaks >= 0.3) && roll < P.peaks) tiles[r][c] = { kind: 'mountain', v: variant }
      else if (nearRock && roll < 0.8) tiles[r][c] = { kind: 'pine', v: variant }
      else if (nearHouse && rand() < P.snowmen) tiles[r][c] = { kind: 'snowman', v: variant }
      else if (roll < P.peaks + P.tree) tiles[r][c] = { kind: rand() < P.pine ? 'pine' : 'tree', v: variant }
      else if (rand() < P.boulders) tiles[r][c] = { kind: 'boulder', v: variant }
      else tiles[r][c] = { kind: 'grass', v: variant }
    }
  }

  return { size: n, theme: th, tiles, water, river, pond, bridges }
}

function pathLen(prev: Map<string, { from: string }>, from: string, start: string): number {
  let n = 1
  let cur = from
  while (cur !== start && prev.has(cur)) {
    cur = prev.get(cur)!.from
    n++
  }
  return n
}
