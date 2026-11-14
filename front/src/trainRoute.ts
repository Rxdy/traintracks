// Trajet du train : une polyligne qui épouse exactement les rails (droites et
// quarts de cercle dans les virages), en unités de case (1 case = 1×1).
// Le trajet est prolongé hors de la grille avant l'entrée et après la sortie
// pour que le train entre et sorte entièrement.
import type { Side } from './cell'
import type { Direction, Puzzle } from './puzzle'

export interface Pt {
  x: number
  y: number
}
export interface Route {
  points: Pt[]
  cum: number[] // longueur cumulée à chaque point
  length: number
  gridStart: number // distance à laquelle la voie entre dans la grille
  gridEnd: number // distance à laquelle elle en sort
}

// Combien de cases il faut prolonger la voie, hors de la grille, pour que le
// train sorte entièrement de l'ÉCRAN (et pas seulement de la grille).
//   rect : boîte de la grille à l'écran (px) ; size : cases par côté ;
//   `margin` : longueur du train + une case de sécurité.
export function leadCells(
  dir: Direction,
  rect: { left: number; top: number; width: number },
  size: number,
  viewport: { width: number; height: number },
  margin = 4,
): number {
  const cell = rect.width / (size + 1)
  if (!(cell > 0)) return 30 // pas de mesure possible (ex. test) : valeur large
  const gridRight = rect.left + size * cell
  const gridBottom = rect.top + size * cell
  const px =
    dir === 'left'
      ? rect.left
      : dir === 'up'
        ? rect.top
        : dir === 'right'
          ? viewport.width - gridRight
          : viewport.height - gridBottom
  return Math.max(px / cell, 0) + margin
}

const OUT: Record<Direction, Pt> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
}
const DIR_SIDE: Record<Direction, Side> = {
  left: 'left',
  right: 'right',
  up: 'top',
  down: 'bottom',
}

function mid(r: number, c: number, side: Side): Pt {
  switch (side) {
    case 'top':
      return { x: c + 0.5, y: r }
    case 'bottom':
      return { x: c + 0.5, y: r + 1 }
    case 'left':
      return { x: c, y: r + 0.5 }
    case 'right':
      return { x: c + 1, y: r + 0.5 }
  }
}

function sideToward(r: number, c: number, nr: number, nc: number): Side {
  if (nr < r) return 'top'
  if (nr > r) return 'bottom'
  return nc < c ? 'left' : 'right'
}

const isHoriz = (s: Side) => s === 'left' || s === 'right'

// Points d'une case, de la côté `from` au côté `to`.
function cellPoints(r: number, c: number, from: Side, to: Side): Pt[] {
  const a = mid(r, c, from)
  const b = mid(r, c, to)
  if (isHoriz(from) === isHoriz(to)) return [a, b] // droit
  // virage : quart de cercle de rayon 0,5 autour du coin commun
  const h = isHoriz(from) ? from : to
  const v = isHoriz(from) ? to : from
  const corner = { x: h === 'left' ? c : c + 1, y: v === 'top' ? r : r + 1 }
  const va = { x: a.x - corner.x, y: a.y - corner.y }
  const vb = { x: b.x - corner.x, y: b.y - corner.y }
  const pts: Pt[] = []
  const N = 8
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * (Math.PI / 2)
    pts.push({
      x: corner.x + Math.cos(t) * va.x + Math.sin(t) * vb.x,
      y: corner.y + Math.cos(t) * va.y + Math.sin(t) * vb.y,
    })
  }
  return pts
}

export function buildRoute(
  path: [number, number][],
  puzzle: Puzzle,
  lead: number | { entry: number; exit: number } = 4,
): Route {
  const leadIn = typeof lead === 'number' ? lead : lead.entry
  const leadOut = typeof lead === 'number' ? lead : lead.exit
  const pts: Pt[] = []
  const push = (p: Pt) => {
    const last = pts[pts.length - 1]
    if (!last || Math.hypot(last.x - p.x, last.y - p.y) > 1e-6) pts.push(p)
  }
  path.forEach(([r, c], i) => {
    const from =
      i === 0 ? DIR_SIDE[puzzle.entry.dir] : sideToward(r, c, path[i - 1][0], path[i - 1][1])
    const to =
      i === path.length - 1
        ? DIR_SIDE[puzzle.exit.dir]
        : sideToward(r, c, path[i + 1][0], path[i + 1][1])
    cellPoints(r, c, from, to).forEach(push)
  })
  // prolongements en ligne droite hors de la grille
  const first = pts[0]
  const eo = OUT[puzzle.entry.dir]
  pts.unshift({ x: first.x + eo.x * leadIn, y: first.y + eo.y * leadIn })
  const last = pts[pts.length - 1]
  const xo = OUT[puzzle.exit.dir]
  pts.push({ x: last.x + xo.x * leadOut, y: last.y + xo.y * leadOut })

  const cum = [0]
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
  }
  const length = cum[cum.length - 1]
  return { points: pts, cum, length, gridStart: leadIn, gridEnd: length - leadOut }
}

// Position et cap (degrés) à la distance `s` le long du trajet.
export function pointAt(route: Route, s: number): Pt & { angle: number } {
  const d = Math.min(Math.max(s, 0), route.length)
  let i = 1
  while (i < route.cum.length - 1 && route.cum[i] < d) i++
  const a = route.points[i - 1]
  const b = route.points[i]
  const seg = route.cum[i] - route.cum[i - 1] || 1
  const t = (d - route.cum[i - 1]) / seg
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
  }
}

// Le train ralentit dans les virages : la vue de la cabine tourne alors moins vite (on voit mieux le décor et on n'a pas le mal de mer).
// 1 en ligne droite, environ 0,42 dans un virage serré à 90°. On regarde 1 case devant pour freiner AVANT d'y entrer.
export function speedFactor(route: Route, s: number): number {
  const a = pointAt(route, s).angle
  const b = pointAt(route, s + 1).angle
  let d = Math.abs(b - a) % 360
  if (d > 180) d = 360 - d
  return 1 / (1 + 1.4 * (Math.min(d, 90) / 90))
}
