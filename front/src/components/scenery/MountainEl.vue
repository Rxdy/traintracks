<script setup lang="ts">
import type { Pal } from '../../scenery/themes'
// Montagne (c'est ce que devient un rocher de la grille) ; sommet enneigé.
const props = defineProps<{ pal: Pal; v: number }>()
// sommet en lave : c'est un volcan, il fume
const lava = props.pal.cap === '#ff7a1a' || props.pal.cap === '#ff5a1f'
const px = props.v === 1 ? 68 : 38
const py = props.v === 1 ? 24 : 18
</script>
<template>
  <g>
    <ellipse cx="50" cy="88" rx="44" ry="8" fill="#000" opacity="0.16" />
    <path :d="v === 1 ? 'M4 88 L34 30 L52 58 L68 24 L96 88 Z' : 'M6 88 L38 18 L62 56 L72 40 L94 88 Z'" :fill="pal.rock[0]" :stroke="pal.rock[1]" stroke-width="2.5" stroke-linejoin="round" />
    <path :d="v === 1 ? 'M68 24 L58 44 L66 40 L72 46 L78 40 Z' : 'M38 18 L26 42 L34 38 L40 46 L48 38 Z'" :fill="pal.cap ?? '#fff'" />
    <path :d="v === 1 ? 'M68 24 L96 88 L66 88 Z' : 'M38 18 L62 56 L72 40 L94 88 L48 88 Z'" :fill="pal.rock[1]" opacity="0.28" />
    <circle v-if="lava" v-for="i in 3" :key="i" :cx="px" :cy="py" r="4" fill="#d1d5db" opacity="0">
      <animate attributeName="cy" :from="py" :to="py - 30" dur="3.2s" :begin="`${-i}s`" repeatCount="indefinite" />
      <animate attributeName="cx" :from="px" :to="px + 12" dur="3.2s" :begin="`${-i}s`" repeatCount="indefinite" />
      <animate attributeName="r" from="4" to="11" dur="3.2s" :begin="`${-i}s`" repeatCount="indefinite" />
      <animate attributeName="opacity" values="0.65;0" dur="3.2s" :begin="`${-i}s`" repeatCount="indefinite" />
    </circle>
  </g>
</template>
