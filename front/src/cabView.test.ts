import { describe, expect, it } from 'vitest'
import { cabView, cameraAt, screenOf, toCamera, VIEW, type CabView, type Live } from './cabView'
import type { Scenery, Tile, TileKind } from './scenery/generate'
import { speedFactor, type Route } from './trainRoute'
import type { LandFrame } from './scenery/motion'

// Un petit décor de 14 × 14 cases, sans marge : la case (r, c) a son centre en (c + 0,5 ; r + 0,5), comme sur la carte.
function decor(items: { r: number; c: number; kind: TileKind; v?: number }[] = [], water: [number, number][] = []): Scenery {
  const tiles: Tile[][] = Array.from({ length: 14 }, () => Array.from({ length: 14 }, () => ({ kind: 'grass' as TileKind, v: 0 })))
  for (const it of items) tiles[it.r][it.c] = { kind: it.kind, v: it.v ?? 0 }
  return {
    seed: 1, margin: { x: 0, y: 0, b: 0 }, frame: { k: 1, visibleRows: 14 }, rows: 14, cols: 14, ext: [], road: null, size: 5, theme: 'plaine',
    tiles, water: new Set(water.map(([r, c]) => `${r},${c}`)), river: null, pond: [], bridges: new Map(), paths: [], props: [], cable: null, tunnels: { entry: null, exit: null },
  }
}
const route = (...pts: [number, number][]): Route => {
  const points = pts.map(([x, y]) => ({ x, y }))
  const cum = [0]
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y))
  return { points, cum, length: cum[cum.length - 1], gridStart: 0, gridEnd: cum[cum.length - 1] }
}
// Le train roule vers l'est (la droite de la carte) le long de y = 5,5. À sa droite, c'est le SUD (les lignes qui suivent).
const droite = route([0.5, 5.5], [13.5, 5.5])

describe('vue de la cabine : projection', () => {
  it('le cap du train est celui de la voie ; la droite du conducteur est le sud quand il va vers l\'est', () => {
    const cam = cameraAt(droite, 2)
    expect(cam.hx).toBeCloseTo(1)
    expect(cam.hy).toBeCloseTo(0)
    expect(toCamera(cam, 6.5, 6.5).l).toBeGreaterThan(0) // plus au sud : à droite
    expect(toCamera(cam, 6.5, 4.5).l).toBeLessThan(0) // plus au nord : à gauche
    expect(toCamera(cam, 6.5, 5.5).f).toBeCloseTo(4) // devant
  })

  it('le cap suit les virages : vers le sud, la droite du conducteur est l\'ouest', () => {
    const virage = route([0.5, 5.5], [8.5, 5.5], [8.5, 13.5])
    const cam = cameraAt(virage, 10) // 2 cases après le virage, en direction du sud
    expect(cam.hx).toBeCloseTo(0)
    expect(cam.hy).toBeCloseTo(1)
    expect(toCamera(cam, 7.5, 12.5).l).toBeGreaterThan(0) // à l'ouest de la voie : à droite
  })
})

describe('vue de la cabine : le décor est celui de la carte', () => {
  it('une maison au sud de la voie est à droite, un arbre au nord est à gauche', () => {
    const v = cabView(decor([{ r: 6, c: 5, kind: 'house' }, { r: 4, c: 5, kind: 'tree' }]), droite, 2)
    const maison = v.sprites.find((s) => s.kind === 'house')!
    const arbre = v.sprites.find((s) => s.kind === 'tree')!
    expect(maison.x).toBeGreaterThan(VIEW.cx)
    expect(arbre.x).toBeLessThan(VIEW.cx)
    expect(maison.l).toBeCloseTo(1)
    expect(arbre.l).toBeCloseTo(-1)
  })

  it('quand le train arrive à la hauteur d\'une maison, elle passe : plus grosse et plus à droite à chaque instant, puis elle sort du champ', () => {
    const d = decor([{ r: 6, c: 5, kind: 'house' }])
    const at = (s: number) => cabView(d, droite, s).sprites.find((x) => x.kind === 'house')
    const [a, b, c] = [at(2), at(3.5), at(4.4)] // 3 cases, 1,5 case puis 0,6 case devant
    expect(a!.f).toBeGreaterThan(b!.f)
    expect(b!.f).toBeGreaterThan(c!.f)
    expect(a!.u).toBeLessThan(b!.u)
    expect(b!.u).toBeLessThan(c!.u)
    expect(a!.x).toBeLessThan(b!.x)
    expect(b!.x).toBeLessThan(c!.x)
    expect(at(6.2)).toBeUndefined() // la maison est derrière le train : elle n'est plus dans le pare-brise
  })

  it('au même instant, l\'objet de gauche et celui de droite à la même hauteur de voie ont la même profondeur (ils passent ensemble)', () => {
    const v = cabView(decor([{ r: 6, c: 5, kind: 'house' }, { r: 4, c: 5, kind: 'tree' }]), droite, 4)
    const maison = v.sprites.find((s) => s.kind === 'house')!
    const arbre = v.sprites.find((s) => s.kind === 'tree')!
    expect(maison.f).toBeCloseTo(arbre.f)
    expect(maison.x - VIEW.cx).toBeCloseTo(VIEW.cx - arbre.x) // symétriques autour de la voie
  })

  it('un objet trop loin, ou derrière le train, n\'est pas dessiné', () => {
    const v = cabView(decor([{ r: 6, c: 13, kind: 'tree' }, { r: 6, c: 0, kind: 'tree' }]), droite, 2)
    expect(v.sprites).toHaveLength(0) // c = 13 est à 11 cases : hors de portée ; c = 0 est derrière
  })

  it('l\'eau, les champs et la route sont dessinés au sol, côté carte', () => {
    const v = cabView(decor([{ r: 6, c: 5, kind: 'field', v: 0 }, { r: 3, c: 6, kind: 'road' }], [[7, 5]]), droite, 2)
    expect(v.ground.map((q) => q.kind).sort()).toEqual(['field', 'road', 'water'])
    const eau = v.ground.find((q) => q.kind === 'water')!
    const route_ = v.ground.find((q) => q.kind === 'road')!
    expect(Math.min(...eau.pts.map((p) => p[0]))).toBeGreaterThan(VIEW.cx) // au sud de la voie : à droite
    expect(Math.max(...route_.pts.map((p) => p[0]))).toBeLessThan(VIEW.cx) // au nord : à gauche
    expect(v.ground.every((q, i, a) => i === 0 || a[i - 1].f >= q.f)).toBe(true) // du plus loin au plus proche
  })

  it('un sol qui dépasse derrière le train est découpé : aucun point du dessin ne passe sous le bord du pare-brise', () => {
    const v = cabView(decor([{ r: 6, c: 2, kind: 'field' }]), droite, 2) // la case est juste sous le train
    for (const q of v.ground) for (const [, y] of q.pts) expect(y).toBeLessThan(VIEW.h * 1.6)
  })
})

describe('vue de la cabine : la voie', () => {
  it('droite : deux rails et un lit de voie centrés, qui se rejoignent à l\'horizon', () => {
    const v = cabView(decor(), droite, 2)
    const [g, d] = v.rails
    expect(g.length).toBeGreaterThan(10)
    expect(g[0][0]).toBeLessThan(VIEW.cx)
    expect(d[0][0]).toBeGreaterThan(VIEW.cx)
    expect(g[0][0] + d[0][0]).toBeCloseTo(2 * VIEW.cx, 0) // symétriques
    expect(Math.abs(g.at(-1)![0] - d.at(-1)![0])).toBeLessThan(Math.abs(g[0][0] - d[0][0]) / 3) // ils se resserrent au loin
    expect(g.at(-1)![1]).toBeGreaterThan(VIEW.horizon) // au-dessous de l'horizon
    expect(v.ballast).not.toBeNull()
  })

  it('un virage à droite plus loin fait partir les rails vers la droite', () => {
    const virage = route([0.5, 5.5], [8.5, 5.5], [8.5, 13.5]) // tourne vers le sud = à droite
    const v = cabView(decor(), virage, 5)
    const lointain = v.rails[0].at(-1)!
    expect(lointain[0]).toBeGreaterThan(VIEW.cx + 20)
    const gauche = route([0.5, 5.5], [8.5, 5.5], [8.5, -2.5]) // vers le nord = à gauche
    expect(cabView(decor(), gauche, 5).rails[0].at(-1)![0]).toBeLessThan(VIEW.cx - 20)
  })

  it('les traverses défilent vers le conducteur à mesure que le train avance (et se répètent à chaque pas)', () => {
    const ys = (s: number) => cabView(decor(), droite, s).sleepers.map((t) => t.y)
    const a = ys(2)
    const b = ys(2.1)
    expect(b).not.toEqual(a)
    expect(ys(2 + 0.32).slice(0, 5).map((y) => Math.round(y))).toEqual(a.slice(0, 5).map((y) => Math.round(y))) // un pas plus loin : même image
  })

  it('en bout de trajet, pas de plantage ni de point au-delà de la voie', () => {
    const v = cabView(decor(), droite, droite.length)
    expect(v.rails[0].length).toBe(0)
    expect(v.sleepers).toHaveLength(0)
  })

  it('screenOf : plus c\'est loin, plus c\'est proche de l\'horizon et du centre', () => {
    const [x1, y1] = screenOf(1, 1)
    const [x2, y2] = screenOf(4, 1)
    expect(y2).toBeLessThan(y1)
    expect(Math.abs(x2 - VIEW.cx)).toBeLessThan(Math.abs(x1 - VIEW.cx))
  })
})

// ---------- décor vivant : voitures, barrières, animaux ----------
const vide: LandFrame = { cars: [], barrier: 0, lights: false, animals: [], birds: [], flakes: [], leaves: [], embers: [], events: [] }
// Une route verticale (x = 8,5) qui coupe la voie en (8,5 ; 5,5) : le passage à niveau est la case ligne 5, colonne 8.
function avecRoute(): Scenery {
  const d = decor()
  d.road = { axis: 'v', line: 8, crossing: [5, 8] }
  return d
}

const voiture = (v: CabView) => v.live.find((l): l is Extract<Live, { t: 'car' }> => l.t === 'car')
const barrieresDe = (v: CabView) => v.live.filter((l): l is Extract<Live, { t: 'barrier' }> => l.t === 'barrier')
const animalDe = (v: CabView, kind: string) => v.live.find((l): l is Extract<Live, { t: 'animal' }> => l.t === 'animal' && l.kind === kind)

describe('vue de la cabine : ce qui bouge', () => {
  it('une voiture qui descend la route vers la voie file vers la droite de l\'écran ; celle qui monte, vers la gauche', () => {
    const land = (dir: 1 | -1): LandFrame => ({ ...vide, cars: [{ id: 1, u: 3, lane: 0.2, dir, kind: 0, color: '#ef4444' }] })
    const descend = voiture(cabView(avecRoute(), droite, 3, { land: land(1) }))!
    const monte = voiture(cabView(avecRoute(), droite, 3, { land: land(-1) }))!
    expect(descend.side).toBe(1)
    expect(monte.side).toBe(-1)
    // elle est au nord de la voie : à gauche de l'écran, devant le train
    expect(descend.x).toBeLessThan(VIEW.cx)
    expect(descend.f).toBeGreaterThan(4)
  })

  it('une voiture derrière le train ou hors de portée n\'est pas dessinée', () => {
    const land: LandFrame = { ...vide, cars: [{ id: 1, u: 3, lane: 0.2, dir: 1, kind: 0, color: '#fff' }] }
    expect(cabView(avecRoute(), droite, 10, { land }).live).toHaveLength(0) // le train a dépassé la route
    expect(cabView(avecRoute(), droite, 0, { land }).live.filter((l) => l.t === 'car')).toHaveLength(1)
  })

  it('le passage à niveau a deux barrières, une de chaque côté de la voie, avec leurs feux', () => {
    const v = cabView(avecRoute(), droite, 4, { land: { ...vide, lights: true } })
    const barrieres = barrieresDe(v)
    expect(barrieres).toHaveLength(2)
    const [gauche, droit] = barrieres.map((b) => b.base[0]).sort((a, b) => a - b)
    expect(gauche).toBeLessThan(VIEW.cx) // un poteau de chaque côté de la voie
    expect(droit).toBeGreaterThan(VIEW.cx)
    expect(barrieres.every((b) => b.lights)).toBe(true)
  })

  it('barrière relevée : le bout de la barre est en l\'air ; baissée : la barre est à l\'horizontale en travers de la route', () => {
    const tip = (barrier: number) => {
      const b = barrieresDe(cabView(avecRoute(), droite, 4, { land: { ...vide, barrier } }))[0]
      return { dy: b.top[1] - b.tip[1], b }
    }
    expect(tip(0).dy).toBeGreaterThan(8) // relevée : la barre monte (le bout est plus haut à l'écran)
    expect(Math.abs(tip(1).dy)).toBeLessThan(2.5) // baissée : à plat
    expect(tip(0.5).dy).toBeLessThan(tip(0).dy) // et elle descend progressivement
    expect(tip(0.5).dy).toBeGreaterThan(tip(1).dy)
  })

  it('pas de route sur la carte : ni voiture ni barrière', () => {
    const land: LandFrame = { ...vide, cars: [{ id: 1, u: 3, lane: 0.2, dir: 1, kind: 0, color: '#fff' }] }
    expect(cabView(decor(), droite, 3, { land }).live).toHaveLength(0)
  })

  it('un animal est dessiné là où il est sur la carte : au sud de la voie, à droite ; au nord, à gauche', () => {
    const land: LandFrame = {
      ...vide,
      animals: [
        { id: 1, kind: 'deer', x: 6.5, y: 6.55, face: 1, t: 0 },
        { id: 2, kind: 'rabbit', x: 6.5, y: 4.4, face: -1, t: 0 },
      ],
    }
    const v = cabView(decor(), droite, 3, { land })
    const cerf = animalDe(v, 'deer')!
    const lapin = animalDe(v, 'rabbit')!
    expect(cerf.x).toBeGreaterThan(VIEW.cx)
    expect(lapin.x).toBeLessThan(VIEW.cx)
    // un animal perché (hibou) est dessiné plus haut que le sol
    const hibou = animalDe(cabView(decor(), droite, 3, { land: { ...vide, animals: [{ id: 3, kind: 'owl', x: 6.5, y: 6.55, face: 1, t: 0 }] } }), 'owl')!
    expect(hibou.y).toBeLessThan(cerf.y)
  })

  it('les animaux suivent leur position : un animal qui se déplace d\'un cran sur la carte bouge dans la cabine', () => {
    const a = (x: number): LandFrame => ({ ...vide, animals: [{ id: 1, kind: 'cat', x, y: 6.5, face: 1, t: 0 }] })
    const avant = animalDe(cabView(decor(), droite, 3, { land: a(6.5) }), 'cat')!
    const apres = animalDe(cabView(decor(), droite, 3, { land: a(7.5) }), 'cat')!
    expect(apres.f).toBeGreaterThan(avant.f) // il s'est éloigné du train (plus loin devant)
  })

  it('le cap peut être imposé (lissage) : la même scène tourne quand le cap tourne', () => {
    const d = decor([{ r: 6, c: 5, kind: 'house' }])
    const normal = cabView(d, droite, 2).sprites.find((s) => s.kind === 'house')!
    const tourne = cabView(d, droite, 2, { heading: Math.PI / 8 }).sprites.find((s) => s.kind === 'house')!
    expect(tourne.x).toBeLessThan(normal.x) // la caméra tourne vers la droite : la maison glisse vers la gauche de l'écran
  })
})

describe('vitesse du train', () => {
  it('pleine vitesse en ligne droite, ralenti dans un virage serré (et avant d\'y entrer)', () => {
    const virage = route([0.5, 5.5], [8.5, 5.5], [8.5, 13.5])
    expect(speedFactor(virage, 2)).toBeCloseTo(1, 1)
    const avant = speedFactor(virage, 7.6) // le virage est dans la case qui suit : il freine AVANT d'y entrer
    expect(avant).toBeLessThan(0.7)
    expect(avant).toBeGreaterThan(0.35)
    expect(speedFactor(virage, 5)).toBeCloseTo(1, 1) // encore loin : pleine vitesse
    expect(speedFactor(virage, 11)).toBeCloseTo(1, 1) // sorti du virage : de nouveau pleine vitesse
  })
})
