<script setup lang="ts">
import type { Pal } from '../../scenery/themes'
// Sapin ; neige sur les branches quand l'environnement est enneigé.
defineProps<{ pal: Pal }>()
</script>
<template>
  <g>
    <ellipse cx="50" cy="88" rx="22" ry="6" fill="#000" opacity="0.14" />
    <rect x="46" y="72" width="8" height="16" fill="#6b4226" />
    <path d="M50 8 L74 42 H60 L80 70 H20 L40 42 H26 Z" :fill="pal.pine[0]" />
    <path d="M50 8 L64 42 H50 L66 70 H50 Z" :fill="pal.pine[1]" opacity="0.7" />
    <template v-if="pal.snow">
      <path d="M50 8 L61 24 L50 21 L39 24 Z" fill="#fff" /><path d="M40 42 L47 38 L58 38 L62 42 L50 46 Z" fill="#fff" /><path d="M24 69 L32 60 L68 60 L76 69 L60 66 L40 66 Z" fill="#fff" />
    </template>
  </g>
</template>
