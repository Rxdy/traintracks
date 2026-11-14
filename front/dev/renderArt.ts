// Fabrique les images fixes du jeu avec le moteur 3D du décor (outil de développement, jamais publié) :
//   ?scene=hero      image de la carte « Niveau » (un petit plateau de 4×4 avec sa voie, son train, quelques arbres)
//   ?scene=icon      icône de l'application (la locomotive en gros plan sur sa voie)
//   ?scene=maskable  la même, plus loin, pour les écrans d'accueil qui découpent l'icône en cercle ou en goutte
// Rendu à la taille de la fenêtre ; `scripts/render-art.sh` en fait des captures, puis les redimensionne.
import * as THREE from 'three'
import { PAL, type Scenery } from '../src/scenery'
import { SKY } from '../src/scenery/sky'
import { build, canvasTex, dark, groundSvg, light, loadSvgTexture, makeKit, makeTextures, tickAnims, type Anim } from '../src/scenery3d/world'

const scene3 = new URLSearchParams(location.search).get('scene') ?? 'hero'
const pal = PAL.plaine
const sky = SKY.plaine
document.body.style.margin = '0'
document.body.style.overflow = 'hidden'
const canvas = document.createElement('canvas')
canvas.style.cssText = 'display:block;width:100vw;height:100vh'
document.body.appendChild(canvas)

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(1)
renderer.setSize(innerWidth, innerHeight, false)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
const scene = new THREE.Scene()
const texs = makeTextures(3)
const kit = makeKit(texs)

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
function trainOn(path: ReturnType<typeof sampler>, head: number, y0: number, cars = 3) {
  ;['#dc2626', '#2563eb', '#f59e0b', '#16a34a'].slice(0, cars).forEach((c, i) => {
    const g = new THREE.Group()
    kit.mesh(kit.geo('carbody', () => new THREE.BoxGeometry(0.52, 0.22, 0.32)), kit.mat(c, texs.plaster, { roughness: 0.45 }), 0, 0.2, 0, g)
    if (i === 0) {
      kit.mesh(kit.geo('cabin', () => new THREE.BoxGeometry(0.2, 0.2, 0.32)), kit.mat(dark(c, 0.3)), -0.16, 0.41, 0, g)
      kit.mesh(kit.geo('cabwin', () => new THREE.BoxGeometry(0.205, 0.07, 0.2)), kit.mat('#bfe3fa', null, { roughness: 0.2, flatShading: false }), -0.16, 0.44, 0, g)
      kit.mesh(kit.geo('chimney', () => new THREE.CylinderGeometry(0.05, 0.04, 0.16, 12)), kit.mat('#1f2937'), 0.15, 0.39, 0, g)
      kit.mesh(kit.geo('lamp', () => new THREE.SphereGeometry(0.045, 10, 8)), new THREE.MeshBasicMaterial({ color: '#fde68a' }), 0.27, 0.24, 0, g)
    } else kit.mesh(kit.geo('carroof', () => new THREE.BoxGeometry(0.5, 0.035, 0.3)), kit.mat(light(c, 0.3)), 0, 0.33, 0, g)
    for (const x of [-0.16, 0.16]) for (const z of [-0.17, 0.17]) kit.mesh(kit.geo('wheel', () => new THREE.CylinderGeometry(0.075, 0.075, 0.035, 16).rotateX(Math.PI / 2)), kit.mat('#1f2937'), x, 0.09, z, g)
    const q = path.at(head - i * 0.62)
    g.position.set(q.x, y0, q.z)
    g.rotation.y = Math.atan2(-q.tz, q.tx)
    scene.add(g)
  })
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
  trainOn(path, path.len - 4.3, 0, 3)
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

const cam = scene3 === 'hero' ? await hero() : await icon(scene3 === 'maskable')
tickAnims(anims, 1e6, 0, true) // tout à sa taille finale, immobile
renderer.render(scene, cam)
document.title = 'pret'
