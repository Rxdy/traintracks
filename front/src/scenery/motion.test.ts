import { describe, it, expect } from 'vitest'
import { levels } from '../testLevels'
import { buildScenery, type Scenery, type Road } from './generate'
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
            if (a.kind === 'butterfly' || a.kind === 'squirrel' || a.kind === 'owl') continue // ils volent ou sautent d'un arbre à l'autre
            const r = Math.floor(a.y - 0.05), c = Math.floor(a.x)
            if (a.y < 0 || r < 0 || r >= s.size || c < 0 || c >= s.size) continue
            seen++
            expect(s.water.has(`${r},${c}`), `${lv.id} ${th} ${a.kind} dans l'eau`).toBe(false)
            expect(['grass', 'tree', 'pine', 'boulder', 'snowman', 'house'].includes(s.tiles[r][c].kind) || s.tiles[r][c].kind === 'field', `${lv.id} ${th} ${a.kind} sur ${s.tiles[r][c].kind}`).toBe(true)
          }
        }
      }
    }
    expect(seen).toBeGreaterThan(1000)
  })
})
