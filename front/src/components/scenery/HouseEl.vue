<script setup lang="ts">
import type { Pal } from '../../scenery/themes'
// Maison, chalet ou cabane selon la palette (murs de bois en forêt et en montagne) ; toit enneigé en hiver.
defineProps<{ pal: Pal; v: number }>()
</script>
<template>
  <g>
    <ellipse cx="50" cy="86" rx="38" ry="7" fill="#000" opacity="0.14" />
    <rect x="18" y="44" width="64" height="40" :fill="pal.walls[v % pal.walls.length]" stroke="#a8977a" stroke-width="2.5" />
    <path d="M10 46 L50 14 L90 46 Z" :fill="pal.roofs[v % pal.roofs.length]" :stroke="pal.snow ? '#b4c4d6' : '#00000030'" stroke-width="2" stroke-linejoin="round" />
    <rect x="44" y="58" width="14" height="26" rx="2" fill="#7a4e2d" />
    <rect x="24" y="54" width="12" height="12" fill="#bfe3fa" stroke="#a8977a" stroke-width="2" />
    <rect x="66" y="54" width="12" height="12" fill="#bfe3fa" stroke="#a8977a" stroke-width="2" />
    <rect x="66" y="22" width="8" height="14" fill="#a8977a" />
    <path v-if="pal.snow" d="M66 22 h8 v-3 h-8 Z" fill="#fff" />
    <circle v-for="i in 3" :key="i" cx="70" cy="20" r="3" :fill="pal.snow ? '#fff' : '#f5f5f5'" opacity="0">
      <animate attributeName="cy" from="20" to="-14" dur="3s" :begin="`${-i}s`" repeatCount="indefinite" />
      <animate attributeName="cx" from="70" to="82" dur="3s" :begin="`${-i}s`" repeatCount="indefinite" />
      <animate attributeName="r" from="3" to="9" dur="3s" :begin="`${-i}s`" repeatCount="indefinite" />
      <animate attributeName="opacity" values="0.75;0" dur="3s" :begin="`${-i}s`" repeatCount="indefinite" />
    </circle>
  </g>
</template>
