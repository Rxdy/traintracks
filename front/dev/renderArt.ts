// Fabrique les images fixes du jeu avec le moteur 3D du décor (outil de développement, jamais publié) :
//   ?scene=hero      image de la carte « Niveau » (un petit plateau de 4×4 avec sa voie, son train, quelques arbres)
//   ?scene=icon      icône de l'application (la locomotive en gros plan sur sa voie)
//   ?scene=maskable  la même, plus loin, pour les écrans d'accueil qui découpent l'icône en cercle ou en goutte
// Rendu à la taille de la fenêtre ; `scripts/render-art.sh` en fait des captures, puis les redimensionne.
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { PAL, type Scenery } from '../src/scenery'
import { SKY } from '../src/scenery/sky'
import { CAR_SPACING, WAGONS } from '../src/trainStyle'
import { buildForest, buildMassif } from '../src/scenery3d/clusters'
import { makeCar, makeSmoke } from '../src/scenery3d/trainModel'
import { build, canvasTex, dark, groundSvg, light, loadSvgTexture, makeKit, makeTextures, tickAnims, type Anim } from '../src/scenery3d/world'

const scene3 = new URLSearchParams(location.search).get('scene') ?? 'hero'
// ?style=soft : essai d'un rendu plus rond et brillant (formes arrondies, matériaux vernis), pour comparer ; pas adopté.
const soft = new URLSearchParams(location.search).get('style') === 'soft'
// ?smoke=1 : trois ronds de fumée sur la cheminée (images fixes)
const smoke = new URLSearchParams(location.search).get('smoke') === '1'
const theme = (new URLSearchParams(location.search).get('theme') ?? 'plaine') as keyof typeof PAL
const pal = PAL[theme]
const sky = SKY[theme]
document.body.style.margin = '0'
document.body.style.overflow = 'hidden'
const canvas = document.createElement('canvas')
canvas.style.cssText = 'display:block;width:100vw;height:100vh'
document.body.appendChild(canvas)

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(1)
renderer.setSize(innerWidth, innerHeight, false)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap
const scene = new THREE.Scene()
const texs = makeTextures(3)
const baseKit = makeKit(texs)
// Style « doux » : coins arrondis sur les boîtes, matériaux vernis, lissage des facettes, couleurs un peu plus vives.
function softenKit(k: typeof baseKit): typeof baseKit {
  const col = new THREE.Color()
  const vivid = (c: string) => {
    col.set(c)
    const hsl = { h: 0, s: 0, l: 0 }
    col.getHSL(hsl)
    return col.setHSL(hsl.h, Math.min(1, hsl.s * 1.25), hsl.l).getStyle()
  }
  const mats = new Map<string, THREE.Material>()
  const mat: typeof baseKit.mat = (color, map, o = {}) => {
    const key = color + (map?.uuid ?? '') + JSON.stringify(o)
    let m = mats.get(key)
    if (!m) mats.set(key, (m = new THREE.MeshPhysicalMaterial({ color: vivid(color), map: map ?? null, roughness: 0.38, clearcoat: 0.8, clearcoatRoughness: 0.15, ...o, flatShading: false })))
    return m
  }
  const geo: typeof baseKit.geo = (key, make) =>
    k.geo('soft:' + key, () => {
      const g = make()
      if (g instanceof THREE.BoxGeometry) {
        const { width: w, height: h, depth: d } = g.parameters
        return new RoundedBoxGeometry(w, h, d, 3, Math.min(w, h, d) * 0.22) as unknown as typeof g
      }
      if (g instanceof THREE.DodecahedronGeometry) return new THREE.IcosahedronGeometry(g.parameters.radius, 3) as unknown as typeof g // rocher : galet lisse
      if (g instanceof THREE.ExtrudeGeometry) {
        // toit : bords biseautés au lieu d'arêtes vives (même longueur qu'avant : le biseau déborde un peu)
        const o = g.parameters.options ?? {}
        const depth = o.depth ?? 0.5
        const r = new THREE.ExtrudeGeometry(g.parameters.shapes, { depth, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 4 })
        r.translate(0, 0, -depth / 2)
        return r as unknown as typeof g
      }
      return g
    })
  return { ...k, mat, geo }
}
const kit = soft ? softenKit(baseKit) : baseKit

scene.background = canvasTex(4, 256, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h)
  gr.addColorStop(0, '#6cbcf5')
  gr.addColorStop(0.6, sky.mid)
  gr.addColorStop(1, sky.low)
  g.fillStyle = gr
  g.fillRect(0, 0, w, h)
}, false)
scene.fog = new THREE.Fog(sky.low, 12, 34)
scene.add(new THREE.HemisphereLight('#eaf5ff', dark(pal.a, 0.3), 1.7))
const sun = new THREE.DirectionalLight('#fff3dc', 2.7)
sun.position.set(-3, 8, 1)
sun.target.position.set(2, 0, 2)
sun.castShadow = true
Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 0.5, far: 30 })
sun.shadow.mapSize.set(4096, 4096)
sun.shadow.bias = -0.0005
sun.shadow.normalBias = 0.02
scene.add(sun, sun.target)

// --- la voie : une ligne brisée aux angles arrondis, échantillonnée par longueur
type P = [number, number]
function rounded(pts: P[], radius: number): P[] {
  const out: P[] = [pts[0]]
  for (let i = 1; i < pts.length - 1; i++) {
    const [a, b, c] = [pts[i - 1], pts[i], pts[i + 1]]
    const da = Math.hypot(b[0] - a[0], b[1] - a[1])
    const dc = Math.hypot(c[0] - b[0], c[1] - b[1])
    const p0: P = [b[0] + ((a[0] - b[0]) * radius) / da, b[1] + ((a[1] - b[1]) * radius) / da]
    const p2: P = [b[0] + ((c[0] - b[0]) * radius) / dc, b[1] + ((c[1] - b[1]) * radius) / dc]
    for (let k = 0; k <= 16; k++) {
      const t = k / 16
      const u = 1 - t
      out.push([u * u * p0[0] + 2 * u * t * b[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * b[1] + t * t * p2[1]])
    }
  }
  out.push(pts[pts.length - 1])
  return out
}
function sampler(pts: P[]) {
  const cum = [0]
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  const len = cum[cum.length - 1]
  return {
    len,
    at(s: number) {
      s = Math.max(0, Math.min(len, s))
      let i = 1
      while (i < cum.length - 1 && cum[i] < s) i++
      const a = pts[i - 1]
      const b = pts[i]
      const f = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1)
      const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
      return { x: a[0] + (b[0] - a[0]) * f, z: a[1] + (b[1] - a[1]) * f, tx: (b[0] - a[0]) / d, tz: (b[1] - a[1]) / d }
    },
  }
}
function track(path: ReturnType<typeof sampler>, y0: number, keep: (x: number, z: number) => boolean) {
  const STEP = 0.04
  const n = Math.ceil(path.len / STEP) + 2
  const bed = new THREE.InstancedMesh(new THREE.BoxGeometry(STEP + 0.02, 0.05, 0.62), kit.mat(pal.bed, texs.speckle), n)
  const rails = new THREE.InstancedMesh(new THREE.BoxGeometry(STEP + 0.008, 0.035, 0.035), kit.mat(pal.rail.rail, null, { metalness: 0.6, roughness: 0.35, flatShading: false }), 2 * n)
  const ties = new THREE.InstancedMesh(new THREE.BoxGeometry(0.075, 0.03, 0.44), kit.mat(pal.rail.tie, texs.wood), n)
  for (const m of [bed, rails, ties]) {
    m.count = 0
    m.castShadow = m.receiveShadow = true
    scene.add(m)
  }
  const d = new THREE.Object3D()
  const put = (m: THREE.InstancedMesh, x: number, y: number, z: number, a: number) => {
    d.position.set(x, y, z)
    d.rotation.set(0, a, 0)
    d.updateMatrix()
    m.setMatrixAt(m.count++, d.matrix)
  }
  for (let s = 0; s <= path.len; s += STEP) {
    const q = path.at(s)
    if (!keep(q.x, q.z)) continue
    const a = Math.atan2(-q.tz, q.tx)
    put(bed, q.x, y0 + 0.025, q.z, a)
    for (const o of [-0.12, 0.12]) put(rails, q.x - q.tz * o, y0 + 0.085, q.z + q.tx * o, a)
  }
  for (let s = 0.125; s <= path.len; s += 0.25) {
    const q = path.at(s)
    if (keep(q.x, q.z)) put(ties, q.x, y0 + 0.06, q.z, Math.atan2(-q.tz, q.tx))
  }
}
function trainOn(path: ReturnType<typeof sampler>, head: number, y0: number, wagons = WAGONS) {
  // le train du jeu (src/scenery3d/trainModel.ts) : locomotive + wagons, mêmes couleurs que le Trajet
  for (let i = 0; i <= wagons; i++) {
    const g = makeCar(i)
    const q = path.at(head - i * CAR_SPACING)
    g.position.set(q.x, y0, q.z)
    g.rotation.y = Math.atan2(-q.tz, q.tx)
    scene.add(g)
  }
  if (smoke) {
    const g = makeSmoke()
    const q = path.at(head)
    g.position.set(q.x, y0, q.z)
    g.rotation.y = Math.atan2(-q.tz, q.tx)
    scene.add(g)
  }
}

const anims: Anim[] = []
const put = (kind: Parameters<typeof build>[0], x: number, z: number, v: number, y0: number, scale = 1.25) => {
  const g = build(kind, v, pal, kit, anims, 0)
  if (!g) return
  g.position.set(x, y0, z)
  g.userData.base = scale
  scene.add(g)
}

// sol de prairie (la même herbe que le décor), avec en option la grille du puzzle dessinée dessus
async function meadow(size: number, grid: boolean): Promise<THREE.Texture> {
  const fake = { seed: 5, cols: size, rows: size, tiles: [], ext: [], road: null, river: null, pond: [], margin: { x: 0, y: 0, b: 0 }, theme: 'plaine' } as unknown as Scenery
  let svg = groundSvg(fake, null, pal)
  if (grid) {
    let lines = ''
    for (let i = 0; i <= size; i++) lines += `<path d="M${i * 100} 0 V${size * 100} M0 ${i * 100} H${size * 100}" stroke="#fff" stroke-opacity="0.55" stroke-width="4"/>`
    svg = svg.replace('</svg>', lines + '</svg>')
  }
  return loadSvgTexture(svg, size * 100, size * 100, 2048)
}

async function hero() {
  // un petit plateau de 4×4 posé dans la prairie, vu de trois quarts
  const far = new THREE.Mesh(new THREE.PlaneGeometry(80, 80).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: pal.a, roughness: 1 }))
  far.receiveShadow = true
  scene.add(far)
  const top = await meadow(4, true)
  const block = new THREE.Mesh(new THREE.BoxGeometry(4, 0.4, 4), [
    kit.mat('#8a5a3a', texs.stone), kit.mat('#8a5a3a', texs.stone), new THREE.MeshStandardMaterial({ map: top, roughness: 1 }),
    kit.mat('#8a5a3a', texs.stone), kit.mat('#7a4e2d', texs.stone), kit.mat('#7a4e2d', texs.stone),
  ])
  block.position.set(2, 0.2, 2)
  block.castShadow = block.receiveShadow = true
  scene.add(block)
  const Y = 0.4
  const path = sampler(rounded([[-1.2, 0.5], [1.5, 0.5], [1.5, 2.5], [3.5, 2.5], [3.5, 5.2]], 0.5))
  track(path, Y, (x, z) => x >= -0.02 && x <= 4.02 && z >= -0.02 && z <= 4.02)
  trainOn(path, 5.9, Y)
  put('tree', 0.5, 1.6, 0, Y)
  put('tree', 3.3, 0.7, 2, Y)
  put('pine', 2.5, 0.5, 0, Y)
  put('house', 0.6, 3.4, 0, Y, 1.35)
  put('tree', 2.6, 1.5, 1, Y)
  put('pine', 0.45, 2.45, 0, Y)
  // quelques arbres dans la prairie autour
  put('tree', -1.4, 2.6, 1, 0, 1.4)
  put('pine', 5.6, 1.2, 0, 0, 1.4)
  put('tree', 5.4, 3.4, 2, 0, 1.4)
  put('tree', -0.8, -1.4, 0, 0, 1.3)
  put('pine', 4.6, -1.6, 0, 0, 1.3)
  const cam = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 0.1, 80)
  // assez bas pour voir l'horizon et le ciel en haut (derrière la pastille « Niveau ») ; le plateau occupe le bas
  cam.position.set(2, 4.9, 9.4)
  cam.lookAt(2, -0.9, -0.1)
  return cam
}

async function icon(far: boolean) {
  // la locomotive de trois quarts face, sur une voie qui vient du fond en tournant
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: await meadow(8, false), roughness: 1 }))
  ground.position.set(0, 0, 0)
  ground.receiveShadow = true
  const t = (ground.material as THREE.MeshStandardMaterial).map!
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(7, 7)
  scene.add(ground)
  const path = sampler(rounded([[-6, -3], [0, -3], [0, 3.5]], 1.6))
  track(path, 0, () => true)
  trainOn(path, path.len - 4.3, 0)
  put('tree', -1.3, -0.6, 0, 0, 1.5)
  put('pine', 1.5, -1.6, 0, 0, 1.5)
  put('tree', 1.7, 0.9, 2, 0, 1.4)
  put('tree', -3.2, -4.6, 1, 0, 1.5)
  put('pine', 2.6, -4.4, 0, 0, 1.4)
  put('house', -2.6, -1.6, 0, 0, 1.5)
  const q = path.at(path.len - 4.3)
  const cam = new THREE.PerspectiveCamera(far ? 34 : 24, 1, 0.1, 80)
  cam.position.set(q.x + 2.1, 2.5, q.z + 3.6)
  cam.lookAt(q.x - 0.15, 0.15, q.z - 0.25)
  return cam
}

// ?scene=show&kind=tree|pine|house|… : un seul élément sur un carré d'herbe (pour comparer l'ancien et le nouveau rendu).
async function show(kind: string) {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: await meadow(8, false), roughness: 1 }))
  ground.receiveShadow = true
  const t = (ground.material as THREE.MeshStandardMaterial).map!
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(7, 7)
  scene.add(ground)
  if (kind === 'train' || kind === 'rail') {
    const path = sampler(rounded([[-3, -1], [0, -1], [0, 2]], 1.0))
    track(path, 0, () => true)
    if (kind === 'train') trainOn(path, path.len - 1.3, 0)
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 80)
    cam.position.set(1.9, 1.5, 2.3)
    cam.lookAt(-0.1, 0.15, 0.2)
    return cam
  }
  const g = build(kind as Parameters<typeof build>[0], 1, pal, kit, anims, 0)
  if (g) {
    g.userData.base = 1
    scene.add(g)
  }
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 80)
  cam.position.set(1.5, 1.25, 2.1)
  cam.lookAt(0, 0.33, 0)
  return cam
}

// ?scene=cluster&kind=mountain|forest[&old=1] : un groupe de cases voisines, regroupé (nouveau) ou case par case (old=1, avant).
async function cluster(kind: string) {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: await meadow(8, false), roughness: 1 }))
  ground.receiveShadow = true
  const t = (ground.material as THREE.MeshStandardMaterial).map!
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(7, 7)
  scene.add(ground)
  const old = new URLSearchParams(location.search).get('old') === '1'
  const cells: [number, number][] = kind === 'mountain' ? [[0, 0], [0, 1], [0, 2], [1, 1], [1, 2]] : [[0, 0], [0, 1], [0, 2], [0, 3], [1, 0], [1, 1], [1, 2], [2, 1], [2, 2], [2, 3]]
  const tk = kind === 'mountain' ? 'mountain' : 'tree'
  if (old) {
    cells.forEach(([r, c], i) => {
      const g = build(i % 4 === 3 && kind !== 'mountain' ? 'pine' : (tk as Parameters<typeof build>[0]), i, pal, kit, anims, 0)
      if (!g) return
      g.position.set(c + 0.5, 0, r + 0.5)
      g.userData.base = kind === 'mountain' ? 1 : 1.3
      scene.add(g)
    })
  } else if (kind === 'mountain') buildMassif(cells, pal, kit, anims, () => 0, (g) => scene.add(g))
  else
    buildForest(cells, (r, c) => ((r + c) % 4 === 3 ? 'pine' : 'tree'), (r, c) => r * 3 + c, (k, v) => build(k as Parameters<typeof build>[0], v, pal, kit, anims, 0), () => 0, (g) => scene.add(g))
  const cam = new THREE.PerspectiveCamera(34, 1, 0.1, 80)
  cam.position.set(kind === 'mountain' ? 1.6 : 2.2, 3.2, kind === 'mountain' ? 6.2 : 6.4)
  cam.lookAt(kind === 'mountain' ? 1.6 : 2, 0.2, 1)
  return cam
}

// ?scene=og : le paysage final (voie, train, massif, forêt, maison, moulin), à la taille de l'image de partage (1200×630).
async function og() {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: await meadow(8, false), roughness: 1 }))
  ground.receiveShadow = true
  const t = (ground.material as THREE.MeshStandardMaterial).map!
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(10, 10)
  scene.add(ground)
  scene.fog = null
  sun.position.set(-1, 9, 4)
  sun.target.position.set(4, 0, -2)
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 0.5, far: 40 })
  const path = sampler(rounded([[-6, -1.2], [2.5, -1.2], [2.5, 1.4], [11, 1.4]], 1.3))
  track(path, 0, () => true)
  trainOn(path, 11.6, 0)
  const cells = (list: [number, number][]) => list
  buildMassif(cells([[-6, 3], [-6, 4], [-6, 5], [-5, 4], [-5, 5]]), pal, kit, anims, () => 0, (g) => scene.add(g))
  buildMassif(cells([[-6, 9], [-6, 10], [-5, 10]]), pal, kit, anims, () => 0, (g) => scene.add(g))
  const forest = (list: [number, number][]) => buildForest(list, (r, c) => ((r * 3 + c) % 4 === 0 ? 'pine' : 'tree'), (r, c) => Math.abs(r * 3 + c), (k, v) => build(k as Parameters<typeof build>[0], v, pal, kit, anims, 0), () => 0, (g) => scene.add(g))
  forest([[-4, -4], [-4, -3], [-4, -2], [-3, -4], [-3, -3], [-3, -2], [-3, -1], [-2, -3], [-2, -2], [-5, -3], [-5, -2]])
  forest([[-4, 7], [-4, 8], [-4, 9], [-3, 7], [-3, 8], [-3, 9], [-3, 10], [-2, 8], [-2, 9]])
  put('house', 4.6, -0.2, 0, 0, 1.55)
  put('house', 5.9, -0.5, 1, 0, 1.45)
  put('windmill', 9.3, -1.6, 0, 0, 1.6)
  put('tree', 1.2, -2.4, 0, 0, 1.5)
  put('tree', 7.3, 3.3, 1, 0, 1.5)
  put('pine', 0.2, 3.1, 0, 0, 1.5)
  put('tree', -2.5, 2.6, 2, 0, 1.5)
  put('tree', 4.4, 3.8, 0, 0, 1.5)
  put('boulder', 8.2, 3.0, 0, 0, 1.6)
  const cam = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 90)
  cam.position.set(2.4, 4.6, 8.4) // le train à droite : la carte de texte prend la gauche de l'image
  cam.lookAt(2.4, 0.1, -1.6)
  return cam
}

const cam = scene3 === 'og' ? await og() : scene3 === 'cluster' ? await cluster(new URLSearchParams(location.search).get('kind') ?? 'mountain') : scene3 === 'hero' ? await hero() : scene3 === 'show' ? await show(new URLSearchParams(location.search).get('kind') ?? 'tree') : await icon(scene3 === 'maskable')
tickAnims(anims, 1e6, 0, true) // tout à sa taille finale, immobile
renderer.render(scene, cam)
document.title = 'pret'
