import { onMounted, onUnmounted } from 'vue'

// Horloge d'animation d'un composant : appelle `tick(dt, t)` à chaque image. Elle s'arrête avec le composant et ne
// tourne pas du tout si la personne a demandé moins de mouvement (le décor reste alors à son état de départ).
export function useClock(tick: (dt: number, t: number) => void): void {
  let raf = 0
  let last = 0
  let t = 0
  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    t += dt
    tick(dt, t)
    raf = requestAnimationFrame(loop)
  }
  onMounted(() => {
    tick(0, 0)
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || typeof requestAnimationFrame !== 'function') return
    last = performance.now()
    raf = requestAnimationFrame(loop)
  })
  onUnmounted(() => {
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf)
  })
}
