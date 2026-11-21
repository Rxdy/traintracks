<script setup lang="ts">
import { LOCO_COLOR, wagonColor } from '../trainStyle'
// Une voiture du train vue du dessus, dans le repère du Trajet (1 case = 1 unité ; elle avance vers +x, centre en 0,0).
// i = 0 : la locomotive à vapeur ; i >= 1 : les wagons (caisses, toit à fenêtres, charbon). Même train que le modèle 3D (scenery3d/trainModel.ts).
defineProps<{ i: number }>()
const GOLD = '#fbbf24'
const EDGE = '#00000044'
</script>

<template>
  <g v-if="i === 0">
    <!-- châssis, chaudière rouge à bandes dorées, cabine au fond, dôme, cheminée, phare -->
    <rect x="-0.23" y="-0.1" width="0.5" height="0.2" rx="0.03" fill="#374151" />
    <rect x="-0.02" y="-0.095" width="0.26" height="0.19" rx="0.06" :fill="LOCO_COLOR" :stroke="EDGE" stroke-width="0.012" />
    <rect x="0.03" y="-0.095" width="0.02" height="0.19" :fill="GOLD" />
    <rect x="0.15" y="-0.095" width="0.02" height="0.19" :fill="GOLD" />
    <rect x="-0.21" y="-0.11" width="0.2" height="0.22" rx="0.03" fill="#7f1d1d" :stroke="EDGE" stroke-width="0.012" />
    <rect x="-0.19" y="-0.09" width="0.16" height="0.18" rx="0.02" fill="#991b1b" />
    <circle cx="0.09" cy="0" r="0.04" :fill="GOLD" />
    <circle cx="0.2" cy="0" r="0.045" fill="#1f2937" :stroke="GOLD" stroke-width="0.016" />
    <circle cx="0.255" cy="0" r="0.028" fill="#fef3c7" />
  </g>
  <g v-else>
    <rect x="-0.26" y="-0.11" width="0.52" height="0.22" rx="0.05" :fill="wagonColor(i)" :stroke="GOLD" stroke-width="0.016" />
    <rect x="-0.2" y="-0.075" width="0.4" height="0.15" rx="0.03" fill="#fff" opacity="0.22" />
    <template v-if="(i - 1) % 3 === 0">
      <rect x="-0.17" y="-0.07" width="0.1" height="0.09" rx="0.012" fill="#a16207" />
      <rect x="0.04" y="-0.02" width="0.1" height="0.09" rx="0.012" fill="#a16207" />
      <rect x="-0.06" y="0.0" width="0.08" height="0.07" rx="0.012" fill="#854d0e" />
    </template>
    <template v-else-if="(i - 1) % 3 === 1">
      <rect v-for="x in [-0.17, -0.04, 0.09]" :key="x" :x="x" y="-0.1" width="0.08" height="0.025" rx="0.006" fill="#bfe3fa" />
      <rect v-for="x in [-0.17, -0.04, 0.09]" :key="'b' + x" :x="x" y="0.075" width="0.08" height="0.025" rx="0.006" fill="#bfe3fa" />
    </template>
    <template v-else>
      <circle cx="-0.11" cy="0" r="0.07" fill="#374151" />
      <circle cx="0.11" cy="0" r="0.07" fill="#374151" />
      <circle cx="-0.13" cy="-0.02" r="0.02" fill="#6b7280" opacity="0.7" />
      <circle cx="0.09" cy="-0.02" r="0.02" fill="#6b7280" opacity="0.7" />
    </template>
  </g>
</template>
