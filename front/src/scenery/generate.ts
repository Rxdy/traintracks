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


export type TileKind = 'rail' | 'grass' | 'tree' | 'pine' | 'house' | 'field' | 'mountain' | 'boulder' | 'snowman' | 'road' | 'windmill' | 'cactus' | 'palm' | 'crater' | 'obsidian' | 'vent' | 'deadtree' | 'skull' | 'building' | 'mesa' | 'dune'

export interface Tile {
  kind: TileKind
  v: number // variante (couleur, forme) : 0..n
  dir?: 'h' | 'v' // sens des sillons d'un champ
}
export interface Pt {
  x: number
  y: number
}
// Route droite d'un bord à l'autre : `axis` 'v' = de haut en bas dans la colonne `line` ; 'h' = de gauche à droite
// dans la ligne `line`. Si elle croise la voie, c'est par un passage à niveau (case `crossing`).
export interface Road {
  axis: 'h' | 'v'
  line: number
  crossing: [number, number] | null
}
export interface Scenery {
  seed: number
  margin: { x: number; y: number; b: number } // cases de paysage autour de la grille : à gauche/droite (x), en haut (y), en bas (b)
  frame: { k: number; visibleRows: number } // échelle de la grille à la victoire, et hauteur (en cases du décor) réellement visible
  rows: number // hauteur du décor en cases
  cols: number // largeur du décor en cases (≥ hauteur quand l'écran est large)
  ext: Pt[][] // prolongements de la voie hors de la grille (entrée, sortie), en unités de case du décor
  road: Road | null
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
export function rng(seed: number): () => number {
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

// Combien de cases de paysage ajouter autour d'une grille de jeu : les petites grilles (4×4) donneraient un décor
// minuscule, alors on montre un paysage d'environ 10×10 cases avec la voie au milieu.
export function sceneryMargin(size: number): number {
  return size <= 4 ? 3 : size <= 6 ? 2 : 1 // au moins 1 : le décor sépare toujours la grille de l'interface (récap, pouvoirs)
}

// `margin` : cases de paysage AJOUTÉES autour de la grille de jeu, en hauteur (y) et en largeur (x) : le décor est plus
// grand que la grille, et plus LARGE que haut sur un grand écran (pour que le train ne roule pas dans du blanc).
// La voie se prolonge en ligne droite jusqu'au bord. Tout se calcule alors sur la grande grille, chemin décalé.
// `top` et `below` (cases, téléphone et tablette) : du paysage en plus au-dessus (jusqu'en haut de l'écran) et en dessous (jusqu'à
// la cabine), sans changer l'échelle de la grille : aucune bande vide autour du décor.
export function buildScenery(puzzle: Puzzle, smallPath: Cell[], theme?: Theme, seed = seedOf(puzzle), margin: number | { x: number; y: number; b?: number; top?: number; below?: number } = 0): Scenery {
  const mx0 = typeof margin === 'number' ? margin : margin.x
  const my0 = typeof margin === 'number' ? margin : margin.y
  const top = typeof margin === 'number' ? 0 : Math.max(0, Math.ceil(margin.top ?? 0))
  const below = typeof margin === 'number' ? 0 : Math.max(0, margin.below ?? 0)
  const N0 = puzzle.size
  // À la victoire la grille rétrécit (échelle k) et le décor doit couvrir TOUTE la zone d'origine, du haut de la grille
  // jusqu'en bas de la colonne des indices : d'où des cases en plus sous la grille (b), pas de blanc avant le récapitulatif.
  const k = my0 > 0 ? N0 / (N0 + 2 * my0) : 1
  const bottom = N0 / 2 + (N0 / 2 + 1) / k + below // bas visible, en cases du décor, depuis le haut de la grille
  const b0 = typeof margin === 'number' || margin.b === undefined ? (my0 > 0 ? Math.ceil(bottom) - N0 : 0) : margin.b
  const mg = { x: mx0, y: my0 + top, b: b0 }
  const rows = N0 + mg.y + mg.b
  const cols = N0 + 2 * mg.x
  const frame = { k, visibleRows: my0 > 0 ? bottom + mg.y : rows }
  const n = Math.min(rows, cols)
  const shifted: Cell[] = smallPath.map(([r, c]) => [r + mg.y, c + mg.x])
  const OUTV: Record<string, Cell> = { left: [0, -1], right: [0, 1], up: [-1, 0], down: [1, 0] }
  const lead = (dir: string) => (dir === 'left' || dir === 'right' ? mg.x : dir === 'up' ? mg.y : mg.b) // cases de paysage dans le sens de la voie
  let path = shifted
  const ext: Pt[][] = []
  if ((mg.x > 0 || mg.y > 0 || mg.b > 0) && shifted.length) {
    const [er, ec] = shifted[0]
    const [xr, xc] = shifted[shifted.length - 1]
    const eo = OUTV[puzzle.entry.dir]
    const xo = OUTV[puzzle.exit.dir]
    const me = lead(puzzle.entry.dir)
    const mx = lead(puzzle.exit.dir)
    const pre: Cell[] = Array.from({ length: me }, (_, k) => [er + eo[0] * (me - k), ec + eo[1] * (me - k)])
    const post: Cell[] = Array.from({ length: mx }, (_, k) => [xr + xo[0] * (k + 1), xc + xo[1] * (k + 1)])
    path = [...pre, ...shifted, ...post]
    // prolongements dessinés par le décor (la grille de jeu, elle, ne dessine que ses propres cases)
    if (me > 0) ext.push([{ x: ec + 0.5 + eo[1] * (me + 0.5), y: er + 0.5 + eo[0] * (me + 0.5) }, { x: ec + 0.5 + eo[1] * 0.5, y: er + 0.5 + eo[0] * 0.5 }])
    if (mx > 0) ext.push([{ x: xc + 0.5 + xo[1] * 0.5, y: xr + 0.5 + xo[0] * 0.5 }, { x: xc + 0.5 + xo[1] * (mx + 0.5), y: xr + 0.5 + xo[0] * (mx + 0.5) }])
  }
  const rand = rng(seed)
  const th: Theme = theme ?? THEMES[Math.floor(rand() * THEMES.length)]
  const P = PARAMS[th]

  const onPath = new Set(path.map(([r, c]) => key(r, c)))
  const rocks = new Set((puzzle.rocks ?? []).map((k) => key(k.row + mg.y, k.col + mg.x)))
  const inside = (r: number, c: number) => r >= 0 && c >= 0 && r < rows && c < cols
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

  // --- Rivière : d'un bord à un autre (côtés tirés au hasard), qui serpente, par cases libres ou ponts ---
  const water = new Set<string>()
  const bridges = new Map<string, 'h' | 'v'>()
  let river: Pt[] | null = null
  const wantsRiver = rand() < P.river
  if (wantsRiver) {
    const borders: { cell: Cell; out: Cell }[] = []
    for (let i = 0; i < cols; i++) borders.push({ cell: [0, i], out: [-1, 0] }, { cell: [rows - 1, i], out: [1, 0] })
    for (let i = 0; i < rows; i++) borders.push({ cell: [i, 0], out: [0, -1] }, { cell: [i, cols - 1], out: [0, 1] })
    // Départ et arrivée tirés au hasard sur deux côtés (le plus souvent opposés), puis un chemin qui serpente
    // (chaque case a un « coût de détour » fixé par la graine) : la rivière ne coupe plus toujours le même coin.
    const SIDES: Cell[] = [[-1, 0], [1, 0], [0, -1], [0, 1]]
    const onSide = (o: Cell) => borders.filter((b) => b.out[0] === o[0] && b.out[1] === o[1] && isFree(b.cell[0], b.cell[1]))
    const wob = new Map<string, number>()
    const detour = (r: number, c: number) => {
      const k = key(r, c)
      if (!wob.has(k)) wob.set(k, rand() * 1.6)
      return wob.get(k)!
    }
    type End = (typeof borders)[0]
    let best: { cells: Cell[]; bridgeAt: string[]; s: End; e: End } | null = null
    for (let attempt = 0; attempt < 10; attempt++) {
      const so = SIDES[Math.floor(rand() * 4)]
      const opposite: Cell = [-so[0], -so[1]]
      const adjacent = SIDES.filter((d) => d !== so && !(d[0] === opposite[0] && d[1] === opposite[1]))
      const to = rand() < 0.55 ? opposite : adjacent[Math.floor(rand() * 2)]
      const sc = onSide(so)
      const ec = onSide(to)
      if (!sc.length || !ec.length) continue
      const s = sc[Math.floor(rand() * sc.length)]
      const e = ec[Math.floor(rand() * ec.length)]
      // Dijkstra sur les cases libres (+ ponts sur la voie droite), coût 1 + détour
      const dist = new Map<string, number>([[key(...s.cell), 0]])
      const prev = new Map<string, { from: string; bridge?: string }>()
      const open: Cell[] = [s.cell]
      const done = new Set<string>()
      const relax = (from: Cell, to2: Cell, add: number, bridge?: string) => {
        const k = key(...to2)
        const d = dist.get(key(...from))! + add
        if (d < (dist.get(k) ?? Infinity) && !done.has(k)) {
          dist.set(k, d)
          prev.set(k, { from: key(...from), bridge })
          if (!open.some(([r, c]) => r === to2[0] && c === to2[1])) open.push(to2)
        }
      }
      const target = key(...e.cell)
      while (open.length) {
        let bi = 0
        for (let i = 1; i < open.length; i++) if (dist.get(key(...open[i]))! < dist.get(key(...open[bi]))!) bi = i
        const [r, c] = open.splice(bi, 1)[0]
        done.add(key(r, c))
        if (key(r, c) === target) break
        for (const [dr, dc] of DIRS) {
          const nr = r + dr
          const nc = c + dc
          if (isFree(nr, nc)) relax([r, c], [nr, nc], 1 + detour(nr, nc))
          else if (inside(nr, nc) && straight.has(key(nr, nc))) {
            const ax = straight.get(key(nr, nc))!
            if ((ax === 'h') !== (dr === 0) && isFree(r + 2 * dr, c + 2 * dc)) relax([r, c], [r + 2 * dr, c + 2 * dc], 3, key(nr, nc))
          }
        }
      }
      if (!done.has(target)) continue
      const cells: Cell[] = []
      const bridgeAt: string[] = []
      let cur = target
      while (cur) {
        const [r, c] = cur.split(',').map(Number)
        cells.unshift([r, c])
        const p = prev.get(cur)
        if (!p) break
        if (p.bridge) bridgeAt.push(p.bridge)
        cur = p.from
      }
      if (!best || cells.length > best.cells.length) best = { cells, bridgeAt, s, e }
      if (best.cells.length >= Math.max(3, n - 2)) break
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
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (isFree(r, c)) free.push([r, c])
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

  const tiles: Tile[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ kind: 'grass' as TileKind, v: 0 })))
  path.forEach(([r, c]) => (tiles[r][c] = { kind: 'rail', v: 0 }))
  const taken = new Set<string>(water)

  // --- Route : ligne droite sans rivière ni rocher ; croise la voie au plus une fois, à angle droit, là où elle
  // est droite (passage à niveau). Tirée d'une graine à part : ajouter la route ne change pas le reste du hasard.
  const rr = rng(seed ^ 0x51ed270b)
  let road: Road | null = null
  if (rr() < P.road) {
    const cands: Road[] = []
    for (const axis of ['v', 'h'] as const) {
      for (let line = 0; line < (axis === 'v' ? cols : rows); line++) {
        const crossings: Cell[] = []
        let ok = true
        for (let i = 0; i < (axis === 'v' ? rows : cols) && ok; i++) {
          const [r, c] = axis === 'v' ? [i, line] : [line, i]
          const k = key(r, c)
          if (onPath.has(k)) {
            if (straight.get(k) === (axis === 'v' ? 'h' : 'v') && !bridges.has(k)) crossings.push([r, c])
            else ok = false
          } else if (!isFree(r, c) || water.has(k)) ok = false
        }
        if (ok && crossings.length <= 1) cands.push({ axis, line, crossing: crossings[0] ?? null })
      }
    }
    const crossing = cands.filter((x) => x.crossing)
    const pool = crossing.length ? crossing : cands.filter(() => rr() < 0.35)
    if (pool.length) road = pool[Math.floor(rr() * pool.length)]
  }
  if (road) {
    for (let i = 0; i < (road.axis === 'v' ? rows : cols); i++) {
      const [r, c] = road.axis === 'v' ? [i, road.line] : [road.line, i]
      if (onPath.has(key(r, c))) continue
      tiles[r][c] = { kind: 'road', v: 0, dir: road.axis }
      taken.add(key(r, c))
    }
  }
  const free = (r: number, c: number) => isFree(r, c) && !taken.has(key(r, c))

  // --- Montagnes : les rochers ---
  rocks.forEach((k) => {
    const [r, c] = k.split(',').map(Number)
    tiles[r][c] = { kind: 'mountain', v: Math.floor(rand() * 3) }
    taken.add(k)
  })

  // --- Hameaux : de petits groupes de maisons un peu partout (ni alignées le long de la voie, ni toutes collées à elle) ---
  const freeCells: Cell[] = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (free(r, c)) freeCells.push([r, c])
  const nearPath = (r: number, c: number) => DIRS.some(([dr, dc]) => onPath.has(key(r + dr, c + dc)))
  const dense = P.houseKind === 'building' // la ville : de vrais quartiers
  const houseCount = Math.min(P.houseBase + Math.floor(freeCells.length * P.houseRatio * (dense ? 1 : 0.3)), freeCells.length)
  const houses: Cell[] = []
  const touchesHouse = (r: number, c: number) => [-1, 0, 1].some((dr) => [-1, 0, 1].some((dc) => houses.some(([a, b]) => a === r + dr && b === c + dc)))
  for (let guard = 0; houses.length < houseCount && guard < 60; guard++) {
    // Hameaux de 1 à 3 maisons (la ville : quartiers de 9) ; deux hameaux ne se touchent jamais, sinon les maisons « se suivent ».
    const seeds = freeCells.filter(([r, c]) => free(r, c) && (dense || !touchesHouse(r, c)))
    if (!seeds.length) break
    const cluster: Cell[] = [seeds[Math.floor(rand() * seeds.length)]]
    const roll = rand()
    const perHamlet = dense ? 9 : roll < 0.4 ? 1 : roll < 0.75 ? 2 : 3
    const want = Math.min(perHamlet, houseCount - houses.length)
    while (cluster.length < want) {
      const around = cluster.flatMap(([r, c]) => DIRS.map(([dr, dc]) => [r + dr, c + dc] as Cell)).filter(([r, c]) => free(r, c) && (dense || !touchesHouse(r, c)) && !cluster.some(([a, b]) => a === r && b === c))
      if (!around.length) break
      cluster.push(around[Math.floor(rand() * around.length)])
    }
    for (const [r, c] of cluster) {
      // deux maisons voisines n'ont jamais le même aspect
      const used = new Set(DIRS.map(([dr, dc]) => tiles[r + dr]?.[c + dc]).filter((t) => t && t.kind === (P.houseKind ?? 'house')).map((t) => t!.v))
      const choices = [0, 1, 2, 3].filter((v) => !used.has(v))
      tiles[r][c] = { kind: P.houseKind ?? 'house', v: (choices.length ? choices : [0, 1, 2, 3])[Math.floor(rand() * (choices.length || 4))] }
      taken.add(key(r, c))
      houses.push([r, c])
    }
  }

  // --- Moulin à vent (plaine) : sur une case libre, loin de la voie si possible ---
  for (let m = 0; m < P.windmills; m++) {
    const cands = freeCells.filter(([r, c]) => free(r, c))
    const far = cands.filter(([r, c]) => !nearPath(r, c))
    const pool = far.length ? far : cands
    if (!pool.length) break
    const [r, c] = pool[Math.floor(rand() * pool.length)]
    tiles[r][c] = { kind: 'windmill', v: 0 }
    taken.add(key(r, c))
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

  const treeKind: TileKind = P.treeKind ?? 'tree'
  const pineKind: TileKind = P.pineKind ?? 'pine'
  // --- Groupes : bosquets d'arbres et crêtes de montagnes plutôt que des cases tirées au hasard ---
  // Des centres sont tirés ; plus une case est proche d'un centre, plus elle a de chances d'être plantée. La densité
  // moyenne reste celle de l'environnement (les poids sont normalisés), seule la répartition change.
  const gr = rng(seed ^ 0xc1a3)
  const freeNow: Cell[] = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (free(r, c)) freeNow.push([r, c])
  const clumped = (density: number, perCentre: number): Map<string, number> => {
    const out = new Map<string, number>()
    if (!P.clump || !freeNow.length || density <= 0) return out
    const k = Math.max(1, Math.round((freeNow.length * density) / perCentre))
    const centres = shuffle(freeNow, gr).slice(0, k)
    const w = (r: number, c: number) => {
      const d = Math.min(...centres.map(([cr, cc]) => Math.hypot(cr - r, cc - c)))
      return d < 0.5 ? 1.6 : d < 1.5 ? 1.1 : d < 2.5 ? 0.35 : 0.05
    }
    const raw = freeNow.map(([r, c]) => w(r, c))
    const scale = (density * freeNow.length) / raw.reduce((a, b) => a + b, 0)
    freeNow.forEach(([r, c], i) => out.set(key(r, c), Math.min(0.97, raw[i] * scale)))
    return out
  }
  const treeHeat = clumped(P.tree, 4)
  const peakHeat = clumped(P.peaks, 3)
  const peakKind: TileKind = P.peakKind ?? 'mountain'

  const touchesBoulder = (r: number, c: number) => [-1, 0, 1].some((dr) => [-1, 0, 1].some((dc) => tiles[r + dr]?.[c + dc]?.kind === 'boulder'))
  // --- Reste : montagnes d'arrière-plan, arbres, sapins, rochers, bonshommes de neige, herbe ---
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!free(r, c)) continue
      const nearRock = DIRS.some(([dr, dc]) => rocks.has(key(r + dr, c + dc)))
      const nearHouse = DIRS.some(([dr, dc]) => tiles[r + dr]?.[c + dc]?.kind === 'house')
      const roll = rand()
      const variant = Math.floor(rand() * 3)
      const pPeak = P.clump ? (peakHeat.get(key(r, c)) ?? 0) : P.peaks
      const pTree = P.clump ? (treeHeat.get(key(r, c)) ?? 0) : P.tree
      let kind: TileKind
      if ((!nearPath(r, c) || P.peaks >= 0.3) && roll < pPeak) kind = peakKind
      else if (nearRock && roll < 0.8) kind = pineKind
      else if (nearHouse && rand() < P.snowmen) kind = 'snowman'
      else if (roll < pPeak + pTree) kind = rand() < P.pine ? pineKind : treeKind
      else if (rand() < P.boulders) kind = 'boulder'
      else kind = 'grass'
      // jamais deux pierres collées (même quand « pierre » tient lieu de sapin, comme sur la Lune) : pas d'amas
      if (kind === 'boulder' && touchesBoulder(r, c)) kind = 'grass'
      tiles[r][c] = { kind, v: variant }
    }
  }

  return { seed, road, margin: mg, frame, ext, size: rows, rows, cols, theme: th, tiles, water, river, pond, bridges }
}
