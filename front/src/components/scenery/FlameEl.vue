<script setup lang="ts">
import type { Pal } from '../../scenery/themes'
// Feu de joie qui crépite (volcan, enfer) : braises au sol, trois flammes qui vacillent. Case de 100×100.
defineProps<{ pal: Pal; v: number }>()
</script>
<template>
  <g>
    <ellipse cx="50" cy="82" rx="26" ry="8" fill="#000" opacity="0.3" />
    <ellipse cx="50" cy="80" rx="18" ry="6" :fill="pal.rock[1]" />
    <g>
      <animateTransform attributeName="transform" type="scale" additive="sum" values="1 1;1.06 0.94;0.97 1.05;1 1" :dur="`${0.9 + (v % 3) * 0.2}s`" repeatCount="indefinite" />
      <path d="M50 18 C64 38 72 50 66 68 C62 78 38 78 34 68 C28 50 42 40 50 18 Z" fill="#ef4444" />
      <path d="M50 34 C60 48 64 58 60 70 C56 77 44 77 40 70 C36 58 44 50 50 34 Z" fill="#f97316" />
      <path d="M50 50 C56 58 57 66 54 72 C52 76 48 76 46 72 C43 66 44 58 50 50 Z" fill="#fde047" />
    </g>
  </g>
</template>
