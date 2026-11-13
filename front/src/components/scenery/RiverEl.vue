<script setup lang="ts">
import { computed } from 'vue'
import type { Scenery } from '../../scenery/generate'
import type { Pal } from '../../scenery/themes'
// Rivière (ligne lissée d'un bord à l'autre) ou étang de repli. Unité : 1 case = 1×1.
const props = defineProps<{ scenery: Scenery; pal: Pal }>()

const riverPath = computed(() => {
  const p = props.scenery.river
  if (!p || p.length < 2) return ''
  let d = `M${p[0].x} ${p[0].y}`
  for (let i = 1; i < p.length - 1; i++) {
    const m1 = { x: (p[i - 1].x + p[i].x) / 2, y: (p[i - 1].y + p[i].y) / 2 }
    const m2 = { x: (p[i].x + p[i + 1].x) / 2, y: (p[i].y + p[i + 1].y) / 2 }
    d += ` L${m1.x} ${m1.y} Q${p[i].x} ${p[i].y} ${m2.x} ${m2.y}`
  }
  const last = p[p.length - 1]
  return d + ` L${last.x} ${last.y}`
})
const pondBox = computed(() => {
  const cells = props.scenery.pond
  if (!cells.length) return null
  const rs = cells.map((c) => c[0])
  const cs = cells.map((c) => c[1])
  return { x: Math.min(...cs) + 0.08, y: Math.min(...rs) + 0.08, w: Math.max(...cs) - Math.min(...cs) + 0.84, h: Math.max(...rs) - Math.min(...rs) + 0.84 }
})
</script>
<template>
  <g>
    <template v-if="riverPath">
      <path :d="riverPath" fill="none" :stroke="pal.bank" stroke-width="0.66" stroke-linecap="round" stroke-linejoin="round" />
      <path :d="riverPath" fill="none" :stroke="pal.water" stroke-width="0.52" stroke-linecap="round" stroke-linejoin="round" />
      <path :d="riverPath" fill="none" :stroke="pal.shine" stroke-width="0.1" stroke-dasharray="0.3 0.45" stroke-linecap="round" stroke-linejoin="round" />
    </template>
    <template v-if="pondBox">
      <rect :x="pondBox.x - 0.05" :y="pondBox.y - 0.05" :width="pondBox.w + 0.1" :height="pondBox.h + 0.1" rx="0.4" :fill="pal.bank" />
      <rect :x="pondBox.x" :y="pondBox.y" :width="pondBox.w" :height="pondBox.h" rx="0.36" :fill="pal.water" />
      <rect :x="pondBox.x + 0.2" :y="pondBox.y + 0.2" :width="pondBox.w * 0.35" height="0.06" rx="0.03" :fill="pal.shine" />
    </template>
  </g>
</template>
