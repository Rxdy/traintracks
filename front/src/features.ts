import { ref } from 'vue'

// Fonctions pas encore publiées. La cabine du conducteur (fenêtre d'incrustation, vue 3D du pare-brise) est en cours d'amélioration :
// cachée par défaut pour tout le monde. On l'active pour tester avec « ?cabine=1 » dans l'adresse (« ?cabine=0 » la recache) ;
// le choix est gardé dans le navigateur. L'image publiée est la même partout : seul ce réglage change d'un navigateur à l'autre.
const KEY = 'traintracks.cabine'
function read(): boolean {
  try {
    const q = new URLSearchParams(window.location.search).get('cabine')
    if (q === '1' || q === '0') localStorage.setItem(KEY, q)
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}
export const cabinEnabled = ref(read())
