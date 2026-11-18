import { ref, watch } from 'vue'
import type { Speed } from './components/SpeedControl.vue'

// Le cran de vitesse du train choisi par le joueur : gardé dans le navigateur, d'un niveau et d'une partie à l'autre.
// « normal » tant qu'il n'a rien choisi. Le stockage peut être absent ou refusé (navigation privée) : on s'en passe.
const KEY = 'traintracks.vitesse'
const VALID: Speed[] = ['slow', 'normal', 'fast']
function load(): Speed {
  try {
    const v = localStorage.getItem(KEY)
    if (v && (VALID as string[]).includes(v)) return v as Speed
  } catch {
    // pas de stockage : valeur par défaut
  }
  return 'normal'
}
export const speed = ref<Speed>(load())
watch(speed, (v) => {
  try {
    localStorage.setItem(KEY, v)
  } catch {
    // tant pis : le choix vaut pour cette partie seulement
  }
})
