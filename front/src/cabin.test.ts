import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import CabinDash from './components/CabinDash.vue'
import CabinWindshield from './components/CabinWindshield.vue'
import type { Scenery, Tile, TileKind } from './scenery/generate'
import type { LandFrame } from './scenery/motion'
import type { Route } from './trainRoute'

describe('Cabine du conducteur (décor)', () => {
  it('le pupitre est purement décoratif : caché des lecteurs d\'écran, rien de cliquable, aucune animation', () => {
    const w = mount(CabinDash)
    const dessin = w.get('[data-test=cabin-dash]')
    expect(dessin.attributes('aria-hidden')).toBe('true')
    expect(w.findAll('button, a, input, select, textarea')).toHaveLength(0)
    expect(w.html()).not.toMatch(/<animate|animation|@keyframes|<script/i)
    expect(w.get('svg').attributes('viewBox')).toBe('0 0 340 116') // les autres éléments se placent en pourcentages de ce dessin
  })

  it('le pupitre montre les commandes : afficheur, cadrans, arrêt d\'urgence rouge, clavier, matrice de voyants', () => {
    const w = mount(CabinDash)
    expect(w.text()).toBe('2300') // le seul texte : l'afficheur orange
    expect(w.findAll('circle').length).toBeGreaterThan(60) // cadrans, voyants, boutons, haut-parleur
    expect(w.html()).toContain('#dc2626') // le gros bouton rouge
  })

  it('le pare-brise est un décor : la voie, ses traverses et ses signaux, sans texte ni animation', () => {
    const w = mount(CabinWindshield)
    expect(w.get('[data-test=cabin-windshield]').attributes('aria-hidden')).toBe('true')
    expect(w.text()).toBe('')
    expect(w.findAll('line').length).toBeGreaterThanOrEqual(8) // deux rails et six traverses
    expect(w.html()).not.toMatch(/<animate|animation|@keyframes|<script/i)
    expect(w.get('svg').attributes('preserveAspectRatio')).toBe('xMidYMid slice') // il s'étire pour remplir la place libre
  })
})

// Un petit décor et une voie droite vers l'est le long de y = 5,5 ; à droite du train, c'est le sud.
function carte(items: { r: number; c: number; kind: TileKind }[]): { route: Route; scenery: Scenery } {
  const tiles: Tile[][] = Array.from({ length: 14 }, () => Array.from({ length: 14 }, () => ({ kind: 'grass' as TileKind, v: 0 })))
  for (const it of items) tiles[it.r][it.c] = { kind: it.kind, v: 0 }
  const scenery: Scenery = { seed: 1, margin: { x: 0, y: 0, b: 0 }, frame: { k: 1, visibleRows: 14 }, rows: 14, cols: 14, ext: [], road: null, size: 5, theme: 'automne', tiles, water: new Set(), river: null, pond: [], bridges: new Map(), paths: [] }
  const route: Route = { points: [{ x: 0.5, y: 5.5 }, { x: 13.5, y: 5.5 }], cum: [0, 13], length: 13, gridStart: 0, gridEnd: 13 }
  return { route, scenery }
}

describe('Pare-brise : la carte vue de la locomotive', () => {
  it('sans carte (avant la victoire), une voie droite et fixe', () => {
    const w = mount(CabinWindshield, { props: { running: false } })
    expect(w.get('svg').attributes('data-mapped')).toBe('false')
    expect(w.findAll('[data-kind]')).toHaveLength(0)
  })

  it('avec la carte : une maison au sud de la voie est dessinée à droite, un arbre au nord à gauche', () => {
    const w = mount(CabinWindshield, { props: { scene: carte([{ r: 6, c: 5, kind: 'house' }, { r: 4, c: 5, kind: 'tree' }]), progress: 2, running: true } })
    expect(w.get('svg').attributes('data-mapped')).toBe('true')
    const x = (kind: string) => Number(/translate\(([-\d.]+)/.exec(w.get(`[data-kind=${kind}]`).attributes('transform') ?? '')![1])
    expect(x('house')).toBeGreaterThan(170)
    expect(x('tree')).toBeLessThan(170)
  })

  it('nouveau départ (niveau suivant, train relancé) : la caméra est tout de suite dans l\'axe de la voie, elle ne pivote pas', async () => {
    // une voie qui part vers l'est puis tourne vers le sud
    const c = carte([])
    c.route = { points: [{ x: 0.5, y: 5.5 }, { x: 6.5, y: 5.5 }, { x: 6.5, y: 13.5 }], cum: [0, 6, 14], length: 14, gridStart: 0, gridEnd: 14 }
    const w = mount(CabinWindshield, { props: { scene: c, progress: 13, running: true } }) // fin du trajet : cap au sud
    expect(Number(w.get('svg').attributes('data-heading'))).toBeCloseTo(Math.PI / 2, 1)
    await new Promise((r) => setTimeout(r, 30)) // un peu de temps passe, comme entre deux images
    await w.setProps({ progress: 0 }) // le train repart du début
    expect(Number(w.get('svg').attributes('data-heading'))).toBeCloseTo(0, 2) // vers l'est, sans transition
    // même chose avec un nouveau trajet (niveau suivant) alors que la position est restée celle de la fin du précédent
    await w.setProps({ progress: 13 })
    const autre = carte([])
    await new Promise((r) => setTimeout(r, 30))
    await w.setProps({ scene: autre, progress: 13 })
    expect(Number(w.get('svg').attributes('data-heading'))).toBeCloseTo(0, 2)
  })

  it('la vue suit la position du train : la maison grossit et passe à droite, puis disparaît derrière lui', async () => {
    const w = mount(CabinWindshield, { props: { scene: carte([{ r: 6, c: 5, kind: 'house' }]), progress: 2, running: true } })
    const lire = () => {
      const t = w.get('[data-kind=house]').attributes('transform') ?? ''
      const m = /translate\(([-\d.]+) ([-\d.]+)\) scale\(([\d.]+)\)/.exec(t)!
      return { x: Number(m[1]), echelle: Number(m[3]) }
    }
    const loin = lire()
    await w.setProps({ progress: 3.6 })
    const pres = lire()
    expect(pres.echelle).toBeGreaterThan(loin.echelle)
    expect(pres.x).toBeGreaterThan(loin.x)
    await w.setProps({ progress: 6.5 })
    expect(w.find('[data-kind=house]').exists()).toBe(false) // dépassée
  })

  it('les couleurs sont celles du décor du niveau', () => {
    const a = mount(CabinWindshield, { props: { scene: carte([{ r: 4, c: 5, kind: 'tree' }]), progress: 2 } }).html()
    const autre = carte([{ r: 4, c: 5, kind: 'tree' }])
    autre.scenery.theme = 'hiver'
    const b = mount(CabinWindshield, { props: { scene: autre, progress: 2 } }).html()
    expect(b).not.toEqual(a)
  })

  it('c\'est un décor : rien de cliquable, rien de lisible, aucune animation propre', () => {
    const w = mount(CabinWindshield, { props: { scene: carte([{ r: 4, c: 5, kind: 'tree' }]), progress: 2, running: true } })
    expect(w.findAll('button, a, input')).toHaveLength(0)
    expect(w.text()).toBe('')
    expect(w.get('svg').attributes('aria-hidden')).toBe('true')
    expect(w.html()).not.toMatch(/<animate|@keyframes|<script/i)
  })
})

const vide: LandFrame = { cars: [], barrier: 0, lights: false, animals: [], birds: [], flakes: [], leaves: [], embers: [], events: [] }

describe('Pare-brise : voitures, barrières, animaux', () => {
  it('dessine les voitures, les barrières du passage à niveau, les animaux et les oiseaux de la carte', () => {
    const c = carte([])
    c.scenery.road = { axis: 'v', line: 8, crossing: [5, 8] }
    const land: LandFrame = {
      ...vide,
      lights: true,
      cars: [{ id: 1, u: 3, lane: 0.2, dir: 1, kind: 0, color: '#ef4444' }, { id: 2, u: 2, lane: -0.2, dir: -1, kind: 1, color: '#3b82f6' }],
      animals: [{ id: 1, kind: 'deer', x: 6.5, y: 6.55, face: 1, t: 0 }, { id: 2, kind: 'rabbit', x: 6.5, y: 4.4, face: -1, t: 0 }],
      birds: [{ id: 1, x: 6.5, y: 4.5, flap: 0.5, kind: 'gull' }],
    }
    const w = mount(CabinWindshield, { props: { scene: c, land, progress: 3, running: true } })
    expect(w.findAll('[data-live=car]')).toHaveLength(2)
    expect(w.findAll('[data-live=barrier]')).toHaveLength(2)
    expect(w.find('[data-live=deer]').exists()).toBe(true)
    expect(w.find('[data-live=rabbit]').exists()).toBe(true)
    expect(w.find('[data-live=bird]').exists()).toBe(true)
  })

  it('sans image du décor vivant, la carte seule s\'affiche (pas d\'erreur)', () => {
    const w = mount(CabinWindshield, { props: { scene: carte([{ r: 6, c: 5, kind: 'house' }]), land: null, progress: 2 } })
    expect(w.find('[data-kind=house]').exists()).toBe(true)
    expect(w.findAll('[data-live]')).toHaveLength(0)
  })

  it('une voiture qui bouge sur la carte bouge dans la cabine', async () => {
    const c = carte([])
    c.scenery.road = { axis: 'v', line: 8, crossing: [5, 8] }
    const voiture = (u: number): LandFrame => ({ ...vide, cars: [{ id: 1, u, lane: 0.2, dir: 1, kind: 0, color: '#ef4444' }] })
    const w = mount(CabinWindshield, { props: { scene: c, land: voiture(1), progress: 3 } })
    const pos = () => /translate\(([-\d.]+) ([-\d.]+)\)/.exec(w.get('[data-live=car]').attributes('transform') ?? '')!.slice(1).map(Number)
    const avant = pos()
    await w.setProps({ land: voiture(3) })
    expect(pos()).not.toEqual(avant)
  })
})

describe('Pare-brise : la caméra tourne en douceur', () => {
  afterEach(() => vi.useRealTimers())

  it('quand la voie tourne d\'un coup, le cap de la caméra ne suit que doucement (pas plus de 50° par seconde)', async () => {
    vi.useFakeTimers()
    const c = carte([])
    c.route = { points: [{ x: 0.5, y: 5.5 }, { x: 8.5, y: 5.5 }, { x: 8.5, y: 13.5 }], cum: [0, 8, 16], length: 16, gridStart: 0, gridEnd: 16 }
    const w = mount(CabinWindshield, { props: { scene: c, progress: 5 } })
    const cap = () => Number(w.get('svg').attributes('data-heading'))
    expect(cap()).toBeCloseTo(0, 1) // vers l'est
    vi.advanceTimersByTime(33)
    await w.setProps({ progress: 12 }) // d'un coup, la voie va vers le sud (cap 90°)
    expect(cap()).toBeGreaterThan(0)
    expect(cap()).toBeLessThan((50 * Math.PI) / 180 * 0.034) // au plus 50°/s pendant 33 ms
    // au bout d'un moment, la caméra a rattrapé la voie
    for (let i = 0; i < 80; i++) {
      vi.advanceTimersByTime(33)
      await w.setProps({ progress: 12 + (i % 2) * 0.001 })
    }
    expect(cap()).toBeGreaterThan(1.3)
    expect(cap()).toBeLessThan(1.6)
  })
})
