<script setup lang="ts">
import type { Pal } from '../../scenery/themes'
// Détails du sol : fleurs, feuilles mortes, cailloux ou bosses de neige selon l'environnement.
defineProps<{ pal: Pal; v: number }>()
</script>
<template>
  <g v-if="v === 0">
    <circle cx="28" cy="66" r="5" :fill="pal.dots[0]" /><circle cx="64" cy="40" r="5" :fill="pal.dots[1]" /><circle cx="74" cy="74" r="4.5" :fill="pal.dots[2]" />
  </g>
  <g v-else-if="v === 1">
    <path d="M30 70 l4 -12 l4 12 M62 46 l4 -12 l4 12" :stroke="pal.tuft" stroke-width="3" fill="none" stroke-linecap="round" />
  </g>
</template>
