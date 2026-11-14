import { ref, watch } from 'vue'

// Style du décor des niveaux gagnés : « 3d » (Three.js) ou « svg » (le décor classique). Choix gardé sur l'appareil.
// On peut aussi forcer par l'adresse : ?decor=svg ou ?decor=3d. Sans WebGL, c'est toujours le décor classique.
export type DecorMode = '3d' | 'svg'
const KEY = 'decor'
const valid = (v: unknown): v is DecorMode => v === '3d' || v === 'svg'

function initial(): DecorMode {
  try {
    const q = new URLSearchParams(window.location.search).get('decor')
    if (valid(q)) return q
    const s = window.localStorage.getItem(KEY)
    if (valid(s)) return s
  } catch {
    // stockage bloqué : on garde le défaut
  }
  return '3d'
}

export const decorMode = ref<DecorMode>(initial())
watch(decorMode, (v) => {
  try {
    window.localStorage.setItem(KEY, v)
  } catch {
    // stockage bloqué : le choix vaut pour cette visite seulement
  }
})

let gl: boolean | null = null
export function webglAvailable(): boolean {
  if (gl !== null) return gl
  if (typeof WebGLRenderingContext === 'undefined') return (gl = false) // tests (jsdom), très vieux navigateurs
  try {
    const c = document.createElement('canvas')
    gl = !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    gl = false
  }
  return gl
}
