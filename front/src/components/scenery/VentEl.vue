<script setup lang="ts">
import type { Pal } from '../../scenery/themes'
// Fumerolle (volcan) : petit cône de roche noire, fissure incandescente, panache de vapeur. Case de 100×100.
defineProps<{ pal: Pal; v: number }>()
</script>
<template>
  <g>
    <ellipse cx="50" cy="84" rx="26" ry="7" fill="#000" opacity="0.25" />
    <path d="M22 84 L40 48 H60 L78 84 Z" :fill="pal.rock[0]" :stroke="pal.rock[1]" stroke-width="2.5" stroke-linejoin="round" />
    <path d="M44 48 H56 L53 56 H47 Z" :fill="pal.cap ?? '#ff7a1a'" />
    <path d="M50 58 L47 70 M50 58 L55 68" :stroke="pal.cap ?? '#ff7a1a'" stroke-width="2.5" stroke-linecap="round" fill="none" />
    <circle v-for="i in 3" :key="i" cx="50" cy="44" r="5" fill="#d1d5db" opacity="0">
      <animate attributeName="cy" from="44" to="6" :dur="`${3 + (v % 3) * 0.4}s`" :begin="`${-i}s`" repeatCount="indefinite" />
      <animate attributeName="cx" from="50" to="62" :dur="`${3 + (v % 3) * 0.4}s`" :begin="`${-i}s`" repeatCount="indefinite" />
      <animate attributeName="r" from="5" to="13" :dur="`${3 + (v % 3) * 0.4}s`" :begin="`${-i}s`" repeatCount="indefinite" />
      <animate attributeName="opacity" values="0.7;0" :dur="`${3 + (v % 3) * 0.4}s`" :begin="`${-i}s`" repeatCount="indefinite" />
    </circle>
  </g>
</template>
