// Les 12 wagons de la collection rendus avec le modèle 3D du jeu (outil de développement, jamais publié).
// ?cols=6 : nombre de colonnes de la planche.
import * as THREE from 'three'
import { WAGON_STYLES } from '../src/trainStyle'
import { makeCar, makeWagon } from '../src/scenery3d/trainModel'

const cols = Number(new URLSearchParams(location.search).get('cols') ?? 4)
document.body.style.cssText = 'margin:0;overflow:hidden;background:linear-gradient(#a5d8ff,#e7f5ff);font-family:system-ui,sans-serif'
const canvas = document.createElement('canvas')
canvas.style.cssText = 'display:block;width:100vw;height:100vh'
document.body.appendChild(canvas)
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(Math.min(2, devicePixelRatio))
renderer.setSize(innerWidth, innerHeight, false)
renderer.shadowMap.enabled = true
const scene = new THREE.Scene()
scene.add(new THREE.HemisphereLight('#ffffff', '#8fb36b', 1.6))
const sun = new THREE.DirectionalLight('#fff4dc', 2.4)
sun.position.set(3, 6, 4)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 })
scene.add(sun)

const rows = Math.ceil(WAGON_STYLES.length / cols)
const GAP_X = 1.25, GAP_Z = 2.1
const all = [{ g: makeCar(0), name: 'Locomotive', sub: '' }, ...WAGON_STYLES.map((w) => ({ g: makeWagon(w), name: w.name, sub: w.accessoryName }))]
const labels: { el: HTMLDivElement; p: THREE.Vector3 }[] = []
all.forEach((it, k) => {
  const idx = k === 0 ? -1 : k - 1
  const col = idx < 0 ? -1 : idx % cols, row = idx < 0 ? 0 : Math.floor(idx / cols)
  const x = (col - (cols - 1) / 2) * GAP_X, z = (row - (rows - 1) / 2) * GAP_Z
  if (idx < 0) return // la locomotive n'est pas sur la planche
  it.g.position.set(x, 0, z)
  it.g.rotation.y = -0.5
  scene.add(it.g)
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.03, 40), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 }))
  plate.position.set(x, -0.015, z)
  plate.receiveShadow = true
  scene.add(plate)
  const el = document.createElement('div')
  el.innerHTML = `<b>${it.name}</b><br><span style="color:#4b5563">${it.sub}</span>`
  el.style.cssText = 'position:absolute;transform:translate(-50%,0);text-align:center;font-size:14px;line-height:1.2;color:#1f2937'
  document.body.appendChild(el)
  labels.push({ el, p: new THREE.Vector3(x, 0, z + 0.42) })
})
// vue orthographique un peu plongeante : tous les wagons à la même taille, rangées bien séparées
const half = ((rows * GAP_Z) / 2) * 0.86 + 0.2
const aspect = innerWidth / innerHeight
const cam = new THREE.OrthographicCamera(-half * aspect, half * aspect, half, -half, 0.1, 100)
cam.position.set(0, 4, 6)
cam.lookAt(0, 0.15, 0.3)
renderer.render(scene, cam)
for (const l of labels) {
  const v = l.p.clone().project(cam)
  l.el.style.left = ((v.x + 1) / 2) * innerWidth + 'px'
  l.el.style.top = ((1 - v.y) / 2) * innerHeight + 'px'
}
document.body.dataset.ready = '1'
