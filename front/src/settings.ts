// Les Paramètres du joueur, gardés dans cet appareil (comme le son et la vitesse du train) : rien côté serveur.
// - volumes : musique des menus, effets du jeu, train, ambiance du décor (0 à 1) ;
// - animations réduites : moins de mouvement, et pas d'ombres dans la 3D (plus léger pour les petits appareils).
// La vitesse du train au départ est dans speedPref.ts ; le son coupé ou non, dans sound/director.ts.
import { ref, watch } from 'vue'
import { setUserLevel } from './sound/engine'

const KEY = 'traintracks.parametres'
export interface Volumes {
  music: number
  sfx: number
  train: number
  amb: number
}
interface Saved {
  volumes: Volumes
  reduced: boolean
}
const DEFAULT: Saved = { volumes: { music: 1, sfx: 1, train: 1, amb: 1 }, reduced: false }
function load(): Saved {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Saved> | null
    if (!raw) return structuredClone(DEFAULT)
    const v = { ...DEFAULT.volumes, ...(raw.volumes ?? {}) }
    for (const k of Object.keys(v) as (keyof Volumes)[]) v[k] = typeof v[k] === 'number' ? Math.max(0, Math.min(1, v[k])) : 1
    return { volumes: v, reduced: raw.reduced === true }
  } catch {
    return structuredClone(DEFAULT) // pas de stockage (navigation privée) : réglages par défaut
  }
}
const saved = load()
export const volumes = ref<Volumes>(saved.volumes)
export const reducedPref = ref<boolean>(saved.reduced)

function apply(v: Volumes): void {
  setUserLevel('music', v.music)
  setUserLevel('sfx', v.sfx)
  setUserLevel('train', v.train)
  setUserLevel('lobby', v.train) // le train qui passe sur l'accueil
  setUserLevel('amb', v.amb)
}
apply(volumes.value)
watch([volumes, reducedPref], ([v, r]) => {
  apply(v)
  try {
    localStorage.setItem(KEY, JSON.stringify({ volumes: v, reduced: r }))
  } catch {
    // tant pis : le réglage vaut pour cette visite
  }
}, { deep: true })

/** Moins d'animations : demandé dans les Paramètres, ou par le système de l'appareil. */
export function reducedMotion(): boolean {
  if (reducedPref.value) return true
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}
