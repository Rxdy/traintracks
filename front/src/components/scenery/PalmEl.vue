<script setup lang="ts">
import type { Pal } from '../../scenery/themes'
// Palmier (tropical, océan) : tronc courbe, cinq palmes qui ondulent, noix de coco. Case de 100×100.
defineProps<{ pal: Pal; v: number }>()
</script>
<template>
  <g>
    <ellipse cx="50" cy="88" rx="24" ry="6" fill="#000" opacity="0.14" />
    <path d="M48 88 Q44 60 54 34" :stroke="pal.trunk ?? '#8a5a2e'" stroke-width="7" stroke-linecap="round" fill="none" />
    <g transform="translate(54 34)">
      <g>
        <animateTransform attributeName="transform" type="rotate" :values="`-3;3;-3`" :dur="`${3.4 + (v % 3) * 0.6}s`" repeatCount="indefinite" />
        <path v-for="(a, i) in [-70, -35, 0, 35, 70]" :key="a" d="M0 0 Q18 -22 40 -4 Q20 -12 0 0 Z" :fill="pal.pine[i % 2]" :stroke="pal.pine[0]" stroke-width="1.2" :transform="`rotate(${a - 10}) ${i % 2 ? 'scale(-1 1)' : ''}`" />
        <circle cx="-4" cy="6" r="4.2" fill="#6b4226" />
        <circle cx="5" cy="7" r="4.2" fill="#7a4e2d" />
      </g>
    </g>
  </g>
</template>
