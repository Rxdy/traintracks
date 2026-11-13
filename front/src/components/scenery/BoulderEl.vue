<script setup lang="ts">
import type { Pal } from '../../scenery/themes'
// Rocher isolé.
defineProps<{ pal: Pal }>()
</script>
<template>
  <g>
    <ellipse cx="50" cy="78" rx="30" ry="7" fill="#000" opacity="0.14" />
    <path d="M22 76 Q20 50 40 44 Q62 38 76 56 Q84 70 78 76 Z" :fill="pal.rock[0]" :stroke="pal.rock[1]" stroke-width="2.5" stroke-linejoin="round" />
    <path d="M40 44 Q62 38 76 56 L60 54 Z" fill="#fff" opacity="0.35" />
  </g>
</template>
