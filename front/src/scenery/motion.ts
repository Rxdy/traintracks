// Mouvement du décor : tout ce qui bouge une fois la grille gagnée (bateaux, poissons, canards, voitures,
// barrières, animaux, oiseaux, météo). Ce fichier ne dessine rien : il fait avancer des petits simulateurs,
// et les composants (WaterLife.vue, SceneryLife.vue) dessinent leur état. Pas de DOM ici, donc testable.
import { rng, type Pt, type Scenery } from './generate'

// ---------- géométrie ----------
// Même lissage que celui du dessin de la rivière : `riverD` en fait un tracé SVG, `sample` le même tracé en points.
export function riverD(p: Pt[]): string {
  if (p.length < 2) return ''
  let d = `M${p[0].x} ${p[0].y}`
  for (let i = 1; i < p.length - 1; i++) {
    const m1 = { x: (p[i - 1].x + p[i].x) / 2, y: (p[i - 1].y + p[i].y) / 2 }
    const m2 = { x: (p[i].x + p[i + 1].x) / 2, y: (p[i].y + p[i + 1].y) / 2 }
    d += ` L${m1.x} ${m1.y} Q${p[i].x} ${p[i].y} ${m2.x} ${m2.y}`
  }
  const last = p[p.length - 1]
  return d + ` L${last.x} ${last.y}`
}
export interface Poly {
  pts: Pt[]
  cum: number[]
  length: number
}
export function sample(p: Pt[]): Poly {
  const pts: Pt[] = [p[0]]
  for (let i = 1; i < p.length - 1; i++) {
    const m1 = { x: (p[i - 1].x + p[i].x) / 2, y: (p[i - 1].y + p[i].y) / 2 }
    const m2 = { x: (p[i].x + p[i + 1].x) / 2, y: (p[i].y + p[i + 1].y) / 2 }
    pts.push(m1)
    for (let k = 1; k <= 6; k++) {
      const t = k / 6
      pts.push({ x: (1 - t) * (1 - t) * m1.x + 2 * (1 - t) * t * p[i].x + t * t * m2.x, y: (1 - t) * (1 - t) * m1.y + 2 * (1 - t) * t * p[i].y + t * t * m2.y })
    }
  }
  pts.push(p[p.length - 1])
  const cum = [0]
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
  return { pts, cum, length: cum[cum.length - 1] }
}
export function at(poly: Poly, s: number): Pt & { angle: number } {
  const d = Math.min(Math.max(s, 0), poly.length)
  let i = 1
  while (i < poly.cum.length - 1 && poly.cum[i] < d) i++
  const a = poly.pts[i - 1]
  const b = poly.pts[i]
  const seg = poly.cum[i] - poly.cum[i - 1] || 1
  const t = (d - poly.cum[i - 1]) / seg
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

// ---------- eau : bateaux, poissons, canards ----------
export interface BoatState {
  id: number
  x: number
  y: number
  angle: number
  opacity: number
  kind: 0 | 1 // 0 barque, 1 péniche
  color: string
}
export interface WaterFrame {
  boats: BoatState[]
  ring: { x: number; y: number; k: number } | null // k : 0..1 de l'anneau qui s'étend ; null si pas de saut
  fish: { x: number; y: number; lift: number; angle: number; scale: number } | null
  ducks: { x: number; y: number; angle: number; white: boolean }[]
  events: ('boat' | 'duck')[] // de quoi faire parler le décor : un bateau apparaît, un canard cancane
}
const BOAT_COLORS = ['#e11d48', '#f59e0b', '#7c3aed', '#0ea5e9']

export function createWaterSim(sc: Scenery) {
  const rand = rng(sc.seed ^ 0x2f6b1a)
  const frozen = sc.theme === 'hiver'
  const poly = sc.river && sc.river.length >= 2 ? sample(sc.river) : null
  const pondBox = (() => {
    if (!sc.pond.length) return null
    const rs = sc.pond.map((c) => c[0])
    const cs = sc.pond.map((c) => c[1])
    return { cx: (Math.min(...cs) + Math.max(...cs) + 1) / 2, cy: (Math.min(...rs) + Math.max(...rs) + 1) / 2, w: Math.max(...cs) - Math.min(...cs) + 1, h: Math.max(...rs) - Math.min(...rs) + 1 }
  })()
  // Un bateau tous les ~3 cases de rivière, 3 au plus. Ils naissent hors grille, avant le 1er point de la rivière.
  const count = poly && !frozen ? clamp(Math.floor(poly.length / 3), 1, 3) : 0
  let nextId = 0
  const mk = (s: number) => ({ id: nextId++, s, speed: 0.34 + rand() * 0.12, off: (rand() - 0.5) * 0.08, kind: (nextId % 2) as 0 | 1, color: BOAT_COLORS[Math.floor(rand() * BOAT_COLORS.length)] })
  const boats = Array.from({ length: count }, (_, i) => mk(-i * ((poly?.length ?? 0) / count + 0.3) - 0.2))
  let nextFish = 1.5
  let fishAt = -9
  let spot: Pt = { x: 0, y: 0 }
  let nextDuck = 6

  function step(dt: number, t: number): WaterFrame {
    const out: BoatState[] = []
    const events: WaterFrame['events'] = []
    if (poly) {
      boats.forEach((b, i) => {
        const before = b.s
        b.s += b.speed * dt
        if (before < 0 && b.s >= 0) events.push('boat')
        if (b.s > poly.length + 0.6) boats[i] = Object.assign(b, mk(-0.4))
        const s = clamp(b.s, 0, poly.length)
        const q = at(poly, s)
        const rad = (q.angle * Math.PI) / 180
        // apparition en fondu au départ, effacement sur la fin
        let op = 1
        if (b.s < 0) op = 0
        else if (b.s < 0.7) op = b.s / 0.7
        else if (b.s > poly.length) op = Math.max(0, 1 - (b.s - poly.length) / 0.5)
        out.push({ id: b.id, x: q.x - Math.sin(rad) * b.off, y: q.y + Math.cos(rad) * b.off, angle: q.angle, opacity: op, kind: b.kind, color: b.color })
      })
    }
    // poisson qui saute (rivière) : anneau + saut
    let ring: WaterFrame['ring'] = null
    let fish: WaterFrame['fish'] = null
    if (poly && !frozen) {
      if (t > nextFish) {
        const q = at(poly, 0.5 + rand() * Math.max(0.1, poly.length - 1.5))
        spot = { x: q.x + (rand() - 0.5) * 0.1, y: q.y }
        fishAt = t
        nextFish = t + 2.2 + rand() * 2.5
      }
      const k = t - fishAt
      if (k >= 0 && k < 1.2) ring = { x: spot.x, y: spot.y, k: k / 1.2 }
      if (k >= 0 && k < 0.45) {
        const u = k / 0.45
        fish = { x: spot.x, y: spot.y, lift: Math.sin(u * Math.PI) * 0.16, angle: -70 + u * 140, scale: 0.6 + Math.sin(u * Math.PI) * 0.5 }
      }
    }
    // canards sur l'étang (ou patineur, s'il est gelé)
    const ducks: WaterFrame['ducks'] = []
    if (pondBox && !frozen) {
      for (let i = 0; i < 2; i++) {
        const a = t * 0.35 + i * 3.1
        const rx = pondBox.w * 0.28
        const ry = pondBox.h * 0.22
        ducks.push({ x: pondBox.cx + Math.cos(a) * rx, y: pondBox.cy + Math.sin(a) * ry, angle: (Math.atan2(Math.cos(a) * ry, -Math.sin(a) * rx) * 180) / Math.PI, white: i === 1 })
      }
    }
    if (ducks.length && t > nextDuck) { events.push('duck'); nextDuck = t + 14 + rand() * 8 }
    return { boats: out, ring, fish, ducks, events }
  }
  return { step, frozen, hasRiver: !!poly, hasBoats: count > 0 }
}

// ---------- terre : route, barrières, animaux, oiseaux, météo ----------
export interface CarState {
  id: number
  u: number // position le long de la route
  lane: number // décalage latéral (voie de droite)
  dir: 1 | -1
  kind: 0 | 1 // voiture / camion
  color: string
}
export type AnimalKind = 'owl' | 'squirrel' | 'deer' | 'rabbit' | 'hedgehog' | 'butterfly'
export interface AnimalState {
  id: number
  kind: AnimalKind
  x: number
  y: number
  face: 1 | -1
  t: number // temps de la simulation : sert aux petites poses (queue, clignement, battement)
  blink?: number // hibou : 0..1
  look?: number
  wag?: number // écureuil : angle de la queue
}
export interface BirdState {
  id: number
  x: number
  y: number
  flap: number // -1..1
  dark: boolean
}
export interface Particle {
  x: number
  y: number
  r: number
  spin: number
}
export interface LandFrame {
  cars: CarState[]
  barrier: number // 0 relevée … 1 baissée
  lights: boolean
  animals: AnimalState[]
  birds: BirdState[]
  flakes: Particle[]
  leaves: Particle[]
  events: ('owl' | 'squirrel' | 'bird' | 'car')[]
}
const CAR_COLORS = ['#ef4444', '#3b82f6', '#f59e0b', '#ffffff', '#22c55e', '#111827']

export function createLandSim(sc: Scenery) {
  const rand = rng(sc.seed ^ 0x7a3c91)
  const n = sc.size
  const th = sc.theme
  const cells = (kind: string) => {
    const out: [number, number][] = []
    // les cases d'eau restent « herbe » dans la grille : il faut les écarter, sinon les animaux iraient dans l'eau
    sc.tiles.forEach((row, r) => row.forEach((t, c) => t.kind === kind && !sc.water.has(`${r},${c}`) && out.push([r, c])))
    return out
  }
  const trees = cells('tree')
  const pines = cells('pine')
  const grass = cells('grass')
  const anyTree = trees.length ? trees : pines
  // Les animaux de terre ne passent que d'une case d'herbe à une case d'herbe voisine : jamais dans la rivière,
  // sur la route ni sur la voie.
  const grassKeys = new Set(grass.map(([r, c]) => `${r},${c}`))
  const neighbours = ([r, c]: [number, number]): [number, number][] =>
    ([[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]] as [number, number][]).filter(([a, b]) => grassKeys.has(`${a},${b}`))
  const centre = (rc: [number, number]): Pt => ({ x: rc[1] + 0.5, y: rc[0] + 0.6 })
  const pick = <T>(a: T[]): T => a[Math.floor(rand() * a.length)]

  // ---- route ----
  const road = sc.road
  const uc = road?.crossing ? (road.axis === 'v' ? road.crossing[0] : road.crossing[1]) + 0.5 : null
  const cars: (CarState & { v: number; vmax: number; heard?: boolean })[] = []
  const spawn = { 1: 0.4, [-1]: 1.6 } as Record<number, number>
  let carId = 0
  const events: LandFrame['events'] = []
  let nextOwl = 8
  let barrier = 0

  // ---- animaux ----
  type Actor = { s: AnimalState; step: (dt: number, t: number) => void }
  const actors: Actor[] = []
  let aid = 0
  const mkAnimal = (kind: AnimalKind, p: Pt): AnimalState => ({ id: aid++, kind, x: p.x, y: p.y, face: 1, t: 0 })

  if (th === 'foret' && anyTree.length > 2) {
    const home = anyTree[0]
    const s = mkAnimal('owl', { x: home[1] + 0.5, y: home[0] + 0.28 })
    actors.push({ s, step: (_dt, t) => {
      const b = t % 3.4
      s.blink = b > 3.15 ? Math.sin(((b - 3.15) / 0.25) * Math.PI) : 0
      s.look = Math.sin(t * 0.6) > 0.55 ? 1 : Math.sin(t * 0.6) < -0.55 ? -1 : 0
      s.t = t
    } })
  }
  if ((th === 'foret' || th === 'automne') && trees.length > 1) {
    const s = mkAnimal('squirrel', centre(trees[0]))
    let idx = 0, nxt = 1, ph: 'sit' | 'hop' = 'sit', t0 = 0
    let from = centre(trees[0]), to = from
    actors.push({ s, step: (_dt, t) => {
      if (ph === 'sit' && t > nxt) {
        let j = idx
        while (j === idx) j = Math.floor(rand() * trees.length)
        from = centre(trees[idx]); to = centre(trees[j]); idx = j; ph = 'hop'; t0 = t; events.push('squirrel')
      }
      if (ph === 'hop') {
        const dur = Math.max(0.6, Math.hypot(to.x - from.x, to.y - from.y) * 0.55)
        const k = Math.min(1, (t - t0) / dur)
        s.x = from.x + (to.x - from.x) * k
        s.y = from.y + (to.y - from.y) * k - Math.sin(k * Math.PI) * 0.22
        s.face = to.x - from.x < 0 ? -1 : 1
        if (k >= 1) { ph = 'sit'; nxt = t + 1.6 + rand() * 2 }
      }
      s.wag = Math.sin(t * (ph === 'sit' ? 6 : 14)) * 12
      s.t = t
    } })
  }
  if ((th === 'foret' || th === 'montagne') && grass.length) {
    let cell = grass[0]
    const s = mkAnimal('deer', { x: cell[1] + 0.5, y: cell[0] + 0.55 })
    let tgt: Pt = { x: s.x, y: s.y }, nxt = 3
    actors.push({ s, step: (dt, t) => {
      if (t > nxt) {
        const nb = neighbours(cell)
        if (nb.length) { cell = pick(nb); tgt = { x: cell[1] + 0.5, y: cell[0] + 0.55 } }
        nxt = t + 6 + rand() * 4
      }
      const dx = tgt.x - s.x, dy = tgt.y - s.y, d = Math.hypot(dx, dy)
      if (d > 0.03) { s.x += (dx / d) * 0.35 * dt; s.y += (dy / d) * 0.35 * dt; s.face = dx < 0 ? -1 : 1 }
      s.t = t
    } })
  }
  if ((th === 'plaine' || th === 'hiver') && grass.length) {
    let cell = grass[0]
    const s = mkAnimal('rabbit', centre(cell))
    let a: Pt = { x: s.x, y: s.y }, b = a, t0 = 0, nxt = 1, mv = false
    actors.push({ s, step: (_dt, t) => {
      if (!mv && t > nxt) {
        const nb = neighbours(cell)
        if (nb.length) { cell = pick(nb); a = b; b = { x: cell[1] + 0.3 + rand() * 0.4, y: cell[0] + 0.45 + rand() * 0.25 }; t0 = t; mv = true }
        else nxt = t + 3
      }
      if (mv) {
        const k = Math.min(1, (t - t0) / 0.45) // un saut d'une case à l'autre
        s.x = a.x + (b.x - a.x) * k
        s.y = a.y + (b.y - a.y) * k - Math.sin(k * Math.PI) * 0.2
        s.face = b.x - a.x < 0 ? -1 : 1
        if (k >= 1) { mv = false; nxt = t + 1.5 + rand() * 3 }
      }
      s.t = t
    } })
  }
  if (th === 'automne' && grass.length) {
    const c = pick(grass)
    const s = mkAnimal('hedgehog', centre(c))
    actors.push({ s, step: (_dt, t) => {
      s.x = c[1] + 0.5 + Math.sin(t * 0.25) * 0.14
      s.y = c[0] + 0.55 + Math.cos(t * 0.19) * 0.06 + Math.sin(t * 7) * 0.006
      s.face = Math.cos(t * 0.25) < 0 ? -1 : 1
      s.t = t
    } })
  }
  if (th === 'plaine' && grass.length) {
    for (let i = 0; i < 3; i++) {
      const c = grass[i % grass.length], ph = rand() * 10
      const s = mkAnimal('butterfly', centre(c))
      actors.push({ s, step: (_dt, t) => {
        s.x = c[1] + 0.5 + Math.sin(t * 0.7 + ph) * 0.35 + Math.sin(t * 1.9 + ph) * 0.08
        s.y = c[0] + 0.5 + Math.sin(t * 0.9 + ph * 2) * 0.3
        s.face = Math.cos(t * 0.7 + ph) < 0 ? -1 : 1
        s.t = t + ph
      } })
    }
  }

  // ---- oiseaux ----
  const birdCount = th === 'plaine' || th === 'automne' ? 3 : th === 'montagne' ? 1 : 0
  const birds = Array.from({ length: birdCount }, (_, i) => ({ id: i, off: i * 0.33, y0: 0.8 + i * (n / 4) + rand(), dark: th !== 'plaine', slow: th === 'montagne' }))

  // ---- météo ----
  const mkParticles = (count: number, vmin: number, vspan: number) => Array.from({ length: count }, () => ({ x: rand() * n, y: rand() * n, r: 0.02 + rand() * 0.025, spin: rand() * 6, v: vmin + rand() * vspan }))
  const flakes = th === 'hiver' ? mkParticles(Math.round(n * n * 0.9), 0.4, 0.5) : []
  const leaves = th === 'automne' ? mkParticles(Math.round(n * 2), 0.25, 0.25) : []

  const hasOwl = actors.some((a) => a.s.kind === 'owl')
  const birdPrev = birds.map(() => NaN)
  function step(dt: number, t: number, trainNear: boolean): LandFrame {
    events.length = 0
    if (hasOwl && t > nextOwl) { events.push('owl'); nextOwl = t + 12 + rand() * 8 }
    // barrière : se baisse quand le train approche, se relève quand il est passé
    barrier += ((trainNear && uc !== null ? 1 : 0) - barrier) * Math.min(1, dt * 4)

    if (road) {
      for (const dir of [1, -1] as const) {
        spawn[dir] -= dt
        if (spawn[dir] > 0) continue
        spawn[dir] = 2.2 + rand() * 3.2
        const u0 = dir > 0 ? -0.5 : n + 0.5
        if (cars.some((c) => c.dir === dir && Math.abs(c.u - u0) < 0.9)) continue
        cars.push({ id: carId++, u: u0, lane: dir > 0 ? -0.135 : 0.135, dir, kind: rand() < 0.18 ? 1 : 0, color: pick(CAR_COLORS), v: 1, vmax: 1.1 + rand() * 0.5 })
      }
      for (const c of cars) {
        let want = c.vmax
        if (uc !== null && barrier > 0.35) {
          const ahead = c.dir * (uc - c.dir * 0.62 - c.u) // distance jusqu'à la ligne d'arrêt (positive : pas encore franchie)
          if (ahead >= -0.25 && ahead < 0.9) want = Math.min(want, Math.max(0, ahead) * 3)
        }
        let gap = Infinity
        for (const o of cars) if (o !== c && o.dir === c.dir) { const d = c.dir * (o.u - c.u); if (d > 0 && d < gap) gap = d }
        if (gap < 0.9) want = Math.min(want, Math.max(0, gap - 0.5) * 3)
        c.v += (want - c.v) * Math.min(1, dt * 6)
        c.u += c.dir * c.v * dt
        // le bruit du moteur part quand la voiture passe au milieu de la grille : on l'entend quand on la voit
        if (!c.heard && c.dir * (c.u - n / 2) >= 0) { c.heard = true; events.push('car') }
      }
      for (let i = cars.length - 1; i >= 0; i--) if (cars[i].u > n + 0.8 || cars[i].u < -0.8) cars.splice(i, 1)
    }

    for (const a of actors) a.step(dt, t)

    for (const p of flakes) {
      p.y += p.v * dt; p.x += 0.1 * dt
      if (p.y > n + 0.1) { p.y = -0.1; p.x = rand() * n }
      if (p.x > n + 0.1) p.x = -0.1
    }
    for (const p of leaves) {
      p.y += p.v * dt; p.x += 0.35 * dt; p.spin += dt * 80
      if (p.y > n + 0.1) { p.y = -0.1; p.x = rand() * n }
      if (p.x > n + 0.1) p.x = -0.1
    }
    const bs: BirdState[] = birds.map((b, i) => {
      const k = ((t * (b.slow ? 0.07 : 0.11) + b.off) % 1.4) - 0.2
      const bx = k * (n + 1) - 0.5
      if (birdPrev[i] < 1 && bx >= 1 && !Number.isNaN(birdPrev[i])) events.push('bird') // le chant part quand l'oiseau entre dans la grille
      birdPrev[i] = bx
      return { id: i, x: bx, y: b.y0 + Math.sin(k * 6) * 0.2, flap: Math.sin(t * (b.slow ? 3 : 12) + i) * 0.5, dark: b.dark }
    })
    return {
      cars: cars.map((c) => ({ id: c.id, u: c.u, lane: c.lane, dir: c.dir, kind: c.kind, color: c.color })),
      barrier,
      lights: barrier > 0.5 && Math.floor(t * 3) % 2 === 0,
      animals: actors.map((a) => ({ ...a.s })),
      birds: bs,
      flakes: flakes.map((p) => ({ x: p.x + Math.sin(t * 1.5 + p.spin) * 0.08, y: p.y, r: p.r, spin: 0 })),
      leaves: leaves.map((p) => ({ x: p.x + Math.sin(t * 1.5 + p.spin) * 0.08, y: p.y, r: p.r, spin: p.spin })),
      events: [...events],
    }
  }
  return { step, road, uc }
}

// Distance, le long du trajet du train, à laquelle il passe au plus près du point (x, y).
export function distanceNear(route: { points: Pt[]; cum: number[] }, x: number, y: number): number {
  let best = Infinity
  let at = 0
  for (let i = 1; i < route.points.length; i++) {
    const a = route.points[i - 1], b = route.points[i]
    const dx = b.x - a.x, dy = b.y - a.y
    const l2 = dx * dx + dy * dy || 1
    const t = clamp(((x - a.x) * dx + (y - a.y) * dy) / l2, 0, 1)
    const d = Math.hypot(a.x + dx * t - x, a.y + dy * t - y)
    if (d < best) { best = d; at = route.cum[i - 1] + (route.cum[i] - route.cum[i - 1]) * t }
  }
  return at
}
