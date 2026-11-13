<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import type { Scenery } from '../scenery/generate'
import { useClock } from '../scenery/clock'
import { createLandSim, type LandFrame } from '../scenery/motion'
import { PAL } from '../scenery/themes'

// Le décor qui vit AU-DESSUS des rails : voitures et barrières du passage à niveau, animaux, oiseaux, feuilles ou
// neige qui tombent. Les voitures s'arrêtent quand le train approche (`trainNear`) et repartent après son passage.
// Même repère que le train : 1 case = 1×1, la grille occupe 0..size (le reste, c'est la colonne des indices).
const props = defineProps<{ scenery: Scenery; trainNear: boolean }>()
const n = computed(() => props.scenery.size)
const pal = computed(() => PAL[props.scenery.theme])
const sim = createLandSim(props.scenery)
const empty: LandFrame = { cars: [], barrier: 0, lights: false, animals: [], birds: [], flakes: [], leaves: [], }
const frame = shallowRef<LandFrame>(empty)
useClock((dt, t) => (frame.value = sim.step(dt, t, props.trainNear)))

// Repère de la route : x = en travers, y = le long (u). Une route horizontale est le même dessin « couché ».
const roadFrame = computed(() => {
  const r = props.scenery.road
  if (!r) return ''
  const m = r.line + 0.5
  return r.axis === 'v' ? `translate(${m} 0)` : `matrix(0 1 1 0 0 ${m})`
})
// Bras de barrière : 0 = relevé (debout), 1 = baissé en travers de la voie de droite.
const armA = computed(() => -85 + 85 * frame.value.barrier)
const armB = computed(() => 265 - 85 * frame.value.barrier)
const uc = computed(() => sim.uc ?? 0)
</script>

<template>
  <svg class="life" :viewBox="`0 0 ${n + 1} ${n + 1}`" data-test="scenery-life" aria-hidden="true">
    <defs>
      <clipPath id="life-clip"><rect x="0" y="0" :width="n" :height="n" rx="0.18" /></clipPath>
    </defs>
    <g clip-path="url(#life-clip)">
      <!-- route : voitures et barrières -->
      <g v-if="scenery.road" :transform="roadFrame">
        <g v-for="c in frame.cars" :key="c.id" :transform="`translate(${c.lane} ${c.u}) rotate(${c.dir > 0 ? 90 : -90})`">
          <template v-if="c.kind === 1">
            <rect x="-0.24" y="-0.1" width="0.3" height="0.2" rx="0.02" fill="#e5e7eb" stroke="#00000033" stroke-width="0.01" />
            <rect x="0.07" y="-0.1" width="0.15" height="0.2" rx="0.03" :fill="c.color" />
            <rect x="0.14" y="-0.08" width="0.05" height="0.16" fill="#9ccbe2" />
          </template>
          <template v-else>
            <rect x="-0.16" y="-0.09" width="0.32" height="0.18" rx="0.04" :fill="c.color" stroke="#00000033" stroke-width="0.01" />
            <rect x="-0.04" y="-0.07" width="0.09" height="0.14" rx="0.02" fill="#bfe3fa" />
            <rect x="0.09" y="-0.07" width="0.04" height="0.14" fill="#9ccbe2" />
            <rect x="0.15" y="-0.075" width="0.02" height="0.03" fill="#fde68a" />
            <rect x="0.15" y="0.045" width="0.02" height="0.03" fill="#fde68a" />
          </template>
        </g>
        <template v-if="scenery.road.crossing">
          <g :transform="`translate(-0.42 ${uc - 0.3})`" data-test="barrier">
            <circle r="0.045" fill="#374151" />
            <g :transform="`rotate(${armA})`">
              <rect x="-0.02" y="-0.025" width="0.62" height="0.05" fill="#fff" stroke="#00000033" stroke-width="0.008" />
              <rect v-for="k in 3" :key="k" :x="0.08 + (k - 1) * 0.17" y="-0.025" width="0.08" height="0.05" fill="#dc2626" />
            </g>
            <circle cx="0" cy="-0.1" r="0.04" :fill="frame.lights ? '#ef4444' : '#7f1d1d'" />
          </g>
          <g :transform="`translate(0.42 ${uc + 0.3})`">
            <circle r="0.045" fill="#374151" />
            <g :transform="`rotate(${armB})`">
              <rect x="-0.02" y="-0.025" width="0.62" height="0.05" fill="#fff" stroke="#00000033" stroke-width="0.008" />
              <rect v-for="k in 3" :key="k" :x="0.08 + (k - 1) * 0.17" y="-0.025" width="0.08" height="0.05" fill="#dc2626" />
            </g>
            <circle cx="0" cy="0.1" r="0.04" :fill="frame.lights ? '#ef4444' : '#7f1d1d'" />
          </g>
        </template>
      </g>

      <!-- animaux -->
      <g v-for="a in frame.animals" :key="a.id" :transform="`translate(${a.x} ${a.y}) scale(${a.face * 1.45} 1.45)`">
        <template v-if="a.kind === 'owl'">
          <g :transform="`rotate(${Math.sin(a.t * 0.5) * 4})`">
            <ellipse cx="0" cy="0.05" rx="0.12" ry="0.14" fill="#8b6f47" />
            <path d="M-0.1 -0.08 l0.02 -0.08 l0.06 0.04 M0.1 -0.08 l-0.02 -0.08 l-0.06 0.04" fill="#6b5436" stroke="#6b5436" stroke-width="0.02" />
            <circle cx="-0.05" cy="-0.02" r="0.052" fill="#fff7d6" />
            <circle cx="0.05" cy="-0.02" r="0.052" fill="#fff7d6" />
            <circle :cx="-0.05 + (a.look ?? 0) * 0.02" cy="-0.02" r="0.024" fill="#111827" />
            <circle :cx="0.05 + (a.look ?? 0) * 0.02" cy="-0.02" r="0.024" fill="#111827" />
            <ellipse cx="-0.05" cy="-0.02" rx="0.054" :ry="0.055 * (a.blink ?? 0)" fill="#8b6f47" />
            <ellipse cx="0.05" cy="-0.02" rx="0.054" :ry="0.055 * (a.blink ?? 0)" fill="#8b6f47" />
            <path d="M-0.016 0.015 l0.016 0.04 l0.016 -0.04 Z" fill="#f59e0b" />
            <path d="M-0.08 0.1 q0.08 0.07 0.16 0" stroke="#6b5436" stroke-width="0.02" fill="none" />
          </g>
        </template>
        <template v-else-if="a.kind === 'squirrel'">
          <g :transform="`rotate(${a.wag ?? 0} -0.06 0.01)`"><path d="M-0.06 0.01 q-0.12 -0.02 -0.1 -0.12 q0.03 -0.1 0.1 -0.04" fill="#c2652a" stroke="#7a3d17" stroke-width="0.012" /></g>
          <ellipse rx="0.065" ry="0.042" fill="#d9772f" stroke="#7a3d17" stroke-width="0.012" />
          <circle cx="0.07" cy="-0.01" r="0.033" fill="#d9772f" stroke="#7a3d17" stroke-width="0.012" />
          <circle cx="0.085" cy="-0.015" r="0.008" fill="#111827" />
          <path d="M0.06 -0.04 l0.01 -0.03 l0.02 0.03" fill="#d9772f" />
        </template>
        <template v-else-if="a.kind === 'deer'">
          <ellipse rx="0.12" ry="0.065" fill="#a0642d" stroke="#5a3515" stroke-width="0.012" />
          <circle cx="0.13" cy="-0.01" r="0.04" fill="#a0642d" stroke="#5a3515" stroke-width="0.012" />
          <path d="M0.15 -0.04 l0.04 -0.08 m-0.02 0.06 l0.05 -0.03 M0.12 -0.045 l0.01 -0.1 m0 0.05 l-0.04 -0.04" stroke="#e8d4b0" stroke-width="0.016" stroke-linecap="round" fill="none" />
          <circle cx="-0.03" cy="-0.02" r="0.012" fill="#fde9c9" />
          <circle cx="0.03" cy="0.025" r="0.012" fill="#fde9c9" />
          <circle cx="0.165" cy="-0.01" r="0.008" fill="#111827" />
          <ellipse cx="0.11" cy="-0.04" rx="0.02" ry="0.011" fill="#7a4a20" :transform="`rotate(${Math.sin(a.t * 3) > 0.8 ? -25 : 0} 0.11 -0.04)`" />
        </template>
        <template v-else-if="a.kind === 'rabbit'">
          <g :stroke="pal.snow ? '#94a3b8' : '#6b5a45'" stroke-width="0.012">
            <ellipse rx="0.065" ry="0.045" :fill="pal.snow ? '#fff' : '#b9a58b'" />
            <circle cx="0.07" cy="-0.005" r="0.032" :fill="pal.snow ? '#fff' : '#b9a58b'" />
            <ellipse cx="0.065" cy="-0.04" rx="0.01" ry="0.032" :fill="pal.snow ? '#fecdd3' : '#b9a58b'" />
            <ellipse cx="0.085" cy="-0.04" rx="0.01" ry="0.032" :fill="pal.snow ? '#fecdd3' : '#b9a58b'" />
          </g>
          <circle cx="-0.07" r="0.02" fill="#fff" />
          <circle cx="0.085" cy="-0.005" r="0.008" fill="#111827" />
        </template>
        <template v-else-if="a.kind === 'hedgehog'">
          <ellipse rx="0.08" ry="0.055" fill="#6b4a2b" stroke="#3b2713" stroke-width="0.012" />
          <path v-for="x in [-0.04, -0.01, 0.02, 0.05]" :key="x" :d="`M${x} -0.05 l0.01 -0.03 M${x} 0.05 l0.01 0.03`" stroke="#3b2713" stroke-width="0.012" />
          <ellipse cx="0.085" cy="0" rx="0.035" ry="0.028" fill="#e8c9a0" stroke="#3b2713" stroke-width="0.01" />
          <circle cx="0.108" r="0.009" fill="#111827" />
        </template>
        <template v-else-if="a.kind === 'butterfly'">
          <g :transform="`rotate(${Math.cos(a.t * 0.7) * 40})`">
            <g :transform="`scale(1 ${0.35 + Math.abs(Math.sin(a.t * 14)) * 0.65})`" :fill="['#f472b6', '#facc15', '#60a5fa'][a.id % 3]">
              <ellipse cx="-0.03" cy="-0.02" rx="0.04" ry="0.025" />
              <ellipse cx="-0.03" cy="0.02" rx="0.04" ry="0.025" />
            </g>
            <rect x="-0.01" y="-0.005" width="0.05" height="0.01" fill="#111827" />
          </g>
        </template>
      </g>

      <!-- oiseaux : ombre au sol décalée, oiseau au-dessus -->
      <template v-for="b in frame.birds" :key="'b' + b.id">
        <ellipse :cx="b.x + 0.22" :cy="b.y + 0.35" rx="0.07" ry="0.025" fill="#000" opacity="0.12" />
        <g :transform="`translate(${b.x} ${b.y})`" fill="none" stroke-linecap="round" stroke-width="0.03" :stroke="b.dark ? '#1f2937' : '#ffffff'">
          <path d="M0 0 q-0.08 -0.06 -0.16 0" :transform="`rotate(${b.flap * 30})`" />
          <path d="M0 0 q0.08 -0.06 0.16 0" :transform="`rotate(${-b.flap * 30})`" />
        </g>
      </template>

      <!-- météo -->
      <circle v-for="(f, i) in frame.flakes" :key="'f' + i" :cx="f.x" :cy="f.y" :r="f.r" fill="#fff" opacity="0.9" />
      <path v-for="(l, i) in frame.leaves" :key="'l' + i" d="M0 0 q0.03 -0.05 0.07 -0.02 q-0.03 0.05 -0.07 0.02 Z" :fill="pal.canopy[i % 3]" :transform="`translate(${l.x} ${l.y}) rotate(${l.spin})`" />
    </g>
  </svg>
</template>

<style scoped>
.life {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
  animation: life-in 1.8s ease-in-out both;
}
@keyframes life-in {
  from {
    opacity: 0;
  }
}
</style>
