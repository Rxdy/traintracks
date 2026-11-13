<script setup lang="ts">
import type { Pal } from '../../scenery/themes'
// Dune (désert) : deux croissants de sable, un côté à l'ombre. Case de 100×100.
defineProps<{ pal: Pal; v: number }>()
</script>
<template>
  <g>
    <path :d="v % 2 ? 'M4 80 Q34 28 70 52 Q86 62 96 80 Z' : 'M4 82 Q26 44 56 40 Q82 38 96 82 Z'" :fill="pal.a" :stroke="pal.rock[1]" stroke-width="2" stroke-linejoin="round" />
    <path :d="v % 2 ? 'M70 52 Q86 62 96 80 H52 Q66 70 70 52 Z' : 'M56 40 Q82 38 96 82 H48 Q62 62 56 40 Z'" :fill="pal.rock[1]" opacity="0.28" />
    <path d="M18 74 q10 -6 20 0 M54 70 q8 -5 16 0" :stroke="pal.rock[1]" stroke-width="1.6" fill="none" opacity="0.5" />
  </g>
</template>
