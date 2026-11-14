// Décor 3D d'un niveau gagné (Three.js). Il lit les MÊMES données que le décor SVG (scenery/generate.ts) et se pose
// exactement à sa place, sous la grille : la caméra regarde à la verticale, donc le sol tombe pile sous les cases.
// Pour qu'on voie quand même le volume (façades, troncs), le monde est légèrement « cisaillé » : plus un point est
// haut, plus il remonte à l'écran (vue cavalière). Lumière en haut à gauche, ombres portées vers le bas à droite.
//
// Tout ce qui est plat (herbe, champs, ballast, route, lit de la rivière, prolongements de la voie) est peint dans
// une seule texture de sol, dessinée en SVG puis rastérisée : c'est le rendu « option 1 ». Les objets debout sont
// en volumes, avec des textures générées par le code (écorce, tuiles, pierre, bois, façades). Aucune image à charger.
import * as THREE from 'three'
import { PAL, rng, type Scenery, type Tile } from '../scenery'
import { riverD, sample } from '../scenery/motion'
import type { Pal } from '../scenery/themes'
import type { Route } from '../trainRoute'

const SHEAR = 1 // une hauteur h remonte de h à l'écran (vue cavalière : on voit les façades et les troncs)
const NIGHT = new Set(['lune', 'neon'])
const HOT = new Set(['volcan', 'enfer'])
const BIG = new Set(['mountain', 'mesa', 'dune', 'building', 'crater'])

// ---------- couleurs ----------
const hex = (h: string): [number, number, number] => {
  const s = h.replace('#', '')
  return s.length === 3 ? [0, 1, 2].map((i) => parseInt(s[i] + s[i], 16)) as [number, number, number] : [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16)) as [number, number, number]
}
const toHex = (c: number[]) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
const mix = (a: string, b: string, k: number) => toHex(hex(a).map((v, i) => v + (hex(b)[i] - v) * k))
const light = (h: string, k: number) => mix(h, '#ffffff', k)
const dark = (h: string, k: number) => mix(h, '#000000', k)

// ---------- textures générées ----------
type Ctx = CanvasRenderingContext2D
function canvasTex(w: number, h: number, draw: (g: Ctx, w: number, h: number) => void, repeat = true): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!, w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}
// Textures « multiplicatrices » : blanches avec des détails gris. La couleur vient du matériau (donc de la palette).
function makeTextures(seed: number) {
  const r = rng(seed ^ 0x51ed)
  const speckle = canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#fff'
    g.fillRect(0, 0, w, h)
    for (let i = 0; i < 260; i++) {
      const v = 200 + Math.floor(r() * 55)
      g.fillStyle = `rgb(${v},${v},${v})`
      g.fillRect(Math.floor(r() * w), Math.floor(r() * h), 2, 2)
    }
  })
  const bark = canvasTex(32, 64, (g, w, h) => {
    g.fillStyle = '#fff'
    g.fillRect(0, 0, w, h)
    for (let i = 0; i < 18; i++) {
      const v = 150 + Math.floor(r() * 70)
      g.strokeStyle = `rgb(${v},${v},${v})`
      g.lineWidth = 1 + r() * 2
      const x = r() * w
      g.beginPath()
      g.moveTo(x, 0)
      g.bezierCurveTo(x + 3, h * 0.3, x - 3, h * 0.7, x + 1, h)
      g.stroke()
    }
  })
  const tiles = canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#fff'
    g.fillRect(0, 0, w, h)
    for (let y = 0; y < h; y += 8) {
      g.fillStyle = 'rgb(165,165,165)'
      g.fillRect(0, y + 6, w, 2) // rangée de tuiles : ombre sous le rang
      for (let x = (y / 8) % 2 ? 4 : 0; x < w; x += 8) {
        const v = 225 + Math.floor(r() * 30)
        g.fillStyle = `rgb(${v},${v},${v})`
        g.fillRect(x + 1, y, 6, 6)
      }
    }
  })
  const wood = canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#fff'
    g.fillRect(0, 0, w, h)
    for (let y = 0; y < h; y += 8) {
      g.fillStyle = 'rgb(150,150,150)'
      g.fillRect(0, y, w, 1)
      for (let i = 0; i < 4; i++) {
        const v = 200 + Math.floor(r() * 40)
        g.fillStyle = `rgb(${v},${v},${v})`
        g.fillRect(r() * w, y + 2 + r() * 5, 6 + r() * 14, 1)
      }
    }
  })
  const stone = canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#fff'
    g.fillRect(0, 0, w, h)
    for (let i = 0; i < 40; i++) {
      const v = 175 + Math.floor(r() * 70)
      g.fillStyle = `rgb(${v},${v},${v})`
      g.beginPath()
      g.ellipse(r() * w, r() * h, 3 + r() * 6, 2 + r() * 4, r() * 3, 0, Math.PI * 2)
      g.fill()
    }
  })
  const strata = canvasTex(16, 64, (g, w, h) => {
    for (let y = 0; y < h; y += 4) {
      const v = y % 8 ? 255 : 205 + Math.floor(r() * 25)
      g.fillStyle = `rgb(${v},${v},${v})`
      g.fillRect(0, y, w, 4)
    }
  })
  const plaster = canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#fff'
    g.fillRect(0, 0, w, h)
    for (let i = 0; i < 120; i++) {
      const v = 228 + Math.floor(r() * 27)
      g.fillStyle = `rgb(${v},${v},${v})`
      g.fillRect(r() * w, r() * h, 3, 3)
    }
  })
  return { speckle, bark, tiles, wood, stone, strata, plaster }
}
type Texs = ReturnType<typeof makeTextures>

// Fusion : la glace en haut à gauche, le feu en bas à droite ; chaque case prend la palette de son côté (comme le SVG).
const palAt = (sc: Scenery, r: number, c: number): Pal => (sc.theme === 'fusion' ? (r + c > (sc.rows + sc.cols) / 2 - 1 ? PAL.volcan : PAL.hiver) : PAL[sc.theme])

// ---------- texture du sol (SVG → canvas) ----------
function groundSvg(sc: Scenery, route: Route | null, pal: Pal): string {
  const W = sc.cols * 100
  const H = sc.rows * 100
  const a = hex(pal.a).map((v) => v / 255)
  const dk = a.map((v) => v * 0.72)
  const lt = a.map((v) => v + (1 - v) * 0.35)
  const m = (c: number[], alpha: string) => `0 0 0 0 ${c[0].toFixed(3)}  0 0 0 0 ${c[1].toFixed(3)}  0 0 0 0 ${c[2].toFixed(3)}  ${alpha}`
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>
  <filter id="pd" filterUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><feTurbulence type="fractalNoise" baseFrequency="0.011" numOctaves="3" seed="${sc.seed % 97}"/><feColorMatrix type="matrix" values="${m(dk, '1.8 0 0 0 -0.8')}"/></filter>
  <filter id="pl" filterUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="${(sc.seed % 89) + 3}"/><feColorMatrix type="matrix" values="${m(lt, '1.8 0 0 0 -0.85')}"/></filter>
  <filter id="gr" filterUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="2"/><feColorMatrix type="matrix" values="${m(dk.map((v) => v * 0.5), '0 0 0 -1.4 0.9')}"/></filter>
  <pattern id="gravel" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="${pal.bed}"/>
    <circle cx="4" cy="5" r="2.2" fill="${pal.bedEdge}"/><circle cx="15" cy="3" r="1.8" fill="${light(pal.bed, 0.3)}"/><circle cx="10" cy="13" r="2.4" fill="${dark(pal.bed, 0.08)}"/><circle cx="20" cy="15" r="2" fill="${pal.bedEdge}"/><circle cx="5" cy="20" r="1.8" fill="${light(pal.bed, 0.3)}"/><circle cx="17" cy="22" r="1.6" fill="${dark(pal.bed, 0.08)}"/></pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="${pal.a}"/>${sc.theme === 'fusion' ? sc.tiles.map((row, r) => row.map((_t, c) => `<rect x="${c * 100}" y="${r * 100}" width="101" height="101" fill="${palAt(sc, r, c).a}"/>`).join('')).join('') : ''}
  <rect width="${W}" height="${H}" filter="url(#pd)" opacity="0.5"/>
  <rect width="${W}" height="${H}" filter="url(#pl)" opacity="0.45"/>
  <rect width="${W}" height="${H}" filter="url(#gr)" opacity="0.45"/>`
  // détails du sol et champs, case par case
  sc.tiles.forEach((row, r) =>
    row.forEach((t: Tile, c) => {
      const x = c * 100
      const y = r * 100
      if (t.kind === 'grass') {
        if (t.v === 0) s += `<circle cx="${x + 28}" cy="${y + 66}" r="5" fill="${pal.dots[0]}"/><circle cx="${x + 64}" cy="${y + 40}" r="5" fill="${pal.dots[1]}"/><circle cx="${x + 74}" cy="${y + 74}" r="4.5" fill="${pal.dots[2]}"/>`
        else if (t.v === 1) s += `<path d="M${x + 30} ${y + 70} l4 -12 l4 12 M${x + 62} ${y + 46} l4 -12 l4 12" stroke="${pal.tuft}" stroke-width="3" fill="none" stroke-linecap="round"/>`
      } else if (t.kind === 'field') {
        const [c0, c1] = pal.crops[t.v % pal.crops.length]
        s += `<rect x="${x}" y="${y}" width="100" height="100" fill="${c0}"/>`
        for (let k = 0; k < 5; k++)
          s += t.dir === 'h'
            ? `<rect x="${x}" y="${y + k * 20 + 10}" width="100" height="10" fill="${c1}"/><rect x="${x}" y="${y + k * 20 + 18}" width="100" height="2" fill="#000" opacity="0.12"/>`
            : `<rect x="${x + k * 20 + 10}" y="${y}" width="10" height="100" fill="${c1}"/><rect x="${x + k * 20 + 18}" y="${y}" width="2" height="100" fill="#000" opacity="0.12"/>`
      }
    }),
  )
  // ballast de la voie (dans la grille et ses prolongements)
  const lines: string[] = []
  if (route) lines.push('M' + route.points.map((p) => `${((p.x + sc.margin.x) * 100).toFixed(1)} ${((p.y + sc.margin.y) * 100).toFixed(1)}`).join(' L'))
  for (const e of sc.ext) lines.push('M' + e.map((p) => `${(p.x * 100).toFixed(1)} ${(p.y * 100).toFixed(1)}`).join(' L'))
  for (const d of lines) s += `<path d="${d}" fill="none" stroke="#000" stroke-opacity="0.16" stroke-width="72" stroke-linejoin="round" transform="translate(3 5)"/>`
  for (const d of lines) s += `<path d="${d}" fill="none" stroke="${pal.bedEdge}" stroke-width="68" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="url(#gravel)" stroke-width="58" stroke-linejoin="round"/>`
  // route
  if (sc.road) {
    const mid = (sc.road.line + 0.5) * 100
    const d = sc.road.axis === 'v' ? `M${mid} -40 L${mid} ${H + 40}` : `M-40 ${mid} L${W + 40} ${mid}`
    s += `<path d="${d}" fill="none" stroke="${pal.bedEdge}" stroke-width="62"/><path d="${d}" fill="none" stroke="${pal.road}" stroke-width="54"/>
    <path d="${d}" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="18 16" opacity="0.8"/>`
    const x = sc.road.crossing
    if (x)
      for (let i = 0; i < 6; i++) {
        const o = -42 + i * 14
        s += sc.road.axis === 'v'
          ? `<rect x="${x[1] * 100 + 23}" y="${x[0] * 100 + 50 + o}" width="54" height="7" fill="${pal.rail.tie}"/>`
          : `<rect x="${x[1] * 100 + 50 + o}" y="${x[0] * 100 + 23}" width="7" height="54" fill="${pal.rail.tie}"/>`
      }
  }
  // rivière ou étang (le lit ; l'eau brillante est un volume posé dessus)
  if (sc.river && sc.river.length >= 2) {
    const d = riverD(sc.river)
    s += `<g transform="scale(100)"><path d="${d}" fill="none" stroke="${dark(pal.a, 0.18)}" stroke-width="0.78" stroke-linecap="round" stroke-linejoin="round" opacity="0.5"/>
    <path d="${d}" fill="none" stroke="${pal.deep}" stroke-width="0.68" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${d}" fill="none" stroke="${pal.shallow}" stroke-width="0.56" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${d}" fill="none" stroke="${pal.water}" stroke-width="0.44" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${d}" fill="none" stroke="${pal.deep}" stroke-width="0.16" stroke-linecap="round" stroke-linejoin="round" opacity="0.5"/></g>`
  }
  const pond = pondBox(sc)
  if (pond) {
    const { x, y, w, h } = pond
    s += `<g transform="scale(100)"><rect x="${x - 0.06}" y="${y - 0.06}" width="${w + 0.12}" height="${h + 0.12}" rx="0.42" fill="${pal.deep}"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="0.36" fill="${pal.shallow}"/><rect x="${x + 0.08}" y="${y + 0.08}" width="${w - 0.16}" height="${h - 0.16}" rx="0.3" fill="${pal.water}"/></g>`
  }
  // rails des prolongements, à plat (même géométrie que les rails de la grille, qui eux restent dessinés par la grille)
  for (const e of sc.ext) {
    const [p, q] = e
    const horiz = Math.abs(p.y - q.y) < 1e-9
    const lo = horiz ? Math.min(p.x, q.x) : Math.min(p.y, q.y)
    const hi = horiz ? Math.max(p.x, q.x) : Math.max(p.y, q.y)
    const mid = horiz ? p.y : p.x
    for (let t = Math.floor(lo * 4) / 4 + 0.125; t < hi; t += 0.25) {
      if (t < lo) continue
      s += horiz
        ? `<rect x="${t * 100 - 3.5}" y="${mid * 100 - 20}" width="7" height="40" fill="${pal.rail.tie}"/>`
        : `<rect x="${mid * 100 - 20}" y="${t * 100 - 3.5}" width="40" height="7" fill="${pal.rail.tie}"/>`
    }
    for (const o of [-0.12, 0.12])
      s += horiz
        ? `<rect x="${lo * 100}" y="${(mid + o) * 100 - 3}" width="${(hi - lo) * 100}" height="6" fill="${pal.rail.rail}"/>`
        : `<rect x="${(mid + o) * 100 - 3}" y="${lo * 100}" width="6" height="${(hi - lo) * 100}" fill="${pal.rail.rail}"/>`
  }
  return s + '</svg>'
}
function pondBox(sc: Scenery) {
  const cells = sc.pond
  if (!cells.length) return null
  const rs = cells.map((c) => c[0])
  const cs = cells.map((c) => c[1])
  return { x: Math.min(...cs) + 0.08, y: Math.min(...rs) + 0.08, w: Math.max(...cs) - Math.min(...cs) + 0.84, h: Math.max(...rs) - Math.min(...rs) + 0.84 }
}
function loadSvgTexture(svg: string, w: number, h: number, maxSide: number): Promise<THREE.CanvasTexture> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const k = Math.min(1, maxSide / Math.max(w, h))
      const c = document.createElement('canvas')
      c.width = Math.round(w * k)
      c.height = Math.round(h * k)
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      const t = new THREE.CanvasTexture(c)
      t.colorSpace = THREE.SRGBColorSpace
      resolve(t)
    }
    img.onerror = () => reject(new Error('texture du sol'))
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  })
}

// ---------- objets debout ----------
interface Anim {
  g: THREE.Object3D
  delay: number // ms avant d'apparaître
  kind?: 'sway' | 'blades' | 'smoke'
  phase: number
}
function makeKit(texs: Texs) {
  const mats = new Map<string, THREE.Material>()
  const geos = new Map<string, THREE.BufferGeometry>()
  const mat = (color: string, map?: THREE.Texture | null, o: THREE.MeshStandardMaterialParameters = {}) => {
    const k = color + (map?.uuid ?? '') + JSON.stringify(o)
    let m = mats.get(k)
    if (!m) mats.set(k, (m = new THREE.MeshStandardMaterial({ color, map: map ?? null, roughness: 0.85, flatShading: true, ...o })))
    return m
  }
  const geo = <G extends THREE.BufferGeometry>(k: string, make: () => G): G => {
    let g = geos.get(k)
    if (!g) geos.set(k, (g = make()))
    return g as G
  }
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, parent?: THREE.Object3D) => {
    const o = new THREE.Mesh(g, m)
    o.position.set(x, y, z)
    o.castShadow = true
    o.receiveShadow = true
    parent?.add(o)
    return o
  }
  return { mat, geo, mesh, texs, dispose: () => { mats.forEach((m) => m.dispose()); geos.forEach((g) => g.dispose()) } }
}
type Kit = ReturnType<typeof makeKit>

function build(kind: Tile['kind'], v: number, pal: Pal, kit: Kit, anims: Anim[], delay: number): THREE.Group | null {
  const { mat, geo, mesh, texs } = kit
  const g = new THREE.Group()
  const trunk = pal.trunk ?? '#7a4e2d'
  const sway = () => anims.push({ g, delay, kind: 'sway', phase: v * 1.7 })
  switch (kind) {
    case 'tree': {
      mesh(geo('trunk', () => new THREE.CylinderGeometry(0.045, 0.065, 0.3, 7)), mat(trunk, texs.bark), 0, 0.15, 0, g)
      const c = pal.canopy
      const blob = (r: number) => geo('blob' + r, () => new THREE.IcosahedronGeometry(r, 1))
      mesh(blob(0.25), mat(c[v % 3], texs.speckle), 0, 0.47, 0, g).rotation.y = v
      mesh(blob(0.17), mat(c[(v + 1) % 3], texs.speckle), -0.15, 0.36, 0.06, g)
      mesh(blob(0.18), mat(c[(v + 2) % 3], texs.speckle), 0.15, 0.37, 0.05, g)
      mesh(blob(0.13), mat(light(c[v % 3], 0.12), texs.speckle), 0.02, 0.33, 0.16, g)
      if (pal.fruit && v === 2) for (const [x, y, z] of [[-0.1, 0.5, 0.18], [0.12, 0.42, 0.2], [0.04, 0.62, 0.12]]) mesh(geo('fruit', () => new THREE.SphereGeometry(0.035, 8, 6)), mat(pal.fruit, null, { flatShading: false, roughness: 0.4 }), x, y, z, g)
      sway()
      break
    }
    case 'pine': {
      mesh(geo('ptrunk', () => new THREE.CylinderGeometry(0.04, 0.05, 0.16, 6)), mat(trunk, texs.bark), 0, 0.08, 0, g)
      const tiers: [number, number, number][] = [[0.27, 0.38, 0.32], [0.2, 0.32, 0.53], [0.13, 0.26, 0.72]]
      tiers.forEach(([r, h, y], i) => {
        mesh(geo(`cone${r}`, () => new THREE.ConeGeometry(r, h, 8)), mat(pal.pine[i % 2], texs.speckle), 0, y, 0, g)
        if (pal.snow) mesh(geo(`snow${r}`, () => new THREE.ConeGeometry(r * 0.55, h * 0.4, 8)), mat('#ffffff', null, { roughness: 0.6 }), 0, y + h * 0.3, 0, g)
      })
      sway()
      break
    }
    case 'house': {
      const wall = pal.walls[v % pal.walls.length]
      const roof = pal.roofs[v % pal.roofs.length]
      mesh(geo('walls', () => new THREE.BoxGeometry(0.52, 0.3, 0.44)), mat(wall, texs.plaster), 0, 0.15, 0, g)
      const roofGeo = geo('roof', () => {
        const sh = new THREE.Shape()
        sh.moveTo(-0.33, 0)
        sh.lineTo(0.33, 0)
        sh.lineTo(0, 0.25)
        sh.closePath()
        const rg = new THREE.ExtrudeGeometry(sh, { depth: 0.54, bevelEnabled: false })
        rg.translate(0, 0, -0.27)
        return rg
      })
      mesh(roofGeo, mat(pal.snow ? light(roof, 0.55) : roof, texs.tiles), 0, 0.3, 0, g)
      mesh(geo('chimney', () => new THREE.BoxGeometry(0.07, 0.17, 0.07)), mat('#a8977a', texs.stone), 0.15, 0.45, -0.1, g)
      mesh(geo('door', () => new THREE.BoxGeometry(0.11, 0.18, 0.012)), mat('#7a4e2d', texs.wood), 0, 0.09, 0.222, g)
      const win = mat('#bfe3fa', null, { emissive: new THREE.Color('#5a7a90'), emissiveIntensity: 0.5, roughness: 0.3, flatShading: false })
      for (const dx of [-0.16, 0.16]) mesh(geo('win', () => new THREE.BoxGeometry(0.09, 0.09, 0.012)), win, dx, 0.18, 0.222, g)
      anims.push({ g, delay, phase: 0 })
      break
    }
    case 'building': {
      const r = rng(v * 7919 + 13)
      const h = 0.55 + (v % 3) * 0.22
      const wall = pal.walls[v % pal.walls.length]
      const facade = canvasTex(64, Math.round(64 * h * 2), (c, w, hh) => {
        c.fillStyle = wall
        c.fillRect(0, 0, w, hh)
        for (let y = 6; y < hh - 8; y += 14)
          for (let x = 6; x < w - 6; x += 14) {
            c.fillStyle = r() < 0.3 ? '#fde68a' : '#a9c7e0'
            c.fillRect(x, y, 8, 9)
          }
      }, false)
      const m = new THREE.MeshStandardMaterial({ map: facade, roughness: 0.7, emissive: new THREE.Color('#ffffff'), emissiveMap: facade, emissiveIntensity: 0.08 })
      mesh(new THREE.BoxGeometry(0.66, h, 0.6), m, 0, h / 2, 0, g)
      mesh(geo('broof', () => new THREE.BoxGeometry(0.7, 0.04, 0.64)), mat(pal.roofs[v % pal.roofs.length], texs.stone), 0, h + 0.02, 0, g)
      mesh(geo('bbox', () => new THREE.BoxGeometry(0.12, 0.1, 0.12)), mat('#6b7280'), 0.18, h + 0.09, -0.12, g)
      anims.push({ g, delay, phase: 0 })
      break
    }
    case 'windmill': {
      mesh(geo('mill', () => new THREE.CylinderGeometry(0.12, 0.2, 0.62, 8)), mat('#f4ead2', texs.plaster), 0, 0.31, 0, g)
      mesh(geo('millcap', () => new THREE.ConeGeometry(0.15, 0.18, 8)), mat('#9a3412', texs.tiles), 0, 0.71, 0, g)
      const blades = new THREE.Group()
      blades.position.set(0, 0.56, 0.17)
      for (let i = 0; i < 4; i++) {
        const arm = new THREE.Group()
        arm.rotation.z = (i * Math.PI) / 2
        mesh(geo('blade', () => new THREE.BoxGeometry(0.07, 0.34, 0.01)), mat('#ffffff', texs.wood), 0.03, 0.2, 0, arm)
        mesh(geo('spar', () => new THREE.BoxGeometry(0.015, 0.38, 0.015)), mat('#7a4e2d'), 0, 0.19, 0.01, arm)
        blades.add(arm)
      }
      g.add(blades)
      anims.push({ g, delay, phase: 0 }, { g: blades, delay: -1, kind: 'blades', phase: v })
      break
    }
    case 'boulder': {
      const b = mesh(geo('boulder', () => new THREE.DodecahedronGeometry(0.2, 0)), mat(pal.rock[0], texs.stone), 0, 0.08, 0, g)
      b.scale.set(1, 0.65, 0.9)
      b.rotation.y = v
      anims.push({ g, delay, phase: 0 })
      break
    }
    case 'mountain': {
      const m = mesh(geo('mount', () => new THREE.ConeGeometry(0.5, 0.75, 6)), mat(pal.rock[0], texs.stone), 0, 0.375, 0, g)
      m.rotation.y = v * 0.7
      mesh(geo('mount2', () => new THREE.ConeGeometry(0.3, 0.45, 5)), mat(pal.rock[1], texs.stone), 0.28, 0.225, 0.12, g)
      const cap = mesh(geo('cap', () => new THREE.ConeGeometry(0.2, 0.3, 6)), mat(pal.cap ?? '#ffffff', null, { roughness: 0.6 }), 0, 0.6, 0, g)
      cap.rotation.y = v * 0.7
      anims.push({ g, delay, phase: 0 })
      break
    }
    case 'snowman': {
      const snow = mat('#ffffff', null, { roughness: 0.6, flatShading: false })
      mesh(geo('sm1', () => new THREE.SphereGeometry(0.15, 14, 10)), snow, 0, 0.14, 0, g)
      mesh(geo('sm2', () => new THREE.SphereGeometry(0.1, 14, 10)), snow, 0, 0.35, 0, g)
      mesh(geo('carrot', () => new THREE.ConeGeometry(0.02, 0.09, 6).rotateX(Math.PI / 2)), mat('#f97316'), 0, 0.36, 0.13, g)
      mesh(geo('hat', () => new THREE.CylinderGeometry(0.06, 0.06, 0.09, 10)), mat('#111827'), 0, 0.48, 0, g)
      anims.push({ g, delay, phase: 0 })
      break
    }
    case 'cactus': {
      const c = mat(pal.canopy[1], texs.bark)
      mesh(geo('cac', () => new THREE.CylinderGeometry(0.07, 0.08, 0.5, 8)), c, 0, 0.25, 0, g)
      mesh(geo('arm', () => new THREE.CylinderGeometry(0.045, 0.05, 0.2, 8)), c, -0.13, 0.32, 0, g)
      mesh(geo('arm', () => new THREE.CylinderGeometry(0.045, 0.05, 0.2, 8)), c, 0.13, 0.26, 0, g)
      mesh(geo('armj', () => new THREE.CylinderGeometry(0.04, 0.04, 0.1, 8).rotateZ(Math.PI / 2)), c, -0.08, 0.24, 0, g)
      mesh(geo('armj', () => new THREE.CylinderGeometry(0.04, 0.04, 0.1, 8).rotateZ(Math.PI / 2)), c, 0.08, 0.18, 0, g)
      if (pal.fruit && v % 2) mesh(geo('flower', () => new THREE.SphereGeometry(0.04, 8, 6)), mat(pal.fruit), 0, 0.52, 0, g)
      anims.push({ g, delay, phase: 0 })
      break
    }
    case 'palm': {
      let x = 0
      for (let i = 0; i < 5; i++) {
        x += 0.02 + i * 0.008
        mesh(geo('pseg', () => new THREE.CylinderGeometry(0.04, 0.05, 0.12, 7)), mat('#7a4e2d', texs.bark), x, 0.06 + i * 0.11, 0, g).rotation.z = -0.15 - i * 0.04
      }
      const top = new THREE.Group()
      top.position.set(x, 0.6, 0)
      for (let i = 0; i < 6; i++) {
        const leaf = new THREE.Group()
        leaf.rotation.y = (i / 6) * Math.PI * 2 + v
        const l = mesh(geo('leaf', () => new THREE.BoxGeometry(0.3, 0.012, 0.08).translate(0.15, 0, 0)), mat(pal.pine[i % 2], texs.speckle), 0, 0, 0, leaf)
        l.rotation.z = -0.45
        top.add(leaf)
      }
      for (const [dx, dz] of [[0.03, 0.03], [-0.03, 0.02], [0, -0.03]]) mesh(geo('coco', () => new THREE.SphereGeometry(0.03, 8, 6)), mat('#6b4226'), dx, -0.03, dz, top)
      g.add(top)
      sway()
      break
    }
    case 'crater': {
      mesh(geo('crim', () => new THREE.TorusGeometry(0.28, 0.06, 6, 16).rotateX(Math.PI / 2)), mat(pal.rock[0], texs.stone), 0, 0.02, 0, g)
      const floor = mesh(geo('cfloor', () => new THREE.CircleGeometry(0.26, 16).rotateX(-Math.PI / 2)), mat(pal.rock[1], texs.stone), 0, 0.005, 0, g)
      floor.castShadow = false
      mesh(geo('pebble', () => new THREE.DodecahedronGeometry(0.04, 0)), mat(pal.rock[0]), 0.36, 0.02, 0.2, g)
      anims.push({ g, delay, phase: 0 })
      break
    }
    case 'obsidian': {
      const glass = mat('#2d2140', null, { roughness: 0.15, metalness: 0.3 })
      for (const [x, z, h, rz] of [[-0.1, 0, 0.42, 0.15], [0.08, 0.05, 0.32, -0.2], [0.02, -0.1, 0.24, 0.05]]) {
        const s = mesh(geo('shard', () => new THREE.OctahedronGeometry(0.1, 0)), glass, x, h / 2, z, g)
        s.scale.set(0.8, h / 0.2, 0.8)
        s.rotation.z = rz
      }
      const glow = mesh(geo('glow', () => new THREE.CircleGeometry(0.22, 16).rotateX(-Math.PI / 2)), new THREE.MeshBasicMaterial({ color: pal.cap ?? '#ff7a1a', transparent: true, opacity: 0.55 }), 0, 0.006, 0, g)
      glow.castShadow = false
      anims.push({ g, delay, phase: 0 })
      break
    }
    case 'vent': {
      mesh(geo('vent', () => new THREE.ConeGeometry(0.26, 0.3, 7)), mat(pal.rock[0], texs.stone), 0, 0.15, 0, g)
      mesh(geo('ventglow', () => new THREE.SphereGeometry(0.06, 8, 6)), new THREE.MeshBasicMaterial({ color: pal.cap ?? '#ff7a1a' }), 0, 0.29, 0, g)
      const smoke = new THREE.Group()
      for (let i = 0; i < 3; i++) {
        const p = mesh(geo('puff', () => new THREE.SphereGeometry(0.07, 8, 6)), new THREE.MeshStandardMaterial({ color: '#d1d5db', transparent: true, opacity: 0.6, depthWrite: false }), 0, 0.3, 0, smoke)
        p.castShadow = false
        p.userData.i = i
      }
      g.add(smoke)
      anims.push({ g, delay, phase: 0 }, { g: smoke, delay: -1, kind: 'smoke', phase: v })
      break
    }
    case 'deadtree': {
      const m = mat('#2a1f1f', texs.bark)
      mesh(geo('dtrunk', () => new THREE.CylinderGeometry(0.035, 0.06, 0.45, 6)), m, 0, 0.225, 0, g).rotation.z = 0.08
      for (const [y, rz, ry] of [[0.32, 0.9, 0], [0.38, -0.8, 0.5], [0.26, 0.7, 2.2]]) {
        const b = mesh(geo('branch', () => new THREE.CylinderGeometry(0.015, 0.025, 0.2, 5).translate(0, 0.1, 0)), m, 0, y, 0, g)
        b.rotation.set(0, ry + v, rz)
      }
      anims.push({ g, delay, phase: 0 })
      break
    }
    case 'skull': {
      mesh(geo('skull', () => new THREE.SphereGeometry(0.11, 12, 10)), mat('#f1e8d4', null, { flatShading: false, roughness: 0.6 }), 0, 0.11, 0, g).scale.set(1, 0.9, 1.05)
      for (const dx of [-0.04, 0.04]) mesh(geo('eye', () => new THREE.SphereGeometry(0.025, 8, 6)), new THREE.MeshBasicMaterial({ color: '#ff3b1f' }), dx, 0.12, 0.09, g)
      for (const r of [0.6, -0.5]) mesh(geo('bone', () => new THREE.CylinderGeometry(0.015, 0.015, 0.22, 6).rotateZ(Math.PI / 2)), mat('#e8dcc4'), 0, 0.02, 0.12, g).rotation.y = r
      anims.push({ g, delay, phase: 0 })
      break
    }
    case 'mesa': {
      const m = mesh(geo('mesa', () => new THREE.CylinderGeometry(0.38, 0.47, 0.42, 7)), mat(pal.rock[0], texs.strata), 0, 0.21, 0, g)
      m.rotation.y = v
      mesh(geo('mesatop', () => new THREE.CylinderGeometry(0.38, 0.38, 0.02, 7)), mat(pal.cap ?? '#e9b27a', texs.speckle), 0, 0.43, 0, g).rotation.y = v
      anims.push({ g, delay, phase: 0 })
      break
    }
    case 'dune': {
      // longue bosse de sable, toutes orientées dans le sens du vent
      const d = mesh(geo('dune', () => new THREE.SphereGeometry(0.45, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2)), mat(light(pal.a, 0.06), null, { flatShading: false, roughness: 1 }), 0, 0, 0, g)
      d.scale.set(1.15, 0.26, 0.5)
      d.rotation.y = 0.25 + (v % 3) * 0.1
      anims.push({ g, delay, phase: 0 })
      break
    }
    case 'field': {
      // relief des sillons : de petites buttes qui accrochent la lumière (la couleur est peinte dans le sol)
      return null
    }
    default:
      return null
  }
  return g
}

// ---------- la vue ----------
export interface View3D {
  dispose(): void
}
export async function createView(canvas: HTMLCanvasElement, sc: Scenery, route: Route | null): Promise<View3D> {
  const pal = PAL[sc.theme]
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const scene = new THREE.Scene()
  const night = NIGHT.has(sc.theme)
  const hot = HOT.has(sc.theme)
  scene.add(new THREE.HemisphereLight(night ? '#8fa3d6' : '#eaf5ff', dark(pal.a, 0.3), night ? 1.1 : 1.7))
  const sun = new THREE.DirectionalLight(night ? '#c7d2fe' : hot ? '#ffd2b0' : '#fff3dc', night ? 1.4 : 2.6)
  const cx = sc.cols / 2
  const cz = sc.rows / 2
  sun.position.set(cx - 4, 9, cz - 3)
  sun.target.position.set(cx, 0, cz)
  sun.castShadow = true
  const span = Math.max(sc.cols, sc.rows) * 0.75 + 2
  Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 0.5, far: 30 })
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.bias = -0.0006
  sun.shadow.normalBias = 0.02
  scene.add(sun, sun.target)

  // le monde cisaillé : ce qui est haut remonte à l'écran
  const world = new THREE.Group()
  world.matrixAutoUpdate = false
  world.matrix.set(1, 0, 0, 0, 0, 1, 0, 0, 0, -SHEAR, 1, 0, 0, 0, 0, 1)
  scene.add(world)

  const texs = makeTextures(sc.seed)
  const kit = makeKit(texs)
  const disposables: { dispose(): void }[] = [kit, ...Object.values(texs)]

  // sol
  const groundMat = new THREE.MeshStandardMaterial({ color: pal.a, roughness: 1 })
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(sc.cols, sc.rows).rotateX(-Math.PI / 2), groundMat)
  ground.position.set(cx, 0, cz)
  ground.receiveShadow = true
  world.add(ground)
  disposables.push(ground.geometry, groundMat)
  const maxTex = Math.min(renderer.capabilities.maxTextureSize, 4096)
  const groundReady = loadSvgTexture(groundSvg(sc, route, pal), sc.cols * 100, sc.rows * 100, maxTex)
    .then((t) => {
      t.anisotropy = renderer.capabilities.getMaxAnisotropy()
      groundMat.map = t
      groundMat.color.set('#ffffff')
      groundMat.needsUpdate = true
      disposables.push(t)
    })
    .catch(() => undefined) // sans texture : un sol uni de la bonne couleur

  // eau : un ruban brillant posé sur le lit peint, avec des reflets qui avancent (sauf glace)
  const frozen = sc.theme === 'hiver'
  let shineTex: THREE.CanvasTexture | null = null
  if (sc.river && sc.river.length >= 2) {
    const poly = sample(sc.river)
    const pos: number[] = []
    const uv: number[] = []
    const idx: number[] = []
    const n = poly.pts.length
    for (let i = 0; i < n; i++) {
      const a = poly.pts[Math.max(0, i - 1)]
      const b = poly.pts[Math.min(n - 1, i + 1)]
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
      const nx = -(b.y - a.y) / len
      const nz = (b.x - a.x) / len
      const p = poly.pts[i]
      for (const side of [-1, 1]) {
        pos.push(p.x + nx * 0.23 * side, 0.004, p.y + nz * 0.23 * side)
        uv.push(side < 0 ? 0 : 1, poly.cum[i])
      }
      if (i < n - 1) idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2)
    }
    const rg = new THREE.BufferGeometry()
    rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    rg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    rg.setIndex(idx)
    rg.computeVertexNormals()
    const waterMat = new THREE.MeshStandardMaterial({ color: frozen ? '#dbeafe' : pal.water, roughness: frozen ? 0.15 : 0.08, metalness: 0.1, transparent: true, opacity: frozen ? 0.75 : 0.45 })
    const water = new THREE.Mesh(rg, waterMat)
    water.receiveShadow = true
    world.add(water)
    disposables.push(rg, waterMat)
    if (!frozen) {
      const r = rng(sc.seed ^ 0x77)
      shineTex = canvasTex(32, 128, (g, w, h) => {
        for (let i = 0; i < 9; i++) {
          g.fillStyle = 'rgba(255,255,255,0.85)'
          g.fillRect(4 + r() * (w - 8), r() * h, 2, 6 + r() * 10)
        }
      })
      shineTex.repeat.set(1, 0.6)
      const shineMat = new THREE.MeshBasicMaterial({ color: pal.shine, map: shineTex, transparent: true, depthWrite: false })
      const shine = new THREE.Mesh(rg, shineMat)
      shine.position.y = 0.002
      world.add(shine)
      disposables.push(shineMat, shineTex)
    }
  }
  const pond = pondBox(sc)
  if (pond) {
    const pg = new THREE.PlaneGeometry(pond.w - 0.1, pond.h - 0.1).rotateX(-Math.PI / 2)
    const pm = new THREE.MeshStandardMaterial({ color: frozen ? '#dbeafe' : pal.water, roughness: 0.08, transparent: true, opacity: 0.45 })
    const p = new THREE.Mesh(pg, pm)
    p.position.set(pond.x + pond.w / 2, 0.004, pond.y + pond.h / 2)
    world.add(p)
    disposables.push(pg, pm)
  }

  // ponts de la voie : tablier de pierre et parapets
  for (const [k, axis] of sc.bridges) {
    const [r, c] = k.split(',').map(Number)
    const deck = new THREE.Group()
    deck.position.set(c + 0.5, 0, r + 0.5)
    if (axis === 'v') deck.rotation.y = Math.PI / 2
    kit.mesh(kit.geo('deck', () => new THREE.BoxGeometry(1.02, 0.05, 0.64)), kit.mat('#c3bdaf', texs.stone), 0, 0.012, 0, deck)
    for (const z of [-0.33, 0.33]) kit.mesh(kit.geo('parapet', () => new THREE.BoxGeometry(1.04, 0.07, 0.06)), kit.mat('#8d877a', texs.stone), 0, 0.035, z, deck)
    world.add(deck)
  }

  // objets debout, qui poussent l'un après l'autre (même rythme que le décor SVG)
  const anims: Anim[] = []
  sc.tiles.forEach((row, r) =>
    row.forEach((t, c) => {
      if (t.kind === 'rail' || t.kind === 'road' || t.kind === 'grass' || sc.water.has(`${r},${c}`)) return
      const g = build(t.kind, t.v, palAt(sc, r, c), kit, anims, 500 + (r + c) * 120)
      if (!g) return
      g.position.set(c + 0.5, 0, r + 0.5)
      g.userData.base = BIG.has(t.kind) ? 1 : 1.3 // les petits objets remplissent mieux leur case
      g.scale.setScalar(0.001)
      world.add(g)
    }),
  )

  // caméra : verticale, orthographique, calée en haut (comme le SVG en « xMidYMin slice »)
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 60)
  camera.up.set(0, 0, -1)
  let lastScale = 0
  function resize(): void {
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (!w || !h) return
    const rect = canvas.getBoundingClientRect()
    const scale = rect.width / w || 1 // la grille est agrandie par CSS à la victoire : on dessine à la taille réelle
    lastScale = scale
    renderer.setPixelRatio(Math.min(3, (window.devicePixelRatio || 1) * scale))
    renderer.setSize(w, h, false)
    const viewH = (sc.cols * h) / w
    camera.left = -sc.cols / 2
    camera.right = sc.cols / 2
    camera.top = viewH / 2
    camera.bottom = -viewH / 2
    camera.position.set(cx, 20, viewH / 2)
    camera.lookAt(cx, 0, viewH / 2)
    camera.updateProjectionMatrix()
  }
  const ro = new ResizeObserver(resize)
  ro.observe(canvas)
  resize()

  await groundReady
  const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  const t0 = performance.now()
  let raf = 0
  let frame = 0
  let last = t0
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop)
    if (document.hidden) return
    const t = now - t0
    const dt = Math.min(0.1, (now - last) / 1000)
    last = now
    if (++frame % 30 === 0) {
      const rect = canvas.getBoundingClientRect()
      if (canvas.clientWidth && Math.abs(rect.width / canvas.clientWidth - lastScale) > 0.02) resize()
    }
    for (const a of anims) {
      if (a.delay >= 0) {
        const p = still ? 1 : Math.min(1, Math.max(0, (t - a.delay) / 700))
        const e = p < 1 ? 1 + 2.2 * Math.pow(p - 1, 3) + 1.2 * Math.pow(p - 1, 2) : 1 // petit rebond à l'arrivée
        const base = (a.g.userData.base as number | undefined) ?? 1
        if (!a.kind) a.g.scale.setScalar(Math.max(0.001, e * base))
        else if (a.kind === 'sway') {
          a.g.scale.setScalar(Math.max(0.001, e * base))
          if (!still) a.g.rotation.z = Math.sin(t / 900 + a.phase + a.g.position.x) * 0.03
        }
      } else if (!still && a.kind === 'blades') a.g.rotation.z -= dt * 1.4
      else if (!still && a.kind === 'smoke')
        a.g.children.forEach((p) => {
          const k = ((t / 2600 + p.userData.i / 3 + a.phase) % 1 + 1) % 1
          p.position.set(k * 0.12, 0.3 + k * 0.45, 0)
          p.scale.setScalar(0.6 + k * 1.4)
          ;((p as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity = 0.6 * (1 - k)
        })
    }
    if (shineTex && !still) shineTex.offset.y -= dt * 0.35
    renderer.render(scene, camera)
  }
  raf = requestAnimationFrame(loop)

  return {
    dispose() {
      cancelAnimationFrame(raf)
      ro.disconnect()
      // tout ce qui a été créé (géométries, matériaux, textures de façade…) ; libérer deux fois ne pose pas de problème
      world.traverse((o) => {
        const m = o as THREE.Mesh
        if (!m.isMesh) return
        m.geometry.dispose()
        for (const mt of ([] as THREE.Material[]).concat(m.material)) {
          const s = mt as THREE.MeshStandardMaterial
          s.map?.dispose()
          s.emissiveMap?.dispose()
          mt.dispose()
        }
      })
      disposables.forEach((d) => d.dispose())
      renderer.dispose()
    },
  }
}
