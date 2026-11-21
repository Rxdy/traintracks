// Le train du jeu en 3D : locomotive à vapeur + wagons, coins arrondis, surfaces vernies, détails dorés.
// Même modèle sur l'accueil (home.ts) et dans les images fixes (dev/renderArt.ts : icône, carte « Niveau »).
// Couleurs et écart entre wagons : src/trainStyle.ts. Le train avance vers +x ; pieds sur y = 0.
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { LOCO_COLOR, starterStyle, type WagonStyle } from '../trainStyle'

const lighter = (c: string, a: number): string => '#' + new THREE.Color(c).lerp(new THREE.Color('#ffffff'), a).getHexString()
const darker = (c: string, a: number): string => '#' + new THREE.Color(c).lerp(new THREE.Color('#000000'), a).getHexString()

/** La voiture n° i du train de départ : 0 = locomotive, 1.. = wagons (caisses, fenêtres, charbon). */
export function makeCar(i: number): THREE.Group {
  return i === 0 ? build(null) : build(starterStyle(i))
}
/** Un wagon de la collection : coloris et accessoire. */
export const makeWagon = (style: WagonStyle): THREE.Group => build(style)

function build(style: WagonStyle | null): THREE.Group {
  const g = new THREE.Group()
  const i = style ? 1 : 0
  const c = style ? style.color : LOCO_COLOR
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
    wagonBody(style!.kind, c, { add, box, cyl, glossy, gold, glass })
  }
  for (const x of [-0.16, 0.16]) for (const z of [-0.18, 0.18]) {
    add(new THREE.CylinderGeometry(0.085, 0.085, 0.04, 28).rotateX(Math.PI / 2), glossy('#111827'), x, 0.09, z)
    add(new THREE.CylinderGeometry(0.04, 0.04, 0.046, 20).rotateX(Math.PI / 2), gold, x, 0.09, z)
  }
  return g
}

type Kit = {
  add: (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => void
  box: (w: number, h: number, d: number, r?: number) => THREE.BufferGeometry
  cyl: (rt: number, rb: number, h: number) => THREE.BufferGeometry
  glossy: (col: string) => THREE.Material
  gold: THREE.Material
  glass: THREE.Material
}
const ROOF = 0.425 // dessus du toit du wagon
const SIDE = 0.172 // flanc du wagon (z), pour y poser portes et fenêtres

// La caisse du wagon selon son type : de vrais wagons de chemin de fer, le détail fait partie du wagon
// (portes, vigie, ridelles, trémies…), rien de posé au hasard sur le toit.
function wagonBody(kind: WagonStyle['kind'], c: string, { add, box, cyl, glossy, gold, glass }: Kit): void {
  const paint = glossy(c), dark = glossy(darker(c, 0.35)), light = glossy(lighter(c, 0.3))
  const wood = glossy('#8a5a2b')
  const sides = (f: (z: number, s: number) => void) => { for (const z of [-SIDE, SIDE]) f(z, Math.sign(z)) }
  const caisse = (h = 0.24, y = 0.26) => add(box(0.52, h, 0.34, 0.07), paint, 0, y, 0)
  const liser = (y = 0.3) => add(box(0.53, 0.035, 0.345, 0.012), gold, 0, y, 0)
  const toit = () => add(box(0.5, 0.05, 0.32, 0.025), light, 0, 0.4, 0)
  const win = (x: number, y: number, w: number, h: number) => sides((z) => add(box(w, h, 0.012, 0.004), glass, x, y, z))
  const door = (x: number, w = 0.15) => sides((z) => {
    add(box(w, 0.19, 0.012, 0.01), dark, x, 0.255, z)
    add(box(0.012, 0.05, 0.016, 0.004), gold, x + w / 2 - 0.025, 0.25, z) // poignée
  })
  switch (kind) {
    case 'baggage': // fourgon à bagages : porte coulissante, petites fenêtres hautes, galerie de toit avec deux malles
      caisse(); liser(); toit()
      door(0)
      sides((z) => add(box(0.3, 0.012, 0.016, 0.004), gold, 0, 0.355, z)) // rail de la porte
      win(-0.18, 0.32, 0.06, 0.05); win(0.18, 0.32, 0.06, 0.05)
      for (const x of [-0.2, 0.2]) for (const z of [-0.12, 0.12]) add(cyl(0.006, 0.006, 0.05), gold, x, ROOF + 0.025, z)
      for (const z of [-0.12, 0.12]) add(box(0.42, 0.012, 0.012, 0.004), gold, 0, ROOF + 0.05, z)
      add(box(0.15, 0.07, 0.11, 0.02), glossy('#7c4a21'), -0.08, ROOF + 0.035, 0)
      add(box(0.12, 0.06, 0.1, 0.02), glossy('#1f2937'), 0.1, ROOF + 0.03, 0)
      for (const x of [-0.11, -0.05]) add(box(0.012, 0.075, 0.115, 0.004), gold, x, ROOF + 0.036, 0) // sangles
      break
    case 'coach': // voiture de voyageurs : fenêtres, portes aux bouts, lanterneau sur le toit
      caisse(); liser(); toit()
      for (const x of [-0.12, 0, 0.12]) win(x, 0.27, 0.09, 0.09)
      for (const x of [-0.225, 0.225]) sides((z) => add(box(0.045, 0.19, 0.012, 0.006), dark, x, 0.255, z))
      add(box(0.34, 0.035, 0.12, 0.015), light, 0, ROOF + 0.015, 0)
      for (const x of [-0.12, 0, 0.12]) add(box(0.05, 0.02, 0.122, 0.004), glass, x, ROOF + 0.018, 0)
      break
    case 'gondola': { // tombereau : caisse ouverte à ridelles, chargée de charbon
      caisse(0.2, 0.24); liser(0.3)
      for (const x of [-0.17, -0.06, 0.06, 0.17]) sides((z) => add(box(0.018, 0.2, 0.014, 0.004), dark, x, 0.24, z))
      add(box(0.48, 0.03, 0.3, 0.012), glossy('#111827'), 0, 0.345, 0)
      const coal = glossy('#1f2937')
      for (const [x, z, r] of [[-0.14, -0.05, 0.09], [0, 0.04, 0.1], [0.14, -0.03, 0.09], [-0.05, -0.08, 0.07], [0.08, 0.09, 0.07]] as const) {
        const m = new THREE.DodecahedronGeometry(r, 0).scale(1, 0.45, 1)
        add(m, coal, x, 0.35, z)
      }
      break
    }
    case 'sleeper': // voiture-lits : rangée de petites fenêtres, aérateurs sur le toit
      caisse(); liser(); toit()
      for (const x of [-0.18, -0.06, 0.06, 0.18]) win(x, 0.3, 0.07, 0.06)
      for (const x of [-0.15, 0, 0.15]) add(cyl(0.02, 0.026, 0.035), glossy('#374151'), x, ROOF + 0.017, 0)
      break
    case 'panorama': // voiture panoramique : bas peint, haut et toit vitrés
      add(box(0.52, 0.14, 0.34, 0.06), paint, 0, 0.21, 0); liser(0.27)
      add(box(0.5, 0.12, 0.32, 0.05), glass, 0, 0.34, 0)
      for (const x of [-0.245, -0.08, 0.08, 0.245]) sides((z) => add(box(0.02, 0.12, 0.014, 0.004), paint, x, 0.34, z))
      add(box(0.5, 0.02, 0.32, 0.01), paint, 0, 0.405, 0)
      break
    case 'dining': // voiture-restaurant : grandes baies cerclées de laiton, tuyau de la cuisine
      caisse(); liser(); toit()
      for (const x of [-0.11, 0.11]) {
        sides((z) => add(box(0.18, 0.1, 0.011, 0.006), gold, x, 0.29, z))
        win(x, 0.29, 0.16, 0.085)
      }
      add(cyl(0.022, 0.022, 0.08), glossy('#374151'), -0.19, ROOF + 0.04, 0.06)
      add(cyl(0.035, 0.025, 0.02), gold, -0.19, ROOF + 0.085, 0.06)
      break
    case 'mail': // wagon postal : caisse fermée, fente à lettres et écusson doré
      caisse(); liser(0.22); toit()
      win(-0.17, 0.32, 0.07, 0.05)
      sides((z, sg) => {
        add(box(0.09, 0.03, 0.012, 0.006), gold, 0.08, 0.3, z)
        add(box(0.07, 0.012, 0.014, 0.003), glossy('#111827'), 0.08, 0.3, z)
        add(new THREE.CylinderGeometry(0.035, 0.035, 0.012, 24).rotateX(Math.PI / 2), gold, -0.05, 0.3, z + sg * 0.002)
      })
      door(0.19, 0.08)
      break
    case 'reefer': // wagon frigorifique : portes isolées à ferrures, trappes à glace sur le toit
      caisse(); liser(0.2); toit()
      sides((z) => {
        add(box(0.18, 0.18, 0.012, 0.01), light, 0, 0.27, z)
        for (const y of [0.21, 0.33]) add(box(0.2, 0.014, 0.016, 0.004), gold, 0, y, z)
      })
      for (const x of [-0.19, 0.19]) for (const z of [-0.08, 0.08]) add(box(0.07, 0.02, 0.07, 0.008), glossy('#e5e7eb'), x, ROOF + 0.01, z)
      break
    case 'caboose': // fourgon de queue : vigie vitrée sur le toit, lanterne rouge à l'arrière
      caisse(); liser(); toit()
      win(-0.15, 0.3, 0.07, 0.06); win(0.15, 0.3, 0.07, 0.06)
      add(box(0.16, 0.1, 0.26, 0.03), paint, 0, ROOF + 0.05, 0)
      add(box(0.12, 0.05, 0.262, 0.01), glass, 0, ROOF + 0.06, 0)
      add(box(0.18, 0.025, 0.28, 0.01), light, 0, ROOF + 0.11, 0)
      add(new THREE.SphereGeometry(0.03, 16, 12), new THREE.MeshBasicMaterial({ color: '#ef4444' }), -0.29, 0.34, 0.12)
      add(cyl(0.035, 0.035, 0.012), gold, -0.29, 0.31, 0.12)
      break
    case 'cattle': // wagon à bestiaux : flancs à claire-voie
      add(box(0.5, 0.22, 0.31, 0.05), glossy('#2b1d10'), 0, 0.26, 0)
      for (const y of [0.17, 0.23, 0.29, 0.35]) add(box(0.52, 0.035, 0.34, 0.012), paint, 0, y, 0)
      for (const x of [-0.25, 0, 0.25]) add(box(0.03, 0.24, 0.345, 0.01), dark, x, 0.26, 0)
      toit()
      break
    case 'boxcar': // wagon couvert : nervures, porte coulissante, passerelle sur le toit
      caisse(); toit()
      for (const x of [-0.21, -0.15, 0.15, 0.21]) sides((z) => add(box(0.012, 0.22, 0.014, 0.003), light, x, 0.26, z))
      door(0, 0.17)
      sides((z) => add(box(0.34, 0.012, 0.016, 0.004), gold, 0, 0.36, z))
      add(box(0.46, 0.012, 0.07, 0.004), wood, 0, ROOF + 0.006, 0)
      break
    case 'hopper': { // trémie à céréales : caisse haute, entonnoirs dessous, trappes de chargement dessus
      add(box(0.52, 0.16, 0.34, 0.05), paint, 0, 0.31, 0); liser(0.3)
      for (const sg of [-1, 1]) add(new THREE.CylinderGeometry(0.15, 0.05, 0.1, 4, 1).rotateY(Math.PI / 4).scale(0.9, 1, 1.4), paint, sg * 0.12, 0.18, 0)
      for (const x of [-0.16, 0, 0.16]) add(box(0.09, 0.02, 0.13, 0.008), dark, x, 0.4, 0)
      for (const x of [-0.24, 0.24]) sides((z) => add(box(0.02, 0.16, 0.014, 0.004), dark, x, 0.31, z))
      break
    }
  }
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
