// Vignettes des wagons (collection, machine « Wagon surprise ») : le vrai modèle 3D, vu de trois quarts, rendu une fois
// dans une image gardée en mémoire. Un seul moteur 3D pour toutes : on ne crée pas un contexte WebGL par vignette.
import * as THREE from 'three'
import { makeCar, makeWagon } from './trainModel'
import { styleOf } from '../trainStyle'

const cache = new Map<string, string>()
let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene | null = null
const W = 320, H = 200
let scale = 1
/** Outils de développement : des vignettes plus grandes (planches, galerie). */
export function setThumbScale(k: number): void {
  scale = k
  cache.clear()
  renderer?.setPixelRatio(k)
}

function setup(): { renderer: THREE.WebGLRenderer; scene: THREE.Scene } {
  if (renderer && scene) return { renderer, scene }
  const canvas = document.createElement('canvas')
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(scale)
  renderer.setSize(W, H, false)
  renderer.shadowMap.enabled = true
  scene = new THREE.Scene()
  scene.add(new THREE.HemisphereLight('#ffffff', '#9fb98a', 1.7))
  const sun = new THREE.DirectionalLight('#fff4dc', 2.3)
  sun.position.set(2, 5, 3)
  sun.castShadow = true
  scene.add(sun)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(6, 6).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.22 }))
  ground.receiveShadow = true
  scene.add(ground)
  return { renderer, scene }
}

/** L'image d'un wagon (identifiant du catalogue), ou de la locomotive avec « loco ». */
export function wagonThumb(id: string): string {
  const hit = cache.get(id)
  if (hit) return hit
  const { renderer, scene } = setup()
  const style = id === 'loco' ? null : styleOf(id)
  const car = style ? makeWagon(style) : makeCar(0)
  car.rotation.y = Math.PI + 0.55 // tourné vers la gauche : dans Mon train, la locomotive est à gauche et tire le train
  scene.add(car)
  // cadrage : la boîte du wagon vue par la caméra, avec une marge ; rien n'est coupé, wagon court ou long
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 50)
  cam.position.set(0, 2.2, 3.2)
  cam.lookAt(0, 0.2, 0)
  cam.updateMatrixWorld()
  car.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(car)
  const view = new THREE.Box3()
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) view.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(cam.matrixWorldInverse))
  const cx = (view.min.x + view.max.x) / 2, cy = (view.min.y + view.max.y) / 2
  let hw = ((view.max.x - view.min.x) / 2) * 1.08, hh = ((view.max.y - view.min.y) / 2) * 1.08
  if (hw / hh > W / H) hh = (hw * H) / W
  else hw = (hh * W) / H
  Object.assign(cam, { left: cx - hw, right: cx + hw, top: cy + hh, bottom: cy - hh })
  cam.updateProjectionMatrix()
  renderer.render(scene, cam)
  const url = renderer.domElement.toDataURL('image/png')
  scene.remove(car)
  car.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    m.geometry.dispose()
    ;([] as THREE.Material[]).concat(m.material).forEach((x) => x.dispose())
  })
  cache.set(id, url)
  return url
}
