// Enregistre le service worker (production uniquement : en développement il
// gênerait le rechargement à chaud).
export function registerSW(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(__APP_VERSION__)}`).catch(() => {
      /* hors ligne indisponible : le jeu reste utilisable en ligne */
    })
  })
}
