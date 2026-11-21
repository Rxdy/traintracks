<script setup lang="ts">
import { computed } from 'vue'
import { PAL, type Theme } from '../scenery'
import { SKY } from '../scenery/sky'
import { carOffsets } from '../trainStyle'
import { trainWagons } from '../myTrain'
import TrainCar from './TrainCar.vue'
// Écran de chargement entre « Jouer » et la grille : toujours affiché, le niveau (serveur) et le décor (fichiers) arrivent ensemble.
// Fond : un paysage dessiné aux couleurs du biome du niveau (ni l'icône de l'appli, ni le fond du bouton Jouer). La barre est une voie :
// le train avance en tête du remplissage.
const props = withDefaults(defineProps<{ level: number; progress: number; theme?: Theme }>(), { theme: 'plaine' })
const sky = computed(() => SKY[props.theme] ?? SKY.plaine)
const pal = computed(() => PAL[props.theme] ?? PAL.plaine)
// le train du joueur (Mon train), dessiné de la queue à la locomotive (la locomotive par-dessus)
// longueur dessinée : de la queue du dernier wagon au nez de la locomotive (2,4 pour le train de départ)
const trainSpan = computed(() => {
  const off = carOffsets(trainWagons.value)
  const last = trainWagons.value[trainWagons.value.length - 1]
  return off[off.length - 1]! + (last ? last.length * 0.31 : 0.31) + 0.26 + 0.04
})
const loadingCars = computed(() => {
  const off = carOffsets(trainWagons.value)
  return [null, ...trainWagons.value].map((w, i) => ({ i, w, off: off[i]! })).reverse()
})
</script>

<template>
  <div class="loading" data-test="level-loading" role="status" aria-live="polite">
    <svg class="land" viewBox="0 0 400 800" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id="load-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" :stop-color="sky.top" />
          <stop offset="0.55" :stop-color="sky.mid" />
          <stop offset="1" :stop-color="sky.low" />
        </linearGradient>
      </defs>
      <rect width="400" height="800" fill="url(#load-sky)" />
      <circle cx="320" cy="250" r="30" :fill="sky.sunCore" />
      <g :fill="sky.cloud" opacity="0.9">
        <ellipse cx="80" cy="300" rx="46" ry="15" /><ellipse cx="108" cy="288" rx="28" ry="16" />
        <ellipse cx="270" cy="380" rx="38" ry="12" /><ellipse cx="292" cy="369" rx="22" ry="13" />
      </g>
      <path d="M0 560 Q70 480 150 540 T300 525 T400 505 V800 H0 Z" :fill="pal.b" opacity="0.75" />
      <path d="M0 610 Q100 545 200 600 T400 585 V800 H0 Z" :fill="pal.b" />
      <g>
        <rect x="52" y="598" width="6" height="20" :fill="pal.trunk ?? '#7c5a3a'" /><circle cx="55" cy="590" r="17" :fill="pal.canopy[0]" />
        <rect x="335" y="592" width="6" height="20" :fill="pal.trunk ?? '#7c5a3a'" /><circle cx="338" cy="584" r="15" :fill="pal.canopy[2]" />
        <rect x="298" y="604" width="5" height="16" :fill="pal.trunk ?? '#7c5a3a'" /><circle cx="300" cy="597" r="12" :fill="pal.canopy[1]" />
      </g>
      <path d="M0 650 Q200 622 400 650 V800 H0 Z" :fill="pal.a" />
      <path d="M0 740 Q200 726 400 740 V800 H0 Z" :fill="pal.b" />
    </svg>
    <div class="veil" aria-hidden="true"></div>
    <h1 class="title" aria-hidden="true"><span>Train</span><span>Tracks</span></h1>
    <p class="level" data-test="loading-level">Niveau {{ level }}</p>

    <div class="foot">
      <p class="label">Chargement…</p>
      <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="Math.round(progress * 100)" :style="{ '--p': progress }">
        <span class="fill"></span>
        <!-- le train du joueur (Mon train), vu du dessus ; la locomotive est à droite -->
        <svg class="train" :viewBox="`${-trainSpan + 0.26} -0.14 ${trainSpan} 0.28`" :style="{ '--train-k': Math.min(2.2, trainSpan / 2.4) }" aria-hidden="true">
          <TrainCar v-for="c in loadingCars" :key="c.i" :i="c.i" :wagon="c.w" :transform="`translate(${-c.off} 0)`" />
        </svg>
      </div>
    </div>
  </div>
</template>

<style scoped>
.loading {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: hidden;
  background: #4f8f6b;
}
.land {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
.veil {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(15, 23, 42, 0.15), rgba(15, 23, 42, 0) 30%, rgba(15, 23, 42, 0) 70%, rgba(15, 23, 42, 0.25));
}
/* Titre : lettres blanches épaisses, contour bleu nuit net, ombre pleine (pas de flou). */
.title {
  position: relative;
  margin: clamp(2.5rem, 9vh, 5rem) 0 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 0.95;
  font-size: clamp(2.1rem, 9.5vw, 3.6rem);
  font-weight: 900;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: #fff;
  -webkit-text-stroke: 0.12em #1e3a8a;
  paint-order: stroke fill;
  text-shadow: 0 0.07em 0 #1e3a8a;
}
.title span:first-child {
  color: #fde047;
}
.level {
  position: relative;
  margin: 0.8rem 0 0;
  font-size: 1.3rem;
  font-weight: 800;
  color: #fff;
  -webkit-text-stroke: 0.2em #1e3a8a;
  paint-order: stroke fill;
}
.foot {
  position: relative;
  margin-top: auto;
  width: min(84vw, 26rem);
  padding-bottom: clamp(2.5rem, 9vh, 5rem);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
}
.label {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #fff;
  -webkit-text-stroke: 0.2em #1e3a8a;
  paint-order: stroke fill;
}
/* La barre : contour blanc, fond bleu nuit ; --p va de 0 à 1. */
.bar {
  --train: 6.4rem; /* largeur du train = largeur minimale du remplissage */
  position: relative;
  width: 100%;
  height: 1.1rem;
  border: 0.2rem solid #fff;
  border-radius: 999px;
  background: #1e1b6b;
  box-shadow: 0 0.2rem 0 rgba(0, 0, 0, 0.3);
}
.fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: calc(var(--train) + (100% - var(--train)) * var(--p));
  border-radius: 999px;
  background: #84cc16;
  transition: width 0.35s ease-out;
}
.train {
  position: absolute;
  top: 50%;
  translate: 0 -50%;
  left: calc((100% - var(--train) * var(--train-k, 1)) * var(--p));
  width: calc(var(--train) * var(--train-k, 1));
  height: auto;
  transition: left 0.35s ease-out;
}
@media (prefers-reduced-motion: reduce) {
  .fill,
  .train {
    transition: none;
  }
}
</style>
