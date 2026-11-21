// Fond du menu en 3D : un paysage de l'environnement en cours (relief au loin, arbres, maisons), le ciel avec son soleil
// et ses nuages, et au premier plan une voie où un petit train passe de temps en temps, dans un sens puis dans l'autre.
// Mêmes objets, mêmes textures et même lumière que le décor des niveaux (world.ts) : le menu et le jeu se ressemblent.
// Économe : 30 images par seconde au plus, rien quand l'onglet est caché, image fixe si l'on préfère moins d'animations.
import { CHIMNEY, makeCar, makeSteam, makeWagon } from './trainModel'
import { carOffsets, STARTER, type WagonStyle } from '../trainStyle'
import * as THREE from 'three'
import { PAL, PARAMS, rng, type Scenery, type Theme, type TileKind } from '../scenery'
import { SKY } from '../scenery/sky'
import { build, canvasTex, finish, dark, groundSvg, loadSvgTexture, makeKit, makeTextures, tickAnims, type Anim } from './world'

const NIGHT = new Set<Theme>(['lune', 'neon'])
const HOT = new Set<Theme>(['volcan', 'enfer'])
const TRACK_Z = 1.6 // la voie, au premier plan
const CYCLE = 30 // s : le train traverse dans un sens, la voie reste vide, puis il repasse dans l'autre

export interface Home3D {
  dispose(): void
  /** Le joueur a changé son train (Mon train, machine) : on remplace les wagons, sans refaire le décor. */
  setWagons(wagons: readonly WagonStyle[]): void
}

export async function createHome(canvas: HTMLCanvasElement, theme: Theme, onPass?: (dir: 1 | -1) => void, wagons: readonly WagonStyle[] = STARTER): Promise<Home3D> {
  const pal = PAL[theme] ?? PAL.plaine
  const sky = SKY[theme] ?? SKY.plaine
  const params = PARAMS[theme]
  const night = NIGHT.has(theme)
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  const fin = finish(renderer)
  const scene = new THREE.Scene()
  const texs = makeTextures(7)
  const kit = makeKit(texs)
  const disposables: { dispose(): void }[] = [kit, ...Object.values(texs)]

  // ciel en dégradé, brume de la couleur de l'horizon
  const skyTex = canvasTex(4, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h)
    gr.addColorStop(0, sky.top)
    gr.addColorStop(0.55, sky.mid)
    gr.addColorStop(1, sky.low)
    g.fillStyle = gr
    g.fillRect(0, 0, w, h)
  }, false)
  scene.background = skyTex
  scene.fog = new THREE.Fog(sky.low, 14, 46)
  disposables.push(skyTex)

  scene.add(new THREE.HemisphereLight(night ? '#8fa3d6' : '#eaf5ff', dark(pal.a, 0.3), night ? 1.1 : 1.6))
  const sun = new THREE.DirectionalLight(night ? '#c7d2fe' : HOT.has(theme) ? '#ffd2b0' : '#fff3dc', night ? 1.3 : 2.5)
  sun.position.set(6, 9, -6) // le soleil est au fond à droite : les ombres viennent vers nous, à gauche
  sun.castShadow = true
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 0.5, far: 40 })
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.bias = -0.0006
  sun.shadow.normalBias = 0.02
  scene.add(sun, sun.target)

  // soleil (ou lune) visible dans le ciel : un disque lumineux qui ne prend pas la brume
  const glow = canvasTex(128, 128, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2)
    gr.addColorStop(0, sky.sun)
    gr.addColorStop(0.32, sky.sunCore)
    gr.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = gr
    g.fillRect(0, 0, w, w)
  }, false)
  const sunDisc = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: glow, transparent: true, fog: false, depthWrite: false }))
  sunDisc.position.set(9, 9, -30)
  scene.add(sunDisc)
  disposables.push(glow)

  // étoiles la nuit
  if (night || sky.night) {
    const r = rng(11)
    const pts: number[] = []
    for (let i = 0; i < 260; i++) pts.push((r() - 0.5) * 90, 6 + r() * 26, -34 - r() * 6)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 0.16, fog: false, transparent: true, opacity: 0.85 })))
  }

  // sol : l'herbe de l'environnement, répétée jusqu'à l'horizon
  const groundMat = new THREE.MeshStandardMaterial({ color: pal.a, roughness: 1, toneMapped: false })
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120).rotateX(-Math.PI / 2), groundMat)
  ground.receiveShadow = true
  scene.add(ground)
  const fake = { seed: 7, cols: 4, rows: 4, tiles: [], ext: [], road: null, river: null, pond: [], margin: { x: 0, y: 0, b: 0 }, theme } as unknown as Scenery
  const tile = groundSvg(fake, null, pal).replace(/<feTurbulence /g, '<feTurbulence stitchTiles="stitch" ')
  const groundReady = loadSvgTexture(tile, 400, 400, 512)
    .then((t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.repeat.set(30, 30)
      t.anisotropy = 8
      groundMat.map = t
      groundMat.color.set('#ffffff')
      groundMat.needsUpdate = true
      disposables.push(t)
    })
    .catch(() => undefined)

  // collines au loin, en facettes
  const r = rng(theme.length * 131 + 7)
  for (let i = 0; i < 9; i++) {
    const h = new THREE.Mesh(kit.geo('hill', () => new THREE.IcosahedronGeometry(1, 1)), kit.mat(i % 2 ? pal.b : dark(pal.b, 0.08), texs.speckle))
    h.position.set(-26 + i * 6.5 + r() * 3, -0.3, -20 - r() * 8)
    h.scale.set(5 + r() * 3, 1.6 + r() * 2.2, 3.5)
    h.receiveShadow = true
    scene.add(h)
  }

  // nuages : quelques boules aplaties qui dérivent lentement
  const clouds = new THREE.Group()
  // les nuages sont éclairés de l'intérieur (émissif) : sinon, vus d'en dessous, ils paraissent gris
  const cloudMat = new THREE.MeshStandardMaterial({ color: sky.cloud, emissive: sky.cloud, emissiveIntensity: 0.6, roughness: 1, flatShading: true, fog: false, transparent: true, opacity: 0.95 })
  for (let i = 0; i < 5; i++) {
    const c = new THREE.Group()
    for (let k = 0; k < 4; k++) {
      const b = new THREE.Mesh(kit.geo('cloud', () => new THREE.IcosahedronGeometry(1, 1)), cloudMat)
      b.position.set(k * 1.1 - 1.6, (k % 2) * 0.4, 0)
      b.scale.set(1.2, 0.7, 0.8)
      c.add(b)
    }
    c.position.set(-24 + i * 11 + r() * 4, 6.5 + r() * 3, -24 - r() * 4)
    c.userData.speed = 0.25 + r() * 0.2
    clouds.add(c)
  }
  scene.add(clouds)
  disposables.push(cloudMat)

  // le paysage : arbres, sapins, maisons de l'environnement, en bosquets et petits hameaux ; jamais sur la voie
  const anims: Anim[] = []
  const kinds: TileKind[] = [params.treeKind ?? 'tree', params.pineKind ?? 'pine']
  const houseKind: TileKind = params.houseKind ?? 'house'
  const place = (kind: TileKind, x: number, z: number, v: number) => {
    if (Math.abs(z - TRACK_Z) < 0.75) return
    const g = build(kind, v, pal, kit, anims, 150 + r() * 900)
    if (!g) return
    g.position.set(x, 0, z)
    g.rotation.y = (r() - 0.5) * 0.6
    g.userData.base = 1.4
    g.scale.setScalar(0.001)
    scene.add(g)
  }
  for (let i = 0; i < 70; i++) {
    const z = -13 + r() * 12.5
    const x = (r() - 0.5) * (14 + (-z) * 1.6) // plus large au loin : le champ de vision s'ouvre
    place(kinds[r() < 0.6 ? 0 : 1], x, z, Math.floor(r() * 3))
  }
  for (let k = 0; k < 3; k++) {
    const hx = -7 + k * 7 + r() * 2
    const hz = -6 - r() * 5
    for (let i = 0; i < 3; i++) place(houseKind, hx + (r() - 0.5) * 2.4, hz + (r() - 0.5) * 1.6, Math.floor(r() * 4))
  }
  if (theme === 'plaine') place('windmill', 5.5, -4.5, 0)
  if (params.peaks > 0.1) for (let i = 0; i < 5; i++) place(params.peakKind ?? 'mountain', -9 + i * 4.5 + r(), -11 - r() * 2, i)
  for (let i = 0; i < 4; i++) place(kinds[0], (i % 2 ? -1 : 1) * (6.5 + r() * 3), TRACK_Z + 1.1 + r() * 0.6, i % 3) // devant la voie, sur les bords

  // la voie au premier plan : ballast, traverses, rails
  const bed = new THREE.Mesh(new THREE.BoxGeometry(80, 0.05, 0.66), kit.mat(pal.bed, texs.speckle))
  bed.position.set(0, 0.025, TRACK_Z)
  bed.receiveShadow = true
  scene.add(bed)
  const sleepers = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 0.03, 0.44), kit.mat(pal.rail.tie, texs.wood), 320)
  const d = new THREE.Object3D()
  for (let i = 0; i < 320; i++) {
    d.position.set(-40 + i * 0.25, 0.06, TRACK_Z)
    d.updateMatrix()
    sleepers.setMatrixAt(i, d.matrix)
  }
  sleepers.castShadow = sleepers.receiveShadow = true
  scene.add(sleepers)
  for (const o of [-0.12, 0.12]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(80, 0.035, 0.03), kit.mat(pal.rail.rail, null, { metalness: 0.6, roughness: 0.35, flatShading: false }))
    rail.position.set(0, 0.09, TRACK_Z + o)
    rail.castShadow = true
    scene.add(rail)
  }

  // le train du joueur (Mon train) : la locomotive rouge et ses wagons, vu de côté sur la voie
  const train = new THREE.Group()
  let tail = 2 // longueur du train derrière la locomotive : un train de fret sort entièrement du champ
  const fill = (list: readonly WagonStyle[]) => {
    for (const old of [...train.children]) {
      train.remove(old)
      old.traverse((o) => {
        const m = o as THREE.Mesh
        if (!m.isMesh) return
        m.geometry.dispose()
        ;([] as THREE.Material[]).concat(m.material).forEach((x) => x.dispose())
      })
    }
    const offsets = carOffsets(list)
    tail = offsets[offsets.length - 1]! + 0.6
    ;[makeCar(0), ...list.map(makeWagon)].forEach((car, i) => {
      car.position.x = -offsets[i]!
      train.add(car)
    })
  }
  fill(wagons)
  train.position.set(-40, 0, TRACK_Z)
  scene.add(train)
  // fumée de la locomotive, comme pendant le Trajet (scenery3d/trainModel.ts)
  const steam = makeSteam()
  scene.add(steam.group)
  disposables.push(steam)
  const chimney = new THREE.Vector3()
  let lastX = train.position.x

  // caméra : au ras du sol, devant la voie ; plus ouverte en portrait (téléphone) pour garder du paysage sur les côtés
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 120)
  const fit = () => {
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (!w || !h) return
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.fov = w < h ? 62 : 42
    camera.position.set(0, w < h ? 2.2 : 1.7, 7.4)
    camera.lookAt(0, 0.9, -6)
    camera.updateProjectionMatrix()
  }
  const ro = new ResizeObserver(fit)
  ro.observe(canvas)
  fit()

  await groundReady
  const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  const t0 = performance.now()
  let raf = 0
  let prevK = -1
  let last = 0
  const SPAN = 26 // de -13 à +13 : hors champ aux deux bouts (plus la longueur du train)
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop)
    if (document.hidden || now - last < 32) return // 30 images par seconde suffisent pour un fond
    const dt = Math.min(0.1, (now - (last || now)) / 1000)
    last = now
    const t = now - t0
    tickAnims(anims, t, dt, still)
    const span = SPAN + 2 * tail
    if (!still) {
      clouds.children.forEach((c) => {
        c.position.x += dt * (c.userData.speed as number)
        if (c.position.x > 30) c.position.x = -30
      })
      // un passage vers la droite (de 3 s à 12 s), puis vers la gauche (de 18 s à 27 s)
      const k = ((t / 1000) % CYCLE) / CYCLE
      const go = (a: number) => Math.min(1, Math.max(0, (k - a) / 0.3))
      // un passage commence (9 s) : le son du train part avec lui
      if (prevK >= 0 && prevK < 0.1 && k >= 0.1) onPass?.(1)
      if (prevK >= 0 && prevK < 0.6 && k >= 0.6) onPass?.(-1)
      prevK = k
      if (k < 0.5) {
        train.rotation.y = 0
        train.position.x = -span / 2 + go(0.1) * span
      } else {
        train.rotation.y = Math.PI
        train.position.x = span / 2 - go(0.6) * span
      }
    } else train.position.x = -40
    // la fumée sort tant que le train roule dans le champ
    const rolling = !still && train.position.x !== lastX && Math.abs(train.position.x) < span / 2 + 1
    lastX = train.position.x
    train.updateMatrixWorld()
    steam.update(dt, train.children[0]!.localToWorld(chimney.copy(CHIMNEY)), rolling)
    fin.draw(scene, camera)
  }
  raf = requestAnimationFrame(loop)

  return {
    setWagons: fill,
    dispose() {
      cancelAnimationFrame(raf)
      ro.disconnect()
      scene.traverse((o) => {
        const m = o as THREE.Mesh
        if (!m.isMesh) return
        m.geometry.dispose()
        for (const mt of ([] as THREE.Material[]).concat(m.material)) {
          ;(mt as THREE.MeshStandardMaterial).map?.dispose()
          mt.dispose()
        }
      })
      disposables.forEach((x) => x.dispose())
      fin.dispose()
    },
  }
}
