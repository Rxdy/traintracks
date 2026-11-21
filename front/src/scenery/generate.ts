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


export type TileKind = 'rail' | 'grass' | 'tree' | 'pine' | 'house' | 'field' | 'mountain' | 'boulder' | 'snowman' | 'road' | 'path' | 'clear' | 'windmill' | 'cactus' | 'palm' | 'crater' | 'obsidian' | 'vent' | 'deadtree' | 'skull' | 'building' | 'mesa' | 'dune'

export interface Tile {
  kind: TileKind
  v: number // variante (couleur, forme) : 0..n
  dir?: 'h' | 'v' // sens des sillons d'un champ
}
// Décors fixes posés sur une case dégagée : cabane et tas de bois (forêt), champignons géants, chalet (montagne), pylônes du téléphérique.
export type PropKind = 'cabin' | 'woodpile' | 'mushroom' | 'chalet' | 'pylon'
export interface Prop {
  kind: PropKind
  x: number // centre, en unités de case
  y: number
  v: number // variante
}
// Tunnel au bout de la voie d'entrée ou de sortie : le train sort d'une montagne au départ et rentre dans une montagne à l'arrivée.
// Le train est coupé au plan du tunnel (voir `clip` dans TrackGrid) : il apparaît ou disparaît dans le noir de l'entrée.
export interface Tunnel {
  x: number // centre de l'entrée du tunnel, sur la voie, en unités de case
  y: number
  out: { x: number; y: number } // vers l'extérieur de la grille (le sens où s'étend la montagne)
  inset: number // distance de l'entrée au bord du décor, en cases
}
// Gare de départ ou d'arrivée, sur le prolongement de la voie, dans le décor : le train y démarre ou s'y arrête à quai.
// (Plus utilisée dans le trajet : elle servira au mécanisme des gares numérotées des niveaux à venir.)
export interface Station {
  x: number // centre du quai, en unités de case
  y: number
  angle: number // sens de marche du train, en degrés
  side: 1 | -1 // côté du quai où se tient le bâtiment (par rapport au sens de marche)
  loco: number // distance, depuis le bord de la grille, où s'arrête la locomotive
}
// Cases visibles à l'écran, depuis chaque bord de la grille (une fois rétrécie) : les tunnels se posent dans l'écran, pas au bord du décor.
export interface View {
  left: number
  right: number
  up: number
  down: number
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
  tunnels: { entry: Tunnel | null; exit: Tunnel | null } // tunnel d'où le train sort au départ, et où il entre à l'arrivée (null : pas la place)
  props: Prop[] // décors fixes (cabane, chalet…)
  cable: [Pt, Pt] | null // câble du téléphérique (montagne) : entre deux pylônes
  paths: Pt[][] // sentiers de terre (maisons et moulin vers la route ou un autre sentier), en unités de case ; tuiles « path »
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
export function buildScenery(puzzle: Puzzle, smallPath: Cell[], theme?: Theme, seed = seedOf(puzzle), margin: number | { x: number; y: number; b?: number; top?: number; below?: number; view?: View } = 0): Scenery {
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
  if (!river && (wantsRiver || th === 'hiver')) { // l'hiver a toujours un étang quand il n'y a pas de rivière
    const free: Cell[] = []
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (isFree(r, c)) free.push([r, c])
    const pairs: Cell[][] = []
    free.forEach(([r, c]) => {
      if (isFree(r, c + 1)) pairs.push([[r, c], [r, c + 1]])
      if (isFree(r + 1, c)) pairs.push([[r, c], [r + 1, c]])
      // l'hiver a des étangs de tailles différentes : 1 case, 2 cases, un carré de 2×2 ou de 3×3
      if (th === 'hiver' && isFree(r, c + 1) && isFree(r + 1, c) && isFree(r + 1, c + 1)) pairs.push([[r, c], [r, c + 1], [r + 1, c], [r + 1, c + 1]])
      // …ou un grand étang de neuf (3×3)
      if (th === 'hiver' && [0, 1, 2].every((i) => [0, 1, 2].every((j) => isFree(r + i, c + j)))) pairs.push([0, 1, 2].flatMap((i) => [0, 1, 2].map((j) => [r + i, c + j] as Cell)))
    })
    if (th === 'hiver') free.forEach((x) => pairs.push([x]))
    if (pairs.length >= 1 && free.length >= 5) {
      // l'hiver tire d'abord une TAILLE (sinon les étangs d'une case, bien plus nombreux, l'emporteraient toujours), puis un emplacement
      const sizes = [...new Set(pairs.map((x) => x.length))].sort((x, y) => x - y)
      const pool = th === 'hiver' ? pairs.filter((x) => x.length === sizes[Math.floor(rand() * sizes.length)]) : pairs
      const p = pool[Math.floor(rand() * pool.length)]
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
    // Villages (la ville : quartiers de 9) ; deux villages ne se touchent jamais, sinon les maisons « se suivent ».
    const seeds = freeCells.filter(([r, c]) => free(r, c) && (dense || !touchesHouse(r, c)))
    if (!seeds.length) break
    const cluster: Cell[] = [seeds[Math.floor(rand() * seeds.length)]]
    const roll = rand()
    // une maison seule reste possible, mais le plus souvent c'est un village (3 à 6 maisons) ; la ville : quartiers de 9
    const perHamlet = dense ? 9 : roll < 0.25 ? 1 : roll < 0.55 ? 3 : roll < 0.85 ? 4 : 6
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
    const want = (th === 'plaine' ? 3 : 2) + Math.floor(rand() * 2) // la plaine a de grands champs : de la place pour le tracteur
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

  // Une montagne seule rend mal (un petit tas isolé) : elle s'adjoint une case voisine (herbe ou arbre, loin de la voie) pour former un
  // petit massif de deux sommets ; sans place, elle devient un rocher (ou de l'herbe, si un rocher est déjà à côté). Les dunes et les mesas ne sont pas concernées.
  if (peakKind === 'mountain')
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        if (tiles[r][c].kind !== 'mountain') continue
        if (DIRS.some(([dr, dc]) => tiles[r + dr]?.[c + dc]?.kind === 'mountain')) continue
        const room = DIRS.map(([dr, dc]) => [r + dr, c + dc] as Cell).filter(
          ([a, b]) => ['grass', 'tree', 'pine'].includes(tiles[a]?.[b]?.kind ?? '') && !taken.has(key(a, b)) && !water.has(key(a, b)) && (!nearPath(a, b) || P.peaks >= 0.3),
        )
        if (room.length) {
          const [a, b] = room[Math.floor(rand() * room.length)]
          tiles[a][b] = { kind: 'mountain', v: tiles[r][c].v }
        } else if (!rocks.has(key(r, c))) tiles[r][c] = { kind: touchesBoulder(r, c) ? 'grass' : 'boulder', v: tiles[r][c].v } // jamais deux pierres collées
        // (un rocher de la grille reste une montagne : c'est un obstacle du puzzle)
      }

  const paths = P.paths ? makePaths(seed, tiles, rows, cols) : []
  const { props, cable } = makeProps(th, seed, tiles, water, rows, cols)
  const tunnels = ext.length ? makeTunnels(puzzle, shifted, mg, frame.visibleRows, tiles, water, typeof margin === 'object' ? margin.view : undefined) : { entry: null, exit: null }
  return { seed, road, margin: mg, frame, ext, size: rows, rows, cols, theme: th, tiles, water, river, pond, bridges, paths, props, cable, tunnels }
}

// --- Sentiers : chaque maison et chaque moulin est relié à la route (ou à un sentier déjà tracé, ou à une autre maison) par un chemin de terre qui
// ne traverse que de l'herbe ou des arbres (abattus sur son passage) : jamais un champ, la voie ou l'eau. Un sentier trop long (plus de 9 cases) n'est pas tracé.
// Tirés d'une graine à part : ajouter les sentiers ne change rien au reste du décor.
function makePaths(seed: number, tiles: Tile[][], rows: number, cols: number): Pt[][] {
  const pr = rng(seed ^ 0x7a11e5)
  const out: Pt[][] = []
  const isHome = (t: Tile | undefined) => !!t && (t.kind === 'house' || t.kind === 'windmill' || t.kind === 'building')
  const goal = (r: number, c: number) => tiles[r][c].kind === 'road' || tiles[r][c].kind === 'path' || isHome(tiles[r][c])
  const homes: Cell[] = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (isHome(tiles[r][c])) homes.push([r, c])
  for (const [hr, hc] of shuffle(homes, pr)) {
    // parcours en largeur depuis la maison, par l'herbe, jusqu'à la route ou à un sentier
    const prev = new Map<string, Cell | null>([[key(hr, hc), null]])
    const queue: Cell[] = [[hr, hc]]
    let end: Cell | null = null
    for (let i = 0; i < queue.length && !end; i++) {
      const [r, c] = queue[i]
      for (const [dr, dc] of shuffle(DIRS, pr)) {
        const nr = r + dr, nc = c + dc
        if (nr < 0 || nc < 0 || nr >= rows || nc >= cols || prev.has(key(nr, nc))) continue
        if (goal(nr, nc)) { prev.set(key(nr, nc), [r, c]); end = [nr, nc]; break }
        if (!['grass', 'tree', 'pine'].includes(tiles[nr][nc].kind)) continue // les arbres sur le tracé sont abattus
        prev.set(key(nr, nc), [r, c])
        queue.push([nr, nc])
      }
    }
    if (!end) continue
    const cells: Cell[] = []
    for (let cur: Cell | null = end; cur; cur = prev.get(key(cur[0], cur[1])) ?? null) cells.unshift(cur)
    if (cells.length > 10) continue
    for (const [r, c] of cells) if (['grass', 'tree', 'pine'].includes(tiles[r][c].kind)) tiles[r][c] = { kind: 'path', v: 0 }
    out.push(cells.map(([r, c]) => ({ x: c + 0.5, y: r + 0.5 })))
  }
  return out
}

// --- Décors fixes par environnement. Tirés d'une graine à part : le reste du décor ne change pas.
//   forêt : une cabane de bûcheron avec son tas de bois, des champignons géants ;
//   montagne : un chalet, et deux pylônes sur des sommets (le téléphérique : câble et cabine, voir motion.ts).
// Chaque décor se pose sur une case d'herbe loin de la voie, qui devient « clear » (plus d'herbe dessinée dessus).
function makeProps(th: Theme, seed: number, tiles: Tile[][], water: Set<string>, rows: number, cols: number): { props: Prop[]; cable: [Pt, Pt] | null } {
  const props: Prop[] = []
  let cable: [Pt, Pt] | null = null
  if (th !== 'foret' && th !== 'montagne') return { props, cable }
  const pr = rng(seed ^ 0x5eed0b)
  const nearRail = (r: number, c: number) => [-1, 0, 1].some((dr) => [-1, 0, 1].some((dc) => tiles[r + dr]?.[c + dc]?.kind === 'rail'))
  const spots = (): Cell[] => {
    const out: Cell[] = []
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (tiles[r][c].kind === 'grass' && !water.has(key(r, c)) && !nearRail(r, c)) out.push([r, c])
    return shuffle(out, pr)
  }
  const put = (kind: PropKind, [r, c]: Cell, v = 0, dx = 0.5, dy = 0.55) => {
    tiles[r][c] = { kind: 'clear', v: 0 }
    props.push({ kind, x: c + dx, y: r + dy, v })
  }
  const free = spots()
  if (th === 'foret') {
    // cabane + tas de bois sur la case voisine
    const home = free.find(([r, c]) => DIRS.some(([dr, dc]) => tiles[r + dr]?.[c + dc]?.kind === 'grass' && !water.has(key(r + dr, c + dc)) && !nearRail(r + dr, c + dc)))
    if (home) {
      const [r, c] = home
      const side = DIRS.find(([dr, dc]) => tiles[r + dr]?.[c + dc]?.kind === 'grass' && !water.has(key(r + dr, c + dc)) && !nearRail(r + dr, c + dc))!
      put('cabin', home)
      put('woodpile', [r + side[0], c + side[1]])
    }
    free.filter(([r, c]) => tiles[r][c].kind === 'grass').slice(0, 3).forEach((cell, i) => put('mushroom', cell, i % 2, 0.35 + pr() * 0.3, 0.5 + pr() * 0.2))
  } else {
    const home = free.find(([r, c]) => tiles[r][c].kind === 'grass')
    if (home) put('chalet', home)
    // téléphérique : deux sommets distants de 3 à 7 cases
    const peaks: Cell[] = []
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (tiles[r][c].kind === 'mountain') peaks.push([r, c])
    const pairs: [Cell, Cell][] = []
    for (const a of peaks) for (const b of peaks) {
      const d = Math.hypot(a[0] - b[0], a[1] - b[1])
      if (a < b && d >= 3 && d <= 7) pairs.push([a, b])
    }
    if (pairs.length) {
      const [a, b] = pairs[Math.floor(pr() * pairs.length)]
      props.push({ kind: 'pylon', x: a[1] + 0.5, y: a[0] + 0.35, v: 0 }, { kind: 'pylon', x: b[1] + 0.5, y: b[0] + 0.35, v: 0 })
      cable = [{ x: a[1] + 0.5, y: a[0] + 0.2 }, { x: b[1] + 0.5, y: b[0] + 0.2 }]
    }
  }
  return { props, cable }
}

// --- Gares : une au bout de la voie d'entrée, une au bout de la voie de sortie, quand le décor laisse au moins 4,6 cases. Le quai
// longe la voie, le bâtiment est de l'autre côté du quai (du côté où il y a le plus de place). Les arbres du quai sont abattus.
// La locomotive s'arrête à `loco` cases du bord de la grille : tout le train tient entre la grille et le bord du décor.
export const TRAIN_SPAN = 2.4 // longueur du train (locomotive + wagons), en cases
export function makeStations(puzzle: Puzzle, shifted: Cell[], mg: { x: number; y: number; b: number }, visibleRows: number, tiles: Tile[][], water: Set<string>): { entry: Station | null; exit: Station | null } {
  const OUTV: Record<string, Cell> = { left: [0, -1], right: [0, 1], up: [-1, 0], down: [1, 0] }
  const N = puzzle.size
  const reach = (dir: string) => (dir === 'left' || dir === 'right' ? mg.x : dir === 'up' ? mg.y : visibleRows - mg.y - N) // cases visibles au bout de la voie
  const build = (cell: Cell, dir: string, arriving: boolean): Station | null => {
    const L = reach(dir)
    if (L < TRAIN_SPAN + 2.2) return null // pas la place : pas de gare
    const o = OUTV[dir]
    const u = { x: o[1], y: o[0] } // vers l'extérieur de la grille
    const A = { x: cell[1] + 0.5 + u.x * 0.5, y: cell[0] + 0.5 + u.y * 0.5 } // bord de la grille, au bout de la voie
    const dirSign = arriving ? 1 : -1 // arrivée : le train va vers l'extérieur ; départ : vers la grille
    const heading = { x: u.x * dirSign, y: u.y * dirSign }
    const normal = { x: -heading.y, y: heading.x }
    const at = (P: Pt, a: number, side: number, b: number) => {
      const r = Math.floor(P.y + u.y * a + normal.y * side * b), c = Math.floor(P.x + u.x * a + normal.x * side * b)
      return { r, c, t: tiles[r]?.[c] }
    }
    // La locomotive s'arrête un peu en retrait du bord du décor (le quai se voit à l'écran même quand le bord est juste hors champ).
    // Si la route, la voie ou l'eau coupent le quai, on le décale le long de la voie.
    const base = arriving ? L - 2.2 : L - TRAIN_SPAN - 1.0
    const lo = arriving ? TRAIN_SPAN + 0.1 : 1.2
    const hi = arriving ? L - 1.0 : L - TRAIN_SPAN
    let chosen: { loco: number; P: Pt; side: 1 | -1 } | null = null
    for (const shift of [0, -1.5, 1.5, -3, 3]) {
      const loco = base + shift
      if (loco < lo || loco > hi) continue
      const d = arriving ? loco - 0.9 : loco + 0.9 // milieu du quai : le train s'arrête le long
      const P = { x: A.x + u.x * d, y: A.y + u.y * d }
      const room = (side: 1 | -1) => {
        let n = 0, bad = 0
        for (let a = -1.4; a <= 1.4; a += 0.7) for (let b = 0.4; b <= 1.6; b += 0.6) {
          const { r, c, t } = at(P, a, side, b)
          // (la case de la voie elle-même est une case « rail » : seul le côté du quai compte)
          if (!t || water.has(`${r},${c}`) || ['road', 'house', 'windmill', 'field', 'path'].includes(t.kind) || (t.kind === 'rail' && b >= 0.6)) bad++
          else if (['grass', 'tree', 'pine', 'clear', 'path'].includes(t.kind)) n++
        }
        return bad ? -1 : n
      }
      const side: 1 | -1 = room(1) >= room(-1) ? 1 : -1
      if (room(side) < 0) continue
      chosen = { loco, P, side }
      break
    }
    if (!chosen) return null
    const { loco, P, side } = chosen
    for (let a = -1.5; a <= 1.5; a += 0.5) for (let b = 0.3; b <= 1.6; b += 0.4) {
      const { r, c, t } = at(P, a, side, b)
      if (t && !water.has(`${r},${c}`) && !['rail', 'road', 'house', 'windmill', 'field', 'path'].includes(t.kind)) tiles[r][c] = { kind: 'clear', v: 0 } // tout ce qui gêne le quai est enlevé (arbres, immeubles, rochers…)
    }
    return { x: P.x, y: P.y, angle: (Math.atan2(heading.y, heading.x) * 180) / Math.PI, side, loco }
  }
  if (!shifted.length) return { entry: null, exit: null }
  return { entry: build(shifted[0], puzzle.entry.dir, false), exit: build(shifted[shifted.length - 1], puzzle.exit.dir, true) }
}

// --- Tunnels : au bout de chaque voie, une montagne percée. L'entrée est à une demi-case du bord de l'écran (plus en retrait si la
// route, l'eau ou une maison gênent). Sans place (moins de 1,3 case entre la grille et le bord), pas de tunnel.
function makeTunnels(puzzle: Puzzle, shifted: Cell[], mg: { x: number; y: number; b: number }, visibleRows: number, tiles: Tile[][], water: Set<string>, view?: View): { entry: Tunnel | null; exit: Tunnel | null } {
  const OUTV: Record<string, Cell> = { left: [0, -1], right: [0, 1], up: [-1, 0], down: [1, 0] }
  const N = puzzle.size
  const reach = (dir: string) => {
    const decor = dir === 'left' || dir === 'right' ? mg.x : dir === 'up' ? mg.y : visibleRows - mg.y - N
    return view ? Math.min(decor, view[dir as keyof View]) : decor // l'écran est souvent plus court que le décor
  }
  const build = (cell: Cell, dir: string): Tunnel | null => {
    const L = reach(dir)
    const decorL = dir === 'left' || dir === 'right' ? mg.x : dir === 'up' ? mg.y : visibleRows - mg.y - N
    if (L < 1.3) return null // il faut au moins un peu de décor entre la grille et le bord de l'écran
    const o = OUTV[dir]
    const u = { x: o[1], y: o[0] }
    const A = { x: cell[1] + 0.5 + u.x * 0.5, y: cell[0] + 0.5 + u.y * 0.5 }
    const normal = { x: -u.y, y: u.x }
    // Collé au bord de l'écran (entrée à une demi-case du bord) : on ne voit que l'entrée et un petit rebord de montagne, pas un gros
    // bloc posé sur le paysage. Si quelque chose gêne (route, eau, maison), de plus en plus en retrait, sans jamais toucher la grille.
    const insets = [0.5, 0.9, 1.5, 2.5, 3.5].filter((i) => L - i >= 0.8)
    for (const inset of insets) {
      const d = L - inset
      // la montagne couvre de l'entrée du tunnel au bord du décor, 1,5 case de large. Le cœur (sur la voie) doit être dégagé ; les flancs
      // peuvent recouvrir un bout de rivière, de sentier ou de champ, mais jamais une maison, un moulin, une route ou une autre voie.
      const core: { r: number; c: number }[] = []
      const side: { r: number; c: number }[] = []
      let bad = false
      for (let a = d; a <= L + 0.5 && !bad; a += 0.5) for (const b of [-0.7, -0.35, 0, 0.35, 0.7]) {
        const r = Math.floor(A.y + u.y * a + normal.y * b), c = Math.floor(A.x + u.x * a + normal.x * b)
        const t = tiles[r]?.[c]
        if (!t) continue
        const inCore = Math.abs(b) <= 0.35
        if (['road', 'house', 'windmill'].includes(t.kind) || (t.kind === 'rail' && !inCore)) { bad = true; break }
        if (inCore && (water.has(`${r},${c}`) || t.kind === 'field' || t.kind === 'path')) { bad = true; break }
        ;(inCore ? core : side).push({ r, c })
      }
      if (bad) continue
      // le cœur est dégagé ; sur les flancs, seuls les objets debout (arbres, rochers…) s'effacent : l'eau, les sentiers et les champs restent
      for (const { r, c } of core) if (tiles[r][c].kind !== 'rail') tiles[r][c] = { kind: 'clear', v: 0 }
      for (const { r, c } of side) if (!water.has(`${r},${c}`) && !['rail', 'path', 'field', 'clear', 'grass'].includes(tiles[r][c].kind)) tiles[r][c] = { kind: 'clear', v: 0 }
      return { x: A.x + u.x * d, y: A.y + u.y * d, out: u, inset: inset + (decorL - L) } // `inset` : distance au bord du décor
    }
    return null
  }
  if (!shifted.length) return { entry: null, exit: null }
  return { entry: build(shifted[0], puzzle.entry.dir), exit: build(shifted[shifted.length - 1], puzzle.exit.dir) }
}
