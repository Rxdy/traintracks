// Le dépôt de Mon train, en 3D (vu d'en haut, de biais, comme le Trajet) : trois voies, chacune avec son garage au fond.
// Le train « en route » s'avance jusqu'au quai ; les deux autres attendent devant leur garage. Quand on en fait rouler
// un autre, l'ancien recule devant son garage et le nouveau avance prendre sa place. Toucher un garage ou un train
// choisit le train à personnaliser. Les trains regardent vers la gauche : la locomotive tire vers le quai.
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { CHIMNEY, makeCar, makeSteam, makeWagon } from './trainModel'
import { carOffsets, carLength, type WagonStyle } from '../trainStyle'

export interface Depot {
  setTrains(trains: readonly (readonly WagonStyle[])[]): void
  setState(active: number, editing: number): void
  dispose(): void
}

const W = 14 // largeur du dépôt (cases)
const GAP = 1.25 // écart entre deux voies
const GARAGE_X = W - 2.3 // porte des garages (le garage fait 2,2 de long)
const QUAI_X = 1.1 // où s'arrête la locomotive du train en route

export function createDepot(canvas: HTMLCanvasElement, onPick: (slot: number) => void): Depot {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  const scene = new THREE.Scene()
  scene.add(new THREE.HemisphereLight('#ffffff', '#8fb36b', 1.5))
  const sun = new THREE.DirectionalLight('#fff4dc', 2.4)
  sun.position.set(W * 0.3, 10, 6)
  sun.target.position.set(W / 2, 0, GAP)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 1024)
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 6, bottom: -6, near: 1, far: 30 })
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

  // le sol, le ballast, les voies
  const ground = add(new THREE.PlaneGeometry(W + 30, GAP * 3 + 16).rotateX(-Math.PI / 2), mat('#9fd07f'), W / 2, 0, GAP)
  ground.castShadow = false
  const ballast = mat('#b8b0a3'), tie = mat('#7a4e2d'), rail = mat('#9ca3af', { metalness: 0.6, roughness: 0.35 })
  for (let k = 0; k < 3; k++) {
    const z = k * GAP
    add(new THREE.BoxGeometry(W + 1, 0.03, 0.62), ballast, W / 2 - 0.2, 0.015, z).castShadow = false
    const ties = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 0.03, 0.46), tie, Math.ceil(W / 0.22))
    disposables.push(ties.geometry)
    const m = new THREE.Matrix4()
    for (let i = 0; i < ties.count; i++) ties.setMatrixAt(i, m.makeTranslation(-0.5 + i * 0.22, 0.045, z))
    ties.receiveShadow = true
    scene.add(ties)
    for (const o of [-0.12, 0.12]) add(new THREE.BoxGeometry(W + 0.8, 0.035, 0.03), rail, W / 2 - 0.3, 0.075, z + o)
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
  const frames: THREE.Mesh[] = []
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
    // devant la porte, une dalle qui s'éclaire quand ce garage est choisi
    const pad = add(new RoundedBoxGeometry(0.5, 0.02, 0.78, 2, 0.01), mat('#fde68a', { emissive: '#f59e0b', emissiveIntensity: 0.6 }), -0.3, 0.035, 0, g)
    pad.castShadow = false
    pad.visible = false
    frames.push(pad)
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
    g.traverse((o) => (o.userData.slot = k))
    scene.add(g)
    garages.push(g)
  }

  // les trains
  type Train = { group: THREE.Group; tail: number; x: number; target: number; steam: ReturnType<typeof makeSteam> }
  const trains: (Train | null)[] = [null, null, null]
  let active = 0
  const parkedX = (tail: number) => GARAGE_X + 0.35 - tail // la queue entre un peu dans le garage
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
      group.traverse((o) => (o.userData.slot = k))
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

  let editing = 0
  function setState(a: number, e: number): void {
    active = a
    editing = e
    trains.forEach((t, k) => t && (t.target = targetOf(k, t.tail)))
    frames.forEach((f, k) => (f.visible = k === editing))
    roofs.forEach((r, k) => r.color.set(k === editing ? '#d97706' : '#7f1d1d')) // le garage choisi : toit orangé
  }

  // la caméra : de biais, tout le dépôt dans la largeur
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 80)
  const fit = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    const halfW = (W + 0.6) / 2
    const halfH = Math.max(halfW * (h / w), 2.1)
    const hw = halfH * (w / h)
    Object.assign(camera, { left: -hw, right: hw, top: halfH, bottom: -halfH })
    camera.position.set(W / 2, 10, GAP + 4.6) // plongée forte, comme la vue du Trajet
    camera.lookAt(W / 2 - 0.2, 0, GAP - 0.1)
    camera.updateProjectionMatrix()
  }
  fit()
  const ro = new ResizeObserver(fit)
  ro.observe(canvas)

  // toucher : quel garage, quel train ?
  const ray = new THREE.Raycaster()
  const onClick = (ev: PointerEvent) => {
    const r = canvas.getBoundingClientRect()
    ray.setFromCamera(new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), camera)
    const hit = ray.intersectObjects([...garages, ...trains.filter(Boolean).map((t) => t!.group)], true)[0]
    const slot = hit?.object.userData.slot
    if (typeof slot === 'number') onPick(slot)
  }
  canvas.addEventListener('pointerup', onClick)
  const onMove = (ev: PointerEvent) => {
    const r = canvas.getBoundingClientRect()
    ray.setFromCamera(new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), camera)
    const hit = ray.intersectObjects([...garages, ...trains.filter(Boolean).map((t) => t!.group)], true)[0]
    canvas.style.cursor = hit ? 'pointer' : ''
  }
  canvas.addEventListener('pointermove', onMove)

  const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
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
    setState,
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
