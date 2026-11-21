// Le train du Trajet est la référence : locomotive rouge + trois wagons (ambre, vert, violet), à 0,62 case d'écart.
// L'écran de chargement et les images de l'appli (icône, carte « Niveau ») le reprennent tel quel.
export const LOCO_COLOR = '#dc2626'
// Les wagons à collectionner : 12 wagons courts, chacun un vrai type de wagon dans son coloris.
// Les trois premiers forment le train de départ (ambre, vert, violet), dans cet ordre.
export type WagonKind = 'baggage' | 'coach' | 'gondola' | 'sleeper' | 'panorama' | 'dining' | 'mail' | 'reefer' | 'caboose' | 'cattle' | 'boxcar' | 'hopper'
export interface WagonStyle {
  id: string
  name: string
  color: string
  kind: WagonKind
  kindName: string
}
export const WAGON_STYLES: WagonStyle[] = [
  { id: 'ambre', name: 'Ambre', color: '#f59e0b', kind: 'baggage', kindName: 'fourgon à bagages' },
  { id: 'vert', name: 'Vert', color: '#16a34a', kind: 'coach', kindName: 'voiture de voyageurs' },
  { id: 'violet', name: 'Violet', color: '#8b5cf6', kind: 'gondola', kindName: 'tombereau à charbon' },
  { id: 'bleu', name: 'Bleu', color: '#2563eb', kind: 'sleeper', kindName: 'voiture-lits' },
  { id: 'ciel', name: 'Ciel', color: '#38bdf8', kind: 'panorama', kindName: 'voiture panoramique' },
  { id: 'rose', name: 'Rose', color: '#ec4899', kind: 'dining', kindName: 'voiture-restaurant' },
  { id: 'orange', name: 'Orange', color: '#f97316', kind: 'mail', kindName: 'wagon postal' },
  { id: 'citron', name: 'Citron', color: '#facc15', kind: 'reefer', kindName: 'wagon frigorifique' },
  { id: 'turquoise', name: 'Turquoise', color: '#14b8a6', kind: 'caboose', kindName: 'fourgon de queue' },
  { id: 'chocolat', name: 'Chocolat', color: '#8b5a2b', kind: 'cattle', kindName: 'wagon à bestiaux' },
  { id: 'ardoise', name: 'Ardoise', color: '#475569', kind: 'boxcar', kindName: 'wagon couvert' },
  { id: 'sable', name: 'Sable', color: '#d6a85a', kind: 'hopper', kindName: 'trémie à céréales' },
]
export const STARTER = WAGON_STYLES.slice(0, 3)
export const WAGON_COLORS = STARTER.map((w) => w.color)
export const WAGONS = WAGON_COLORS.length
/** Style du wagon n° i du train de départ (1 = le premier derrière la locomotive). */
export const starterStyle = (i: number): WagonStyle => STARTER[(i - 1) % STARTER.length]!
export const CAR_SPACING = 0.62
/** Couleur du wagon n° i (1 = le premier derrière la locomotive). */
export const wagonColor = (i: number): string => WAGON_COLORS[(i - 1) % WAGON_COLORS.length]!
