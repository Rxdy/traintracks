<script setup lang="ts">
import { computed } from 'vue'
import { PAL, type Theme } from '../scenery'

// Paysage de l'accueil : ciel, soleil, nuages, collines, arbres et une voie
// ferrée au premier plan. Tout en SVG (aucune image à charger).
// Il prend les couleurs du biome du niveau en cours (sol, arbres, voie) et un ciel à son image.
const props = withDefaults(defineProps<{ theme?: Theme }>(), { theme: 'plaine' })

interface Sky { top: string; mid: string; low: string; sun: string; sunCore: string; cloud: string; night?: boolean }
const SKY: Record<Theme, Sky> = {
  plaine: { top: '#a5d8ff', mid: '#d7efff', low: '#f1faff', sun: '#fff7c2', sunCore: '#fde68a', cloud: '#ffffff' },
  foret: { top: '#9ad0c0', mid: '#cfeadf', low: '#eef8f2', sun: '#f4f9c8', sunCore: '#e5ee9a', cloud: '#f4fbf7' },
  automne: { top: '#f5c98e', mid: '#fbe3bd', low: '#fff4e2', sun: '#ffe9b0', sunCore: '#fbbf6a', cloud: '#fff8ee' },
  montagne: { top: '#8fb8e8', mid: '#c4daf3', low: '#e6f0fb', sun: '#fff7c2', sunCore: '#fde68a', cloud: '#ffffff' },
  hiver: { top: '#c3d9ee', mid: '#e1edf8', low: '#f7fbff', sun: '#ffffff', sunCore: '#eaf4ff', cloud: '#ffffff' },
  ville: { top: '#9fb4c9', mid: '#c9d6e3', low: '#e8eef4', sun: '#fff3c9', sunCore: '#fde68a', cloud: '#eef2f6' },
  desert: { top: '#8fd0f0', mid: '#fde9b8', low: '#fff4d6', sun: '#fff1b0', sunCore: '#fcd34d', cloud: '#fffaf0' },
  tropical: { top: '#59c7e8', mid: '#a8e6f0', low: '#e0f8f8', sun: '#fff7c2', sunCore: '#fde047', cloud: '#ffffff' },
  canyon: { top: '#f0a878', mid: '#f8cfa6', low: '#fde8d0', sun: '#ffe0a0', sunCore: '#fb923c', cloud: '#fff1e6' },
  volcan: { top: '#5a2a2a', mid: '#a8472f', low: '#e08a4a', sun: '#ffb27a', sunCore: '#ff6a2e', cloud: '#7a5048' },
  enfer: { top: '#2a0d12', mid: '#6b1a1a', low: '#b8341c', sun: '#ff7a3a', sunCore: '#ff3b1f', cloud: '#5a2a2a' },
  bonbons: { top: '#ffc2e2', mid: '#ffdff0', low: '#fff1fa', sun: '#fff0c2', sunCore: '#ffd6ef', cloud: '#ffffff' },
  lune: { top: '#05060f', mid: '#10132a', low: '#1d2142', sun: '#e8ecf5', sunCore: '#d3d8e6', cloud: '#2a2f55', night: true },
  neon: { top: '#150a33', mid: '#33105e', low: '#6a1f8f', sun: '#ff8ae6', sunCore: '#f0abfc', cloud: '#4a2a80', night: true },
  fusion: { top: '#9fd6ff', mid: '#f2c9b8', low: '#ffe2c2', sun: '#ffd6a0', sunCore: '#fb923c', cloud: '#ffffff' },
}
const trunk = computed(() => pal.value.trunk ?? '#7c5a3a')
const sky = computed(() => SKY[props.theme] ?? SKY.plaine)
const pal = computed(() => PAL[props.theme] ?? PAL.plaine)
const vars = computed(() => ({ '--sky-top': sky.value.top, '--sky-mid': sky.value.mid, '--sky-low': sky.value.low }))
const STARS = [[30, 60], [90, 140], [150, 40], [210, 110], [260, 70], [350, 90], [60, 220], [180, 190], [300, 200], [380, 30], [120, 90], [240, 30]]
</script>

<template>
  <div class="landscape" data-test="landscape" :data-theme="theme" :style="vars" aria-hidden="true">
    <svg viewBox="0 0 400 800" preserveAspectRatio="xMidYMax slice">
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
          <rect x="40" y="-24" width="30" height="15" rx="2" fill="#2563eb" />
          <rect x="74" y="-24" width="30" height="15" rx="2" fill="#f59e0b" />
          <rect x="108" y="-24" width="30" height="15" rx="2" fill="#16a34a" />
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
