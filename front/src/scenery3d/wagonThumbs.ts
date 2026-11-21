// Vignettes des wagons (collection, machine « Wagon surprise ») : le vrai modèle 3D, vu de trois quarts, rendu une fois
// dans une image gardée en mémoire. Un seul moteur 3D pour toutes : on ne crée pas un contexte WebGL par vignette.
import * as THREE from 'three'
import { makeCar, makeWagon } from './trainModel'
import { styleOf } from '../trainStyle'

const cache = new Map<string, string>()
let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene | null = null
const W = 320, H = 200

function setup(): { renderer: THREE.WebGLRenderer; scene: THREE.Scene } {
  if (renderer && scene) return { renderer, scene }
  const canvas = document.createElement('canvas')
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(1)
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
  car.rotation.y = -0.55
  scene.add(car)
  // cadrage : un wagon long recule la caméra pour tenir entier
  const len = style ? style.length : 1
  const span = 0.52 + (len - 1) * 0.62
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 50)
  const half = Math.max(0.42, span * 0.62)
  Object.assign(cam, { left: -half, right: half, top: (half * H) / W + 0.12, bottom: (-half * H) / W + 0.12 })
  cam.updateProjectionMatrix()
  cam.position.set(0, 2.2, 3.2)
  cam.lookAt(0, 0.2, 0)
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
