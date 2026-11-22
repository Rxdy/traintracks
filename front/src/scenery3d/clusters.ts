// Regroupements du décor 3D : des cases voisines de même nature ne donnent pas N objets collés, mais UN ensemble.
//  - montagnes : un massif plus haut et plus large, avec une crête (le sommet est au centre, la pente descend vers les bords) ;
//  - végétation : une vraie forêt (plusieurs arbres par case, serrés), pas un arbre isolé par case.
// Comme pour un lac : les cases se rejoignent. Une case isolée reste un objet seul (voir build() dans world.ts).
import * as THREE from 'three'
import { rng } from '../scenery'
import type { Pal } from '../scenery/themes'
import type { Anim, Kit } from './world'

export type Cell = [number, number]

/** Composantes connexes (4 voisins) des cases dont la nature est dans `kinds`. */
export function components(rows: number, cols: number, kindAt: (r: number, c: number) => string, kinds: Set<string>): Cell[][] {
  const seen = new Set<number>()
  const out: Cell[][] = []
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (seen.has(r * cols + c) || !kinds.has(kindAt(r, c))) continue
      const comp: Cell[] = []
      const stack: Cell[] = [[r, c]]
      seen.add(r * cols + c)
      while (stack.length) {
        const [y, x] = stack.pop()!
        comp.push([y, x])
        for (const [dy, dx] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const ny = y + dy
          const nx = x + dx
          if (ny < 0 || nx < 0 || ny >= rows || nx >= cols || seen.has(ny * cols + nx) || !kinds.has(kindAt(ny, nx))) continue
          seen.add(ny * cols + nx)
          stack.push([ny, nx])
        }
      }
      out.push(comp)
    }
  return out
}

/**
 * Un massif de montagnes : UN relief lisse (un maillage), pas des cônes. Chaque case est un sommet arrondi, les cases voisines sont
 * reliées par une crête (la hauteur est le maximum des sommets et des arêtes qui les relient, donc la crête reste haute entre deux
 * cases). Plus le massif est grand, plus il monte. Le bas est rocheux, le haut enneigé, et un peu de bruit casse les surfaces lisses.
 * Une montagne seule suit la même règle (un seul sommet arrondi).
 */
export function buildMassif(
  cells: Cell[],
  pal: Pal,
  kit: Kit,
  anims: Anim[],
  delayOf: (r: number, c: number) => number,
  add: (g: THREE.Group) => void,
): void {
  const { mat } = kit
  const key = new Set(cells.map(([r, c]) => `${r},${c}`))
  const has = (r: number, c: number) => key.has(`${r},${c}`)
  const around = (r: number, c: number) => {
    let n = 0
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dy || dx) && has(r + dy, c + dx)) n++
    return n
  }
  const size = cells.length
  const grow = Math.min(1.8, 1 + 0.1 * (size - 1))
  const heightOf = (r: number, c: number) => (0.62 + 0.08 * around(r, c)) * grow
  const R = 0.92 // rayon d'un sommet : un peu plus que la case, pour que les cases voisines se fondent

  // boîte du relief, avec une marge pour que les pentes descendent jusqu'au sol
  let r0 = Infinity, r1 = -Infinity, c0 = Infinity, c1 = -Infinity
  for (const [r, c] of cells) { r0 = Math.min(r0, r); r1 = Math.max(r1, r); c0 = Math.min(c0, c); c1 = Math.max(c1, c) }
  const x0 = c0 - 0.5, x1 = c1 + 1.5, z0 = r0 - 0.5, z1 = r1 + 1.5
  const per = 18 // points par case
  const nx = Math.round((x1 - x0) * per), nz = Math.round((z1 - z0) * per)
  const rand = rng(size * 7919 + r0 * 131 + c0 * 17)
  const seedA = rand() * 100, seedB = rand() * 100
  const noise = (x: number, z: number, s: number) => {
    // bruit de valeurs lissé : des bosses douces, pas du bruit blanc
    const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi
    const h = (i: number, j: number) => { const v = Math.sin((i + s) * 127.1 + (j + s * 1.7) * 311.7) * 43758.5453; return v - Math.floor(v) }
    const u = fx * fx * (3 - 2 * fx), w = fz * fz * (3 - 2 * fz)
    return h(xi, zi) * (1 - u) * (1 - w) + h(xi + 1, zi) * u * (1 - w) + h(xi, zi + 1) * (1 - u) * w + h(xi + 1, zi + 1) * u * w
  }
  const bump = (d: number) => (d >= R ? 0 : Math.pow(1 - Math.pow(d / R, 1.5), 1.7)) // sommet arrondi mais bien marqué, flancs assez raides
  const segs: [number, number, number, number, number][] = [] // arêtes entre cases voisines (x, z, x', z', hauteur)
  for (const [r, c] of cells)
    for (const [dy, dx] of [[0, 1], [1, 0]] as const)
      if (has(r + dy, c + dx)) segs.push([c + 0.5, r + 0.5, c + dx + 0.5, r + dy + 0.5, Math.max(heightOf(r, c), heightOf(r + dy, c + dx)) * 0.74]) // la crête fléchit entre deux sommets
  const distSeg = (px: number, pz: number, ax: number, az: number, bx: number, bz: number) => {
    const vx = bx - ax, vz = bz - az
    const t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz)))
    return Math.hypot(px - (ax + t * vx), pz - (az + t * vz))
  }
  const field = (x: number, z: number) => {
    let h = 0
    for (const [r, c] of cells) h = Math.max(h, heightOf(r, c) * bump(Math.hypot(x - (c + 0.5), z - (r + 0.5))))
    for (const [ax, az, bx, bz, ah] of segs) h = Math.max(h, ah * bump(distSeg(x, z, ax, az, bx, bz)))
    // relief : grosses ondulations + arêtes de roche (bruit « en crête »), qui s'effacent vers le bord pour rester posées au sol
    const edge = Math.min(1, h / 0.18)
    const ridge = 1 - Math.abs(noise(x * 3.1, z * 3.1, seedB) * 2 - 1)
    return h * (1 + 0.22 * (noise(x * 1.7, z * 1.7, seedA) - 0.5)) + edge * 0.16 * ridge * h
  }
  const geom = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx, nz).rotateX(-Math.PI / 2)
  const pos = geom.attributes.position as THREE.BufferAttribute
  const colors = new Float32Array(pos.count * 3)
  const tmp = new THREE.Color()
  const rockA = new THREE.Color(pal.rock[0]), rockB = new THREE.Color(pal.rock[1]), cap = new THREE.Color(pal.cap ?? '#ffffff'), foot = new THREE.Color(pal.b)
  let peak = 0.01
  const hs: number[] = []
  for (let i = 0; i < pos.count; i++) {
    const x = x0 + (x1 - x0) / 2 + pos.getX(i), z = z0 + (z1 - z0) / 2 + pos.getZ(i)
    const h = field(x, z)
    hs.push(h)
    peak = Math.max(peak, h)
  }
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2
  for (let i = 0; i < pos.count; i++) {
    const h = hs[i]
    const x = pos.getX(i) + cx, z = pos.getZ(i) + cz
    pos.setY(i, h < 0.004 ? -0.02 : h) // le bord se cache sous le sol
    const t = h / peak
    const n = noise(x * 5, z * 5, seedA)
    tmp.copy(rockA).lerp(rockB, n)
    tmp.lerp(foot, Math.max(0, 1 - t / 0.22) * 0.8) // le pied prend la couleur du sol
    const snow = Math.min(1, Math.max(0, (t - (0.66 + (n - 0.5) * 0.2)) / 0.12)) // la neige couvre le haut, bord irrégulier
    tmp.lerp(cap, snow)
    colors.set([tmp.r, tmp.g, tmp.b], i * 3)
  }
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geom.computeVertexNormals()
  const m = new THREE.Mesh(geom, mat('#ffffff', null, { vertexColors: true, flatShading: false, roughness: 0.85 }))
  m.castShadow = m.receiveShadow = true
  const g = new THREE.Group()
  g.position.set(cx, 0, cz)
  m.position.set(0, 0, 0)
  g.add(m)
  g.userData.base = 1
  g.scale.setScalar(0.001)
  anims.push({ g, delay: Math.min(...cells.map(([r, c]) => delayOf(r, c))), phase: 0 })
  add(g)
}

/** Une forêt : plusieurs arbres par case, tirés dans la case et un peu au-delà, serrés, de tailles variées. */
export function buildForest(
  cells: Cell[],
  kindAt: (r: number, c: number) => string,
  vAt: (r: number, c: number) => number,
  make: (kind: string, v: number, delay: number) => THREE.Group | null,
  delayOf: (r: number, c: number) => number,
  add: (g: THREE.Group) => void,
): void {
  const size = cells.length
  // au plus 3 arbres par case ; au-delà de 40 cases, 2 (le décor reste léger)
  const perCell = size > 40 ? 2 : 3
  for (const [r, c] of cells) {
    const rand = rng(r * 977 + c * 31 + size * 7)
    for (let k = 0; k < perCell; k++) {
      const kind = kindAt(r, c)
      const g = make(kind, vAt(r, c) + k, delayOf(r, c) + k * 90)
      if (!g) continue
      g.position.set(c + 0.5 + (rand() - 0.5) * 0.78, 0, r + 0.5 + (rand() - 0.5) * 0.78)
      g.userData.base = 0.82 + rand() * 0.34
      g.rotation.y = rand() * 6
      g.scale.setScalar(0.001)
      add(g)
    }
  }
}

/**
 * Un village : chaque case porte deux maisons, un peu plus petites, tournées vers le centre du village (la place).
 * En ville (immeubles), chaque case garde un immeuble, élargi pour que le pâté de maisons soit continu.
 */
export function buildVillage(
  cells: Cell[],
  kindAt: (r: number, c: number) => string,
  vAt: (r: number, c: number) => number,
  make: (kind: string, v: number, delay: number) => THREE.Group | null,
  delayOf: (r: number, c: number) => number,
  add: (g: THREE.Group) => void,
): void {
  const cx = cells.reduce((a, [, c]) => a + c + 0.5, 0) / cells.length
  const cz = cells.reduce((a, [r]) => a + r + 0.5, 0) / cells.length
  for (const [r, c] of cells) {
    const kind = kindAt(r, c)
    const rand = rng(r * 613 + c * 29 + cells.length)
    if (kind === 'building') {
      const g = make(kind, vAt(r, c), delayOf(r, c))
      if (!g) continue
      g.position.set(c + 0.5, 0, r + 0.5)
      g.userData.base = 1.42 // l'immeuble remplit sa case : les voisins se touchent
      g.scale.setScalar(0.001)
      add(g)
      continue
    }
    const x0 = c + 0.5, z0 = r + 0.5
    // les deux maisons de la case, de part et d'autre de son centre, en travers de la direction de la place
    const dx = cx - x0, dz = cz - z0
    const face = Math.abs(dx) + Math.abs(dz) < 0.01 ? rand() * 6 : Math.atan2(dx, dz)
    const side = { x: Math.cos(face), z: -Math.sin(face) }
    for (const k of [-1, 1]) {
      const g = make(kind, vAt(r, c) + (k > 0 ? 1 : 0), delayOf(r, c) + (k > 0 ? 80 : 0))
      if (!g) continue
      g.position.set(x0 + side.x * 0.23 * k + (rand() - 0.5) * 0.06, 0, z0 + side.z * 0.23 * k + (rand() - 0.5) * 0.06)
      g.rotation.y = face + (rand() - 0.5) * 0.3 // la porte (face +z de la maison) regarde la place
      g.userData.base = 0.9
      g.scale.setScalar(0.001)
      add(g)
    }
  }
}
