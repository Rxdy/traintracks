<script setup lang="ts">
import type { Pal } from '../../scenery/themes'
// Arbre feuillu. Couleurs du feuillage selon la saison (vert, roux, givré). Dessiné dans une case de 100×100.
defineProps<{ pal: Pal; v: number }>()
</script>
<template>
  <g>
    <ellipse cx="50" cy="84" rx="28" ry="8" fill="#000" opacity="0.14" />
    <rect x="45" y="56" width="10" height="28" rx="3" :fill="pal.trunk ?? '#7a4e2d'" />
    <g><animateTransform attributeName="transform" type="rotate" :values="`-1.6 50 84;1.6 50 84;-1.6 50 84`" :dur="3.6 + (v % 3) * 0.7 + 's'" repeatCount="indefinite" />
    <circle cx="50" cy="40" r="26" :fill="pal.canopy[0]" />
    <circle cx="38" cy="48" r="17" :fill="pal.canopy[1]" />
    <circle cx="62" cy="46" r="17" :fill="pal.canopy[2]" />
    <template v-if="pal.fruit && v === 2"><circle cx="44" cy="36" r="4" :fill="pal.fruit" /><circle cx="60" cy="48" r="4" :fill="pal.fruit" /></template>
    </g>
  </g>
</template>
