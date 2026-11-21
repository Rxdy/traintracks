// Aucun zoom dans le jeu, sur aucun appareil : l'écran est mesuré au pixel près (grille, Trajet, chargement).
//  - ordinateur : Ctrl/Cmd + molette (et le pincement du pavé tactile, qui arrive comme Ctrl + molette), Ctrl/Cmd + « + », « - », « 0 » ;
//  - téléphone : pincement (deux doigts) ; le double tap est coupé en CSS (`touch-action: manipulation`, style.css) ;
//  - iPhone : Safari ignore `user-scalable=no` de la balise viewport, d'où les événements « gesture ».
// Le zoom du menu du navigateur ne peut pas être bloqué par une page.
export function blockZoom(): void {
  window.addEventListener(
    'keydown',
    (e) => {
      if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '_', '0'].includes(e.key)) e.preventDefault()
    },
    { capture: true },
  )
  setWheelGuard(true)
  // Deux doigts posés sur le pavé tactile = clic droit : sur l'écran de jeu, pas de menu du navigateur (il figeait le Trajet sous
  // Firefox). La croix d'une case passe toujours : la grille écoute le clic droit elle-même.
  const inGame = (t: EventTarget | null) => t instanceof Element && !!t.closest('.track, .loading')
  window.addEventListener('contextmenu', (e) => inGame(e.target) && e.preventDefault(), { capture: true })
  document.addEventListener('touchmove', (e) => e.touches.length > 1 && e.preventDefault(), { passive: false })
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false })
}

// Ctrl + molette (et le pincement du pavé tactile) : bloqué par un écouteur de molette qui peut annuler l'événement. Sous Firefox,
// un tel écouteur oblige le navigateur à passer CHAQUE événement du pavé tactile par la page (200 à 250 par seconde quand on
// défile à deux doigts) : la page n'avait plus le temps de dessiner, et le Trajet se figeait (diagnostic ?perf, perfProbe.ts).
// Pendant le Trajet on le retire donc (TrackGrid) : Firefox traite le défilement à part, sans la page. Le zoom au clavier reste bloqué.
// La page de jeu ne défile de toute façon pas (html.lock-screen : overflow hidden, overscroll-behavior none).
const onWheel = (e: WheelEvent): void => {
  if (e.ctrlKey) e.preventDefault()
}
let guarded = false
export function setWheelGuard(on: boolean): void {
  if (on === guarded) return
  guarded = on
  if (on) window.addEventListener('wheel', onWheel, { passive: false, capture: true })
  else window.removeEventListener('wheel', onWheel, { capture: true })
}
