// Le dépôt de Mon train, en 3D (vu d'en haut, de biais, comme le Trajet) : trois voies, chacune avec son garage au fond,
// et derrière les garages l'entrepôt de la collection. Le train « en route » s'avance jusqu'au quai ; les deux autres
// attendent devant leur garage. Toucher un train le fait rouler (l'ancien recule devant son garage, le nouveau avance) ;
// toucher un garage ouvre la personnalisation de son train ; toucher l'entrepôt ouvre la collection.
// Les trains regardent vers la gauche : la locomotive tire vers le quai. Les voies filent vers la gauche bien au-delà de l'écran (le voyage
// continue) ; les heurtoirs rouges gardent les trains dans l'écran. Une gare, à gauche de l'entrepôt, borde les quais.
import { reducedMotion } from '../settings'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { CHIMNEY, makeCar, makeSteam, makeWagon } from './trainModel'
import { carOffsets, carLength, styleOf as carStyle, type WagonStyle } from '../trainStyle'

export type DepotPick = { kind: 'train' | 'garage'; slot: number } | { kind: 'collection' }

export interface Depot {
  setTrains(trains: readonly (readonly WagonStyle[])[]): void
  setActive(active: number): void
  dispose(): void
}

const W = 14 // largeur du dépôt (cases)
const GAP = 1.25 // écart entre deux voies
const GARAGE_X = W - 2.3 // porte des garages (le garage fait 2,2 de long)
const QUAI_X = 1.1 // où s'arrête la locomotive du train en route
const FAR_LEFT = -40 // les voies (et le sol) vont jusque-là : bien au-delà du bord gauche de l'écran

export function createDepot(canvas: HTMLCanvasElement, onPick: (p: DepotPick) => void): Depot {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
  renderer.shadowMap.enabled = !reducedMotion() // animations réduites : pas d'ombres, plus léger
  renderer.shadowMap.type = THREE.PCFShadowMap
  const scene = new THREE.Scene()
  scene.add(new THREE.HemisphereLight('#ffffff', '#8fb36b', 1.5))
  const sun = new THREE.DirectionalLight('#fff4dc', 2.4)
  sun.position.set(W * 0.3, 10, 6)
  sun.target.position.set(W / 2, 0, GAP)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 1024)
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 8, bottom: -8, near: 1, far: 34 })
  scene.add(sun, sun.target)

  const disposables: { dispose(): void }[] = []
  const mat = (color: string, o: THREE.MeshStandardMaterialParameters = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o })
    disposables.push(m)
    return m
  }
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = scene) => {
    disposables.push(geo)
    const o = new THREE.Mesh(geo, m)
    o.position.set(x, y, z)
    o.castShadow = o.receiveShadow = true
    parent.add(o)
    return o
  }
  // Un panneau écrit (enseigne sur un toit) : toujours de face pour la caméra, donc lisible dans les deux vues (voir fit).
  const signs: THREE.Mesh[] = []
  const sign = (text: string, w: number, h: number, x: number, y: number, z: number, parent: THREE.Object3D, bg = '#7f1d1d', fg = '#fde68a') => {
    const px = 96
    const c = document.createElement('canvas')
    c.width = Math.round((px * w) / h)
    c.height = px
    const g2 = c.getContext('2d')!
    g2.fillStyle = bg
    g2.fillRect(0, 0, c.width, c.height)
    g2.strokeStyle = '#fbbf24'
    g2.lineWidth = 8
    g2.strokeRect(4, 4, c.width - 8, c.height - 8)
    g2.fillStyle = fg
    g2.font = `bold ${Math.round(px * 0.56)}px system-ui, sans-serif`
    g2.textAlign = 'center'
    g2.textBaseline = 'middle'
    g2.fillText(text, c.width / 2, px * 0.54)
    const tex = new THREE.CanvasTexture(c)
    tex.anisotropy = 4
    disposables.push(tex)
    const m = add(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }), x, y, z, parent)
    m.castShadow = m.receiveShadow = false
    signs.push(m)
    return m
  }

  // le sol, le ballast, les voies
  const ground = add(new THREE.PlaneGeometry(W + 15 - FAR_LEFT, GAP * 3 + 16).rotateX(-Math.PI / 2), mat('#9fd07f'), (FAR_LEFT + W + 15) / 2, 0, GAP)
  ground.castShadow = false
  const ballast = mat('#b8b0a3'), tie = mat('#7a4e2d'), rail = mat('#9ca3af', { metalness: 0.6, roughness: 0.35 })
  for (let k = 0; k < 3; k++) {
    const z = k * GAP
    // de FAR_LEFT (hors de l'écran) jusqu'aux garages
    const len = W + 0.3 - FAR_LEFT
    add(new THREE.BoxGeometry(len + 0.2, 0.03, 0.62), ballast, FAR_LEFT + len / 2, 0.015, z).castShadow = false
    const ties = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 0.03, 0.46), tie, Math.ceil(len / 0.22))
    disposables.push(ties.geometry)
    const m = new THREE.Matrix4()
    for (let i = 0; i < ties.count; i++) ties.setMatrixAt(i, m.makeTranslation(FAR_LEFT + i * 0.22, 0.045, z))
    ties.receiveShadow = true
    scene.add(ties)
    for (const o of [-0.12, 0.12]) add(new THREE.BoxGeometry(len, 0.035, 0.03), rail, FAR_LEFT + len / 2, 0.075, z + o)
    // heurtoir rouge au bout du quai
    add(new RoundedBoxGeometry(0.12, 0.18, 0.5, 3, 0.03), mat('#dc2626'), QUAI_X - 0.7, 0.12, z)
  }
  // le quai (deux bandes de pierre entre les voies) et ses lampadaires
  const stone = mat('#d6d3d1'), edge = mat('#fde68a')
  for (const z of [GAP / 2, GAP * 1.5]) {
    add(new THREE.BoxGeometry(5.2, 0.14, 0.44), stone, QUAI_X + 2.2, 0.07, z)
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(5.2, 0.015, 0.04), edge, QUAI_X + 2.2, 0.145, z + s * 0.2)
    for (const x of [QUAI_X + 0.4, QUAI_X + 2.2, QUAI_X + 4]) {
      add(new THREE.CylinderGeometry(0.02, 0.025, 0.55, 8), mat('#374151'), x, 0.42, z)
      add(new THREE.SphereGeometry(0.06, 12, 8), new THREE.MeshBasicMaterial({ color: '#fef3c7' }), x, 0.72, z)
    }
  }

  // les garages, au fond de chaque voie
  const garages: THREE.Group[] = []
  const roofs: THREE.MeshStandardMaterial[] = []
  const wall = mat('#b45309'), dark = mat('#1f2937'), gold = mat('#fbbf24', { metalness: 0.5, roughness: 0.3 })
  for (let k = 0; k < 3; k++) {
    const g = new THREE.Group()
    g.position.set(GARAGE_X, 0, k * GAP)
    const d = 2.2
    add(new RoundedBoxGeometry(d, 0.72, 1.0, 3, 0.04), wall, d / 2, 0.36, 0, g)
    const prism = new THREE.CylinderGeometry(0.62, 0.62, d + 0.1, 3).rotateZ(Math.PI / 2).rotateX(Math.PI / 6).scale(1, 0.55, 1)
    const roof = mat('#7f1d1d')
    roofs.push(roof)
    add(prism, roof, d / 2, 0.86, 0, g)

    add(new THREE.BoxGeometry(0.02, 0.56, 0.62), dark, -0.005, 0.3, 0, g) // la porte ouverte
    add(new THREE.BoxGeometry(0.04, 0.64, 0.72), gold, -0.02, 0.33, 0, g) // l'encadrement doré de la porte
    // le numéro du garage
    const plate = document.createElement('canvas')
    plate.width = plate.height = 64
    const c2 = plate.getContext('2d')!
    c2.fillStyle = '#fde68a'
    c2.beginPath()
    c2.arc(32, 32, 30, 0, Math.PI * 2)
    c2.fill()
    c2.fillStyle = '#7f1d1d'
    c2.font = 'bold 40px system-ui, sans-serif'
    c2.textAlign = 'center'
    c2.textBaseline = 'middle'
    c2.fillText(String(k + 1), 32, 35)
    const tex = new THREE.CanvasTexture(plate)
    disposables.push(tex)
    add(new THREE.CircleGeometry(0.13, 24).rotateY(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex }), -0.03, 0.62, 0, g)
    sign(`TRAIN ${k + 1}`, 1.5, 0.36, d / 2, 1.32, 0, g) // sur le toit
    g.traverse((o) => (o.userData.pick = { kind: 'garage', slot: k }))
    scene.add(g)
    garages.push(g)
  }

  // l'entrepôt de la collection, derrière les garages (en haut de la vue), avec sa voie de garage et son enseigne
  const store = new THREE.Group()
  store.position.set(GARAGE_X - 4.2, 0, -2.3)
  const sw = 4.2
  add(new RoundedBoxGeometry(sw, 0.95, 1.5, 3, 0.05), mat('#e7d8b9'), sw / 2, 0.475, 0, store)
  add(new THREE.CylinderGeometry(0.82, 0.82, sw + 0.12, 24, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2).scale(1, 0.5, 1), mat('#475569'), sw / 2, 0.95, 0, store)
  add(new THREE.BoxGeometry(1.5, 0.75, 0.02), dark, sw / 2, 0.39, 0.755, store) // la grande porte ouverte
  add(new THREE.BoxGeometry(1.6, 0.06, 0.06), gold, sw / 2, 0.79, 0.77, store)
  for (const x of [0.45, sw - 0.45]) add(new THREE.BoxGeometry(0.5, 0.32, 0.02), mat('#bfe3fa', { metalness: 0.1, roughness: 0.2 }), x, 0.55, 0.755, store)
  sign('COLLECTION', 2.3, 0.42, sw / 2, 1.62, 0, store)
  // la voie qui entre dans l'entrepôt, et deux wagons qu'on aperçoit dehors
  for (const o of [-0.12, 0.12]) add(new THREE.BoxGeometry(0.03, 0.03, 1.4), rail, sw / 2 + o, 0.06, 1.35, store)
  for (const [id, z] of [['ambre', 1.25], ['vert', 0.6]] as const) {
    const w = makeWagon(carStyle(id))
    w.rotation.y = Math.PI / 2
    w.position.set(sw / 2, 0.03, z)
    store.add(w)
  }
  store.traverse((o) => (o.userData.pick = { kind: 'collection' }))
  scene.add(store)

  // la gare, à gauche de l'entrepôt : face aux quais, derrière la première voie
  const station = new THREE.Group()
  station.position.set(QUAI_X + 2.4, 0, -1.75)
  {
    const sw2 = 3.4
    const slate = mat('#64748b')
    add(new RoundedBoxGeometry(sw2, 0.8, 0.85, 3, 0.04), mat('#f5ead3'), 0, 0.4, 0, station) // le bâtiment, pierre claire
    add(new THREE.CylinderGeometry(0.5, 0.5, sw2 + 0.1, 3).rotateZ(Math.PI / 2).rotateX(Math.PI / 6).scale(1, 0.42, 1), slate, 0, 0.92, -0.05, station) // le toit d'ardoise
    // la tour de l'horloge, au milieu, plus haute que le toit
    add(new RoundedBoxGeometry(0.6, 1.25, 0.6, 3, 0.03), mat('#e7d8b9'), 0, 0.98, 0.05, station)
    add(new THREE.ConeGeometry(0.46, 0.45, 4).rotateY(Math.PI / 4), slate, 0, 1.83, 0.05, station)
    // portes et grandes fenêtres côté quais, encadrées d'or
    for (const x of [-1.3, -0.85, 0.85, 1.3]) {
      add(new THREE.BoxGeometry(0.32, 0.42, 0.02), mat('#bfe3fa', { metalness: 0.1, roughness: 0.2 }), x, 0.42, 0.43, station)
      add(new THREE.BoxGeometry(0.36, 0.04, 0.03), gold, x, 0.65, 0.435, station)
    }
    add(new THREE.BoxGeometry(0.44, 0.58, 0.02), dark, 0, 0.29, 0.43, station)
    add(new THREE.BoxGeometry(0.5, 0.05, 0.03), gold, 0, 0.6, 0.44, station)
    // une marquise fine au-dessus du quai : on voit encore la façade
    add(new THREE.BoxGeometry(sw2 + 0.3, 0.03, 0.32), mat('#94a3b8', { metalness: 0.3, roughness: 0.5 }), 0, 0.72, 0.62, station)
    for (const x of [-1.6, 1.6]) add(new THREE.CylinderGeometry(0.02, 0.02, 0.72, 8), mat('#374151'), x, 0.36, 0.76, station)
    // l'horloge (de face pour la caméra, comme les panneaux) : cadran blanc, aiguilles
    {
      const c = document.createElement('canvas')
      c.width = c.height = 128
      const g2 = c.getContext('2d')!
      g2.fillStyle = '#fbbf24'
      g2.beginPath(); g2.arc(64, 64, 62, 0, Math.PI * 2); g2.fill()
      g2.fillStyle = '#ffffff'
      g2.beginPath(); g2.arc(64, 64, 54, 0, Math.PI * 2); g2.fill()
      g2.strokeStyle = '#1f2937'
      g2.lineCap = 'round'
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2
        g2.lineWidth = i % 3 ? 3 : 6
        g2.beginPath(); g2.moveTo(64 + Math.sin(a) * 44, 64 - Math.cos(a) * 44); g2.lineTo(64 + Math.sin(a) * 52, 64 - Math.cos(a) * 52); g2.stroke()
      }
      g2.lineWidth = 7; g2.beginPath(); g2.moveTo(64, 64); g2.lineTo(64 + 24, 64 - 14); g2.stroke() // 10 h 10
      g2.lineWidth = 5; g2.beginPath(); g2.moveTo(64, 64); g2.lineTo(64 - 30, 64 - 18); g2.stroke()
      const tex = new THREE.CanvasTexture(c)
      disposables.push(tex)
      const clock = add(new THREE.CircleGeometry(0.24, 32), new THREE.MeshBasicMaterial({ map: tex }), 0, 1.3, 0.37, station)
      clock.castShadow = clock.receiveShadow = false
      signs.push(clock)
    }
    sign('GARE', 1.3, 0.38, 0, 2.3, 0.05, station)
  }
  scene.add(station)

  // quelques arbres autour du dépôt
  const leaf = mat('#3f9a4a'), trunk = mat('#7a4e2d')
  for (const [x, z, h] of [[-0.6, -1.4, 0.9], [0.6, -2.4, 1.1], [5.8, -2.3, 1.0], [-0.3, 3.6, 1.0], [3.8, 3.9, 0.8], [9.2, 3.7, 1.1], [13.8, 3.5, 0.9]] as const) {
    add(new THREE.CylinderGeometry(0.05, 0.07, 0.3, 8), trunk, x, 0.15, z)
    add(new THREE.ConeGeometry(0.32 * h, 0.8 * h, 9), leaf, x, 0.3 + 0.4 * h, z)
  }

  // les trains
  type Train = { group: THREE.Group; tail: number; x: number; target: number; steam: ReturnType<typeof makeSteam> }
  const trains: (Train | null)[] = [null, null, null]
  let active = 0
  const parkedX = (tail: number) => GARAGE_X - 0.1 - tail // juste devant la porte : le train garé se voit en entier, même le plus long
  const targetOf = (k: number, tail: number) => (k === active ? QUAI_X : Math.max(QUAI_X + 2.6, parkedX(tail)))

  function disposeGroup(g: THREE.Object3D): void {
    g.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      m.geometry.dispose()
      ;([] as THREE.Material[]).concat(m.material).forEach((x) => x.dispose())
    })
  }

  let lastKey = ['', '', '']
  function setTrains(list: readonly (readonly WagonStyle[])[]): void {
    list.slice(0, 3).forEach((wagons, k) => {
      const key = wagons.map((w) => w.id).join()
      if (trains[k] && lastKey[k] === key) return
      lastKey[k] = key
      const old = trains[k]
      if (old) {
        scene.remove(old.group)
        disposeGroup(old.group)
        scene.remove(old.steam.group)
        old.steam.dispose()
      }
      const group = new THREE.Group()
      const off = carOffsets(wagons)
      ;[makeCar(0), ...wagons.map(makeWagon)].forEach((car, i) => {
        car.position.x = off[i]! // vers la droite : les wagons derrière la locomotive, qui regarde à gauche
        car.rotation.y = Math.PI
        group.add(car)
      })
      group.position.z = k * GAP
      group.traverse((o) => (o.userData.pick = { kind: 'train', slot: k }))
      const last = wagons[wagons.length - 1] ?? null
      const tail = off[off.length - 1]! + carLength(last) / 2
      const target = targetOf(k, tail)
      const x = old ? old.x : target
      group.position.x = x
      scene.add(group)
      const steam = makeSteam()
      scene.add(steam.group)
      trains[k] = { group, tail, x, target, steam }
    })
  }

  function setActive(a: number): void {
    active = a
    trains.forEach((t, k) => t && (t.target = targetOf(k, t.tail)))
  }
  // au survol (souris), le toit du garage ou de l'entrepôt s'éclaire : on voit ce qui se touche
  const storeRoof = (store.children[1] as THREE.Mesh).material as THREE.MeshStandardMaterial
  function hover(p: DepotPick | null): void {
    roofs.forEach((r, k) => r.color.set(p?.kind === 'garage' && p.slot === k ? '#d97706' : '#7f1d1d'))
    storeRoof.color.set(p?.kind === 'collection' ? '#2563eb' : '#475569')
  }

  // la caméra : de biais, le dépôt entier dans l'écran, en laissant la place de l'en-tête (en haut) et de l'aide (en bas).
  // Écran plus large que haut : vue de face, les voies en travers, l'entrepôt derrière les garages.
  // Écran en hauteur (téléphone, tablette debout) : vue depuis le heurtoir, les voies montent vers les garages,
  // et l'entrepôt passe tout au fond, derrière les garages, sa porte tournée vers nous.
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 80)
  const PAD_TOP = 78, PAD_BOTTOM = 70, PAD_SIDE = 12 // px
  const corner = new THREE.Vector3()
  const fit = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    const tall = h > w
    const target = new THREE.Vector3(W / 2, 0, GAP)
    let box: [number, number, number, number] // xmin, xmax, zmin, zmax : ce qui doit se voir
    if (tall) {
      store.rotation.y = -Math.PI / 2
      store.position.set(GARAGE_X + 2.2 + 2.1, 0, GAP - sw / 2)
      camera.position.set(target.x - 4.95, 10, target.z)
      box = [QUAI_X - 1.1, store.position.x + 0.8, -0.6, GAP * 2 + 0.6]
    } else {
      store.rotation.y = 0
      store.position.set(GARAGE_X - 4.2, 0, -2.3)
      camera.position.set(target.x + 0.2, 10, target.z + 4.95) // plongée forte, comme la vue du Trajet
      box = [QUAI_X - 1.1, W + 0.1, -3.2, GAP * 2 + 0.6]
    }
    camera.up.set(0, 1, 0)
    camera.lookAt(target)
    camera.updateMatrixWorld()
    station.visible = !tall // écran en hauteur : la vue part du heurtoir, la gare serait hors champ
    // les panneaux de face pour la caméra (dans le repère de leur bâtiment, qui peut être tourné)
    scene.updateMatrixWorld()
    for (const s of signs) s.parent!.getWorldQuaternion(s.quaternion).invert().multiply(camera.quaternion)
    // le cadre du dépôt, vu par la caméra
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
    for (const x of [box[0], box[1]]) for (const z of [box[2], box[3]]) for (const y of [0, 1.4]) {
      corner.set(x, y, z).applyMatrix4(camera.matrixWorldInverse)
      x0 = Math.min(x0, corner.x); x1 = Math.max(x1, corner.x)
      y0 = Math.min(y0, corner.y); y1 = Math.max(y1, corner.y)
    }
    // unités par pixel : le dépôt tient dans la zone libre ; ce qui reste se partage de chaque côté
    const u = Math.max((x1 - x0) / Math.max(1, w - 2 * PAD_SIDE), (y1 - y0) / Math.max(1, h - PAD_TOP - PAD_BOTTOM))
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2 + ((PAD_BOTTOM - PAD_TOP) / 2) * u
    Object.assign(camera, { left: cx - (w / 2) * u, right: cx + (w / 2) * u, top: cy + (h / 2) * u, bottom: cy - (h / 2) * u })
    camera.updateProjectionMatrix()
  }
  fit()
  const ro = new ResizeObserver(fit)
  ro.observe(canvas)

  // toucher : quel garage, quel train ?
  const ray = new THREE.Raycaster()
  const pickAt = (ev: PointerEvent): DepotPick | null => {
    const r = canvas.getBoundingClientRect()
    ray.setFromCamera(new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), camera)
    const hit = ray.intersectObjects([store, ...garages, ...trains.filter(Boolean).map((t) => t!.group)], true)[0]
    return (hit?.object.userData.pick as DepotPick | undefined) ?? null
  }
  const onClick = (ev: PointerEvent) => {
    const p = pickAt(ev)
    if (p) onPick(p)
  }
  canvas.addEventListener('pointerup', onClick)
  const onMove = (ev: PointerEvent) => {
    const p = pickAt(ev)
    canvas.style.cursor = p ? 'pointer' : ''
    hover(p)
  }
  canvas.addEventListener('pointermove', onMove)

  const still = reducedMotion()
  const chimney = new THREE.Vector3()
  let raf = 0
  let last = performance.now()
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop)
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    for (const t of trains) {
      if (!t) continue
      const d = t.target - t.x
      // un train avance à 3,6 cases/s au plus, freine en arrivant ; tout de suite à sa place si l'on préfère moins d'animations
      const step = still ? d : Math.sign(d) * Math.min(Math.abs(d), Math.max(0.2, Math.min(3.6, Math.abs(d) * 2.4)) * dt)
      t.x += step
      t.group.position.x = t.x
      t.group.updateMatrixWorld()
      const loco = t.group.children[0]!
      t.steam.update(dt, loco.localToWorld(chimney.copy(CHIMNEY)), Math.abs(step) > 1e-4 && !still)
    }
    renderer.render(scene, camera)
  }
  raf = requestAnimationFrame(loop)

  return {
    setTrains,
    setActive,
    dispose() {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerup', onClick)
      canvas.removeEventListener('pointermove', onMove)
      for (const t of trains) if (t) {
        disposeGroup(t.group)
        t.steam.dispose()
      }
      disposables.forEach((x) => x.dispose())
      renderer.dispose()
    },
  }
}
