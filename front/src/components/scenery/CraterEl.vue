<script setup lang="ts">
import type { Pal } from '../../scenery/themes'
// Cratère (lune) : cuvette sombre, bord clair, deux petits cailloux. Case de 100×100.
defineProps<{ pal: Pal; v: number }>()
</script>
<template>
  <g>
    <ellipse cx="50" cy="62" rx="36" ry="20" :fill="pal.rock[1]" opacity="0.5" />
    <ellipse cx="50" cy="60" rx="33" ry="18" :fill="pal.canopy[2]" :stroke="pal.rock[0]" stroke-width="4" />
    <ellipse cx="46" cy="64" rx="22" ry="10" :fill="pal.rock[1]" opacity="0.45" />
    <ellipse :cx="v % 2 ? 78 : 22" cy="78" rx="6" ry="4" :fill="pal.rock[0]" :stroke="pal.rock[1]" stroke-width="1.5" />
    <ellipse :cx="v % 2 ? 24 : 80" cy="34" rx="4" ry="3" :fill="pal.rock[0]" :stroke="pal.rock[1]" stroke-width="1.2" />
  </g>
</template>
