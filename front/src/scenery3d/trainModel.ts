// Le train du jeu en 3D : locomotive à vapeur + wagons, coins arrondis, surfaces vernies, détails dorés.
// Même modèle sur l'accueil (home.ts) et dans les images fixes (dev/renderArt.ts : icône, carte « Niveau »).
// Couleurs et écart entre wagons : src/trainStyle.ts. Le train avance vers +x ; pieds sur y = 0.
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { LOCO_COLOR, wagonColor } from '../trainStyle'

const lighter = (c: string, a: number): string => '#' + new THREE.Color(c).lerp(new THREE.Color('#ffffff'), a).getHexString()
const darker = (c: string, a: number): string => '#' + new THREE.Color(c).lerp(new THREE.Color('#000000'), a).getHexString()

/** La voiture n° i : 0 = locomotive, 1.. = wagons (caisses, fenêtres, charbon). */
export function makeCar(i: number): THREE.Group {
  const g = new THREE.Group()
  const c = i === 0 ? LOCO_COLOR : wagonColor(i)
  const glossy = (col: string) => new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.38, clearcoat: 0.8, clearcoatRoughness: 0.15 })
  const gold = new THREE.MeshPhysicalMaterial({ color: '#fbbf24', roughness: 0.25, metalness: 0.6, clearcoat: 0.6 })
  const glass = new THREE.MeshPhysicalMaterial({ color: '#bfe3fa', roughness: 0.1, clearcoat: 1 })
  const box = (w: number, h: number, d: number, r = 0.05) => new RoundedBoxGeometry(w, h, d, 4, r)
  const cyl = (rt: number, rb: number, h: number) => new THREE.CylinderGeometry(rt, rb, h, 24)
  const lieDown = (geo: THREE.BufferGeometry) => geo.rotateZ(Math.PI / 2) // cylindre couché dans le sens du train
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => {
    const o = new THREE.Mesh(geo, m)
    o.position.set(x, y, z)
    o.castShadow = o.receiveShadow = true
    g.add(o)
  }
  // châssis sombre sous la caisse, tampons aux deux bouts
  add(box(0.58, 0.05, 0.3, 0.02), glossy('#374151'), 0, 0.12, 0)
  for (const x of [-0.3, 0.3]) for (const z of [-0.09, 0.09]) add(lieDown(cyl(0.025, 0.025, 0.04)), gold, x, 0.13, z)
  if (i === 0) {
    // chaudière couchée, cabine au fond, cheminée à col, dôme, phare cerclé, chasse-pierres
    add(lieDown(cyl(0.12, 0.12, 0.34)), glossy(c), 0.09, 0.27, 0)
    add(lieDown(cyl(0.125, 0.125, 0.03)), gold, 0.0, 0.27, 0)
    add(lieDown(cyl(0.125, 0.125, 0.03)), gold, 0.18, 0.27, 0)
    add(box(0.2, 0.26, 0.34, 0.05), glossy(darker(c, 0.3)), -0.16, 0.34, 0)
    add(box(0.22, 0.04, 0.38, 0.02), glossy('#374151'), -0.16, 0.48, 0)
    add(box(0.012, 0.09, 0.2, 0.004), glass, -0.06, 0.38, 0)
    for (const z of [-0.172, 0.172]) add(box(0.2, 0.09, 0.012, 0.004), glass, -0.16, 0.38, z)
    add(cyl(0.035, 0.05, 0.14), glossy('#1f2937'), 0.17, 0.46, 0)
    add(cyl(0.06, 0.04, 0.03), gold, 0.17, 0.54, 0)
    add(new THREE.SphereGeometry(0.05, 20, 14), gold, 0.04, 0.39, 0)
    add(new THREE.SphereGeometry(0.055, 20, 16), new THREE.MeshBasicMaterial({ color: '#fef3c7' }), 0.285, 0.28, 0)
    add(lieDown(cyl(0.065, 0.065, 0.02)), gold, 0.27, 0.28, 0)
    add(box(0.06, 0.05, 0.3, 0.02), glossy('#374151'), 0.3, 0.14, 0)
  } else {
    add(box(0.52, 0.24, 0.34, 0.07), glossy(c), 0, 0.26, 0)
    add(box(0.53, 0.035, 0.345, 0.012), gold, 0, 0.3, 0) // liseré doré
    add(box(0.5, 0.05, 0.32, 0.025), glossy(lighter(c, 0.3)), 0, 0.4, 0) // toit
    // chargement ou fenêtres selon le wagon (même suite que le train vu du dessus : TrainCar.vue)
    const kind = (i - 1) % 3
    if (kind === 0) for (const [x, z] of [[-0.12, -0.06], [0.1, 0.05], [-0.02, 0.07]]) add(box(0.14, 0.1, 0.14, 0.02), glossy('#a16207'), x!, 0.47, z!)
    else if (kind === 1) for (const z of [-0.18, 0.18]) for (const x of [-0.14, 0, 0.14]) add(box(0.1, 0.09, 0.012, 0.004), glass, x, 0.27, z)
    else for (const x of [-0.12, 0.12]) add(new THREE.SphereGeometry(0.09, 20, 14), glossy('#374151'), x, 0.45, 0)
  }
  for (const x of [-0.16, 0.16]) for (const z of [-0.18, 0.18]) {
    add(new THREE.CylinderGeometry(0.085, 0.085, 0.04, 28).rotateX(Math.PI / 2), glossy('#111827'), x, 0.09, z)
    add(new THREE.CylinderGeometry(0.04, 0.04, 0.046, 20).rotateX(Math.PI / 2), gold, x, 0.09, z)
  }
  return g
}

/** Trois ronds de fumée au-dessus de la cheminée (images fixes). */
export function makeSmoke(): THREE.Group {
  const g = new THREE.Group()
  ;[[0.17, 0.66, 0.05], [0.12, 0.78, 0.07], [0.05, 0.92, 0.09]].forEach(([x, y, r]) => {
    const o = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, transparent: true, opacity: 0.85 }))
    o.position.set(x!, y!, 0)
    g.add(o)
  })
  return g
}

/** Fumée de la locomotive pendant le trajet : des bouffées sortent de la cheminée, montent, grossissent, traînent en arrière et
 *  s'effacent. Un petit lot de boules réutilisées (rien n'est créé pendant la marche). `update` à chaque image, avec la cheminée
 *  en coordonnées du monde ; `on` faux : plus de nouvelles bouffées, les dernières finissent de se dissiper. */
export function makeSteam(): { group: THREE.Group; update(dt: number, from: THREE.Vector3, on: boolean): void; dispose(): void } {
  const group = new THREE.Group()
  const geo = new THREE.SphereGeometry(1, 14, 10)
  const LIFE = 1.5 // s
  const EVERY = 0.16 // s entre deux bouffées
  const puffs = Array.from({ length: Math.ceil(LIFE / EVERY) + 1 }, () => {
    const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, transparent: true, opacity: 0, depthWrite: false })
    const m = new THREE.Mesh(geo, mat)
    m.visible = false
    group.add(m)
    return { m, mat, age: LIFE, drift: new THREE.Vector3() }
  })
  const last = new THREE.Vector3()
  let wait = 0
  let next = 0
  let seed = 1
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  return {
    group,
    update(dt, from, on) {
      // le train avance : la fumée part vers l'arrière (sens inverse de la marche), un peu au hasard
      const back = from.clone().sub(last)
      const moving = back.lengthSq() > 1e-8 && back.lengthSq() < 1
      last.copy(from)
      wait -= dt
      if (on && wait <= 0) {
        wait = EVERY
        const p = puffs[next++ % puffs.length]!
        p.age = 0
        p.m.position.copy(from)
        p.drift.set((rnd() - 0.5) * 0.12, 0.42 + rnd() * 0.12, (rnd() - 0.5) * 0.12)
        if (moving && dt > 0) p.drift.addScaledVector(back.normalize(), -0.25)
        p.m.visible = true
      }
      for (const p of puffs) {
        if (p.age >= LIFE) continue
        p.age += dt
        const u = Math.min(1, p.age / LIFE)
        p.m.position.addScaledVector(p.drift, dt)
        p.m.scale.setScalar(0.06 + 0.19 * Math.sqrt(u))
        p.mat.opacity = 0.92 * (1 - u * u) * Math.min(1, p.age / 0.12)
        if (p.age >= LIFE) p.m.visible = false
      }
    },
    dispose() {
      geo.dispose()
      puffs.forEach((p) => p.mat.dispose())
    },
  }
}

/** Haut de la cheminée de la locomotive, dans son repère (voir makeCar). */
export const CHIMNEY = new THREE.Vector3(0.17, 0.56, 0)
