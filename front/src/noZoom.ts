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
  // Le défilement à deux doigts (pavé tactile, molette) sur l'écran de jeu ne fait rien : sur Mac, il lançait l'effet d'élastique ou le
  // geste « page précédente » du navigateur, et le Trajet se figeait. Ailleurs (Compte, Classement…), la page défile normalement.
  const inGame = (t: EventTarget | null) => t instanceof Element && !!t.closest('.track, .loading')
  window.addEventListener('wheel', (e) => (e.ctrlKey || inGame(e.target)) && e.preventDefault(), { passive: false, capture: true })
  document.addEventListener('touchmove', (e) => e.touches.length > 1 && e.preventDefault(), { passive: false })
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false })
}
