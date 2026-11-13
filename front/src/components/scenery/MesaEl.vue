<script setup lang="ts">
import type { Pal } from '../../scenery/themes'
// Mesa du Grand Canyon : butte à sommet plat, flancs rayés de strates. Case de 100×100.
defineProps<{ pal: Pal; v: number }>()
</script>
<template>
  <g>
    <ellipse cx="50" cy="90" rx="44" ry="8" fill="#000" opacity="0.16" />
    <path :d="v % 2 ? 'M8 88 L16 44 H46 L52 56 H62 L70 40 H84 L94 88 Z' : 'M6 88 L14 38 H80 L94 88 Z'" :fill="pal.rock[0]" :stroke="pal.rock[1]" stroke-width="2.5" stroke-linejoin="round" />
    <path :d="v % 2 ? 'M16 44 H46 L52 56 H62 L70 40 H84 L86 48 H16 Z' : 'M14 38 H80 L82 48 H12 Z'" :fill="pal.cap ?? '#e9b27a'" />
    <path :d="v % 2 ? 'M12 62 H92 M10 74 H94' : 'M10 62 H90 M8 74 H93'" :stroke="pal.rock[1]" stroke-width="3" opacity="0.5" />
    <path :d="v % 2 ? 'M70 40 L94 88 L66 88 Z' : 'M56 38 H80 L94 88 H56 Z'" :fill="pal.rock[1]" opacity="0.25" />
  </g>
</template>
