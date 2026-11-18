import { describe, it, expect } from 'vitest'
import { buildRoute, pointAt } from './trainRoute'
import { samplePuzzle, sampleSolution } from './puzzle'
import { levels } from './testLevels'

describe('trainRoute', () => {
  it('épouse les rails : chaque point reste sur une case de la voie (ou hors grille)', () => {
    const route = buildRoute(sampleSolution, samplePuzzle, 0)
    const cells = new Set(sampleSolution.map(([r, c]) => `${r}:${c}`))
    for (const p of route.points) {
      // point sur la frontière d'une case de la voie
      const ok = [...cells].some((k) => {
        const [r, c] = k.split(':').map(Number)
        return p.x >= c - 1e-6 && p.x <= c + 1 + 1e-6 && p.y >= r - 1e-6 && p.y <= r + 1 + 1e-6
      })
      expect(ok).toBe(true)
    }
  })

  it('longueur : 1 par case droite, π/4 par virage', () => {
    const l = levels[0] // 4×4 : départ (1,0) → sortie (3,1)
    const route = buildRoute(l.solution, l.puzzle, 0)
    expect(route.length).toBeGreaterThan(l.solution.length * 0.78)
    expect(route.length).toBeLessThanOrEqual(l.solution.length)
  })

  it('pointAt : démarre au bord d\'entrée, avec cap horizontal vers la droite', () => {
    const route = buildRoute(sampleSolution, samplePuzzle, 4)
    const start = pointAt(route, 4) // fin du prolongement = bord gauche de la grille
    expect(start.x).toBeCloseTo(0)
    expect(start.y).toBeCloseTo(2.5)
    expect(start.angle).toBeCloseTo(0)
    const before = pointAt(route, 0)
    expect(before.x).toBeCloseTo(-4)
  })

  it('pointAt est borné aux extrémités', () => {
    const route = buildRoute(sampleSolution, samplePuzzle)
    expect(pointAt(route, -5)).toMatchObject({ x: route.points[0].x })
    expect(pointAt(route, 1e6).x).toBeCloseTo(route.points.at(-1)!.x)
  })
})

// Le train doit passer EXACTEMENT sur les rails, sur tous les niveaux.
describe('trainRoute : le train reste sur les rails', () => {
  const all = [
    { name: 'exemple', puzzle: samplePuzzle, solution: sampleSolution },
    ...levels.map((l) => ({ name: 'niveau ' + l.id, puzzle: l.puzzle, solution: l.solution })),
  ]
  const EPS = 1e-6

  function onRail(path: [number, number][], p: { x: number; y: number }): boolean {
    return path.some(([r, c], i) => {
      if (p.x < c - EPS || p.x > c + 1 + EPS || p.y < r - EPS || p.y > r + 1 + EPS) return false
      const sideOf = (nr: number, nc: number) =>
        nr < r ? 'top' : nr > r ? 'bottom' : nc < c ? 'left' : 'right'
      const dirSide = (d: string) => (d === 'up' ? 'top' : d === 'down' ? 'bottom' : d)
      return (() => {
        const puzzle = all.find((a) => a.solution === path)!.puzzle
        const from = i === 0 ? dirSide(puzzle.entry.dir) : sideOf(path[i - 1][0], path[i - 1][1])
        const to = i === path.length - 1 ? dirSide(puzzle.exit.dir) : sideOf(path[i + 1][0], path[i + 1][1])
        const horiz = (s: string) => s === 'left' || s === 'right'
        if (horiz(from) === horiz(to)) {
          return horiz(from) ? Math.abs(p.y - (r + 0.5)) < EPS : Math.abs(p.x - (c + 0.5)) < EPS
        }
        const h = horiz(from) ? from : to
        const v = horiz(from) ? to : from
        const cx = h === 'left' ? c : c + 1
        const cy = v === 'top' ? r : r + 1
        // 8 segments par quart de cercle : la corde est au plus à 0,0024 à l'intérieur
        const d = Math.hypot(p.x - cx, p.y - cy)
        return d <= 0.5 + EPS && d >= 0.5 - 0.0025
      })()
    })
  }

  it.each(all.map((a) => [a.name, a] as const))('%s : tous les points échantillonnés sont sur un rail', (_n, a) => {
    const route = buildRoute(a.solution, a.puzzle, 0)
    const steps = 400
    for (let i = 0; i <= steps; i++) {
      const p = pointAt(route, (i / steps) * route.length)
      expect(onRail(a.solution, p), `s=${i}/${steps} (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`).toBe(true)
    }
  })

  it.each(all.map((a) => [a.name, a] as const))('%s : commence à l\'entrée et finit à la sortie', (_n, a) => {
    const route = buildRoute(a.solution, a.puzzle, 0)
    const [er, ec] = a.solution[0]
    const [xr, xc] = a.solution.at(-1)!
    const d = a.puzzle.entry.dir
    const start = pointAt(route, 0)
    expect(start.x).toBeCloseTo(d === 'left' ? ec : ec + 0.5)
    expect(start.y).toBeCloseTo(d === 'up' ? er : er + 0.5)
    const end = pointAt(route, route.length)
    const x = a.puzzle.exit.dir
    expect(end.x).toBeCloseTo(x === 'right' ? xc + 1 : xc + 0.5)
    expect(end.y).toBeCloseTo(x === 'down' ? xr + 1 : xr + 0.5)
  })

  it('le cap suit la voie : jamais de saut brusque entre deux points proches', () => {
    for (const a of all) {
      const route = buildRoute(a.solution, a.puzzle, 2)
      let prev = pointAt(route, 0).angle
      for (let s = 0.05; s <= route.length; s += 0.05) {
        const cur = pointAt(route, s).angle
        const diff = Math.abs(((cur - prev + 540) % 360) - 180)
        expect(diff).toBeLessThanOrEqual(45 + 1e-6) // virages lissés en 8 pas de 11,25°
        prev = cur
      }
    }
  })
})

import { leadCells } from './trainRoute'

describe('trainRoute : sortie de l\'écran', () => {
  const vp = { width: 390, height: 844 }
  // grille 8×8 : 9 colonnes de 34 px, en (39, 130)
  const rect = { left: 39, top: 130, width: 306 }

  it('leadCells : la voie dépasse le bord de l\'écran, quelle que soit la sortie', () => {
    const cell = 306 / 9
    const size = 8
    // sortie vers le bas : distance jusqu'au bas de l'écran
    const down = leadCells('down', rect, size, vp)
    expect(130 + cell + size * cell + down * cell).toBeGreaterThan(vp.height + 3 * cell)
    const right = leadCells('right', rect, size, vp)
    expect(39 + cell + size * cell + right * cell).toBeGreaterThan(vp.width + 3 * cell)
    const left = leadCells('left', rect, size, vp)
    expect(39 + cell - left * cell).toBeLessThan(-3 * cell)
    const up = leadCells('up', rect, size, vp)
    expect(130 + cell - up * cell).toBeLessThan(-3 * cell)
  })

  it('leadCells : valeur large quand la grille ne se mesure pas', () => {
    expect(leadCells('down', { left: 0, top: 0, width: 0 }, 8, vp)).toBeGreaterThanOrEqual(30)
  })

  it('buildRoute : le trajet intérieur reste le même, seuls les prolongements changent', () => {
    const a = buildRoute(sampleSolution, samplePuzzle, { entry: 3, exit: 20 })
    const b = buildRoute(sampleSolution, samplePuzzle, { entry: 3, exit: 5 })
    expect(a.gridEnd - a.gridStart).toBeCloseTo(b.gridEnd - b.gridStart)
    expect(a.gridStart).toBe(3)
    expect(a.length - a.gridEnd).toBeCloseTo(20)
  })
})
