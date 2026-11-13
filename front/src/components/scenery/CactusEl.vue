<script setup lang="ts">
import type { Pal } from '../../scenery/themes'
// Cactus (désert, canyon) : tronc et deux bras, fleur parfois. Couleurs du feuillage de l'environnement. Case de 100×100.
defineProps<{ pal: Pal; v: number }>()
</script>
<template>
  <g>
    <ellipse cx="50" cy="86" rx="22" ry="6" fill="#000" opacity="0.14" />
    <g>
      <animateTransform attributeName="transform" type="rotate" values="-1;1;-1" :dur="`${4 + (v % 3)}s`" repeatCount="indefinite" />
      <path d="M42 86 V34 a8 8 0 0 1 16 0 V86 Z" :fill="pal.canopy[0]" :stroke="pal.canopy[2]" stroke-width="2" />
      <path d="M42 62 H30 a6 6 0 0 1 -6 -6 V42 a6 6 0 0 1 12 0 V50 H42 Z" :fill="pal.canopy[1]" :stroke="pal.canopy[2]" stroke-width="2" />
      <path v-if="v !== 1" d="M58 52 H68 a6 6 0 0 0 6 -6 V34 a6 6 0 0 0 -12 0 V40 H58 Z" :fill="pal.canopy[1]" :stroke="pal.canopy[2]" stroke-width="2" />
      <path d="M50 30 V80 M45 40 V78 M55 40 V78" :stroke="pal.canopy[2]" stroke-width="1.5" opacity="0.5" fill="none" />
      <circle v-if="pal.fruit && v === 2" cx="50" cy="24" r="6" :fill="pal.fruit" />
    </g>
  </g>
</template>
