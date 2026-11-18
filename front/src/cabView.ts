// Vue de la cabine : ce que le conducteur voit par le pare-brise, calculé à partir du VRAI trajet du train et du VRAI décor.
// Le train est sur la carte (le décor de victoire) ; ici on se place à la locomotive, on regarde dans le sens de la voie, et on projette
// en perspective les cases autour : une maison à droite de la voie sur la carte est à droite dans la cabine, au moment où le petit
// train la dépasse. Aucune donnée inventée : tout vient de `scenery.tiles`, `scenery.water` et de la route.
//
// Repères. Carte : x vers la droite, y vers le bas, 1 unité = 1 case, origine = coin haut-gauche de la grille (comme `Route`).
// Caméra : `f` = distance devant le train (profondeur), `l` = décalage latéral, positif à DROITE de la voie.
// Écran : 340 × 120, l'horizon à y = 62, le centre à x = 170.
import { pointAt, type Route } from './trainRoute'
import type { Scenery, TileKind } from './scenery/generate'
import type { AnimalKind, BirdKind, LandFrame } from './scenery/motion'

export const VIEW = { w: 340, h: 120, horizon: 62, cx: 170 }
const K = 140 // échelle : pixels par case à une case de distance
const EYE = 0.32 // hauteur des yeux du conducteur, en cases
const NEAR = 0.45 // plus près que ça, on ne dessine plus (l'objet est sorti du champ)
const FAR = 9 // portée de la vue, en cases
const BALLAST = 0.34 // demi-largeur du lit de la voie
const GAUGE = 0.17 // demi-écartement des rails
const SLEEPER_GAP = 0.32

export type Pt2 = [number, number]
export interface Camera {
  x: number
  y: number
  hx: number
  hy: number
}
export interface Quad {
  pts: Pt2[]
  kind: 'grass' | 'field' | 'water' | 'road' | 'path'
  v: number
  dir?: 'h' | 'v'
  f: number
}
export interface Sprite {
  kind: TileKind
  v: number
  x: number
  y: number // pied de l'objet, sur le sol
  u: number // pixels par case à cette distance
  f: number
  l: number
}
// Ce qui BOUGE sur la carte, vu de la cabine : mêmes voitures, mêmes barrières, mêmes animaux (image `LandFrame` du décor vivant).
export type Live =
  | { t: 'car'; f: number; x: number; y: number; u: number; kind: 0 | 1; color: string; side: -1 | 0 | 1; away: boolean }
  | { t: 'animal'; f: number; x: number; y: number; u: number; kind: AnimalKind; flip: 1 | -1; time: number; blink: number; wag: number; z: number }
  | { t: 'bird'; f: number; x: number; y: number; u: number; kind: BirdKind; flap: number }
  | { t: 'barrier'; f: number; base: Pt2; top: Pt2; tip: Pt2; w: number; lights: boolean }
export interface CabView {
  ground: Quad[] // du plus loin au plus proche
  ballast: Pt2[] | null
  rails: Pt2[][] // deux polylignes
  sleepers: { x1: number; x2: number; y: number; w: number }[]
  sprites: Sprite[] // du plus loin au plus proche
  heading: number // cap du train (radians) : l'horizon lointain tourne avec lui
  live: Live[] // voitures, barrières, animaux, oiseaux : du plus loin au plus proche
}

/** Position et cap du train à la distance `s` : on regarde un peu devant, pour tourner en douceur dans les virages. */
export function cameraAt(route: Route, s: number, heading?: number): Camera {
  const p = pointAt(route, s)
  if (heading !== undefined) return { x: p.x, y: p.y, hx: Math.cos(heading), hy: Math.sin(heading) }
  const q = pointAt(route, s + 0.35)
  let a = Math.atan2(q.y - p.y, q.x - p.x)
  if (q.x === p.x && q.y === p.y) a = (p.angle * Math.PI) / 180 // au bout du trajet
  return { x: p.x, y: p.y, hx: Math.cos(a), hy: Math.sin(a) }
}

/** Profondeur et décalage (positif à droite) d'un point de la carte, vus de la caméra. */
export function toCamera(cam: Camera, x: number, y: number): { f: number; l: number } {
  const dx = x - cam.x
  const dy = y - cam.y
  return { f: dx * cam.hx + dy * cam.hy, l: -dx * cam.hy + dy * cam.hx }
}

/** Écran d'un point du sol (profondeur f, décalage l). */
export const screenOf = (f: number, l: number): Pt2 => [VIEW.cx + (K * l) / f, VIEW.horizon + (K * EYE) / f]

// Découpe un polygone (en profondeur / décalage) pour ne garder que ce qui est devant `NEAR`.
function clipNear(poly: { f: number; l: number }[]): { f: number; l: number }[] {
  const out: { f: number; l: number }[] = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const ain = a.f >= NEAR
    const bin = b.f >= NEAR
    if (ain) out.push(a)
    if (ain !== bin) {
      const t = (NEAR - a.f) / (b.f - a.f)
      out.push({ f: NEAR, l: a.l + (b.l - a.l) * t })
    }
  }
  return out
}

const NO_SPRITE = new Set<TileKind>(['rail', 'grass', 'field', 'road', 'path', 'clear'])

/** Cap naturel du train (radians) : celui que la caméra suit, avant lissage. */
export function trackHeading(route: Route, s: number): number {
  const c = cameraAt(route, s)
  return Math.atan2(c.hy, c.hx)
}

/** Écran d'un point en l'air (hauteur z au-dessus du sol, en cases). */
export const screenOf3 = (f: number, l: number, z: number): Pt2 => [VIEW.cx + (K * l) / f, VIEW.horizon + (K * (EYE - z)) / f]

export function cabView(scenery: Scenery, route: Route, s: number, opts: { heading?: number; land?: LandFrame | null } = {}): CabView {
  const cam = cameraAt(route, s, opts.heading)
  const mg = scenery.margin
  const ground: Quad[] = []
  const sprites: Sprite[] = []

  for (let r = 0; r < scenery.tiles.length; r++) {
    for (let c = 0; c < scenery.tiles[r].length; c++) {
      const wx = c - mg.x + 0.5
      const wy = r - mg.y + 0.5
      const mid = toCamera(cam, wx, wy)
      if (mid.f < NEAR - 0.8 || mid.f > FAR + 0.8 || Math.abs(mid.l) > mid.f * 1.7 + 1.3) continue
      const tile = scenery.tiles[r][c]
      const isWater = scenery.water.has(`${r},${c}`)
      const flat: Quad['kind'] | null = isWater ? 'water' : tile.kind === 'field' ? 'field' : tile.kind === 'road' ? 'road' : tile.kind === 'path' ? 'path' : tile.kind === 'grass' && tile.v % 2 === 1 ? 'grass' : null
      if (flat) {
        const poly = clipNear(
          ([[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]] as Pt2[]).map(([dx, dy]) => toCamera(cam, wx + dx, wy + dy)),
        )
        if (poly.length >= 3) ground.push({ pts: poly.map((p) => screenOf(p.f, p.l)), kind: flat, v: tile.v, dir: tile.dir, f: mid.f })
      }
      if (!NO_SPRITE.has(tile.kind) && mid.f >= NEAR && mid.f <= FAR) {
        const [x, y] = screenOf(mid.f, mid.l)
        sprites.push({ kind: tile.kind, v: tile.v, x, y, u: K / mid.f, f: mid.f, l: mid.l })
      }
    }
  }
  ground.sort((a, b) => b.f - a.f)
  sprites.sort((a, b) => b.f - a.f)

  // La voie elle-même : on suit la route devant le train, virages compris.
  const left: Pt2[] = []
  const right: Pt2[] = []
  const bl: Pt2[] = []
  const br: Pt2[] = []
  const edge = (t: number, off: number) => {
    const p = pointAt(route, t)
    const q = pointAt(route, t + 0.05)
    const len = Math.hypot(q.x - p.x, q.y - p.y) || 1
    const nx = -(q.y - p.y) / len
    const ny = (q.x - p.x) / len // normale, à droite du sens de marche
    return toCamera(cam, p.x + nx * off, p.y + ny * off)
  }
  for (let t = s; t <= s + FAR + 0.001 && t <= route.length; t += 0.15) {
    const lr = edge(t, -GAUGE)
    if (lr.f < NEAR) continue
    left.push(screenOf(lr.f, lr.l))
    const rr = edge(t, GAUGE)
    right.push(screenOf(rr.f, rr.l))
    const lb = edge(t, -BALLAST)
    const rb = edge(t, BALLAST)
    bl.push(screenOf(lb.f, lb.l))
    br.push(screenOf(rb.f, rb.l))
  }
  const sleepers: CabView['sleepers'] = []
  for (let t = Math.ceil((s + NEAR) / SLEEPER_GAP) * SLEEPER_GAP; t <= s + FAR && t <= route.length; t += SLEEPER_GAP) {
    const a = edge(t, -BALLAST + 0.04)
    const b = edge(t, BALLAST - 0.04)
    if (a.f < NEAR || b.f < NEAR) continue
    const [x1, y] = screenOf(a.f, a.l)
    const [x2] = screenOf(b.f, b.l)
    sleepers.push({ x1, x2, y, w: Math.max(0.6, 3.2 / ((a.f + b.f) / 2)) })
  }
  return { ground, ballast: bl.length > 1 ? [...bl, ...br.reverse()] : null, rails: [left, right], sleepers, sprites, heading: Math.atan2(cam.hy, cam.hx), live: opts.land ? liveItems(scenery, cam, opts.land) : [] }
}

// ---------- le décor vivant ----------
// Les positions du décor vivant sont dans le repère du décor (case (r, c) = [c, c+1] × [r, r+1]) ; la carte du train est décalée de la marge.
const CAR_SCALE = 1.5 // les voitures sont minuscules sur la carte (0,3 case) : un peu plus grosses pour qu'on les voie
const ANIMAL_SCALE = 1 // à l'échelle de la carte : un animal fait la taille d'un animal à côté des arbres et des maisons

function liveItems(scenery: Scenery, cam: Camera, land: LandFrame): Live[] {
  const mg = scenery.margin
  const out: Live[] = []
  const place = (x: number, y: number) => {
    const wx = x - mg.x
    const wy = y - mg.y
    const p = toCamera(cam, wx, wy)
    return p.f >= NEAR && p.f <= FAR && Math.abs(p.l) <= p.f * 1.8 + 1 ? p : null
  }
  const road = scenery.road
  if (road) {
    const m = road.line + 0.5
    const along = road.axis === 'v' ? { x: 0, y: 1 } : { x: 1, y: 0 } // sens de la route sur la carte
    for (const c of land.cars) {
      const wx = road.axis === 'v' ? m + c.lane : c.u
      const wy = road.axis === 'v' ? c.u : m + c.lane
      const p = place(wx, wy)
      if (!p) continue
      const lateral = (along.x * -cam.hy + along.y * cam.hx) * c.dir // + : la voiture file vers la droite de l'écran
      const ahead = along.x * cam.hx + along.y * cam.hy // composante dans le sens du regard
      const side = Math.abs(lateral) < 0.4 ? 0 : lateral > 0 ? 1 : -1
      const [x, y] = screenOf(p.f, p.l)
      out.push({ t: 'car', f: p.f, x, y, u: (K / p.f) * CAR_SCALE, kind: c.kind, color: c.color, side, away: ahead * c.dir > 0 })
    }
    // Passage à niveau : deux barrières, une de chaque côté de la voie (même repère que SceneryLife).
    if (road.crossing) {
      const uc = (road.axis === 'v' ? road.crossing[0] : road.crossing[1]) + 0.5
      const lift = (1 - land.barrier) * (80 * Math.PI) / 180 // 0 = baissée en travers de la route, 80° = relevée
      const post = (lx: number, ly: number, dir: 1 | -1) => {
        const toWorld = (ax: number, ay: number): Pt2 => (road.axis === 'v' ? [m + ax, ay] : [ay, m + ax])
        const [bx, by] = toWorld(lx, ly)
        const base = place(bx, by)
        if (!base) return
        // la barre part du poteau, à travers la route (x local), et se relève
        const [tx, ty] = toWorld(lx + dir * 0.62 * Math.cos(lift), ly)
        const tp = toCamera(cam, tx - mg.x, ty - mg.y)
        if (tp.f < NEAR) return
        out.push({
          t: 'barrier',
          f: base.f,
          base: screenOf3(base.f, base.l, 0),
          top: screenOf3(base.f, base.l, 0.13),
          tip: screenOf3(tp.f, tp.l, 0.13 + 0.62 * Math.sin(lift)),
          w: (0.055 * K) / base.f,
          lights: land.lights,
        })
      }
      post(-0.42, uc - 0.3, 1)
      post(0.42, uc + 0.3, -1)
    }
  }
  for (const a of land.animals) {
    const p = place(a.x, a.y)
    if (!p) continue
    const [x, y] = screenOf(p.f, p.l)
    // orientation : sur la carte l'animal regarde à gauche ou à droite ; on le retourne selon le sens du regard du conducteur
    const flip = Math.abs(cam.hy) > 0.35 ? ((a.face * -cam.hy > 0 ? 1 : -1) as 1 | -1) : 1
    const high = a.kind === 'owl' || a.kind === 'squirrel' ? 0.35 : a.kind === 'butterfly' ? 0.25 : 0 // perchés dans l'arbre, ou en l'air
    out.push({ t: 'animal', f: p.f, x, y: y - (K * high) / p.f, u: (K / p.f) * ANIMAL_SCALE, kind: a.kind, flip, time: a.t, blink: a.blink ?? 0, wag: a.wag ?? 0, z: high })
  }
  for (const b of land.birds) {
    const p = place(b.x, b.y)
    if (!p) continue
    const [x] = screenOf(p.f, p.l)
    out.push({ t: 'bird', f: p.f, x, y: VIEW.horizon - 60 / p.f - 6, u: (K / p.f) * 1.6, kind: b.kind, flap: b.flap })
  }
  return out.sort((a, b) => b.f - a.f)
}
