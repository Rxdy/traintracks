// Diagnostic d'affichage, seulement avec ?perf dans l'adresse (jamais affiché sinon). Il sert à comprendre un gel : un petit
// cadre en bas à gauche donne, chaque seconde, le nombre d'images dessinées (boucle d'images du navigateur), de minuteries
// (le train avance par minuterie), d'événements de défilement reçus, et le plus long trou entre deux images.
// Si les images tombent à 0 mais pas les minuteries : le navigateur a suspendu le dessin. Si tout tombe : la page est bloquée.
export function startPerfProbe(): void {
  if (!new URLSearchParams(location.search).has('perf')) return
  const box = document.createElement('pre')
  box.setAttribute('aria-hidden', 'true')
  box.style.cssText =
    'position:fixed;left:8px;bottom:8px;z-index:200;margin:0;padding:6px 8px;border-radius:8px;background:rgba(0,0,0,.75);color:#fff;font:12px/1.35 ui-monospace,monospace;pointer-events:none;white-space:pre'
  document.body.appendChild(box)
  let frames = 0
  let ticks = 0
  let wheels = 0
  let prevented = 0
  let lastFrame = performance.now()
  let worstGap = 0
  const log: string[] = []
  const frame = (now: number): void => {
    frames++
    worstGap = Math.max(worstGap, now - lastFrame)
    lastFrame = now
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
  window.setInterval(() => ticks++, 30)
  // en dernier (bulle) : on voit si le défilement a été bloqué par la page (noZoom.ts) ou non
  window.addEventListener('wheel', (e) => {
    wheels++
    if (e.defaultPrevented) prevented++
  }, { passive: true })
  window.setInterval(() => {
    const line = `images ${String(frames).padStart(3)}/s  minuteries ${String(ticks).padStart(2)}/s  défilement ${wheels} (bloqués ${prevented})  pire trou ${Math.round(worstGap)} ms`
    log.unshift(line)
    log.length = Math.min(log.length, 8)
    box.textContent = log.join('\n')
    frames = ticks = wheels = prevented = worstGap = 0
  }, 1000)
}
