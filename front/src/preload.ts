// Préchargement du décor 3D (three.js, fichier à part de ~770 Ko) : le décor de la grille en a besoin dès l'ouverture d'un niveau.
// On le demande une seule fois ; un échec (hors ligne, pas de WebGL) n'est pas une erreur : la grille retombe sur le décor classique.
import { webglAvailable } from './decor'

let world: Promise<boolean> | null = null

export function preloadWorld(): Promise<boolean> {
  // sans WebGL, la grille garde le décor classique : inutile de télécharger three.js
  if (!webglAvailable()) return Promise.resolve(false)
  world ??= import('./scenery3d/world').then(
    () => true,
    () => false,
  )
  return world
}

// À l'accueil, pendant que le joueur regarde le menu : on charge sans gêner l'affichage.
export function preloadWorldWhenIdle(): void {
  const ric = (globalThis as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback
  if (ric) ric(() => void preloadWorld())
  else setTimeout(() => void preloadWorld(), 1500)
}

// Durée minimale de l'écran de chargement (ms), pour que la barre se voie arriver au bout ; les tests la mettent à 0.
export const loadingTiming = { minMs: 600 }
