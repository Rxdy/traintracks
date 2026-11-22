<script setup lang="ts">
import { computed } from 'vue'
import { CAR_SPACING, LOCO_COLOR, starterStyle, type WagonStyle } from '../trainStyle'
// Une voiture du train vue du dessus, dans le repère du Trajet (1 case = 1 unité ; elle avance vers +x, centre en 0,0).
// i = 0 : la locomotive à vapeur ; i >= 1 : un wagon (`wagon`, sinon celui du train de départ à cette place).
// Même train que le modèle 3D (scenery3d/trainModel.ts), en plus simple ; un wagon de fret est plus long.
const props = defineProps<{ i: number; wagon?: WagonStyle | null }>()
const st = computed(() => props.wagon ?? starterStyle(Math.max(1, props.i)))
const L = computed(() => 0.52 + (st.value.length - 1) * CAR_SPACING)
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
  <g v-else-if="st.family === 'fret'">
    <!-- wagon long de fret : plancher, puis le chargement vu du dessus -->
    <rect :x="-L / 2" y="-0.11" :width="L" height="0.22" rx="0.03" :fill="st.kind === 'tank' ? '#374151' : st.color" :stroke="GOLD" stroke-width="0.012" />
    <template v-if="st.kind === 'flat'">
      <rect :x="-L / 2 + 0.02" y="-0.09" :width="L - 0.04" height="0.18" rx="0.01" fill="#a16207" />
    </template>
    <template v-else-if="st.kind === 'logs' || st.kind === 'pipes'">
      <rect v-for="y in [-0.075, -0.025, 0.025, 0.075]" :key="y" :x="-L / 2 + 0.03" :y="y - 0.022" :width="L - 0.06" height="0.044" rx="0.022" :fill="st.kind === 'logs' ? '#6b4423' : '#94a3b8'" :stroke="EDGE" stroke-width="0.006" />
    </template>
    <template v-else-if="st.kind === 'autos'">
      <rect v-for="(x, k) in [-L / 4, L / 4]" :key="x" :x="x - 0.17" y="-0.08" width="0.34" height="0.16" rx="0.05" :fill="['#ef4444', '#fbbf24'][k]" :stroke="EDGE" stroke-width="0.008" />
    </template>
    <template v-else-if="st.kind === 'boat'">
      <path d="M -0.42 -0.1 L 0.28 -0.1 Q 0.5 0 0.28 0.1 L -0.42 0.1 Z" fill="#f8fafc" :stroke="EDGE" stroke-width="0.01" />
      <rect x="-0.2" y="-0.07" width="0.22" height="0.14" rx="0.03" fill="#bfe3fa" />
    </template>
    <template v-else-if="st.kind === 'tank'">
      <rect :x="-L / 2 + 0.02" y="-0.1" :width="L - 0.04" height="0.2" rx="0.1" :fill="st.color" :stroke="EDGE" stroke-width="0.01" />
      <circle cx="0" cy="0" r="0.05" :fill="GOLD" />
    </template>
    <template v-else-if="st.kind === 'containers'">
      <rect v-for="(x, k) in [-L / 4, L / 4]" :key="x" :x="x - L / 4 + 0.02" y="-0.1" :width="L / 2 - 0.04" height="0.2" rx="0.01" :fill="[st.color, '#1d4ed8'][k]" :stroke="EDGE" stroke-width="0.008" />
    </template>
    <template v-else>
      <!-- bétail, moutons, éléphant -->
      <ellipse v-for="x in (st.kind === 'elephant' ? [0] : st.kind === 'sheep' ? [-0.3, -0.15, 0, 0.15, 0.3] : [-0.3, 0, 0.3])" :key="x" :cx="x" cy="0" :rx="st.kind === 'elephant' ? 0.24 : 0.08" :ry="st.kind === 'elephant' ? 0.09 : 0.05" :fill="st.kind === 'elephant' ? '#9ca3af' : '#f8fafc'" :stroke="EDGE" stroke-width="0.008" />
    </template>
  </g>
  <g v-else>
    <rect x="-0.26" y="-0.11" width="0.52" height="0.22" rx="0.05" :fill="st.color" :stroke="GOLD" stroke-width="0.016" />
    <template v-if="st.kind === 'gondola'">
      <rect x="-0.22" y="-0.08" width="0.44" height="0.16" rx="0.02" fill="#1f2937" />
      <circle v-for="x in [-0.12, 0, 0.12]" :key="x" :cx="x" cy="-0.01" r="0.04" fill="#374151" />
    </template>
    <template v-else-if="st.kind === 'panorama'">
      <rect x="-0.22" y="-0.08" width="0.44" height="0.16" rx="0.03" fill="#bfe3fa" />
    </template>
    <template v-else>
      <rect x="-0.24" y="-0.095" width="0.48" height="0.19" rx="0.04" fill="#fff" opacity="0.3" />
      <rect v-if="st.kind === 'coach' || st.kind === 'dining'" x="-0.13" y="-0.035" width="0.26" height="0.07" rx="0.02" fill="#fff" opacity="0.4" />
      <rect v-if="st.kind === 'caboose'" x="-0.07" y="-0.07" width="0.14" height="0.14" rx="0.02" :fill="st.color" :stroke="EDGE" stroke-width="0.01" />
      <rect v-if="st.kind === 'baggage'" x="-0.15" y="-0.05" width="0.14" height="0.1" rx="0.02" fill="#7c4a21" />
      <circle v-for="x in st.kind === 'hopper' ? [-0.15, 0, 0.15] : []" :key="x" :cx="x" cy="0" r="0.03" fill="#00000033" />
    </template>
  </g>
</template>
