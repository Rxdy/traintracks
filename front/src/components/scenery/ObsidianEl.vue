<script setup lang="ts">
import type { Pal } from '../../scenery/themes'
// Cristaux d'obsidienne (volcan) : trois éclats noirs et brillants, une lueur de lave à leur pied. Case de 100×100.
// Le sens des éclats change avec la variante pour que deux cristaux voisins ne se ressemblent pas.
defineProps<{ pal: Pal; v: number }>()
</script>
<template>
  <g :transform="v % 2 ? 'translate(100 0) scale(-1 1)' : undefined">
    <ellipse cx="50" cy="80" rx="34" ry="9" :fill="pal.cap ?? '#ff7a1a'" opacity="0.28" />
    <ellipse cx="50" cy="80" rx="22" ry="5.5" :fill="pal.cap ?? '#ff7a1a'" opacity="0.35" />
    <!-- éclat du fond, plus petit -->
    <path d="M62 80 L66 42 L76 80 Z" fill="#241a2e" stroke="#4b3a63" stroke-width="2" stroke-linejoin="round" />
    <!-- grand éclat -->
    <path d="M30 82 L44 18 L62 82 Z" fill="#2d2140" stroke="#5b4880" stroke-width="2.5" stroke-linejoin="round" />
    <path d="M44 18 L50 82 L62 82 Z" fill="#1b1326" opacity="0.8" />
    <path d="M44 24 L38 66" stroke="#b9a6e8" stroke-width="2.5" stroke-linecap="round" opacity="0.7" />
    <!-- petit éclat couché -->
    <path d="M18 82 L22 56 L36 82 Z" fill="#33264a" stroke="#5b4880" stroke-width="2" stroke-linejoin="round" />
    <!-- veine de lave -->
    <path d="M40 82 L47 66 L45 56" fill="none" :stroke="pal.cap ?? '#ff7a1a'" stroke-width="2" stroke-linecap="round" opacity="0.9" />
  </g>
</template>
