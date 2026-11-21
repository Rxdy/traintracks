// Le train du Trajet est la référence : locomotive rouge + trois wagons (ambre, vert, violet), à 0,62 case d'écart.
// L'écran de chargement et les images de l'appli (icône, carte « Niveau ») le reprennent tel quel.
export const LOCO_COLOR = '#dc2626'
export const WAGON_COLORS = ['#f59e0b', '#16a34a', '#8b5cf6']
export const WAGONS = WAGON_COLORS.length
export const CAR_SPACING = 0.62
/** Couleur du wagon n° i (1 = le premier derrière la locomotive). */
export const wagonColor = (i: number): string => WAGON_COLORS[(i - 1) % WAGON_COLORS.length]!
