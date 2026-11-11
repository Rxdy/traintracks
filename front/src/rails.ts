// Géométrie SVG des rails, dans un repère 100×100 (viewBox de la case).
//
// Une case se raccorde à un ENSEMBLE de côtés (2, 3 ou 4) :
//   - 2 côtés opposés      → rail droit
//   - 2 côtés adjacents    → virage (arc lisse)
//   - 3 côtés              → jonction en T
//   - 4 côtés              → croisement +
// Chaque forme est dessinée comme une vraie voie : 2 rails parallèles + traverses.
//
// La logique est séparée du rendu pour pouvoir être testée seule.

import { oppositeSide, pieceForSides, type Side } from './cell'

export interface RailShape {
  rails: string[] // chemins SVG "d" des rails
  sleepers: string[] // chemins SVG "d" des traverses
}

const CENTER = 50
const RAIL_OFFSET = 12 // écart des rails par rapport à l'axe
const A = CENTER - RAIL_OFFSET // 38
const B = CENTER + RAIL_OFFSET // 62
const SLEEPER_INNER = 30 // 50 - 20
const SLEEPER_OUTER = 70 // 50 + 20
// Positions des traverses le long d'un demi-bras (proches puis loin du centre).
const NEAR = [12.5, 37.5]
const FAR = [62.5, 87.5]

function round(n: number): number {
  return Math.round(n * 1000) / 1000
}

function seg(x1: number, y1: number, x2: number, y2: number): string {
  return `M ${round(x1)} ${round(y1)} L ${round(x2)} ${round(y2)}`
}

function polar(ox: number, oy: number, r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180
  return [ox + r * Math.cos(a), oy + r * Math.sin(a)]
}

// Arc de quart de cercle centré en (ox, oy), rayon r, de a1 à a2 (degrés).
function arc(ox: number, oy: number, r: number, a1: number, a2: number): string {
  const [x1, y1] = polar(ox, oy, r, a1)
  const [x2, y2] = polar(ox, oy, r, a2)
  const delta = (((a2 - a1) % 360) + 360) % 360
  const sweep = delta === 90 ? 1 : 0 // sens qui bombe vers le centre de la case
  return `M ${round(x1)} ${round(y1)} A ${r} ${r} 0 0 ${sweep} ${round(x2)} ${round(y2)}`
}

// Coin de rotation + angles (vers les deux bords reliés) pour chaque virage.
const CURVES: Record<
  'curve-tl' | 'curve-tr' | 'curve-bl' | 'curve-br',
  { ox: number; oy: number; a1: number; a2: number }
> = {
  'curve-tl': { ox: 0, oy: 0, a1: 0, a2: 90 },
  'curve-tr': { ox: 100, oy: 0, a1: 180, a2: 90 },
  'curve-bl': { ox: 0, oy: 100, a1: 0, a2: 270 },
  'curve-br': { ox: 100, oy: 100, a1: 180, a2: 270 },
}

// Demi-rail droit du centre vers un côté.
function arm(side: Side): RailShape {
  switch (side) {
    case 'top':
      return {
        rails: [seg(A, 0, A, CENTER), seg(B, 0, B, CENTER)],
        sleepers: NEAR.map((y) => seg(SLEEPER_INNER, y, SLEEPER_OUTER, y)),
      }
    case 'bottom':
      return {
        rails: [seg(A, CENTER, A, 100), seg(B, CENTER, B, 100)],
        sleepers: FAR.map((y) => seg(SLEEPER_INNER, y, SLEEPER_OUTER, y)),
      }
    case 'left':
      return {
        rails: [seg(0, A, CENTER, A), seg(0, B, CENTER, B)],
        sleepers: NEAR.map((x) => seg(x, SLEEPER_INNER, x, SLEEPER_OUTER)),
      }
    case 'right':
      return {
        rails: [seg(CENTER, A, 100, A), seg(CENTER, B, 100, B)],
        sleepers: FAR.map((x) => seg(x, SLEEPER_INNER, x, SLEEPER_OUTER)),
      }
  }
}

// Virage lisse (arc) entre deux côtés adjacents.
function curve(a: Side, b: Side): RailShape {
  const piece = pieceForSides(a, b) as keyof typeof CURVES
  const { ox, oy, a1, a2 } = CURVES[piece]
  const rails = [arc(ox, oy, A, a1, a2), arc(ox, oy, B, a1, a2)]
  const signedDelta = ((((a2 - a1 + 540) % 360) + 360) % 360) - 180
  const sleepers = [1 / 8, 3 / 8, 5 / 8, 7 / 8].map((t) => {
    const angle = a1 + signedDelta * t
    const [ix, iy] = polar(ox, oy, SLEEPER_INNER, angle)
    const [outx, outy] = polar(ox, oy, SLEEPER_OUTER, angle)
    return seg(ix, iy, outx, outy)
  })
  return { rails, sleepers }
}

// Géométrie complète (rails + traverses) pour un ensemble de côtés connectés.
export function railShapeForSides(sides: Side[]): RailShape {
  // 2 côtés adjacents → virage lisse.
  if (sides.length === 2 && oppositeSide(sides[0]) !== sides[1]) {
    return curve(sides[0], sides[1])
  }
  // Sinon (droit, T ou croix) → un demi-rail droit vers chaque côté.
  const rails: string[] = []
  const sleepers: string[] = []
  for (const side of sides) {
    const a = arm(side)
    rails.push(...a.rails)
    sleepers.push(...a.sleepers)
  }
  return { rails, sleepers }
}
