import * as THREE from 'three'
import type { AnimalKind, AnimalState } from '../scenery/motion'

// Les animaux de la scène 3D : mêmes proportions et mêmes couleurs que leur dessin SVG (SceneryLife), en volumes simples comme les
// wagons. Chaque modèle est construit de profil, vers +x (l'avant), pieds sur le sol (y = 0), à l'échelle du dessin SVG
// (le parent applique l'agrandissement de la scène). `pose` fait les petits mouvements (tête qui broute, queue, oreille).
export interface Animal3D {
  group: THREE.Group
  pose(a: AnimalState): void
}

const mats = new Map<string, THREE.MeshStandardMaterial>()
const mat = (c: string): THREE.MeshStandardMaterial => mats.get(c) ?? mats.set(c, new THREE.MeshStandardMaterial({ color: c, roughness: 0.75 })).get(c)!
const sphere = new THREE.SphereGeometry(1, 14, 10)
const cube = new THREE.BoxGeometry(1, 1, 1)
const cylinder = new THREE.CylinderGeometry(1, 1, 1, 12)
const cone = new THREE.ConeGeometry(1, 1, 10)

function put(g: THREE.Object3D, geo: THREE.BufferGeometry, color: string, sx: number, sy: number, sz: number, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat(color))
  m.scale.set(sx, sy, sz)
  m.position.set(x, y, z)
  m.castShadow = true
  g.add(m)
  return m
}
const ell = (g: THREE.Object3D, c: string, rx: number, ry: number, rz: number, x: number, y: number, z: number) => put(g, sphere, c, rx, ry, rz, x, y, z)
const box = (g: THREE.Object3D, c: string, w: number, h: number, d: number, x: number, y: number, z: number) => put(g, cube, c, w, h, d, x, y, z)
const rod = (g: THREE.Object3D, c: string, r: number, h: number, x: number, y: number, z: number) => put(g, cylinder, c, r, h, r, x, y, z)
// une roue : axe le long de z
const wheel = (g: THREE.Object3D, c: string, r: number, w: number, x: number, y: number, z: number) => {
  const m = put(g, cylinder, c, r, w, r, x, y, z)
  m.rotation.x = Math.PI / 2
  return m
}
const pivot = (g: THREE.Object3D, x: number, y: number, z: number) => {
  const p = new THREE.Group()
  p.position.set(x, y, z)
  g.add(p)
  return p
}
const grazing = (a: AnimalState, speed: number) => Math.max(0, Math.sin(a.t * speed)) // 0..1 : la tête descend brouter

function sheep(): Animal3D {
  const group = new THREE.Group()
  const body = pivot(group, 0, 0, 0)
  for (const x of [-0.035, 0.035]) for (const z of [-0.026, 0.026]) rod(body, '#3b3b3b', 0.008, 0.05, x, 0.025, z)
  const wool = '#f8fafc'
  for (const [x, y, r] of [[-0.04, 0.097, 0.04], [0.005, 0.107, 0.045], [0.04, 0.09, 0.036]] as const) ell(body, wool, r, r, r * 1.05, x, y, 0)
  for (const [x, y, z] of [[-0.03, 0.09, 0.03], [-0.03, 0.09, -0.03], [0.02, 0.095, 0.03], [0.02, 0.095, -0.03]] as const) ell(body, wool, 0.032, 0.032, 0.03, x, y, z)
  const head = ell(body, '#3b3b3b', 0.03, 0.026, 0.024, 0.082, 0.073, 0)
  const eyes = [-1, 1].map((s) => ell(body, '#ffffff', 0.006, 0.006, 0.006, 0.098, 0.08, s * 0.017))
  return {
    group,
    pose(a) {
      const g = grazing(a, 0.9)
      body.position.y = -g * 0.012
      head.position.y = 0.073 - g * 0.03
      eyes.forEach((e) => (e.position.y = 0.08 - g * 0.03))
    },
  }
}

function cow(): Animal3D {
  const group = new THREE.Group()
  const body = pivot(group, 0, 0, 0)
  for (const x of [-0.07, -0.03, 0.04, 0.08]) for (const z of [-0.03, 0.03]) rod(body, '#374151', 0.011, 0.06, x, 0.03, z)
  ell(body, '#ffffff', 0.12, 0.058, 0.05, 0, 0.09, 0)
  for (const s of [-1, 1]) {
    ell(body, '#1f2937', 0.035, 0.03, 0.012, -0.02, 0.1, s * 0.046)
    ell(body, '#1f2937', 0.03, 0.025, 0.012, 0.07, 0.085, s * 0.04)
  }
  const head = pivot(body, 0, 0, 0)
  ell(head, '#ffffff', 0.04, 0.03, 0.032, 0.14, 0.078, 0)
  ell(head, '#f9a8b4', 0.016, 0.014, 0.022, 0.165, 0.068, 0)
  for (const s of [-1, 1]) {
    rod(head, '#e5e7eb', 0.006, 0.028, 0.135, 0.108, s * 0.022).rotation.x = s * 0.35
    ell(head, '#1f2937', 0.006, 0.006, 0.006, 0.16, 0.088, s * 0.022)
  }
  return {
    group,
    pose(a) {
      const g = grazing(a, 0.7)
      body.position.y = -g * 0.01
      head.position.y = -g * 0.035
    },
  }
}

function tractor(): Animal3D {
  const group = new THREE.Group()
  const body = pivot(group, 0, 0, 0)
  for (const z of [-0.055, 0.055]) {
    wheel(body, '#1f2937', 0.055, 0.03, -0.07, 0.055, z)
    wheel(body, '#9ca3af', 0.024, 0.032, -0.07, 0.055, z)
  }
  for (const z of [-0.047, 0.047]) {
    wheel(body, '#1f2937', 0.034, 0.024, 0.09, 0.035, z)
    wheel(body, '#9ca3af', 0.014, 0.026, 0.09, 0.035, z)
  }
  box(body, '#dc2626', 0.14, 0.06, 0.09, 0.07, 0.085, 0) // le capot
  box(body, '#b91c1c', 0.1, 0.09, 0.09, -0.05, 0.12, 0) // la cabine
  box(body, '#bfdbfe', 0.07, 0.04, 0.094, -0.05, 0.125, 0) // les vitres
  rod(body, '#374151', 0.006, 0.05, 0.12, 0.14, 0)
  return {
    group,
    pose(a) {
      body.position.y = Math.sin(a.t * 18) * 0.003 // le moteur tourne
    },
  }
}

function cat(): Animal3D {
  const group = new THREE.Group()
  const grey = '#6b7280'
  for (const x of [-0.045, 0.05]) for (const z of [-0.025, 0.025]) rod(group, grey, 0.011, 0.034, x, 0.017, z)
  ell(group, grey, 0.08, 0.045, 0.04, 0, 0.055, 0)
  ell(group, grey, 0.035, 0.035, 0.034, 0.085, 0.075, 0)
  for (const s of [-1, 1]) {
    put(group, cone, grey, 0.01, 0.025, 0.01, 0.082, 0.112, s * 0.02)
    ell(group, '#facc15', 0.007, 0.007, 0.007, 0.114, 0.08, s * 0.015)
  }
  const tail = pivot(group, -0.07, 0.06, 0)
  rod(tail, '#4b5563', 0.011, 0.11, -0.045, 0.03, 0).rotation.z = 0.9
  return {
    group,
    pose(a) {
      tail.rotation.z = Math.sin(a.t * 2) * 0.18
    },
  }
}

function rabbit(snow: boolean): Animal3D {
  const group = new THREE.Group()
  const fur = snow ? '#ffffff' : '#b9a58b'
  for (const z of [-0.025, 0.025]) {
    ell(group, fur, 0.03, 0.014, 0.014, -0.035, 0.014, z)
    rod(group, fur, 0.009, 0.03, 0.045, 0.015, z)
  }
  ell(group, fur, 0.065, 0.045, 0.04, 0, 0.055, 0)
  ell(group, fur, 0.032, 0.032, 0.03, 0.07, 0.07, 0)
  for (const s of [-1, 1]) {
    ell(group, snow ? '#fecdd3' : fur, 0.01, 0.034, 0.008, 0.065, 0.118, s * 0.014)
    ell(group, '#111827', 0.007, 0.007, 0.007, 0.098, 0.074, s * 0.016)
  }
  ell(group, '#ffffff', 0.02, 0.02, 0.02, -0.07, 0.058, 0)
  return { group, pose() {} }
}

function squirrel(): Animal3D {
  const group = new THREE.Group()
  const fur = '#d9772f'
  for (const z of [-0.022, 0.022]) rod(group, fur, 0.01, 0.03, 0.03, 0.015, z)
  ell(group, fur, 0.065, 0.042, 0.035, 0, 0.05, 0)
  ell(group, fur, 0.033, 0.033, 0.03, 0.07, 0.066, 0)
  for (const s of [-1, 1]) {
    put(group, cone, fur, 0.009, 0.024, 0.009, 0.06, 0.1, s * 0.016)
    ell(group, '#111827', 0.007, 0.007, 0.007, 0.1, 0.07, s * 0.014)
  }
  const tail = pivot(group, -0.06, 0.05, 0)
  ell(tail, '#c2652a', 0.035, 0.085, 0.03, -0.03, 0.07, 0).rotation.z = 0.35
  return {
    group,
    pose(a) {
      tail.rotation.z = -((a.wag ?? 0) * Math.PI) / 180
    },
  }
}

function deer(): Animal3D {
  const group = new THREE.Group()
  const hide = '#a0642d'
  for (const x of [-0.075, 0.075]) for (const z of [-0.03, 0.03]) rod(group, '#7a4a20', 0.009, 0.08, x, 0.04, z)
  ell(group, hide, 0.12, 0.065, 0.05, 0, 0.12, 0)
  for (const [x, y, z] of [[-0.03, 0.14, 0.047], [0.03, 0.105, 0.047], [-0.03, 0.14, -0.047], [0.03, 0.105, -0.047]] as const) ell(group, '#fde9c9', 0.012, 0.012, 0.006, x, y, z)
  const neck = rod(group, hide, 0.022, 0.08, 0.105, 0.17, 0)
  neck.rotation.z = -0.55
  ell(group, hide, 0.04, 0.034, 0.03, 0.14, 0.215, 0)
  ell(group, '#111827', 0.008, 0.008, 0.008, 0.172, 0.22, 0.02)
  ell(group, '#111827', 0.008, 0.008, 0.008, 0.172, 0.22, -0.02)
  const ears = [-1, 1].map((s) => {
    const e = ell(group, '#7a4a20', 0.02, 0.011, 0.008, 0.115, 0.24, s * 0.026)
    e.rotation.z = 0.3
    return e
  })
  for (const s of [-1, 1]) {
    rod(group, '#e8d4b0', 0.006, 0.07, 0.135, 0.275, s * 0.018).rotation.set(s * 0.25, 0, -0.25)
    rod(group, '#e8d4b0', 0.005, 0.04, 0.155, 0.29, s * 0.025).rotation.set(s * 0.5, 0, -0.9)
  }
  return {
    group,
    pose(a) {
      const flick = Math.sin(a.t * 3) > 0.8
      ears.forEach((e) => (e.rotation.z = flick ? 0.8 : 0.3))
    },
  }
}

const BUILD: Partial<Record<AnimalKind, (snow: boolean) => Animal3D>> = { sheep, cow, tractor, cat, rabbit, squirrel, deer }
export function makeAnimal(kind: AnimalKind, snow: boolean): Animal3D | null {
  return BUILD[kind]?.(snow) ?? null
}
