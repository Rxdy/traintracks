<script setup lang="ts">
import { computed } from 'vue'
import type { Road } from '../../scenery/generate'
import type { Pal } from '../../scenery/themes'
// Route d'un bord à l'autre (asphalte, bordures, pointillés blancs) ; au passage à niveau, des traverses en travers.
// Unité : 1 case = 1×1.
const props = defineProps<{ road: Road; rows: number; cols: number; pal: Pal }>()
const d = computed(() => {
  const m = props.road.line + 0.5
  return props.road.axis === 'v' ? `M${m} -0.4 L${m} ${props.rows + 0.4}` : `M-0.4 ${m} L${props.cols + 0.4} ${m}`
})
const planks = computed(() => {
  const x = props.road.crossing
  if (!x) return []
  // 6 planches en travers de la chaussée, dans le sens de la voie (perpendiculaire à la route)
  return Array.from({ length: 6 }, (_, i) => {
    const o = -0.42 + i * 0.14
    return props.road.axis === 'v'
      ? { x: x[1] + 0.5 - 0.27, y: x[0] + 0.5 + o, w: 0.54, h: 0.07 }
      : { x: x[1] + 0.5 + o, y: x[0] + 0.5 - 0.27, w: 0.07, h: 0.54 }
  })
})
</script>
<template>
  <g data-test="road">
    <path :d="d" fill="none" :stroke="pal.bedEdge" stroke-width="0.62" />
    <path :d="d" fill="none" :stroke="pal.road" stroke-width="0.54" />
    <path :d="d" fill="none" stroke="#fff" stroke-width="0.03" stroke-dasharray="0.18 0.16" opacity="0.8" />
    <rect v-for="(p, i) in planks" :key="i" :x="p.x" :y="p.y" :width="p.w" :height="p.h" :fill="pal.rail.tie" opacity="0.9" />
  </g>
</template>
