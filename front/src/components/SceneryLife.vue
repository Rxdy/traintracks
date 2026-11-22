<script setup lang="ts">
import { reducedMotion } from '../settings'
import { computed, ref, shallowRef } from 'vue'
import type { Scenery } from '../scenery/generate'
import { useClock } from '../scenery/clock'
import { REVEAL, revealDelay } from '../scenery/reveal'
import { createLandSim, type LandFrame } from '../scenery/motion'
import { PAL } from '../scenery/themes'
import { sound } from '../sound/director'

// Le décor qui vit AU-DESSUS des rails : voitures et barrières du passage à niveau, animaux, oiseaux, feuilles ou
// neige qui tombent. Les voitures s'arrêtent quand le train approche (`trainNear`) et repartent après son passage.
// Même repère que le train : 1 case = 1×1, la grille occupe 0..size (le reste, c'est la colonne et la rangée des indices, à gauche et en haut : -1..0).
const props = withDefaults(defineProps<{ scenery: Scenery; trainNear: boolean; start?: boolean }>(), { start: true })
const emit = defineEmits<{ (e: 'frame', f: LandFrame): void }>()
const cols = computed(() => props.scenery.cols)
const board = computed(() => props.scenery.rows - props.scenery.margin.y - props.scenery.margin.b) // taille de la grille de jeu : le repère de la page
const pal = computed(() => PAL[props.scenery.theme])
const sim = createLandSim(props.scenery)
const empty: LandFrame = { cars: [], barrier: 0, lights: false, animals: [], birds: [], flakes: [], leaves: [], embers: [], events: [] }
const frame = shallowRef<LandFrame>(empty)
// Apparition : tout ce qui vit sur le décor (animaux, oiseaux, voitures, cabane…) apparaît case par case, chaque case à un
// moment tiré au hasard (scenery/reveal.ts, le même tirage que les arbres et les maisons), à partir du moment où le décor est prêt (`start`).
const reduce = reducedMotion()
const REVEAL_END = REVEAL.start + REVEAL.spread + 100
const elapsed = ref(reduce ? REVEAL_END : 0) // ms depuis le début de l'apparition ; au-delà de REVEAL_END, plus de masque
let revealT0 = -1
const cellDelays = computed(() => {
  const out: { r: number; c: number; d: number }[] = []
  for (let r = 0; r < props.scenery.rows; r++) for (let c = 0; c < props.scenery.cols; c++) out.push({ r, c, d: revealDelay(props.scenery.seed, r, c) })
  return out
})
const shown = computed(() => cellDelays.value.filter((x) => x.d <= elapsed.value))
useClock((dt, t) => {
  if (elapsed.value < REVEAL_END && props.start) {
    if (revealT0 < 0) revealT0 = t
    elapsed.value = (t - revealT0) * 1000
  }
  frame.value = sim.step(dt, t, props.trainNear)
  frame.value.events.forEach((e) => sound.ambient(e))
  emit('frame', frame.value) // la cabine du conducteur montre les mêmes voitures, barrières et animaux
})

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
// Les petites scènes (feu de camp, skieur, cabine de téléphérique…) sont agrandies pour se voir à côté des arbres.
const BIG: Record<string, number> = { campfire: 1.8, gondola: 1.7, skater: 1.5, skier: 1.5, sled: 1.5, goat: 1.3, tractor: 1.3, sheep: 1.3, cow: 1.3 }
</script>

<template>
  <svg class="life" :viewBox="`-1 -1 ${board + 1} ${board + 1}`" data-test="scenery-life" aria-hidden="true">
    <defs>
      <mask id="life-mask" maskUnits="userSpaceOnUse" :x="-2" :y="-2" :width="scenery.cols + 4" :height="scenery.rows + 4">
        <rect :x="-2" :y="-2" :width="scenery.cols + 4" :height="scenery.rows + 4" fill="#000" />
        <rect v-for="x in shown" :key="x.r * 1000 + x.c" :x="x.c - 0.02" :y="x.r - 0.02" width="1.04" height="1.04" fill="#fff" />
      </mask>
      <clipPath id="life-clip"><rect x="0" y="0" :width="cols" :height="scenery.frame.visibleRows" rx="0.18" /></clipPath>
    </defs>
    <g :transform="`translate(${-scenery.margin.x} ${-scenery.margin.y})`">
    <g clip-path="url(#life-clip)" :mask="elapsed < REVEAL_END ? 'url(#life-mask)' : undefined">
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

      <!-- décors fixes : câble du téléphérique, cabane, tas de bois, champignons, chalet, pylônes -->
      <line v-if="scenery.cable" :x1="scenery.cable[0].x" :y1="scenery.cable[0].y" :x2="scenery.cable[1].x" :y2="scenery.cable[1].y" stroke="#374151" stroke-width="0.012" data-test="cable" />
      <g v-for="(p, i) in scenery.props" :key="'prop' + i" :transform="`translate(${p.x} ${p.y}) scale(${p.kind === 'pylon' ? 1.6 : p.kind === 'mushroom' ? 1.5 : 1.15})`" :data-test="'prop-' + p.kind">
        <template v-if="p.kind === 'cabin'">
          <rect x="-0.26" y="-0.12" width="0.52" height="0.3" rx="0.015" fill="#a16207" stroke="#5b3a21" stroke-width="0.014" />
          <path d="M-0.3 -0.1 L0 -0.32 L0.3 -0.1 Z" fill="#5b3a21" /><path d="M-0.26 -0.01 h0.52 M-0.26 0.07 h0.52" stroke="#7c4a05" stroke-width="0.012" />
          <rect x="-0.05" y="0.03" width="0.1" height="0.15" fill="#3b2713" /><rect x="0.11" y="-0.06" width="0.09" height="0.08" fill="#fde68a" stroke="#5b3a21" stroke-width="0.01" />
          <rect x="0.12" y="-0.4" width="0.07" height="0.14" fill="#78716c" />
        </template>
        <template v-else-if="p.kind === 'woodpile'">
          <g fill="#c58a4a" stroke="#7a4e2d" stroke-width="0.01"><circle v-for="(c, j) in [[-0.15, 0.1], [-0.05, 0.1], [0.05, 0.1], [0.15, 0.1], [-0.1, 0.01], [0, 0.01], [0.1, 0.01], [-0.05, -0.08], [0.05, -0.08]]" :key="j" :cx="c[0]" :cy="c[1]" r="0.05" /></g>
          <g fill="#e8c59a"><circle v-for="(c, j) in [[-0.15, 0.1], [0.05, 0.1], [0, 0.01], [-0.05, -0.08]]" :key="j" :cx="c[0]" :cy="c[1]" r="0.022" /></g>
        </template>
        <template v-else-if="p.kind === 'mushroom'">
          <rect x="-0.018" y="-0.02" width="0.036" height="0.1" rx="0.01" fill="#f5e9d4" />
          <path d="M-0.15 -0.02 q0.15 -0.25 0.3 0 Z" :fill="p.v ? '#dc2626' : '#a16207'" /><g :fill="p.v ? '#fff' : '#fde68a'"><circle cx="-0.05" cy="-0.08" r="0.022" /><circle cx="0.05" cy="-0.05" r="0.017" /><circle cx="0.01" cy="-0.12" r="0.015" /></g>
        </template>
        <template v-else-if="p.kind === 'chalet'">
          <rect x="-0.26" y="-0.1" width="0.52" height="0.28" rx="0.015" fill="#b45309" stroke="#5b3a21" stroke-width="0.014" />
          <path d="M-0.34 -0.08 L0 -0.34 L0.34 -0.08 Z" fill="#f8fafc" stroke="#94a3b8" stroke-width="0.014" />
          <rect x="-0.05" y="0.04" width="0.1" height="0.14" fill="#3b2713" /><rect x="-0.2" y="-0.04" width="0.09" height="0.08" fill="#fde68a" stroke="#5b3a21" stroke-width="0.01" /><rect x="0.11" y="-0.04" width="0.09" height="0.08" fill="#fde68a" stroke="#5b3a21" stroke-width="0.01" />
        </template>
        <template v-else-if="p.kind === 'pylon'">
          <path d="M-0.06 0.1 L0 -0.12 L0.06 0.1 M-0.04 0.04 h0.08" stroke="#374151" stroke-width="0.02" fill="none" /><rect x="-0.05" y="-0.15" width="0.1" height="0.03" fill="#374151" />
        </template>
      </g>

      <!-- animaux -->
      <g v-for="a in frame.animals" :key="a.id" :transform="`translate(${a.x} ${a.y}) scale(${a.face * 1.45 * (BIG[a.kind] ?? 1)} ${1.45 * (BIG[a.kind] ?? 1)})`">
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
        <template v-else-if="a.kind === 'goat'">
          <g :transform="`translate(0 ${Math.max(0, Math.sin(a.t * 1.3)) * 0.01})`">
            <g stroke="#78716c" stroke-width="0.014" stroke-linecap="round"><line x1="-0.05" y1="0.03" x2="-0.05" y2="0.085" /><line x1="0.05" y1="0.03" x2="0.05" y2="0.085" /></g>
            <ellipse cx="0" cy="0" rx="0.085" ry="0.045" fill="#e7e5e4" stroke="#a8a29e" stroke-width="0.012" />
            <path d="M0.07 -0.02 l0.045 -0.03 l0.02 0.02 l-0.01 0.05 l-0.05 0.01 Z" fill="#e7e5e4" stroke="#a8a29e" stroke-width="0.012" />
            <path d="M0.1 -0.05 q-0.01 -0.045 -0.045 -0.05 M0.115 -0.045 q0.02 -0.04 -0.005 -0.06" stroke="#57534e" stroke-width="0.012" fill="none" stroke-linecap="round" />
            <path d="M0.13 0.01 l0.005 0.03" stroke="#a8a29e" stroke-width="0.012" />
          </g>
        </template>
        <template v-else-if="a.kind === 'campfire'">
          <ellipse cx="0" cy="0.04" rx="0.06" ry="0.02" fill="#57534e" />
          <path d="M-0.05 0.035 l0.1 -0.012 M-0.05 0.015 l0.1 0.02" stroke="#7a4e2d" stroke-width="0.022" stroke-linecap="round" />
          <path :d="`M-0.03 0.03 q-0.02 -0.05 0.02 -0.08 q0 ${0.03 + Math.sin(a.t * 11) * 0.01} 0.02 0.03 q0.03 -0.03 0.01 -0.08 q0.06 0.05 0.03 0.12 Z`" fill="#f97316" />
          <path d="M-0.012 0.03 q-0.01 -0.03 0.012 -0.05 q0.02 0.02 0.012 0.05 Z" fill="#fde047" />
          <circle v-for="i in 3" :key="i" :cx="Math.sin(a.t * 0.9 + i) * 0.03 + (i - 2) * 0.012" :cy="-0.09 - (((a.t * 0.35 + i / 3) % 1)) * 0.16" :r="0.016 + ((a.t * 0.35 + i / 3) % 1) * 0.02" fill="#9ca3af" :opacity="0.55 - ((a.t * 0.35 + i / 3) % 1) * 0.5" />
        </template>
        <template v-else-if="a.kind === 'skater'">
          <ellipse cx="0" cy="0.07" rx="0.05" ry="0.012" fill="#fff" opacity="0.5" />
          <g :transform="`rotate(${-12 * Math.sin(a.t * 2)} 0 0.06)`">
            <path d="M-0.012 0.06 l-0.014 -0.07 M0.012 0.06 l0.03 -0.05" stroke="#1e3a8a" stroke-width="0.022" stroke-linecap="round" />
            <rect x="-0.03" y="-0.07" width="0.06" height="0.075" rx="0.02" fill="#dc2626" />
            <circle cx="0" cy="-0.09" r="0.028" fill="#fcd9b6" /><path d="M-0.03 -0.1 q0.03 -0.04 0.06 0 Z" fill="#2563eb" />
            <path d="M-0.03 -0.04 l-0.04 0.02 M0.03 -0.04 l0.045 -0.03" stroke="#dc2626" stroke-width="0.016" stroke-linecap="round" />
          </g>
        </template>
        <template v-else-if="a.kind === 'skier'">
          <path d="M-0.1 0.075 h0.2" stroke="#1d4ed8" stroke-width="0.016" stroke-linecap="round" />
          <path d="M-0.01 0.07 l-0.03 -0.07 M0.012 0.07 l0.03 -0.06" stroke="#111827" stroke-width="0.02" stroke-linecap="round" />
          <rect x="-0.035" y="-0.07" width="0.07" height="0.075" rx="0.02" fill="#f97316" />
          <circle cx="0.01" cy="-0.095" r="0.028" fill="#fcd9b6" /><path d="M-0.02 -0.105 q0.03 -0.04 0.06 0 Z" fill="#111827" />
          <path d="M0.03 -0.04 l0.06 0.05 M-0.03 -0.04 l0.05 0.07" stroke="#92400e" stroke-width="0.012" stroke-linecap="round" />
        </template>
        <template v-else-if="a.kind === 'sled'">
          <path d="M-0.1 0.07 q-0.03 0 -0.03 -0.03 M0.1 0.07 q0.04 0 0.04 -0.04" stroke="#7a4e2d" stroke-width="0.016" fill="none" stroke-linecap="round" />
          <path d="M-0.1 0.07 h0.2" stroke="#7a4e2d" stroke-width="0.016" />
          <rect x="-0.09" y="0.025" width="0.18" height="0.03" rx="0.01" fill="#b45309" />
          <rect x="-0.04" y="-0.04" width="0.06" height="0.07" rx="0.02" fill="#16a34a" /><circle cx="-0.01" cy="-0.065" r="0.026" fill="#fcd9b6" /><path d="M-0.037 -0.075 q0.027 -0.04 0.054 0 Z" fill="#dc2626" />
        </template>
        <template v-else-if="a.kind === 'gondola'">
          <path d="M0 -0.18 v0.06" stroke="#374151" stroke-width="0.012" />
          <rect x="-0.07" y="-0.12" width="0.14" height="0.1" rx="0.02" fill="#dc2626" stroke="#7f1d1d" stroke-width="0.012" />
          <rect x="-0.055" y="-0.1" width="0.04" height="0.045" rx="0.008" fill="#bfdbfe" /><rect x="0.015" y="-0.1" width="0.04" height="0.045" rx="0.008" fill="#bfdbfe" />
        </template>
        <template v-else-if="a.kind === 'sheep'">
          <g :transform="`translate(0 ${Math.max(0, Math.sin(a.t * 0.9)) * 0.012})`">
            <g stroke="#3b3b3b" stroke-width="0.014" stroke-linecap="round"><line x1="-0.035" y1="0.04" x2="-0.035" y2="0.085" /><line x1="0.035" y1="0.04" x2="0.035" y2="0.085" /></g>
            <ellipse cx="0.082" :cy="0.012 + Math.max(0, Math.sin(a.t * 0.9)) * 0.03" rx="0.03" ry="0.026" fill="#3b3b3b" />
            <circle cx="-0.04" cy="-0.012" r="0.04" fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.01" /><circle cx="0.005" cy="-0.022" r="0.045" fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.01" /><circle cx="0.04" cy="-0.005" r="0.036" fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.01" />
            <circle cx="0.09" :cy="0.006 + Math.max(0, Math.sin(a.t * 0.9)) * 0.03" r="0.006" fill="#fff" />
          </g>
        </template>
        <template v-else-if="a.kind === 'cow'">
          <g :transform="`translate(0 ${Math.max(0, Math.sin(a.t * 0.7)) * 0.01})`">
            <g stroke="#374151" stroke-width="0.018" stroke-linecap="round"><line x1="-0.07" y1="0.04" x2="-0.07" y2="0.09" /><line x1="-0.03" y1="0.04" x2="-0.03" y2="0.09" /><line x1="0.04" y1="0.04" x2="0.04" y2="0.09" /><line x1="0.08" y1="0.04" x2="0.08" y2="0.09" /></g>
            <ellipse cx="0" cy="0" rx="0.12" ry="0.058" fill="#fff" stroke="#9ca3af" stroke-width="0.012" />
            <path d="M-0.05 -0.04 q0.03 -0.02 0.05 0.01 q-0.01 0.04 -0.05 0.03 Z M0.04 0.0 q0.04 -0.02 0.06 0.02 q-0.03 0.035 -0.06 -0.02 Z" fill="#1f2937" />
            <ellipse cx="0.14" :cy="0.012 + Math.max(0, Math.sin(a.t * 0.7)) * 0.035" rx="0.04" ry="0.03" fill="#fff" stroke="#9ca3af" stroke-width="0.012" />
            <ellipse cx="0.165" :cy="0.022 + Math.max(0, Math.sin(a.t * 0.7)) * 0.035" rx="0.016" ry="0.014" fill="#f9a8b4" />
            <path d="M0.13 -0.012 l-0.005 -0.025 M0.15 -0.012 l0.01 -0.022" stroke="#e5e7eb" stroke-width="0.012" stroke-linecap="round" :transform="`translate(0 ${Math.max(0, Math.sin(a.t * 0.7)) * 0.035})`" />
          </g>
        </template>
        <template v-else-if="a.kind === 'tractor'">
          <g :transform="`translate(0 ${Math.sin(a.t * 18) * 0.003})`">
            <circle cx="-0.07" cy="0.03" r="0.055" fill="#1f2937" /><circle cx="-0.07" cy="0.03" r="0.025" fill="#9ca3af" />
            <circle cx="0.09" cy="0.05" r="0.034" fill="#1f2937" /><circle cx="0.09" cy="0.05" r="0.014" fill="#9ca3af" />
            <rect x="-0.0" y="-0.03" width="0.14" height="0.06" rx="0.012" fill="#dc2626" stroke="#7f1d1d" stroke-width="0.012" />
            <rect x="-0.1" y="-0.08" width="0.1" height="0.09" rx="0.012" fill="#b91c1c" stroke="#7f1d1d" stroke-width="0.012" />
            <rect x="-0.085" y="-0.068" width="0.07" height="0.04" rx="0.008" fill="#bfdbfe" />
            <rect x="0.115" y="-0.075" width="0.012" height="0.05" fill="#374151" />
            <circle :cx="0.12 + Math.sin(a.t * 2) * 0.01" :cy="-0.1 - ((a.t * 0.4) % 1) * 0.05" r="0.018" fill="#9ca3af" :opacity="0.7 - ((a.t * 0.4) % 1) * 0.6" />
          </g>
        </template>
        <template v-else-if="a.kind === 'hedgehog'">
          <ellipse rx="0.08" ry="0.055" fill="#6b4a2b" stroke="#3b2713" stroke-width="0.012" />
          <path v-for="x in [-0.04, -0.01, 0.02, 0.05]" :key="x" :d="`M${x} -0.05 l0.01 -0.03 M${x} 0.05 l0.01 0.03`" stroke="#3b2713" stroke-width="0.012" />
          <ellipse cx="0.085" cy="0" rx="0.035" ry="0.028" fill="#e8c9a0" stroke="#3b2713" stroke-width="0.01" />
          <circle cx="0.108" r="0.009" fill="#111827" />
        </template>
        <template v-else-if="a.kind === 'cat'">
          <path :d="`M-0.07 0.01 q-0.1 -0.02 -0.09 -0.1 q0.02 -0.05 0.05 -0.02`" fill="none" stroke="#4b5563" stroke-width="0.022" stroke-linecap="round" :transform="`rotate(${Math.sin(a.t * 2) * 10} -0.07 0.01)`" />
          <ellipse rx="0.08" ry="0.045" fill="#6b7280" stroke="#374151" stroke-width="0.012" />
          <circle cx="0.085" cy="-0.015" r="0.035" fill="#6b7280" stroke="#374151" stroke-width="0.012" />
          <path d="M0.065 -0.04 l0.005 -0.04 l0.025 0.025 M0.1 -0.04 l0.015 -0.035 l0.005 0.045" fill="#6b7280" stroke="#374151" stroke-width="0.01" />
          <circle cx="0.098" cy="-0.02" r="0.007" fill="#facc15" />
          <circle cx="0.075" cy="-0.02" r="0.007" fill="#facc15" />
        </template>
        <template v-else-if="a.kind === 'lizard'">
          <path d="M-0.05 0 q-0.09 0.02 -0.14 -0.02" fill="none" :stroke="pal.snow ? '#f97316' : '#ea580c'" stroke-width="0.022" stroke-linecap="round" />
          <ellipse rx="0.07" ry="0.025" :fill="pal.snow ? '#f97316' : '#ea580c'" stroke="#7c2d12" stroke-width="0.01" />
          <ellipse cx="0.08" rx="0.03" ry="0.022" fill="#fb923c" stroke="#7c2d12" stroke-width="0.01" />
          <circle cx="0.09" cy="-0.008" r="0.007" fill="#111827" />
          <path d="M-0.03 0.02 l-0.03 0.03 M0.04 0.02 l0.03 0.03 M-0.03 -0.02 l-0.03 -0.03 M0.04 -0.02 l0.03 -0.03" stroke="#7c2d12" stroke-width="0.012" stroke-linecap="round" />
        </template>
        <template v-else-if="a.kind === 'scorpion'">
          <path d="M-0.05 0 q-0.1 -0.03 -0.08 -0.12 q0.02 -0.05 0.07 -0.03" fill="none" stroke="#7f1d1d" stroke-width="0.02" stroke-linecap="round" :transform="`rotate(${Math.sin(a.t * 3) * 8} -0.05 0)`" />
          <ellipse rx="0.065" ry="0.04" fill="#991b1b" stroke="#450a0a" stroke-width="0.012" />
          <path d="M0.05 -0.02 q0.06 -0.04 0.08 0.01 M0.05 0.02 q0.06 0.04 0.08 -0.01" fill="none" stroke="#991b1b" stroke-width="0.02" stroke-linecap="round" />
          <path d="M-0.02 0.035 l-0.015 0.04 M0.01 0.035 l0 0.045 M0.035 0.03 l0.02 0.04 M-0.02 -0.035 l-0.015 -0.04 M0.01 -0.035 l0 -0.045 M0.035 -0.03 l0.02 -0.04" stroke="#450a0a" stroke-width="0.01" stroke-linecap="round" />
          <circle cx="0.05" cy="-0.012" r="0.006" fill="#fde047" />
        </template>
        <template v-else-if="a.kind === 'alien'">
          <ellipse cx="0" cy="0.02" rx="0.055" ry="0.05" fill="#84cc16" stroke="#3f6212" stroke-width="0.012" />
          <path d="M-0.02 -0.03 l-0.03 -0.07 M0.02 -0.03 l0.03 -0.07" stroke="#3f6212" stroke-width="0.012" stroke-linecap="round" />
          <circle cx="-0.05" cy="-0.1" r="0.015" fill="#bef264" stroke="#3f6212" stroke-width="0.008" />
          <circle cx="0.05" cy="-0.1" r="0.015" fill="#bef264" stroke="#3f6212" stroke-width="0.008" />
          <circle cx="-0.02" cy="0.005" r="0.016" fill="#111827" />
          <circle cx="0.025" cy="0.005" r="0.016" fill="#111827" />
          <path d="M-0.02 0.04 q0.02 0.02 0.045 0" fill="none" stroke="#3f6212" stroke-width="0.01" stroke-linecap="round" />
          <path :d="`M-0.03 0.065 l-0.015 ${0.03 + Math.sin(a.t * 6) * 0.01} M0.03 0.065 l0.015 ${0.03 - Math.sin(a.t * 6) * 0.01}`" stroke="#3f6212" stroke-width="0.014" stroke-linecap="round" />
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

      <!-- oiseaux : chaque environnement a les siens ; ombre au sol décalée -->
      <template v-for="b in frame.birds" :key="'b' + b.id">
        <ellipse :cx="b.x + 0.22" :cy="b.y + 0.35" :rx="b.kind === 'eagle' || b.kind === 'vulture' ? 0.14 : 0.07" ry="0.025" fill="#000" opacity="0.12" />
        <g :transform="`translate(${b.x} ${b.y})`" stroke-linecap="round" stroke-linejoin="round">
          <template v-if="b.kind === 'gull'">
            <g fill="none" stroke="#ffffff" stroke-width="0.03">
              <path d="M0 0 q-0.08 -0.06 -0.16 0" :transform="`rotate(${b.flap * 30})`" />
              <path d="M0 0 q0.08 -0.06 0.16 0" :transform="`rotate(${-b.flap * 30})`" />
            </g>
          </template>
          <template v-else-if="b.kind === 'crow'">
            <ellipse rx="0.045" ry="0.028" fill="#111827" />
            <circle cx="0.05" cy="-0.005" r="0.02" fill="#111827" />
            <path d="M0.065 -0.005 l0.03 0.008 l-0.03 0.008 Z" fill="#f59e0b" />
            <g fill="none" stroke="#1f2937" stroke-width="0.035">
              <path d="M-0.01 0 q-0.07 -0.07 -0.15 -0.01" :transform="`rotate(${b.flap * 35})`" />
              <path d="M0.01 0 q0.07 -0.07 0.15 -0.01" :transform="`rotate(${-b.flap * 35})`" />
            </g>
          </template>
          <template v-else-if="b.kind === 'eagle'">
            <g transform="scale(1.8)">
              <path d="M-0.2 0.01 q0.1 -0.07 0.2 -0.02 q0.1 -0.05 0.2 0.02 q-0.1 0.02 -0.2 0.01 q-0.1 0.01 -0.2 -0.01 Z" fill="#5b3a21" stroke="#3b2713" stroke-width="0.01" :transform="`rotate(${b.flap * 8})`" />
              <circle cx="0.01" cy="-0.015" r="0.022" fill="#f8fafc" />
              <path d="M0.03 -0.015 l0.03 0.005 l-0.03 0.01 Z" fill="#f59e0b" />
            </g>
          </template>
          <template v-else-if="b.kind === 'vulture'">
            <g transform="scale(1.5)">
              <path d="M-0.18 0.02 q0.09 -0.06 0.18 -0.03 q0.09 -0.03 0.18 0.03 q-0.09 0.01 -0.18 0 q-0.09 0.01 -0.18 0 Z" fill="#3b2f2a" :transform="`rotate(${b.flap * 8})`" />
              <circle cx="0.02" cy="-0.02" r="0.02" fill="#e8b4a0" />
              <path d="M0.04 -0.02 l0.03 0.01 l-0.03 0.008 Z" fill="#d97706" />
            </g>
          </template>
          <template v-else-if="b.kind === 'parrot'">
            <ellipse rx="0.04" ry="0.025" fill="#ef4444" />
            <path d="M-0.035 0.005 l-0.07 0.03 l0.07 -0.015 Z" fill="#2563eb" />
            <circle cx="0.045" cy="-0.01" r="0.02" fill="#ef4444" />
            <path d="M0.062 -0.012 l0.025 0.01 l-0.025 0.012 Z" fill="#facc15" />
            <g fill="none" stroke-width="0.032">
              <path d="M0 -0.005 q-0.06 -0.06 -0.14 -0.01" stroke="#22c55e" :transform="`rotate(${b.flap * 35})`" />
              <path d="M0 -0.005 q0.06 -0.06 0.14 -0.01" stroke="#22c55e" :transform="`rotate(${-b.flap * 35})`" />
            </g>
          </template>
          <template v-else-if="b.kind === 'bat'">
            <ellipse rx="0.03" ry="0.025" fill="#1f1015" />
            <circle cx="0.012" cy="-0.004" r="0.006" fill="#ff3b1f" /><circle cx="0.026" cy="-0.004" r="0.006" fill="#ff3b1f" />
            <path d="M-0.01 0 q-0.05 -0.07 -0.15 -0.02 q0.03 0.01 0.03 0.03 q0.03 -0.01 0.04 0.02 q0.03 -0.02 0.08 -0.03 Z" fill="#1f1015" :transform="`rotate(${b.flap * 35})`" />
            <path d="M0.01 0 q0.05 -0.07 0.15 -0.02 q-0.03 0.01 -0.03 0.03 q-0.03 -0.01 -0.04 0.02 q-0.03 -0.02 -0.08 -0.03 Z" fill="#1f1015" :transform="`rotate(${-b.flap * 35})`" />
          </template>
          <template v-else-if="b.kind === 'pigeon'">
            <ellipse rx="0.05" ry="0.03" fill="#9ca3af" />
            <circle cx="0.055" cy="-0.008" r="0.022" fill="#6b7280" />
            <ellipse cx="0.04" cy="0.004" rx="0.018" ry="0.012" fill="#7c3aed" opacity="0.8" />
            <path d="M0.076 -0.008 l0.02 0.006 l-0.02 0.006 Z" fill="#f59e0b" />
            <g fill="none" stroke="#b6bcc6" stroke-width="0.035">
              <path d="M-0.01 0 q-0.06 -0.06 -0.14 -0.01" :transform="`rotate(${b.flap * 35})`" />
              <path d="M0.01 0 q0.06 -0.06 0.14 -0.01" :transform="`rotate(${-b.flap * 35})`" />
            </g>
          </template>
          <template v-else-if="b.kind === 'drone'">
            <rect x="-0.035" y="-0.02" width="0.07" height="0.04" rx="0.01" fill="#0b1024" stroke="#00e5ff" stroke-width="0.01" />
            <circle cx="0" cy="0" r="0.008" fill="#ff2bd6" />
            <path d="M-0.035 -0.02 l-0.045 -0.03 M0.035 -0.02 l0.045 -0.03 M-0.035 0.02 l-0.045 0.03 M0.035 0.02 l0.045 0.03" stroke="#00e5ff" stroke-width="0.012" />
            <ellipse v-for="(o, k) in [[-0.08, -0.05], [0.08, -0.05], [-0.08, 0.05], [0.08, 0.05]]" :key="k" :cx="o[0]" :cy="o[1]" :rx="0.04 * (0.5 + Math.abs(b.flap))" ry="0.008" fill="#00e5ff" opacity="0.6" />
          </template>
        </g>
      </template>

      <!-- météo -->
      <circle v-for="(f, i) in frame.flakes" :key="'f' + i" :cx="f.x" :cy="f.y" :r="f.r" fill="#fff" opacity="0.9" />
      <circle v-for="(e, i) in frame.embers" :key="'e' + i" :cx="e.x" :cy="e.y" :r="e.r" fill="#fb923c" opacity="0.85" />
      <path v-for="(l, i) in frame.leaves" :key="'l' + i" d="M0 0 q0.03 -0.05 0.07 -0.02 q-0.03 0.05 -0.07 0.02 Z" :fill="pal.canopy[i % 3]" :transform="`translate(${l.x} ${l.y}) rotate(${l.spin})`" />
    </g>
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
