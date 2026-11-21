// Le train du jeu en 3D : locomotive à vapeur + wagons, coins arrondis, surfaces vernies, détails dorés.
// Même modèle sur l'accueil (home.ts) et dans les images fixes (dev/renderArt.ts : icône, carte « Niveau »).
// Couleurs et écart entre wagons : src/trainStyle.ts. Le train avance vers +x ; pieds sur y = 0.
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { CAR_SPACING, LOCO_COLOR, starterStyle, type WagonStyle } from '../trainStyle'

const lighter = (c: string, a: number): string => '#' + new THREE.Color(c).lerp(new THREE.Color('#ffffff'), a).getHexString()
const darker = (c: string, a: number): string => '#' + new THREE.Color(c).lerp(new THREE.Color('#000000'), a).getHexString()

/** La voiture n° i du train de départ : 0 = locomotive, 1.. = wagons (caisses, fenêtres, charbon). */
export function makeCar(i: number): THREE.Group {
  return i === 0 ? build(null) : build(starterStyle(i))
}
/** Un wagon de la collection (type et coloris ; les wagons de fret sont plus longs). */
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
  // un wagon long (fret) s'allonge de la différence avec un wagon court ; tout le reste garde sa taille
  const extra = style ? (style.length - 1) * CAR_SPACING : 0
  const chassis = 0.58 + extra
  // châssis sombre sous la caisse, tampons aux deux bouts
  add(box(chassis, 0.05, 0.3, 0.02), glossy('#374151'), 0, 0.12, 0)
  for (const x of [-chassis / 2 - 0.01, chassis / 2 + 0.01]) for (const z of [-0.09, 0.09]) add(lieDown(cyl(0.025, 0.025, 0.04)), gold, x, 0.13, z)
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
  } else if (style!.family === 'fret') {
    freightBody(style!.kind, c, 0.52 + extra, { add, box, cyl, glossy, gold, glass })
  } else {
    wagonBody(style!.kind, c, { add, box, cyl, glossy, gold, glass })
  }
  // roues : deux essieux pour un wagon court, deux bogies de deux essieux pour un wagon long
  const wheel = (x: number, r: number) => {
    for (const z of [-0.18, 0.18]) {
      add(new THREE.CylinderGeometry(r, r, 0.04, 28).rotateX(Math.PI / 2), glossy('#111827'), x, r, z)
      add(new THREE.CylinderGeometry(r * 0.47, r * 0.47, 0.046, 20).rotateX(Math.PI / 2), gold, x, r, z)
    }
  }
  if (extra > 0) {
    for (const b of [-1, 1]) {
      const cx = b * (chassis / 2 - 0.16)
      add(box(0.26, 0.04, 0.32, 0.015), glossy('#1f2937'), cx, 0.085, 0)
      for (const dx of [-0.075, 0.075]) wheel(cx + dx, 0.065)
    }
  } else for (const x of [-0.16, 0.16]) wheel(x, 0.085)
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
    case 'hopper': { // trémie à céréales : caisse haute aux bouts en pente, goulottes de vidange dessous, trappes et passerelle dessus
      const prof = new THREE.Shape()
      prof.moveTo(-0.1, 0.15)
      prof.lineTo(0.1, 0.15)
      prof.lineTo(0.26, 0.3)
      prof.lineTo(0.26, 0.43)
      prof.quadraticCurveTo(0, 0.46, -0.26, 0.43)
      prof.lineTo(-0.26, 0.3)
      prof.closePath()
      const body = new THREE.ExtrudeGeometry(prof, { depth: 0.31, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 3 })
      body.translate(0, 0, -0.155)
      add(body, paint, 0, 0, 0)
      sides((z) => {
        for (const x of [-0.17, -0.06, 0.06, 0.17]) add(box(0.016, 0.12, 0.012, 0.004), dark, x, 0.37, z + Math.sign(z) * 0.0)
        add(box(0.52, 0.02, 0.014, 0.006), gold, 0, 0.31, z)
      })
      for (const x of [-0.07, 0.07]) {
        add(box(0.07, 0.05, 0.16, 0.012), dark, x, 0.13, 0) // goulotte
        add(box(0.08, 0.012, 0.17, 0.004), gold, x, 0.105, 0)
      }
      add(box(0.46, 0.012, 0.07, 0.004), glossy('#8a5a2b'), 0, 0.465, 0) // passerelle
      for (const x of [-0.16, 0, 0.16]) for (const z of [-0.09, 0.09]) add(cyl(0.032, 0.032, 0.018), dark, x, 0.455, z) // trappes rondes
      for (let k = 0; k < 4; k++) add(box(0.012, 0.012, 0.06, 0.003), gold, -0.285, 0.18 + k * 0.07, 0.1) // échelle au bout
      add(box(0.012, 0.28, 0.012, 0.003), gold, -0.285, 0.29, 0.07)
      add(box(0.012, 0.28, 0.012, 0.003), gold, -0.285, 0.29, 0.13)
      break
    }
  }
}

// Les wagons de fret : un plateau (ou une citerne) long, et un chargement qu'on reconnaît de loin.
function freightBody(kind: WagonStyle['kind'], c: string, len: number, { add, box, cyl, glossy, gold, glass }: Kit): void {
  const paint = glossy(c), dark = glossy(darker(c, 0.35))
  const half = len / 2
  const deck = (col = c) => add(box(len, 0.05, 0.34, 0.015), glossy(col), 0, 0.17, 0) // plancher, dessus à 0,195
  const TOP = 0.195
  const lieX = (geo: THREE.BufferGeometry) => geo.rotateZ(Math.PI / 2) // couché dans le sens du wagon
  const stakes = (h: number, n: number) => {
    for (let k = 0; k < n; k++) {
      const x = -half + 0.05 + (k * (len - 0.1)) / (n - 1)
      for (const z of [-0.16, 0.16]) add(box(0.022, h, 0.022, 0.006), glossy('#1f2937'), x, TOP + h / 2, z)
    }
  }
  switch (kind) {
    case 'flat': // wagon plat : rien dessus, un plancher de bois et ses ranchers
      deck(c)
      add(box(len - 0.04, 0.012, 0.3, 0.004), glossy('#a16207'), 0, TOP + 0.006, 0)
      for (let k = 0; k < Math.round(len / 0.08); k++) add(box(0.004, 0.013, 0.3, 0.001), glossy('#7c4a21'), -half + 0.04 + k * 0.08, TOP + 0.007, 0)
      stakes(0.04, 5)
      break
    case 'logs': { // grumes : troncs empilés entre des ranchers
      deck(c)
      stakes(0.2, 5)
      const bark = glossy('#6b4423'), cut = glossy('#e6c38f')
      const L = len - 0.06
      for (const [z, y] of [[-0.1, 0], [0, 0], [0.1, 0], [-0.05, 1], [0.05, 1], [0, 2]] as const) {
        const yy = TOP + 0.05 + y * 0.085
        add(lieX(new THREE.CylinderGeometry(0.05, 0.05, L, 14)), bark, 0, yy, z)
        for (const sx of [-1, 1]) add(lieX(new THREE.CylinderGeometry(0.044, 0.044, 0.006, 14)), cut, sx * (L / 2 + 0.002), yy, z)
      }
      break
    }
    case 'autos': { // porte-autos : deux étages de voitures
      deck(c)
      const upper = TOP + 0.17
      for (let k = 0; k < 4; k++) for (const z of [-0.16, 0.16]) add(box(0.02, 0.17, 0.02, 0.005), paint, -half + 0.05 + (k * (len - 0.1)) / 3, TOP + 0.085, z)
      add(box(len, 0.025, 0.34, 0.008), paint, 0, upper, 0)
      const colors = ['#ef4444', '#fbbf24', '#f8fafc', '#22c55e']
      let n = 0
      for (const y of [TOP, upper + 0.0125]) for (const x of [-len / 4, len / 4]) car(x, y, colors[n++ % colors.length]!)
      break
    }
    case 'boat': { // un bateau à moteur sur ses berceaux : coque effilée, pont en bois, cabine vitrée
      deck(c)
      for (const x of [-0.26, 0.22]) {
        add(box(0.05, 0.05, 0.3, 0.01), glossy('#1f2937'), x, TOP + 0.025, 0)
        for (const z of [-0.1, 0.1]) add(box(0.04, 0.06, 0.03, 0.008), glossy('#1f2937'), x, TOP + 0.06, z)
      }
      // la coque, vue du dessus : arrière carré, avant en pointe ; montée en hauteur, bords arrondis
      const plan = (k: number) => {
        const sh = new THREE.Shape()
        sh.moveTo(-0.42 * k, -0.12 * k)
        sh.lineTo(0.12 * k, -0.125 * k)
        sh.quadraticCurveTo(0.36 * k, -0.11 * k, 0.48 * k, 0)
        sh.quadraticCurveTo(0.36 * k, 0.11 * k, 0.12 * k, 0.125 * k)
        sh.lineTo(-0.42 * k, 0.12 * k)
        sh.closePath()
        return sh
      }
      const lift = (geo: THREE.BufferGeometry, y: number) => geo.rotateX(Math.PI / 2).translate(0, y, 0)
      const hullB = TOP + 0.07
      add(lift(new THREE.ExtrudeGeometry(plan(0.86), { depth: 0.05, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 4 }), hullB + 0.05), glossy('#1d4ed8'), 0, 0, 0)
      add(lift(new THREE.ExtrudeGeometry(plan(1), { depth: 0.07, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 3 }), hullB + 0.13), glossy('#f8fafc'), 0, 0, 0)
      add(lift(new THREE.ExtrudeGeometry(plan(0.9), { depth: 0.012, bevelEnabled: false }), hullB + 0.157), glossy('#b7834a'), 0, 0, 0) // le pont
      add(box(0.26, 0.1, 0.17, 0.035), glossy('#f8fafc'), -0.12, hullB + 0.21, 0) // la cabine
      add(box(0.2, 0.045, 0.175, 0.012), glass, -0.12, hullB + 0.215, 0)
      add(box(0.02, 0.07, 0.19, 0.008).rotateZ(-0.5), glass, 0.04, hullB + 0.2, 0) // le pare-brise
      add(cyl(0.008, 0.008, 0.16), glossy('#e5e7eb'), -0.16, hullB + 0.33, 0) // l'antenne
      add(box(0.07, 0.1, 0.07, 0.015), glossy('#374151'), -0.43, hullB + 0.09, 0) // le moteur hors-bord
      add(box(0.02, 0.08, 0.02, 0.004), glossy('#374151'), -0.45, hullB + 0.01, 0)
      for (const z of [-0.1, 0.1]) add(lieX(cyl(0.006, 0.006, 0.5)), gold, 0.04, hullB + 0.19, z) // la main courante
      break
    }
    case 'tank': { // wagon-citerne : une cuve couchée, ses cerclages, son dôme et son échelle
      add(box(len, 0.04, 0.3, 0.012), glossy('#374151'), 0, 0.165, 0)
      const r = 0.15, y = TOP + r - 0.01
      add(lieX(new THREE.CylinderGeometry(r, r, len - 0.16, 28)), paint, 0, y, 0)
      for (const sx of [-1, 1]) add(new THREE.SphereGeometry(r, 28, 16).scale(0.55, 1, 1), paint, sx * (len / 2 - 0.08), y, 0)
      for (const x of [-len / 4, len / 4]) add(lieX(new THREE.CylinderGeometry(r + 0.006, r + 0.006, 0.02, 28)), gold, x, y, 0)
      add(cyl(0.06, 0.06, 0.05), dark, 0, y + r + 0.015, 0)
      add(cyl(0.065, 0.065, 0.012), gold, 0, y + r + 0.04, 0)
      for (const z of [-0.035, 0.035]) add(box(0.01, 0.2, 0.01, 0.003), gold, 0.08, y + 0.04, SIDE + z * 0 + (z > 0 ? 0 : -0.012))
      add(box(0.04, 0.03, 0.02, 0.006), glossy('#1f2937'), 0, 0.14, SIDE) // la vanne
      break
    }
    case 'containers': { // porte-conteneurs : deux conteneurs nervurés
      deck('#374151')
      const cols = [c, '#1d4ed8']
      const w = (len - 0.08) / 2
      cols.forEach((col, k) => {
        const x = (k ? 1 : -1) * (w / 2 + 0.02)
        add(box(w, 0.24, 0.3, 0.015), glossy(col), x, TOP + 0.12, 0)
        for (let r = 0; r < 7; r++) for (const z of [-0.152, 0.152]) add(box(0.012, 0.22, 0.006, 0.002), glossy(darker(col, 0.25)), x - w / 2 + 0.05 + (r * (w - 0.1)) / 6, TOP + 0.12, z)
        for (const sx of [-1, 1]) add(box(0.006, 0.2, 0.26, 0.002), glossy(darker(col, 0.3)), x + sx * (w / 2 + 0.001), TOP + 0.12, 0)
      })
      break
    }
    case 'livestock': { // wagon à animaux : ridelles basses à claire-voie, des vaches qui regardent le paysage
      deck(c)
      for (const y of [0.05, 0.1]) for (const z of [-0.16, 0.16]) add(box(len, 0.025, 0.018, 0.006), paint, 0, TOP + y, z)
      for (const sx of [-1, 1]) add(box(0.018, 0.12, 0.34, 0.006), paint, sx * (half - 0.01), TOP + 0.06, 0)
      stakes(0.12, 5)
      const cows: [number, number, number][] = [[-len / 3, 0.05, 0], [0, -0.05, 1], [len / 3, 0.04, 0]]
      for (const [x, z, flip] of cows) cow(x, z, flip ? -1 : 1)
      break
    }
    case 'sheep': { // wagon à bétail : des moutons serrés derrière la claire-voie
      deck(c)
      for (const y of [0.05, 0.1]) for (const z of [-0.16, 0.16]) add(box(len, 0.025, 0.018, 0.006), paint, 0, TOP + y, z)
      for (const sx of [-1, 1]) add(box(0.018, 0.12, 0.34, 0.006), paint, sx * (half - 0.01), TOP + 0.06, 0)
      stakes(0.12, 4)
      const n = 5
      for (let k = 0; k < n; k++) sheep(-half + 0.11 + (k * (len - 0.22)) / (n - 1), k % 2 ? 0.06 : -0.06, k % 2 ? -1 : 1)
      break
    }
    case 'elephant': { // wagon de cirque fermé : deux éléphants passent la tête par les fenêtres pour prendre l'air
      const red = paint, cream = glossy('#fde68a')
      add(box(len, 0.27, 0.34, 0.05), red, 0, 0.33, 0)
      add(box(len + 0.01, 0.03, 0.345, 0.01), gold, 0, 0.215, 0) // liseré bas
      add(box(len + 0.01, 0.03, 0.345, 0.01), gold, 0, 0.45, 0) // liseré haut
      add(box(len - 0.02, 0.05, 0.36, 0.025), glossy(lighter(c, 0.25)), 0, 0.48, 0) // le toit
      add(box(len - 0.12, 0.035, 0.22, 0.017), glossy(lighter(c, 0.4)), 0, 0.515, 0) // le lanterneau
      for (let k = 0; k < 6; k++) add(new THREE.SphereGeometry(0.018, 10, 8), cream, -half + 0.1 + (k * (len - 0.2)) / 5, 0.545, 0) // ampoules du toit
      const head = (x: number, side: 1 | -1) => {
        const z = side * SIDE
        add(box(0.2, 0.15, 0.012, 0.03), glossy('#1f2937'), x, 0.34, z) // la fenêtre (le noir de l'intérieur)
        add(box(0.22, 0.17, 0.008, 0.03), gold, x, 0.34, z - side * 0.002)
        const skin = glossy('#9ca3af'), dk = glossy('#6b7280'), white = glossy('#f8fafc')
        const hz = z + side * 0.06
        add(new THREE.SphereGeometry(0.085, 18, 14), skin, x, 0.37, hz) // la tête
        for (const dx of [-0.09, 0.09]) add(new THREE.SphereGeometry(0.07, 14, 10).scale(1, 1.1, 0.3), dk, x + dx, 0.37, hz - side * 0.02) // les oreilles
        add(new THREE.CylinderGeometry(0.022, 0.035, 0.16, 12).rotateX(side * 0.5), skin, x, 0.28, hz + side * 0.06) // la trompe, qui pend
        for (const dx of [-0.035, 0.035]) add(new THREE.ConeGeometry(0.01, 0.05, 8).rotateX(side * (Math.PI / 2 + 0.3)), white, x + dx, 0.33, hz + side * 0.07) // les défenses
        for (const dx of [-0.035, 0.035]) add(new THREE.SphereGeometry(0.012, 8, 6), glossy('#111827'), x + dx, 0.41, hz + side * 0.075) // les yeux
      }
      head(len / 4, 1)
      head(-len / 4, -1)
      // deux fenêtres fermées de l'autre côté, avec des étoiles de cirque
      for (const [x, sd] of [[-len / 4, 1], [len / 4, -1]] as const) {
        add(box(0.2, 0.15, 0.012, 0.03), cream, x, 0.34, sd * SIDE)
        add(new THREE.CylinderGeometry(0.04, 0.04, 0.014, 5).rotateX(Math.PI / 2), gold, x, 0.34, sd * (SIDE + 0.006))
      }
      break
    }
    case 'pipes': { // tuyaux : un fagot de gros tuyaux entre des ranchers
      deck(c)
      stakes(0.18, 5)
      const steel = glossy('#94a3b8'), hole = new THREE.MeshBasicMaterial({ color: '#1f2937' })
      const L = len - 0.04
      for (const [z, y] of [[-0.105, 0], [0, 0], [0.105, 0], [-0.052, 1], [0.052, 1]] as const) {
        const yy = TOP + 0.052 + y * 0.09
        add(lieX(new THREE.CylinderGeometry(0.052, 0.052, L, 18)), steel, 0, yy, z)
        for (const sx of [-1, 1]) add(lieX(new THREE.CylinderGeometry(0.036, 0.036, 0.004, 18)), hole, sx * (L / 2 + 0.002), yy, z)
      }
      for (const x of [-len / 4, len / 4]) add(box(0.015, 0.2, 0.33, 0.004), glossy('#f59e0b'), x, TOP + 0.1, 0) // sangles
      break
    }
  }

  function car(x: number, y: number, col: string): void {
    add(box(0.36, 0.07, 0.2, 0.03), glossy(col), x, y + 0.055, 0)
    add(box(0.18, 0.06, 0.18, 0.03), glossy(col), x - 0.02, y + 0.11, 0)
    add(box(0.185, 0.04, 0.182, 0.01), glass, x - 0.02, y + 0.112, 0)
    for (const dx of [-0.11, 0.11]) for (const z of [-0.09, 0.09]) add(new THREE.CylinderGeometry(0.03, 0.03, 0.025, 14).rotateX(Math.PI / 2), glossy('#111827'), x + dx, y + 0.03, z)
  }
  function sheep(x: number, z: number, dir: number): void {
    const wool = glossy('#f5f5f4'), face = glossy('#292524')
    const y = TOP + 0.085
    add(new THREE.SphereGeometry(0.065, 16, 12).scale(1.35, 0.95, 1), wool, x, y, z)
    for (const [dx, dy] of [[-0.05, 0.03], [0.03, 0.04], [0, -0.01]]) add(new THREE.SphereGeometry(0.04, 12, 10), wool, x + dx! * dir, y + dy!, z)
    add(new THREE.SphereGeometry(0.032, 12, 10).scale(1.3, 1, 0.9), face, x + 0.095 * dir, y + 0.02, z)
    for (const dz of [-0.03, 0.03]) add(box(0.02, 0.012, 0.03, 0.004), face, x + 0.085 * dir, y + 0.04, z + dz)
  }
  function cow(x: number, z: number, dir: number): void {
    const white = glossy('#f8fafc'), black = glossy('#1f2937'), pink = glossy('#f9a8d4')
    const y = TOP + 0.1
    add(box(0.2, 0.1, 0.1, 0.035), white, x, y, z)
    add(box(0.07, 0.06, 0.105, 0.02), black, x - 0.03 * dir, y + 0.01, z)
    add(box(0.07, 0.065, 0.07, 0.025), white, x + 0.12 * dir, y + 0.04, z)
    add(box(0.03, 0.035, 0.06, 0.012), pink, x + 0.16 * dir, y + 0.025, z)
    for (const dz of [-0.03, 0.03]) add(cyl(0.008, 0.012, 0.03), glossy('#e5e7eb'), x + 0.12 * dir, y + 0.085, z + dz)
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
