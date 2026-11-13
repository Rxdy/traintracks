<script setup lang="ts">
import type { Pal } from '../../scenery/themes'
// Arbre mort tordu (enfer) : tronc noir, branches nues. Case de 100×100.
defineProps<{ pal: Pal; v: number }>()
</script>
<template>
  <g>
    <ellipse cx="50" cy="86" rx="22" ry="6" fill="#000" opacity="0.3" />
    <g :transform="v % 2 ? 'translate(100 0) scale(-1 1)' : ''" :stroke="pal.canopy[2]" stroke-linecap="round" stroke-linejoin="round" fill="none">
      <path d="M50 86 C46 70 54 58 48 44 C44 34 50 26 46 14" stroke-width="7" />
      <path d="M49 58 C58 54 66 50 72 38" stroke-width="4.5" />
      <path d="M48 46 C40 42 32 40 26 28" stroke-width="4" />
      <path d="M52 52 L64 56 M33 38 L26 44 M70 42 L78 46 M46 22 L54 16" stroke-width="2.5" />
    </g>
  </g>
</template>
