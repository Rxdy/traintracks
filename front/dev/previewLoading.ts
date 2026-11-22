import { createApp, h, ref } from 'vue'
import LevelLoading from '../src/components/LevelLoading.vue'
import '../src/style.css'
import { THEMES } from '../src/scenery/themes'

const themeIdx = ref(0) // touche T : environnement suivant

// Aperçu de l'écran de chargement : la progression se rejoue en boucle (0 → 50 % → 100 %) ; touches 0, 5, 1 pour la fixer.
const progress = ref(0)
let fixed = false
const steps = [0, 0.5, 1]
let i = 0
setInterval(() => {
  if (!fixed) progress.value = steps[i++ % steps.length]!
}, 1400)
window.addEventListener('keydown', (e) => {
  const v = { '0': 0, '5': 0.5, '1': 1 }[e.key]
  if (v !== undefined) {
    fixed = true
    progress.value = v
  } else if (e.key === ' ') fixed = false
  else if (e.key === 't') themeIdx.value++
})
createApp({ render: () => h(LevelLoading, { level: 7 + 25 * themeIdx.value, progress: progress.value, theme: THEMES[themeIdx.value % THEMES.length] }) }).mount('#app')
