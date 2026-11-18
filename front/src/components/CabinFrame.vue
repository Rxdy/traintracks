<script setup lang="ts">
import CabinDash from './CabinDash.vue'
import CabinWindshield from './CabinWindshield.vue'
import type { Route } from '../trainRoute'
import type { Scenery } from '../scenery/generate'
import type { LandFrame } from '../scenery/motion'
import type { Theme } from '../scenery/themes'

// La cabine du Trajet : posée par-dessus le paysage, en bas de l'écran, elle monte à la victoire (absente pendant le Plateau).
// Pare-brise (la voie défile quand le train roule), store qui se ferme à l'arrivée et porte le récapitulatif (slot « store »), tableau de bord.
defineProps<{
  shown: boolean
  scene: { route: Route; scenery: Scenery; rails: Route | null } | null
  land: LandFrame | null
  progress: number
  running: boolean
  theme?: Theme
  storeDown: boolean
}>()
</script>

<template>
  <div class="cabin" :class="{ shown }" data-test="cabin" :aria-hidden="!shown">
    <div class="cab">
      <div class="windshield">
        <CabinWindshield :scene="scene" :land="land" :progress="progress" :running="running" :theme="theme" />
        <div class="store" :class="{ down: storeDown }" data-test="store">
          <slot name="store" />
        </div>
      </div>
      <div class="pupitre-wrap">
        <CabinDash />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Cabine sous la grille, collée au décor, sur toute la largeur de l'écran et jusqu'en bas (la page a une marge : on la débord). */
.cabin {
  position: fixed;
  left: 50%;
  bottom: 0;
  z-index: 8; /* au-dessus du paysage (le plateau : 5) et de la barre du haut (6) */
  display: flex;
  align-items: stretch;
  width: min(100vw, 92vh); /* téléphone : tout l'écran ; ordinateur : bornée par la hauteur pour que le pupitre ne devienne pas géant */
  height: min(44vh, 26rem);
  transform: translate(-50%, 105%); /* rangée sous l'écran pendant le Plateau */
  pointer-events: none;
  transition: transform 0.9s cubic-bezier(0.3, 0.8, 0.3, 1) 1s; /* monte pendant que le paysage apparaît */
}
.cabin.shown {
  transform: translate(-50%, 0);
  pointer-events: auto;
}
.cab {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 0.5rem 0.4rem 0;
  border-top: 3px solid #fff;
  border-radius: 30px 30px 0 0 / 22px 22px 0 0;
  background: #1c2430;
  box-shadow: var(--shadow);
}
/* Pare-brise : s'étire pour prendre la place libre au-dessus du pupitre. */
.windshield {
  position: relative;
  flex: 1 1 0;
  min-height: 8.4rem; /* assez pour que le récapitulatif et « Niveau suivant » tiennent sur le store */
  margin-bottom: 0.45rem;
  overflow: hidden;
  border: 3px solid #0b1220;
  border-radius: 24px 24px 6px 6px / 16px 16px 6px 6px;
}
/* Le store : une fois le train arrivé, il se ferme comme un store de fenêtre (de haut en bas) et porte le récapitulatif. */
.store {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 0.3rem 0.4rem 0.9rem;
  background: repeating-linear-gradient(#d6dde7 0 11px, #bcc6d3 11px 13px);
  transform: translateY(-102%);
  transition: transform 0.9s cubic-bezier(0.45, 0.05, 0.25, 1);
}
.store.down {
  transform: translateY(0);
}
.store::after {
  /* lame du bas avec sa poignée */
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 0.55rem;
  background: #475569;
  border-top: 2px solid #64748b;
}
@media (prefers-reduced-motion: reduce) {
  .store,
  .cabin {
    transition: none;
  }
}
/* Le pupitre (dessin de 340 × 116) garde ses proportions ; tout y est placé en pourcentages : il se réduit jusqu'au téléphone. */
.pupitre-wrap {
  flex: none;
  position: relative;
  container-type: inline-size; /* les tailles des touches suivent la largeur du pupitre (unité cqw) */
}
</style>
