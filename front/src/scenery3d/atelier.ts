// L'atelier (personnaliser un train) en 3D, vu de biais comme le Trajet : le train attelé sur sa voie, la locomotive à
// gauche qui regarde vers la gauche. On y glisse les wagons : la scène dit où le doigt se trouve (`probe` : une place
// dans le train, ou hors de la scène), fait de la place pour le wagon tenu et le fait suivre le doigt (`hold`).
// Les wagons glissent vers leur place : le train reste toujours attelé. Pour ranger un wagon, on le glisse hors de la
// scène, vers « Tes wagons » (la page s'en occupe).
import { reducedMotion } from '../settings'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { makeCar, makeWagon } from './trainModel'
import { carOffsets, styleOf, TRAIN_LONGEST } from '../trainStyle'

export type Probe = { kind: 'car'; index: number; at: number } | { kind: 'none' }

export interface Atelier {
  setCars(ids: readonly string[]): void
  /** Où est le doigt : sur un wagon (index), à quelle place il irait (at), ou hors de la scène. */
  probe(clientX: number, clientY: number): Probe
  /** Un wagon tenu : `from` = sa place dans le train (ou null s'il vient de « Tes wagons ») ; null = plus rien de tenu. */
  hold(h: { id: string; from: number | null; clientX: number; clientY: number } | null): void
  dispose(): void
}

const LEFT = -0.9, RIGHT = 0.62 / 2 + TRAIN_LONGEST + 0.9 // la voie : de quoi tenir le plus long train possible

export function createAtelier(canvas: HTMLCanvasElement): Atelier {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
  renderer.shadowMap.enabled = !reducedMotion() // animations réduites : pas d'ombres, plus léger
  const scene = new THREE.Scene()
  scene.add(new THREE.HemisphereLight('#ffffff', '#8fb36b', 1.55))
  const sun = new THREE.DirectionalLight('#fff4dc', 2.3)
  sun.position.set(2, 8, 5)
  sun.target.position.set((LEFT + RIGHT) / 2, 0, 0)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 1024)
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 4, bottom: -4, near: 1, far: 30 })
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

  // le sol, la voie, le heurtoir à gauche
  const len = RIGHT - LEFT + 4
  add(new THREE.PlaneGeometry(len, 8).rotateX(-Math.PI / 2), mat('#a8d48a'), (LEFT + RIGHT) / 2, 0, 0).castShadow = false
  add(new THREE.BoxGeometry(len, 0.03, 0.66), mat('#b8b0a3'), (LEFT + RIGHT) / 2, 0.015, 0).castShadow = false
  const ties = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 0.03, 0.46), mat('#7a4e2d'), Math.ceil(len / 0.22))
  disposables.push(ties.geometry)
  const m4 = new THREE.Matrix4()
  for (let i = 0; i < ties.count; i++) ties.setMatrixAt(i, m4.makeTranslation(LEFT - 2 + i * 0.22, 0.045, 0))
  ties.receiveShadow = true
  scene.add(ties)
  const rail = mat('#9ca3af', { metalness: 0.6, roughness: 0.35 })
  for (const o of [-0.12, 0.12]) add(new THREE.BoxGeometry(len, 0.035, 0.03), rail, (LEFT + RIGHT) / 2, 0.075, o)
  add(new RoundedBoxGeometry(0.12, 0.2, 0.5, 3, 0.03), mat('#dc2626'), LEFT + 0.25, 0.12, 0)

  // les voitures : chacune glisse vers sa place (x), le wagon tenu flotte au-dessus du doigt
  type Car = { id: string; group: THREE.Group; x: number; target: number }
  let cars: Car[] = [] // les wagons du train, dans l'ordre (sans la locomotive)
  const loco = makeCar(0)
  loco.rotation.y = Math.PI
  scene.add(loco)
  const build = (id: string): THREE.Group => {
    const g = makeWagon(styleOf(id))
    g.rotation.y = Math.PI
    scene.add(g)
    return g
  }
  const drop = (g: THREE.Object3D) => {
    scene.remove(g)
    g.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      m.geometry.dispose()
      ;([] as THREE.Material[]).concat(m.material).forEach((x) => x.dispose())
    })
  }

  let held: { id: string; from: number | null; group: THREE.Group; x: number; z: number; at: number | null } | null = null

  // la place de chaque voiture : le train tel qu'il serait, wagon tenu compris là où il irait
  let heldTarget = 0
  let base: number[] = [] // centres des wagons qui restent, sans la place du wagon tenu : sert à choisir la place visée
  function layout(): void {
    const order = cars.map((c) => c.id)
    if (held && held.from !== null) order.splice(held.from, 1)
    const staying = cars.filter((_, k) => !(held && held.from === k))
    base = carOffsets(order.map(styleOf)).slice(1)
    const withGap = held && held.at !== null ? [...order.slice(0, held.at), held.id, ...order.slice(held.at)] : order
    const off = carOffsets(withGap.map(styleOf))
    if (held && held.at !== null) heldTarget = off[held.at + 1]! // le wagon tenu va dans la place qui s'ouvre, sur la voie
    let j = 1
    staying.forEach((c, k) => {
      if (held && held.at !== null && k === held.at) j++ // la place laissée au wagon tenu
      c.target = off[j++]!
    })
  }

  function setCars(ids: readonly string[]): void {
    const old = cars
    const next: Car[] = []
    const pool = [...old]
    for (const id of ids) {
      const k = pool.findIndex((c) => c.id === id)
      if (k >= 0) next.push(pool.splice(k, 1)[0]!)
      else {
        const group = build(id)
        const fromHeld = held && held.id === id ? held.x : null
        next.push({ id, group, x: fromHeld ?? 0, target: 0 })
      }
    }
    for (const c of pool) drop(c.group)
    cars = next
    layout()
    for (const c of cars) if (c.x === 0) c.x = c.target
  }

  // la caméra : de biais, toute la voie dans la largeur
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 60)
  const fit = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    const halfW = (RIGHT - LEFT) / 2 + 0.2
    const halfH = Math.max((halfW * h) / w, 0.9)
    const hw = (halfH * w) / h
    Object.assign(camera, { left: -hw, right: hw, top: halfH, bottom: -halfH })
    camera.position.set((LEFT + RIGHT) / 2, 6, 4.2)
    camera.lookAt((LEFT + RIGHT) / 2, 0.15, 0)
    camera.updateProjectionMatrix()
  }
  fit()
  const ro = new ResizeObserver(fit)
  ro.observe(canvas)

  const ray = new THREE.Raycaster()
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.25)
  const hit = new THREE.Vector3()
  const toWorld = (clientX: number, clientY: number): THREE.Vector3 | null => {
    const r = canvas.getBoundingClientRect()
    if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) return null
    ray.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), camera)
    return ray.ray.intersectPlane(plane, hit) ? hit.clone() : null
  }
  // la place où irait un wagon lâché en x : après toutes les voitures dont le centre est à sa gauche
  const placeAt = (x: number, _skip: number | null) => base.filter((c) => c < x).length

  function probe(clientX: number, clientY: number): Probe {
    const p = toWorld(clientX, clientY)
    if (!p) return { kind: 'none' }
    if (Math.abs(p.z) > 1.4) return { kind: 'none' }
    const r = canvas.getBoundingClientRect()
    ray.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), camera)
    const on = ray.intersectObjects(cars.map((c) => c.group), true)[0]
    const index = on ? cars.findIndex((c) => c.group.getObjectById(on.object.id) || c.group === on.object) : -1
    return { kind: 'car', index, at: placeAt(p.x, held?.from ?? null) }
  }

  function hold(h: { id: string; from: number | null; clientX: number; clientY: number } | null): void {
    if (!h) {
      if (held && held.from === null) drop(held.group) // venu de « Tes wagons » : le parent dira s'il entre dans le train
      if (held && held.from !== null) held.group.visible = true
      held = null
      layout()
      return
    }
    if (!held || held.id !== h.id || held.from !== h.from) {
      if (held && held.from === null) drop(held.group)
      const group = h.from !== null ? cars[h.from]!.group : build(h.id)
      held = { id: h.id, from: h.from, group, x: h.from !== null ? cars[h.from]!.x : RIGHT, z: 0, at: null }
      heldTarget = held.x
    }
    const p = toWorld(h.clientX, h.clientY)
    if (p) {
      held.at = placeAt(p.x, held.from)
    } else held.at = null // hors de la scène : le train se referme (vers « Tes wagons », le wagon sera rangé)
    layout()
  }

  const still = reducedMotion()
  let raf = 0
  let last = performance.now()
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop)
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    const k = still ? 1 : Math.min(1, dt * 12)
    for (const c of cars) {
      if (held && held.group === c.group) continue
      c.x += (c.target - c.x) * k
      c.group.position.set(c.x, 0, 0)
      c.group.rotation.z = 0
    }
    if (held) {
      // sur les rails, dans sa place ; à peine soulevé pour qu'on voie lequel on tient. Hors de la scène : caché.
      held.group.visible = held.at !== null
      held.x += (heldTarget - held.x) * k
      held.group.position.set(held.x, 0.04, 0)
      held.group.rotation.z = 0
    }
    renderer.render(scene, camera)
  }
  raf = requestAnimationFrame(loop)

  return {
    setCars,
    probe,
    hold,
    dispose() {
      cancelAnimationFrame(raf)
      ro.disconnect()
      for (const c of cars) drop(c.group)
      if (held && held.from === null) drop(held.group)
      drop(loco)
      disposables.forEach((x) => x.dispose())
      renderer.dispose()
    },
  }
}
