// Le train du Trajet est la référence : locomotive rouge + trois wagons (ambre, vert, violet), à 0,62 case d'écart.
// L'écran de chargement et les images de l'appli (icône, carte « Niveau ») le reprennent tel quel.
export const LOCO_COLOR = '#dc2626'
// Les wagons à collectionner : le même wagon standard en 12 coloris, chacun avec son accessoire.
// Les trois premiers forment le train de départ (ambre, vert, violet), dans cet ordre.
export type Accessory = 'crates' | 'windows' | 'coal' | 'flag' | 'balloons' | 'flowers' | 'oranges' | 'parasol' | 'bell' | 'barrels' | 'stove' | 'sacks'
export interface WagonStyle {
  id: string
  name: string
  color: string
  accessory: Accessory
  accessoryName: string
}
export const WAGON_STYLES: WagonStyle[] = [
  { id: 'ambre', name: 'Ambre', color: '#f59e0b', accessory: 'crates', accessoryName: 'caisses' },
  { id: 'vert', name: 'Vert', color: '#16a34a', accessory: 'windows', accessoryName: 'voyageurs' },
  { id: 'violet', name: 'Violet', color: '#8b5cf6', accessory: 'coal', accessoryName: 'charbon' },
  { id: 'bleu', name: 'Bleu', color: '#2563eb', accessory: 'flag', accessoryName: 'drapeau' },
  { id: 'ciel', name: 'Ciel', color: '#38bdf8', accessory: 'balloons', accessoryName: 'ballons' },
  { id: 'rose', name: 'Rose', color: '#ec4899', accessory: 'flowers', accessoryName: 'jardinière' },
  { id: 'orange', name: 'Orange', color: '#f97316', accessory: 'oranges', accessoryName: "cageots d'oranges" },
  { id: 'citron', name: 'Citron', color: '#facc15', accessory: 'parasol', accessoryName: 'parasol' },
  { id: 'turquoise', name: 'Turquoise', color: '#14b8a6', accessory: 'bell', accessoryName: 'cloche' },
  { id: 'chocolat', name: 'Chocolat', color: '#8b5a2b', accessory: 'barrels', accessoryName: 'tonneaux' },
  { id: 'ardoise', name: 'Ardoise', color: '#475569', accessory: 'stove', accessoryName: 'poêle' },
  { id: 'sable', name: 'Sable', color: '#d6a85a', accessory: 'sacks', accessoryName: 'sacs de grain' },
]
export const STARTER = WAGON_STYLES.slice(0, 3)
export const WAGON_COLORS = STARTER.map((w) => w.color)
export const WAGONS = WAGON_COLORS.length
/** Style du wagon n° i du train de départ (1 = le premier derrière la locomotive). */
export const starterStyle = (i: number): WagonStyle => STARTER[(i - 1) % STARTER.length]!
export const CAR_SPACING = 0.62
/** Couleur du wagon n° i (1 = le premier derrière la locomotive). */
export const wagonColor = (i: number): string => WAGON_COLORS[(i - 1) % WAGON_COLORS.length]!
