<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { PAL, type Theme } from '../scenery'
import { SKY } from '../scenery/sky'
import Home3D from './Home3D.vue'
import { sound } from '../sound/director'
import { webglAvailable } from '../decor'
import { myTrain } from '../myTrain'

// Paysage de l'accueil : ciel, soleil, nuages, collines, arbres et une voie
// ferrée au premier plan. Tout en SVG (aucune image à charger).
// Il prend les couleurs du biome du niveau en cours (sol, arbres, voie) et un ciel à son image.
// Avec la 3D (presque partout), c'est un vrai paysage en volume (Home3D). En attendant, seul le ciel est affiché, puis la 3D
// apparaît en fondu : jamais le dessin 2D avant la 3D. Le dessin ne sert que sans 3D (pas de WebGL, ou échec du chargement).
const props = withDefaults(defineProps<{ theme?: Theme }>(), { theme: 'plaine' })

const trunk = computed(() => pal.value.trunk ?? '#7c5a3a')
const sky = computed(() => SKY[props.theme] ?? SKY.plaine)
const pal = computed(() => PAL[props.theme] ?? PAL.plaine)
const vars = computed(() => ({ '--sky-top': sky.value.top, '--sky-mid': sky.value.mid, '--sky-low': sky.value.low }))
const failed3d = ref(false)
const ready3d = ref(false)
const use3d = computed(() => !failed3d.value && webglAvailable())
watch(() => props.theme, () => (ready3d.value = false)) // nouveau paysage : le ciel le temps qu'il se charge
// Les menus ont leur musique (tant que ce paysage est affiché), et le train qui passe derrière a son son.
onMounted(() => sound.lobby(true))
onUnmounted(() => sound.lobby(false))
const STARS = [[30, 60], [90, 140], [150, 40], [210, 110], [260, 70], [350, 90], [60, 220], [180, 190], [300, 200], [380, 30], [120, 90], [240, 30]]
</script>

<template>
  <div class="landscape" data-test="landscape" :data-theme="theme" :style="vars" aria-hidden="true">
    <Home3D v-if="use3d" :key="theme + ':' + myTrain.train.join()" :theme="theme" @ready="ready3d = true" @fail="failed3d = true" @pass="sound.lobbyPass($event)" />
    <svg v-show="!use3d" viewBox="0 0 400 800" preserveAspectRatio="xMidYMax slice">
      <defs>
        <radialGradient id="sun" cx="50%" cy="50%" r="50%">
          <stop offset="0" :stop-color="sky.sun" />
          <stop offset="0.45" :stop-color="sky.sunCore" />
          <stop offset="1" :stop-color="sky.sunCore" stop-opacity="0" />
        </radialGradient>
        <!-- le train de décor : locomotive + 3 wagons, vu de côté, roues sur y=0 -->
        <g id="scenery-train">
          <rect x="0" y="-26" width="36" height="17" rx="2" fill="#dc2626" />
          <rect x="0" y="-33" width="13" height="24" rx="2" fill="#991b1b" />
          <rect x="25" y="-33" width="6" height="8" fill="#111827" />
          <circle cx="34" cy="-17" r="2.4" fill="#fde68a" />
          <rect x="40" y="-24" width="30" height="15" rx="2" fill="#f59e0b" />
          <rect x="74" y="-24" width="30" height="15" rx="2" fill="#16a34a" />
          <rect x="108" y="-24" width="30" height="15" rx="2" fill="#8b5cf6" />
          <rect x="36" y="-14" width="4" height="2" fill="#374151" />
          <rect x="70" y="-14" width="4" height="2" fill="#374151" />
          <rect x="104" y="-14" width="4" height="2" fill="#374151" />
          <g fill="#1f2937">
            <circle cx="8" cy="-5" r="4.5" /><circle cx="26" cy="-5" r="4.5" />
            <circle cx="48" cy="-5" r="4.5" /><circle cx="62" cy="-5" r="4.5" />
            <circle cx="82" cy="-5" r="4.5" /><circle cx="96" cy="-5" r="4.5" />
            <circle cx="116" cy="-5" r="4.5" /><circle cx="130" cy="-5" r="4.5" />
          </g>
        </g>
        <pattern id="sleepers" width="18" height="40" patternUnits="userSpaceOnUse">
          <rect x="0" y="6" width="10" height="28" rx="2" :fill="pal.rail.tie" />
        </pattern>
      </defs>

      <circle cx="318" cy="150" r="92" fill="url(#sun)" />
      <circle cx="318" cy="150" r="34" :fill="sky.sunCore" />
      <g v-if="sky.night" fill="#fff" data-test="stars">
        <circle v-for="(st, i) in STARS" :key="i" :cx="st[0]" :cy="st[1]" :r="i % 3 === 0 ? 1.8 : 1.1" opacity="0.85" />
      </g>

      <g class="cloud cloud--a" :fill="sky.cloud" opacity="0.95">
        <ellipse cx="80" cy="120" rx="46" ry="16" />
        <ellipse cx="110" cy="106" rx="30" ry="18" />
        <ellipse cx="58" cy="108" rx="24" ry="14" />
      </g>
      <g class="cloud cloud--b" :fill="sky.cloud" opacity="0.85">
        <ellipse cx="250" cy="236" rx="38" ry="13" />
        <ellipse cx="274" cy="224" rx="24" ry="15" />
      </g>

      <!-- collines -->
      <path d="M0 560 Q70 470 150 535 T300 520 T400 500 V800 H0 Z" :fill="pal.b" opacity="0.7" />
      <path d="M0 610 Q100 540 200 600 T400 580 V800 H0 Z" :fill="pal.b" />

      <!-- arbres -->
      <g>
        <rect x="52" y="596" width="6" height="22" :fill="trunk" />
        <circle cx="55" cy="588" r="18" :fill="pal.canopy[0]" />
        <rect x="335" y="590" width="6" height="22" :fill="trunk" />
        <circle cx="338" cy="582" r="16" :fill="pal.canopy[2]" />
        <rect x="300" y="602" width="5" height="18" :fill="trunk" />
        <circle cx="302" cy="595" r="13" :fill="pal.canopy[1]" />
      </g>

      <!-- premier plan + voie -->
      <path d="M0 650 Q200 620 400 650 V800 H0 Z" :fill="pal.a" />
      <rect x="0" y="708" width="400" height="40" fill="url(#sleepers)" />
      <rect x="0" y="716" width="400" height="5" :fill="pal.rail.rail" />
      <rect x="0" y="735" width="400" height="5" :fill="pal.rail.rail" />
      <path d="M0 760 Q200 745 400 760 V800 H0 Z" :fill="pal.b" />

      <!-- Un petit train passe de temps en temps sur la voie, un sens puis l'autre.
           La forme dessinée a la locomotive à GAUCHE : elle roule donc vers la
           gauche ; pour rouler vers la droite on la retourne. -->
      <g transform="translate(0 736)">
        <g class="train train--right" data-test="train-right">
          <g transform="translate(138 0) scale(-1 1)">
            <use href="#scenery-train" />
          </g>
        </g>
        <g class="train train--left" data-test="train-left">
          <use href="#scenery-train" />
        </g>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.landscape {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background: linear-gradient(var(--sky-top) 0%, var(--sky-mid) 55%, var(--sky-low) 100%);
  overflow: hidden;
}
svg {
  width: 100%;
  height: 100%;
  display: block;
}
.cloud {
  animation: drift 40s linear infinite alternate;
}
.cloud--b {
  animation-duration: 55s;
}
@keyframes drift {
  from {
    transform: translateX(-30px);
  }
  to {
    transform: translateX(60px);
  }
}
/* cycle de 30 s : le train traverse en ~9 s, puis la voie reste vide */
.train {
  transform: translateX(-170px);
  animation: pass 30s linear infinite;
}
.train--right {
  animation-delay: 3s;
}
.train--left {
  animation-name: pass-back; /* 560 → -170 : vers la gauche */
  animation-delay: 18s;
}
@keyframes pass {
  0% {
    transform: translateX(-170px);
  }
  30%,
  100% {
    transform: translateX(560px);
  }
}
@keyframes pass-back {
  0% {
    transform: translateX(560px);
  }
  30%,
  100% {
    transform: translateX(-170px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .cloud,
  .train {
    animation: none;
  }
  .train {
    display: none;
  }
}
</style>
