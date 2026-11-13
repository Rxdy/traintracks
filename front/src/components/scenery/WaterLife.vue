<script setup lang="ts">
import { shallowRef } from 'vue'
import type { Scenery } from '../../scenery/generate'
import { useClock } from '../../scenery/clock'
import { createWaterSim, type WaterFrame } from '../../scenery/motion'
// Vie sur l'eau : bateaux qui descendent la rivière (fondu à l'apparition et à la disparition), poissons qui
// sautent, canards sur l'étang. Dessiné entre l'eau et les ponts : les bateaux passent SOUS les ponts.
const props = defineProps<{ scenery: Scenery }>()
const sim = createWaterSim(props.scenery)
const frame = shallowRef<WaterFrame>({ boats: [], ring: null, fish: null, ducks: [] })
useClock((dt, t) => (frame.value = sim.step(dt, t)))
</script>
<template>
  <g data-test="water-life">
    <g v-for="b in frame.boats" :key="b.id" :opacity="b.opacity" :transform="`translate(${b.x} ${b.y}) rotate(${b.angle})`">
      <path d="M-0.2 -0.07 L-0.55 -0.15 M-0.2 0.07 L-0.55 0.15" stroke="#fff" stroke-width="0.02" opacity="0.55" fill="none" stroke-linecap="round" />
      <template v-if="b.kind === 0">
        <path d="M-0.17 0 Q-0.15 -0.075 0.02 -0.075 Q0.17 -0.06 0.2 0 Q0.17 0.06 0.02 0.075 Q-0.15 0.075 -0.17 0 Z" :fill="b.color" stroke="#00000033" stroke-width="0.012" />
        <path d="M-0.12 0 Q0 -0.035 0.14 0 Q0 0.035 -0.12 0 Z" fill="#f3dcae" />
        <path d="M-0.04 -0.03 L0.1 0.09 M-0.04 0.03 L0.1 -0.09" stroke="#7a4e2d" stroke-width="0.016" stroke-linecap="round" />
      </template>
      <template v-else>
        <path d="M-0.26 -0.07 H0.2 L0.28 0 L0.2 0.07 H-0.26 Z" :fill="b.color" stroke="#00000033" stroke-width="0.012" />
        <rect x="-0.16" y="-0.045" width="0.18" height="0.09" rx="0.012" fill="#fff" />
        <rect x="-0.12" y="-0.03" width="0.04" height="0.06" fill="#9ccbe2" />
        <rect x="-0.05" y="-0.03" width="0.04" height="0.06" fill="#9ccbe2" />
      </template>
    </g>
    <ellipse v-if="frame.ring" :cx="frame.ring.x" :cy="frame.ring.y" :rx="0.05 + frame.ring.k * 0.24" :ry="0.03 + frame.ring.k * 0.14" fill="none" stroke="#fff" stroke-width="0.025" :opacity="0.8 * (1 - frame.ring.k)" />
    <g v-if="frame.fish" :transform="`translate(${frame.fish.x} ${frame.fish.y - frame.fish.lift}) rotate(${frame.fish.angle}) scale(${frame.fish.scale})`">
      <path d="M-0.06 0 Q0 -0.045 0.06 0 Q0 0.045 -0.06 0 M0.06 0 l0.045 -0.04 v0.08 Z" fill="#f97316" />
    </g>
    <g v-for="(d, i) in frame.ducks" :key="'d' + i" :transform="`translate(${d.x} ${d.y}) rotate(${d.angle})`">
      <ellipse rx="0.075" ry="0.05" :fill="d.white ? '#f8fafc' : '#8b6f47'" />
      <circle cx="0.075" r="0.03" fill="#166534" />
      <path d="M0.1 0 l0.04 0.005 l-0.04 0.012 Z" fill="#f59e0b" />
    </g>
  </g>
</template>
