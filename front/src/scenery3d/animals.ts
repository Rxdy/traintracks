import * as THREE from 'three'
import type { AnimalKind, AnimalState } from '../scenery/motion'

// Les animaux de la scène 3D : mêmes proportions et mêmes couleurs que leur dessin SVG (SceneryLife), en volumes simples comme les
// wagons. Chaque modèle est construit de profil, vers +x (l'avant), pieds sur le sol (y = 0), à l'échelle du dessin SVG
// (le parent applique l'agrandissement de la scène). `pose` fait les petits mouvements (tête qui broute, queue, oreille).
export interface Animal3D {
  group: THREE.Group
  pose(a: AnimalState): void
  lift?: number // hauteur au-dessus du sol (le papillon vole)
  front?: boolean // regarde vers le joueur (+z) au lieu d'aller vers l'avant : le hibou
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
// un membre : un cylindre entre deux points
const limb = (g: THREE.Object3D, c: string, r: number, a: [number, number, number], b: [number, number, number]) => {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b)
  const d = vb.clone().sub(va)
  const m = put(g, cylinder, c, r, d.length(), r, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2)
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())
  return m
}
const flame = (c: string) => new THREE.MeshBasicMaterial({ color: c, transparent: true })
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

// La robe de la vache : des taches noires PEINTES sur la peau (une texture), pas des volumes qui dépassent du corps.
let cowMat: THREE.MeshStandardMaterial | null = null
function cowSkin(): THREE.MeshStandardMaterial {
  if (cowMat) return cowMat
  const W = 512, H = 256
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  g.fillStyle = '#fafaf9'
  g.fillRect(0, 0, W, H)
  g.fillStyle = '#26262a'
  let seed = 11
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  // une tache : un contour irrégulier lissé ; dessinée aussi de part et d'autre pour que la texture se raccorde autour du corps
  const blob = (cx: number, cy: number, r: number) => {
    const n = 12
    const pts = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2
      const k = r * (0.6 + 0.6 * rnd())
      return [cx + Math.cos(a) * k * 1.3, cy + Math.sin(a) * k] as const
    })
    for (const dx of [-W, 0, W]) {
      g.beginPath()
      g.moveTo((pts[0][0] + pts[n - 1][0]) / 2 + dx, (pts[0][1] + pts[n - 1][1]) / 2)
      for (let i = 0; i < n; i++) {
        const p = pts[i], q = pts[(i + 1) % n]
        g.quadraticCurveTo(p[0] + dx, p[1], (p[0] + q[0]) / 2 + dx, (p[1] + q[1]) / 2)
      }
      g.closePath()
      g.fill()
    }
  }
  for (const [x, y, r] of [[60, 80, 46], [170, 170, 38], [250, 70, 52], [340, 150, 44], [430, 60, 40], [470, 190, 36], [110, 215, 30], [300, 225, 34], [200, 20, 28]] as const) blob(x, y, r)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  cowMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 })
  return cowMat
}

function cow(): Animal3D {
  const group = new THREE.Group()
  const body = pivot(group, 0, 0, 0)
  const hide = '#fafaf9', dark = '#26262a'
  for (const x of [-0.085, 0.085]) for (const z of [-0.034, 0.034]) {
    rod(body, '#e7e5e4', 0.0145, 0.07, x, 0.037, z)
    rod(body, '#44403c', 0.0155, 0.014, x, 0.007, z)
  }
  // le corps et la croupe : pôles de la sphère aux deux bouts (avant et arrière), pour que la robe ne se pince pas sur le dos
  for (const [rx, ry, rz, x, y] of [[0.13, 0.064, 0.056, 0, 0.118], [0.06, 0.06, 0.054, -0.085, 0.12]] as const) {
    const m = new THREE.Mesh(sphere, cowSkin())
    m.scale.set(ry, rx, rz)
    m.rotation.z = Math.PI / 2
    m.position.set(x, y, 0)
    m.castShadow = true
    body.add(m)
  }
  ell(body, '#f9a8b4', 0.022, 0.016, 0.026, -0.05, 0.062, 0) // le pis
  const tail = pivot(body, -0.14, 0.15, 0)
  limb(tail, '#e7e5e4', 0.006, [0, 0, 0], [-0.012, -0.075, 0])
  ell(tail, dark, 0.012, 0.018, 0.012, -0.013, -0.088, 0)
  const head = pivot(body, 0, 0, 0)
  ell(head, hide, 0.044, 0.04, 0.036, 0.152, 0.135, 0)
  ell(head, '#f9a8b4', 0.022, 0.02, 0.03, 0.185, 0.122, 0)
  for (const s of [-1, 1]) {
    ell(head, '#111827', 0.006, 0.006, 0.006, 0.172, 0.142, s * 0.033)
    ell(head, dark, 0.022, 0.008, 0.014, 0.132, 0.158, s * 0.044).rotation.z = 0.25
    put(head, cone, '#e7e5e4', 0.008, 0.026, 0.008, 0.138, 0.18, s * 0.02)
  }
  return {
    group,
    pose(a) {
      const g = grazing(a, 0.7)
      body.position.y = -g * 0.008
      head.position.y = -g * 0.05
      head.rotation.z = -g * 0.25
      tail.rotation.z = Math.sin(a.t * 2.2) * 0.2
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

function goat(): Animal3D {
  const group = new THREE.Group()
  const body = pivot(group, 0, 0, 0)
  const wool = '#e7e5e4'
  for (const x of [-0.05, 0.05]) for (const z of [-0.022, 0.022]) rod(body, '#78716c', 0.008, 0.055, x, 0.028, z)
  ell(body, wool, 0.085, 0.045, 0.04, 0, 0.082, 0)
  ell(body, wool, 0.034, 0.03, 0.026, 0.105, 0.105, 0)
  ell(body, '#a8a29e', 0.01, 0.018, 0.01, 0.135, 0.075, 0) // la barbiche
  for (const s of [-1, 1]) {
    limb(body, '#57534e', 0.006, [0.098, 0.128, s * 0.012], [0.07, 0.17, s * 0.02])
    limb(body, '#57534e', 0.005, [0.07, 0.17, s * 0.02], [0.05, 0.16, s * 0.026])
    ell(body, '#111827', 0.005, 0.005, 0.005, 0.132, 0.11, s * 0.016)
  }
  return {
    group,
    pose(a) {
      body.position.y = Math.max(0, Math.sin(a.t * 1.3)) * 0.01
    },
  }
}

function hedgehog(): Animal3D {
  const group = new THREE.Group()
  ell(group, '#6b4a2b', 0.08, 0.055, 0.055, 0, 0.055, 0)
  const spine = '#3b2713'
  for (let i = 0; i < 16; i++) {
    const x = -0.06 + (i % 4) * 0.035, z = ((i * 37) % 7 - 3) * 0.012
    put(group, cone, spine, 0.008, 0.035, 0.008, x, 0.1 + ((i * 13) % 5) * 0.003, z).rotation.z = 0.5
  }
  ell(group, '#e8c9a0', 0.036, 0.03, 0.03, 0.085, 0.04, 0)
  ell(group, '#111827', 0.009, 0.009, 0.009, 0.118, 0.04, 0)
  for (const s of [-1, 1]) ell(group, '#111827', 0.006, 0.006, 0.006, 0.1, 0.055, s * 0.016)
  for (const x of [-0.03, 0.04]) for (const z of [-0.03, 0.03]) rod(group, '#3b2713', 0.008, 0.016, x, 0.008, z)
  return { group, pose() {} }
}

function lizard(snow: boolean): Animal3D {
  const group = new THREE.Group()
  const skin = snow ? '#f97316' : '#ea580c'
  ell(group, skin, 0.07, 0.022, 0.03, 0, 0.026, 0)
  ell(group, '#fb923c', 0.032, 0.02, 0.024, 0.08, 0.028, 0)
  ell(group, '#111827', 0.006, 0.006, 0.006, 0.098, 0.04, 0.012)
  ell(group, '#111827', 0.006, 0.006, 0.006, 0.098, 0.04, -0.012)
  const tail = pivot(group, -0.06, 0.022, 0)
  for (const [x, z, r] of [[-0.03, 0.005, 0.02], [-0.07, 0.015, 0.014], [-0.11, 0.012, 0.009], [-0.14, 0.003, 0.006]] as const) ell(tail, skin, r * 1.4, r * 0.8, r, x, 0, z)
  for (const [x, s] of [[-0.03, 1], [0.045, 1], [-0.03, -1], [0.045, -1]] as const) limb(group, '#7c2d12', 0.007, [x, 0.02, s * 0.022], [x + 0.025, 0.004, s * 0.05])
  return {
    group,
    pose(a) {
      tail.rotation.y = Math.sin(a.t * 3) * 0.35
    },
  }
}

function scorpion(): Animal3D {
  const group = new THREE.Group()
  const red = '#991b1b', dark = '#450a0a'
  ell(group, red, 0.065, 0.03, 0.04, 0, 0.034, 0)
  ell(group, '#fde047', 0.006, 0.006, 0.006, 0.055, 0.052, 0.012)
  ell(group, '#fde047', 0.006, 0.006, 0.006, 0.055, 0.052, -0.012)
  for (const s of [-1, 1]) {
    limb(group, red, 0.011, [0.05, 0.034, s * 0.025], [0.09, 0.034, s * 0.05])
    ell(group, red, 0.025, 0.012, 0.018, 0.115, 0.034, s * 0.045)
    for (const x of [-0.025, 0.005, 0.035]) limb(group, dark, 0.005, [x, 0.03, s * 0.03], [x + 0.01, 0.004, s * 0.06])
  }
  const tail = pivot(group, -0.05, 0.04, 0)
  for (const [x, y, r] of [[-0.03, 0.01, 0.016], [-0.06, 0.04, 0.015], [-0.07, 0.075, 0.014], [-0.045, 0.1, 0.013]] as const) ell(tail, red, r, r, r, x, y, 0)
  put(tail, cone, dark, 0.008, 0.03, 0.008, -0.02, 0.115, 0).rotation.z = 1.7
  return {
    group,
    pose(a) {
      tail.rotation.z = Math.sin(a.t * 3) * 0.14
    },
  }
}

function alien(): Animal3D {
  const group = new THREE.Group()
  const skin = '#84cc16', dark = '#3f6212'
  const legL = limb(group, dark, 0.007, [-0.03, 0.045, 0.01], [-0.045, 0.01, 0.01])
  const legR = limb(group, dark, 0.007, [0.03, 0.045, -0.01], [0.045, 0.01, -0.01])
  ell(group, skin, 0.055, 0.05, 0.05, 0, 0.09, 0)
  for (const s of [-1, 1]) {
    limb(group, dark, 0.005, [s * 0.02, 0.13, 0], [s * 0.05, 0.19, 0])
    ell(group, '#bef264', 0.015, 0.015, 0.015, s * 0.05, 0.19, 0)
    ell(group, '#111827', 0.016, 0.02, 0.012, 0.025, 0.095, s * 0.022)
  }
  ell(group, dark, 0.02, 0.005, 0.016, 0.05, 0.068, 0)
  return {
    group,
    pose(a) {
      const k = Math.sin(a.t * 6) * 0.01
      legL.position.y = 0.0275 + k
      legR.position.y = 0.0275 - k
    },
  }
}

function owl(): Animal3D {
  const group = new THREE.Group() // regarde vers +x ; `front` le tourne vers le joueur
  const feather = '#8b6f47', dark = '#6b5436'
  ell(group, feather, 0.12, 0.14, 0.1, 0, 0.14, 0)
  ell(group, '#a88a5c', 0.07, 0.07, 0.04, 0.05, 0.1, 0) // le ventre clair
  for (const s of [-1, 1]) {
    put(group, cone, dark, 0.02, 0.05, 0.02, 0.0, 0.29, s * 0.07)
    ell(group, '#fff7d6', 0.052, 0.052, 0.02, 0.1, 0.17, s * 0.05)
  }
  const pupils = [-1, 1].map((s) => ell(group, '#111827', 0.024, 0.024, 0.014, 0.115, 0.17, s * 0.05))
  const lids = [-1, 1].map((s) => ell(group, feather, 0.056, 0.056, 0.024, 0.104, 0.17, s * 0.05))
  put(group, cone, '#f59e0b', 0.016, 0.04, 0.016, 0.125, 0.14, 0).rotation.z = -Math.PI / 2
  rod(group, '#6b5436', 0.02, 0.01, 0, 0.005, 0)
  return {
    group,
    front: true,
    pose(a) {
      const blink = a.blink ?? 0 // 0 : ouvert
      lids.forEach((l) => l.scale.set(0.056, 0.056 * Math.min(1, blink * 1.05) + 0.001, 0.024))
      pupils.forEach((p, i) => (p.position.z = (i ? 1 : -1) * 0.05 + (a.look ?? 0) * 0.02))
      group.rotation.z = Math.sin(a.t * 0.5) * 0.07
    },
  }
}

function campfire(): Animal3D {
  const group = new THREE.Group()
  for (let i = 0; i < 8; i++) {
    const t = (i / 8) * Math.PI * 2
    ell(group, '#57534e', 0.02, 0.014, 0.02, Math.cos(t) * 0.06, 0.01, Math.sin(t) * 0.06)
  }
  limb(group, '#7a4e2d', 0.011, [-0.05, 0.015, -0.015], [0.05, 0.03, 0.015])
  limb(group, '#7a4e2d', 0.011, [-0.05, 0.03, 0.02], [0.05, 0.015, -0.02])
  const fire = new THREE.Group()
  group.add(fire)
  const matO = flame('#f97316'), matY = flame('#fde047')
  const outer = [0, 1, 2].map((i) => {
    const m = new THREE.Mesh(cone, matO)
    m.scale.set(0.022, 0.07, 0.022)
    m.position.set((i - 1) * 0.022, 0.065, (i % 2 ? 0.01 : -0.01))
    fire.add(m)
    return m
  })
  const inner = new THREE.Mesh(cone, matY)
  inner.scale.set(0.016, 0.05, 0.016)
  inner.position.set(0, 0.05, 0)
  fire.add(inner)
  const puffs = [0, 1, 2].map(() => {
    const m = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: '#9ca3af', transparent: true, opacity: 0.4 }))
    group.add(m)
    return m
  })
  return {
    group,
    pose(a) {
      outer.forEach((m, i) => m.scale.set(0.022, 0.07 + Math.sin(a.t * 11 + i * 2) * 0.012, 0.022))
      inner.scale.y = 0.05 + Math.sin(a.t * 13) * 0.01
      puffs.forEach((m, i) => {
        const k = (a.t * 0.35 + (i + 1) / 3) % 1
        const r = 0.016 + k * 0.02
        m.scale.set(r, r, r)
        m.position.set(Math.sin(a.t * 0.9 + i) * 0.03, 0.12 + k * 0.16, 0)
        ;(m.material as THREE.MeshBasicMaterial).opacity = 0.55 - k * 0.5
      })
    },
  }
}

// un petit personnage : jambes, buste, tête, bonnet, bras (skateur, skieur, luge)
function person(body: THREE.Object3D, o: { torso: string; hat: string; legs: string; y: number; sit?: boolean }) {
  const y = o.y
  if (!o.sit) {
    limb(body, o.legs, 0.011, [-0.012, y + 0.06, 0], [-0.02, y, 0.01])
    limb(body, o.legs, 0.011, [0.012, y + 0.06, 0], [0.03, y + 0.005, -0.01])
  }
  ell(body, o.torso, 0.03, 0.04, 0.026, 0, y + 0.1, 0)
  ell(body, '#fcd9b6', 0.028, 0.028, 0.026, 0.004, y + 0.158, 0)
  ell(body, o.hat, 0.03, 0.012, 0.027, 0.0, y + 0.172, 0)
}

function skater(): Animal3D {
  const group = new THREE.Group()
  const body = pivot(group, 0, 0.0, 0)
  person(body, { torso: '#dc2626', hat: '#2563eb', legs: '#1e3a8a', y: 0 })
  limb(body, '#dc2626', 0.008, [-0.02, 0.12, 0.02], [-0.07, 0.1, 0.05])
  limb(body, '#dc2626', 0.008, [0.02, 0.12, -0.02], [0.07, 0.14, -0.05])
  box(body, '#e5e7eb', 0.05, 0.008, 0.014, -0.0, 0.004, 0.012)
  return {
    group,
    pose(a) {
      body.rotation.z = (12 * Math.sin(a.t * 2) * Math.PI) / 180 // il se penche en patinant
    },
  }
}

function skier(): Animal3D {
  const group = new THREE.Group()
  for (const z of [-0.016, 0.016]) box(group, '#1d4ed8', 0.2, 0.008, 0.012, 0, 0.004, z)
  person(group, { torso: '#f97316', hat: '#111827', legs: '#111827', y: 0.008 })
  limb(group, '#92400e', 0.006, [0.02, 0.12, 0.03], [0.1, 0.01, 0.045])
  limb(group, '#92400e', 0.006, [-0.02, 0.12, -0.03], [0.04, 0.01, -0.05])
  return { group, pose() {} }
}

function sled(): Animal3D {
  const group = new THREE.Group()
  for (const z of [-0.03, 0.03]) {
    box(group, '#7a4e2d', 0.2, 0.012, 0.012, 0, 0.008, z)
    limb(group, '#7a4e2d', 0.008, [0.1, 0.008, z], [0.13, 0.04, z])
  }
  box(group, '#b45309', 0.18, 0.02, 0.07, 0, 0.03, 0)
  ell(group, '#16a34a', 0.03, 0.04, 0.026, -0.01, 0.075, 0)
  ell(group, '#fcd9b6', 0.026, 0.026, 0.024, -0.005, 0.12, 0)
  ell(group, '#dc2626', 0.027, 0.011, 0.025, -0.005, 0.138, 0)
  return { group, pose() {} }
}

function butterfly(_snow: boolean, id: number): Animal3D {
  const group = new THREE.Group()
  const colour = ['#f472b6', '#facc15', '#60a5fa'][id % 3]
  const wings = [-1, 1].map((s) => {
    const w = pivot(group, 0, 0, 0)
    ell(w, colour, 0.04, 0.004, 0.03, -0.02, 0, s * 0.03)
    ell(w, colour, 0.03, 0.004, 0.025, -0.045, 0, s * 0.022)
    return w
  })
  box(group, '#111827', 0.05, 0.01, 0.01, 0.01, 0, 0)
  return {
    group,
    lift: 0.14,
    pose(a) {
      const f = Math.sin(a.t * 14) * 0.9
      wings[0].rotation.x = f
      wings[1].rotation.x = -f
    },
  }
}

const BUILD: Partial<Record<AnimalKind, (snow: boolean, id: number) => Animal3D>> = {
  sheep, cow, tractor, cat, rabbit, squirrel, deer, goat, hedgehog, lizard, scorpion, alien, owl, campfire, skater, skier, sled, butterfly,
}
export function makeAnimal(kind: AnimalKind, snow: boolean, id = 0): Animal3D | null {
  return BUILD[kind]?.(snow, id) ?? null
}
