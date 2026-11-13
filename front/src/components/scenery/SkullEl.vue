<script setup lang="ts">
import type { Pal } from '../../scenery/themes'
// Crâne posé sur un petit tas d'os (enfer). Les orbites rougeoient doucement. Case de 100×100.
defineProps<{ pal: Pal; v: number }>()
</script>
<template>
  <g>
    <ellipse cx="50" cy="84" rx="28" ry="7" fill="#000" opacity="0.3" />
    <path d="M24 82 L46 74 M76 82 L54 74 M30 76 L70 80" stroke="#e8dcc4" stroke-width="5" stroke-linecap="round" />
    <path d="M30 62 C30 40 70 40 70 62 C70 68 66 70 64 72 V76 H36 V72 C34 70 30 68 30 62 Z" fill="#f1e8d4" stroke="#b9a98a" stroke-width="2.5" stroke-linejoin="round" />
    <ellipse cx="42" cy="58" rx="6" ry="7" fill="#240c12" />
    <ellipse cx="58" cy="58" rx="6" ry="7" fill="#240c12" />
    <circle cx="42" cy="59" r="2.4" fill="#ff3b1f"><animate attributeName="opacity" values="1;0.35;1" :dur="`${1.6 + (v % 3) * 0.4}s`" repeatCount="indefinite" /></circle>
    <circle cx="58" cy="59" r="2.4" fill="#ff3b1f"><animate attributeName="opacity" values="1;0.35;1" :dur="`${1.6 + (v % 3) * 0.4}s`" repeatCount="indefinite" /></circle>
    <path d="M50 64 L47 70 H53 Z" fill="#240c12" />
    <path d="M42 76 V72 M50 76 V72 M58 76 V72" stroke="#b9a98a" stroke-width="2" />
  </g>
</template>
