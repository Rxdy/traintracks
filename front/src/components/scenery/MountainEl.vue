<script setup lang="ts">
import type { Pal } from '../../scenery/themes'
// Montagne (c'est ce que devient un rocher de la grille) ; sommet enneigé.
defineProps<{ pal: Pal; v: number }>()
</script>
<template>
  <g>
    <ellipse cx="50" cy="88" rx="44" ry="8" fill="#000" opacity="0.16" />
    <path :d="v === 1 ? 'M4 88 L34 30 L52 58 L68 24 L96 88 Z' : 'M6 88 L38 18 L62 56 L72 40 L94 88 Z'" :fill="pal.rock[0]" :stroke="pal.rock[1]" stroke-width="2.5" stroke-linejoin="round" />
    <path :d="v === 1 ? 'M68 24 L58 44 L66 40 L72 46 L78 40 Z' : 'M38 18 L26 42 L34 38 L40 46 L48 38 Z'" fill="#fff" />
    <path :d="v === 1 ? 'M68 24 L96 88 L66 88 Z' : 'M38 18 L62 56 L72 40 L94 88 L48 88 Z'" :fill="pal.rock[1]" opacity="0.28" />
  </g>
</template>
