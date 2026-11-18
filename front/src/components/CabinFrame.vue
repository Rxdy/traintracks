<script setup lang="ts">
import { ref } from 'vue'
import CabinWindshield from './CabinWindshield.vue'
import type { Route } from '../trainRoute'
import type { Scenery } from '../scenery/generate'
import type { LandFrame } from '../scenery/motion'
import type { Theme } from '../scenery/themes'

// La vue du conducteur : une petite fenêtre en incrustation, en bas à gauche du paysage du Trajet. Une languette sur le bord gauche
// la range (il ne reste que la languette, comme la vignette d'un appel vidéo) ou la rouvre ; le choix du joueur est mémorisé.
// Absente pendant le Plateau : elle entre par la gauche à la victoire.
defineProps<{
  shown: boolean
  scene: { route: Route; scenery: Scenery; rails: Route | null } | null
  land: LandFrame | null
  progress: number
  running: boolean
  theme?: Theme
}>()

const KEY = 'traintracks.cabine-rangee'
function read(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}
const shut = ref(read())
function toggle(): void {
  shut.value = !shut.value
  try {
    localStorage.setItem(KEY, shut.value ? '1' : '0')
  } catch {
    /* stockage indisponible (navigation privée) : le choix vaut pour cette visite */
  }
}
</script>

<template>
  <div class="pip" :class="{ shown, shut }" data-test="cabin" :aria-hidden="!shown">
    <div class="win" data-test="cabin-window">
      <CabinWindshield :scene="scene" :land="land" :progress="progress" :running="running" :theme="theme" />
    </div>
    <button
      type="button"
      class="tab"
      data-test="cabin-tab"
      :tabindex="shown ? 0 : -1"
      :aria-expanded="!shut"
      :aria-label="shut ? 'Rouvrir la cabine' : 'Ranger la cabine'"
      :title="shut ? 'Rouvrir la cabine' : 'Ranger la cabine'"
      @click="toggle"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 6l-6 6 6 6" /></svg>
    </button>
  </div>
</template>

<style scoped>
.pip {
  --tab: 1.9rem;
  --w: min(62vw, 22rem);
  position: fixed;
  left: 0;
  bottom: max(1rem, env(safe-area-inset-bottom));
  z-index: 8; /* au-dessus du paysage (le plateau : 5) et de la barre du haut (6) */
  display: flex;
  align-items: center;
  transform: translateX(-110%); /* avant la victoire : hors de l'écran */
  pointer-events: none;
  transition: transform 0.6s cubic-bezier(0.3, 0.8, 0.3, 1) 1s; /* entre pendant que le paysage apparaît */
}
.pip.shown {
  transform: translateX(0);
  pointer-events: auto;
  transition-delay: 1s;
}
.pip.shown.shut {
  transform: translateX(calc(-100% + var(--tab)));
  transition-delay: 0s;
}
.win {
  width: var(--w);
  aspect-ratio: 1.55;
  overflow: hidden;
  border: 0.2rem solid #fff;
  border-left: 0;
  border-radius: 0 1rem 1rem 0;
  background: #0b1220;
  box-shadow: 0 0.3rem 1rem rgba(0, 0, 0, 0.45);
}
.tab {
  flex: none;
  display: grid;
  place-items: center;
  width: var(--tab);
  height: 5rem;
  margin-left: -0.2rem;
  padding: 0;
  border: 0;
  border-radius: 0 0.8rem 0.8rem 0;
  background: #fff;
  color: #1c2430;
  box-shadow: 0.1rem 0.1rem 0.6rem rgba(0, 0, 0, 0.4);
  cursor: pointer;
}
.tab:focus-visible {
  outline: 3px solid #1d4ed8;
  outline-offset: 2px;
}
.tab svg {
  width: 1.2rem;
  height: 1.2rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform 0.3s ease;
}
.pip.shut .tab svg {
  transform: rotate(180deg);
}
/* Paysage (l'écran est plus large que haut) : la fenêtre est plus petite en proportion. */
@media (min-aspect-ratio: 1/1) {
  .pip {
    --w: min(28vw, 30rem);
  }
}
@media (prefers-reduced-motion: reduce) {
  .pip,
  .tab svg {
    transition: none;
  }
}
</style>
