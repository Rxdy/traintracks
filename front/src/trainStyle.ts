// Le train du Trajet est la référence : locomotive rouge + wagons, à 0,62 case d'écart entre deux wagons courts.
// Les wagons viennent du catalogue partagé (shared/wagons.ts) : un type et un coloris par wagon, et une longueur
// (les wagons de fret sont plus longs). Le train de départ : ambre, vert, violet.
import { STARTER_TRAIN, WAGON_DEFS, wagonDef, type WagonDef } from '../../shared/wagons.js'

export const LOCO_COLOR = '#dc2626'
export type WagonStyle = WagonDef
export type { WagonKind } from '../../shared/wagons.js'
export const WAGON_STYLES = WAGON_DEFS
/** Le wagon d'un identifiant (un identifiant inconnu, d'une version plus récente, retombe sur l'ambre). */
export const styleOf = (id: string): WagonStyle => wagonDef(id) ?? WAGON_DEFS[0]!
export const STARTER = STARTER_TRAIN.map(styleOf)
export const WAGON_COLORS = STARTER.map((w) => w.color)
export const WAGONS = WAGON_COLORS.length
/** Style du wagon n° i du train de départ (1 = le premier derrière la locomotive). */
export const starterStyle = (i: number): WagonStyle => STARTER[(i - 1) % STARTER.length]!
export const CAR_SPACING = 0.62
/** Couleur du wagon n° i du train de départ. */
export const wagonColor = (i: number): string => WAGON_COLORS[(i - 1) % WAGON_COLORS.length]!

/** Longueur d'une voiture sur la voie (cases) : la locomotive et un wagon court font 0,62. */
export const carLength = (w: WagonStyle | null): number => (w ? w.length : 1) * CAR_SPACING

/** Distance du centre de chaque voiture derrière le centre de la locomotive (0 pour elle), wagons longs compris. */
export function carOffsets(wagons: readonly WagonStyle[]): number[] {
  const out = [0]
  let d = 0
  let prev = carLength(null)
  for (const w of wagons) {
    const len = carLength(w)
    d += (prev + len) / 2
    out.push(d)
    prev = len
  }
  return out
}

/** Distance de la locomotive au bout du dernier wagon (cases) : la longueur du train derrière elle. */
export function trainTail(wagons: readonly WagonStyle[]): number {
  const off = carOffsets(wagons)
  return off[off.length - 1]! + carLength(wagons[wagons.length - 1] ?? null) / 2 - CAR_SPACING / 2
}

/** Ce qu'on dit au joueur : un nom court (« Bagages », « Vaches »). */
export const wagonLabel = (id: string): string => styleOf(id).name
