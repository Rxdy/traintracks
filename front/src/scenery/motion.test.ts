import { describe, it, expect } from 'vitest'
import { levels } from '../testLevels'
import { buildScenery, seedOf, THEMES, type Scenery, type Road } from './generate'
import { at, createLandSim, createWaterSim, distanceNear, sample } from './motion'
import { buildRoute } from '../trainRoute'

// Un niveau de la plaine avec route et passage à niveau, et un avec rivière.
function find(pred: (s: Scenery) => boolean, th: Parameters<typeof buildScenery>[2] = 'plaine') {
  for (const lv of levels) {
    const s = buildScenery(lv.puzzle, lv.solution, th)
    if (pred(s)) return { lv, s }
  }
  throw new Error('aucun niveau')
}

describe('mouvement du décor', () => {
  it('sample / at : suit la rivière de bout en bout', () => {
    const poly = sample([{ x: 0, y: 0.5 }, { x: 2.5, y: 0.5 }, { x: 2.5, y: 3 }])
    expect(at(poly, 0)).toMatchObject({ x: 0, y: 0.5 })
    expect(at(poly, poly.length)).toMatchObject({ x: 2.5, y: 3 })
    expect(poly.length).toBeGreaterThan(4)
  })

  it('bateaux : naissent invisibles, visibles en route, jamais sur une rivière gelée', () => {
    const { s } = find((x) => !!x.river)
    const sim = createWaterSim(s)
    expect(sim.hasBoats).toBe(true)
    let seen = false
    for (let t = 0; t < 40; t += 0.05) {
      const f = sim.step(0.05, t)
      for (const b of f.boats) {
        expect(b.opacity).toBeGreaterThanOrEqual(0)
        expect(b.opacity).toBeLessThanOrEqual(1)
        if (b.opacity === 1) seen = true
      }
    }
    expect(seen).toBe(true)
    const ice = find((x) => !!x.river, 'hiver')
    expect(createWaterSim(ice.s).hasBoats).toBe(false)
  })

  it('voitures : roulent, mais s\'arrêtent avant le passage à niveau quand la barrière est baissée', () => {
    const { s } = find((x) => !!x.road?.crossing)
    const road = s.road as Road
    const sim = createLandSim(s)
    const uc = (road.axis === 'v' ? road.crossing![0] : road.crossing![1]) + 0.5
    let moved = false
    for (let t = 0; t < 30; t += 0.05) {
      const f = sim.step(0.05, t, false)
      if (f.cars.length) moved = true
    }
    expect(moved).toBe(true)
    // train en approche : la barrière se baisse, puis aucune voiture ne franchit plus le passage à niveau
    let t = 30
    for (let i = 0; i < 60; i++) sim.step(0.05, (t += 0.05), true)
    const start = sim.step(0.05, t, true)
    expect(start.barrier).toBeGreaterThan(0.9)
    const past = (c: { dir: number; u: number }) => c.dir * (uc - c.u) < 0
    // une voiture déjà engagée (passée la ligne d'arrêt, à 0,62 case du centre) finit de traverser : c'est normal
    const alreadyPast = new Set(start.cars.filter((c) => c.dir * (uc - c.u) < 0.7).map((c) => c.id))
    for (let i = 0; i < 200; i++) {
      const f = sim.step(0.05, (t += 0.05), true)
      for (const c of f.cars) if (past(c)) expect(alreadyPast.has(c.id), 'une voiture a franchi la barrière baissée').toBe(true)
    }
    // le train passé : la barrière se relève
    for (let i = 0; i < 80; i++) sim.step(0.05, (t += 0.05), false)
    expect(sim.step(0.05, t, false).barrier).toBeLessThan(0.1)
  })

  it('animaux selon le milieu : hibou en forêt, lapin en plaine', () => {
    const kinds = (th: Parameters<typeof buildScenery>[2]) => {
      const { s } = find((x) => x.tiles.flat().filter((t) => t.kind === 'tree').length > 2 && x.tiles.flat().some((t) => t.kind === 'grass'), th)
      return new Set(createLandSim(s).step(0.05, 1, false).animals.map((a) => a.kind))
    }
    expect(kinds('foret').has('owl')).toBe(true)
    expect(kinds('foret').has('rabbit')).toBe(false)
    expect(kinds('plaine').has('rabbit')).toBe(true)
  })

  it('distanceNear : trouve où le train passe sur le passage à niveau', () => {
    const { lv, s } = find((x) => !!x.road?.crossing)
    const route = buildRoute(lv.solution, lv.puzzle, 1)
    const [r, c] = s.road!.crossing!
    const d = distanceNear(route, c + 0.5, r + 0.5)
    expect(d).toBeGreaterThan(route.gridStart)
    expect(d).toBeLessThan(route.gridEnd)
  })

  it('les animaux de terre ne vont jamais dans l\'eau, ni sur la route ni sur la voie', () => {
    let seen = 0
    for (const lv of levels.slice(0, 40)) {
      for (const th of ['plaine', 'foret', 'automne', 'montagne', 'hiver'] as const) {
        const s = buildScenery(lv.puzzle, lv.solution, th)
        const sim = createLandSim(s)
        for (let t = 0; t < 40; t += 0.1) {
          for (const a of sim.step(0.1, t, false).animals) {
            if (a.kind === 'butterfly' || a.kind === 'squirrel' || a.kind === 'owl' || a.kind === 'gondola' || a.kind === 'skater') continue // ils volent, sautent d'un arbre à l'autre, pendent à un câble ou patinent sur l'étang
            const r = Math.floor(a.y - 0.05), c = Math.floor(a.x)
            if (a.y < 0 || r < 0 || r >= s.size || c < 0 || c >= s.size) continue
            seen++
            expect(s.water.has(`${r},${c}`), `${lv.id} ${th} ${a.kind} dans l'eau`).toBe(false)
            expect(['grass', 'tree', 'pine', 'boulder', 'snowman', 'house'].includes(s.tiles[r][c].kind) || s.tiles[r][c].kind === 'field' || s.tiles[r][c].kind === 'clear', `${lv.id} ${th} ${a.kind} sur ${s.tiles[r][c].kind}`).toBe(true)
          }
        }
      }
    }
    expect(seen).toBeGreaterThan(1000)
  })

  it('on entend ce qu\'on voit : le moteur part au milieu de la grille, le chant quand l\'oiseau entre', () => {
    const { s } = find((x) => !!x.road)
    const sim = createLandSim(s)
    let heard = 0
    for (let t = 0; t < 40; t += 0.05) {
      const f = sim.step(0.05, t, false)
      for (const e of f.events) {
        if (e !== 'car') continue
        heard++
        expect(f.cars.some((c) => Math.abs(c.u - s.size / 2) < 0.3), 'moteur sans voiture au milieu').toBe(true)
      }
    }
    expect(heard).toBeGreaterThan(2)
    const b = find((x) => !!x.river, 'plaine').s
    const bsim = createLandSim(b)
    for (let t = 0; t < 60; t += 0.05) {
      const f = bsim.step(0.05, t, false)
      if (f.events.includes('bird')) expect(f.birds.some((x) => x.x >= 0.9 && x.x < 1.6)).toBe(true)
    }
  })

  it('cohérence : pas de bateaux, de poissons ni de canards dans la lave, le chocolat ou le néon', () => {
    for (const th of ['volcan', 'enfer', 'bonbons', 'neon', 'lune', 'fusion'] as const) {
      for (const lv of levels.slice(0, 12)) {
        const s = buildScenery(lv.puzzle, lv.solution, th)
        const sim = createWaterSim(s)
        expect(sim.hasBoats, th).toBe(false)
        for (let t = 0; t < 20; t += 0.5) {
          const f = sim.step(0.5, t)
          expect(f.boats, th).toHaveLength(0)
          expect(f.ducks, th).toHaveLength(0)
          expect(f.fish, th).toBeNull()
          expect(f.events, th).toEqual([])
        }
      }
    }
    // et sur de l'eau, ils sont là
    const eau = find((x) => !!x.river && x.theme === 'plaine').s
    expect(createWaterSim(eau).hasBoats).toBe(true)
  })
})

describe('chaque environnement a ses animaux', () => {
  it('aucun décor n\'est sans vie : au moins un animal, quel que soit le biome', () => {
    for (const th of THEMES) {
      for (const lv of levels.slice(0, 25)) {
        const s = buildScenery(lv.puzzle, lv.solution, th, undefined, { x: 6, y: 2 }) // comme en jeu : avec la marge de paysage
        expect(createLandSim(s).step(0.05, 1, false).animals.length, `${th} niveau ${lv.id}`).toBeGreaterThan(0)
      }
    }
  })

  it('plaine : un troupeau broute près de son point d\'attache, un tracteur travaille dans un champ d\'au moins 2 cases, ailleurs rien de tout cela', () => {
    let herds = 0, tractors = 0
    for (const lv of levels.slice(0, 80)) {
      const s = buildScenery(lv.puzzle, lv.solution, 'plaine', seedOf(lv.puzzle), { x: 3, y: 3 })
      const sim = createLandSim(s)
      let f = sim.step(0.05, 1, false)
      const kinds = f.animals.map((a) => a.kind)
      if (kinds.includes('sheep') || kinds.includes('cow')) herds++
      const tr = f.animals.find((a) => a.kind === 'tractor')
      if (tr) {
        tractors++
        const r = Math.floor(tr.y), c0 = Math.floor(tr.x)
        expect(s.tiles[r][c0].kind, `niveau ${lv.id}`).toBe('field')
        for (let t = 2; t < 40; t += 0.5) {
          f = sim.step(0.5, t, false)
          const a = f.animals.find((x) => x.kind === 'tractor')!
          expect(s.tiles[Math.floor(a.y)][Math.floor(a.x)].kind, `niveau ${lv.id}`).toBe('field')
        }
      }
    }
    expect(herds).toBeGreaterThan(40)
    expect(tractors).toBeGreaterThan(10)
    for (const th of THEMES.filter((t) => t !== 'plaine')) {
      const s = buildScenery(levels[0].puzzle, levels[0].solution, th)
      const kinds = createLandSim(s).step(0.05, 1, false).animals.map((a) => a.kind)
      expect(kinds).not.toContain('tractor')
      expect(kinds).not.toContain('sheep')
      expect(kinds).not.toContain('cow')
    }
  })

  it('forêt, montagne, hiver : leurs éléments propres, et seulement chez eux', () => {
    const kinds = (th: Parameters<typeof buildScenery>[2], lv = levels[0]) => {
      const s = buildScenery(lv.puzzle, lv.solution, th, seedOf(lv.puzzle), { x: 3, y: 3 })
      return { s, k: new Set(createLandSim(s).step(0.05, 1, false).animals.map((a) => a.kind)) }
    }
    let feu = 0, cabane = 0, teleph = 0, chevre = 0, patin = 0, ski = 0
    for (const lv of levels.slice(0, 120)) {
      const f = kinds('foret', lv), m = kinds('montagne', lv), h = kinds('hiver', lv)
      if (f.k.has('campfire')) feu++
      if (f.s.props.some((p) => p.kind === 'cabin') && f.s.props.some((p) => p.kind === 'woodpile')) cabane++
      if (m.s.cable && m.k.has('gondola') && m.s.props.filter((p) => p.kind === 'pylon').length === 2) teleph++
      if (m.k.has('goat')) chevre++
      if (h.k.has('skater')) patin++
      if (h.k.has('skier')) ski++
    }
    expect(feu).toBeGreaterThan(80)
    expect(cabane).toBeGreaterThan(80)
    expect(teleph).toBeGreaterThan(30)
    expect(chevre).toBeGreaterThan(80)
    expect(patin).toBeGreaterThan(50)
    expect(ski).toBeGreaterThan(40)
    for (const th of THEMES.filter((t) => !['foret', 'montagne', 'hiver'].includes(t))) {
      const { s, k } = kinds(th)
      expect(s.props, th).toEqual([])
      for (const x of ['campfire', 'goat', 'gondola', 'skater', 'skier', 'sled']) expect(k.has(x as never), `${th} ${x}`).toBe(false)
    }
  })

  it('hiver : des étangs de tailles différentes (1, 2 ou 4 cases)', () => {
    const sizes = new Set<number>()
    for (const lv of levels) {
      const s = buildScenery(lv.puzzle, lv.solution, 'hiver', seedOf(lv.puzzle), { x: 3, y: 3 })
      if (s.pond.length) sizes.add(s.pond.length)
    }
    expect([...sizes].sort()).toEqual([1, 2, 4])
  })
})
