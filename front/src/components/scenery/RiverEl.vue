<script setup lang="ts">
import { computed } from 'vue'
import { rng, type Scenery } from '../../scenery/generate'
import { at, riverD, sample } from '../../scenery/motion'
import type { Pal } from '../../scenery/themes'
// Rivière (ligne lissée d'un bord à l'autre) ou étang de repli. Unité : 1 case = 1×1.
// Elle ne doit JAMAIS ressembler à une route : fond bleu plus sombre que l'eau (pas de berge sable), pas de ligne
// continue au milieu, des reflets irréguliers qui avancent, des roseaux et des cailloux sur les bords.
// Gelée (hiver), l'eau ne bouge plus et se fissure.
const props = defineProps<{ scenery: Scenery; pal: Pal }>()

const frozen = computed(() => props.scenery.theme === 'hiver')
const riverPath = computed(() => (props.scenery.river && props.scenery.river.length >= 2 ? riverD(props.scenery.river) : ''))
const pondBox = computed(() => {
  const cells = props.scenery.pond
  if (!cells.length) return null
  const rs = cells.map((c) => c[0])
  const cs = cells.map((c) => c[1])
  return { x: Math.min(...cs) + 0.08, y: Math.min(...rs) + 0.08, w: Math.max(...cs) - Math.min(...cs) + 0.84, h: Math.max(...rs) - Math.min(...rs) + 0.84 }
})

// Reflets : trois fils fins décalés de part et d'autre, avec des tirets irréguliers et des vitesses différentes.
const flows = [
  { off: -0.12, dash: '0.09 0.5 0.05 0.34', dur: 2.6 },
  { off: 0.1, dash: '0.06 0.42 0.12 0.6', dur: 3.4 },
  { off: 0.02, dash: '0.04 0.7 0.08 0.45', dur: 1.9 },
]

// Roseaux et cailloux posés sur la berge, hors des ponts.
const bank = computed(() => {
  const r = props.scenery.river
  if (!r || r.length < 2) return []
  const poly = sample(r)
  const rand = rng(props.scenery.seed ^ 0x4b1d)
  const out: { x: number; y: number; reed: boolean }[] = []
  const bridges = [...props.scenery.bridges.keys()].map((k) => k.split(',').map(Number))
  for (let s = 0.4; s < poly.length - 0.2; s += 0.55) {
    let i = 1
    while (i < poly.cum.length - 1 && poly.cum[i] < s) i++
    const a = poly.pts[i - 1]
    const b = poly.pts[i]
    const ang = Math.atan2(b.y - a.y, b.x - a.x)
    const side = rand() < 0.5 ? -1 : 1
    const x = b.x - Math.sin(ang) * 0.36 * side
    const y = b.y + Math.cos(ang) * 0.36 * side
    const reed = rand() < 0.5
    if (x < 0 || y < 0 || x > props.scenery.size || y > props.scenery.size) continue
    if (bridges.some(([br, bc]) => x > bc - 0.05 && x < bc + 1.05 && y > br - 0.05 && y < br + 1.05)) continue
    out.push({ x, y, reed })
  }
  return out
})
// Glace : une fissure au milieu de la rivière.
const crack = computed(() => {
  const r = props.scenery.river
  if (!r || r.length < 2) return ''
  const poly = sample(r)
  const q = at(poly, poly.length * 0.4)
  return `M${q.x - 0.1} ${q.y - 0.12} l0.12 0.16 l-0.08 0.12 l0.1 0.1`
})
// roseaux : à la couleur des touffes de l'environnement (verts en plaine, charbon au volcan, rose chez les bonbons)
const reedColor = computed(() => (frozen.value ? '#c9b98f' : props.pal.tuft))
</script>
<template>
  <g>
    <template v-if="riverPath">
      <path :d="riverPath" fill="none" :stroke="pal.deep" stroke-width="0.68" stroke-linecap="round" stroke-linejoin="round" />
      <path :d="riverPath" fill="none" :stroke="pal.shallow" stroke-width="0.56" stroke-linecap="round" stroke-linejoin="round" />
      <path :d="riverPath" fill="none" :stroke="pal.water" stroke-width="0.44" stroke-linecap="round" stroke-linejoin="round" />
      <template v-if="!frozen">
        <path
          v-for="(f, i) in flows"
          :key="i"
          class="flow"
          :d="riverPath"
          fill="none"
          :stroke="pal.shine"
          stroke-width="0.045"
          stroke-linecap="round"
          :stroke-dasharray="f.dash"
          :transform="`translate(${f.off} 0)`"
          :style="{ animationDuration: f.dur + 's' }"
          opacity="0.8"
        />
      </template>
      <path v-else-if="crack" :d="crack" stroke="#fff" stroke-width="0.03" fill="none" opacity="0.9" stroke-linecap="round" stroke-linejoin="round" />
      <template v-for="(b, i) in bank" :key="'b' + i">
        <g v-if="b.reed" :transform="`translate(${b.x} ${b.y})`">
          <path d="M0 0 l-0.03 -0.16 M0.02 0 l0.01 -0.2 M0.04 0 l0.05 -0.14" :stroke="reedColor" stroke-width="0.022" stroke-linecap="round" fill="none" />
          <ellipse cx="0.02" cy="-0.2" rx="0.016" ry="0.04" :fill="frozen ? '#8b6f47' : '#7a4e2d'" />
        </g>
        <ellipse v-else :cx="b.x" :cy="b.y" rx="0.05" ry="0.035" :fill="pal.rock[0]" :stroke="pal.rock[1]" stroke-width="0.012" />
      </template>
    </template>
    <template v-if="pondBox">
      <rect :x="pondBox.x - 0.06" :y="pondBox.y - 0.06" :width="pondBox.w + 0.12" :height="pondBox.h + 0.12" rx="0.42" :fill="pal.deep" />
      <rect :x="pondBox.x" :y="pondBox.y" :width="pondBox.w" :height="pondBox.h" rx="0.36" :fill="pal.shallow" />
      <rect :x="pondBox.x + 0.08" :y="pondBox.y + 0.08" :width="pondBox.w - 0.16" :height="pondBox.h - 0.16" rx="0.3" :fill="pal.water" />
      <path v-if="!frozen" class="wave" :d="`M${pondBox.x + 0.2} ${pondBox.y + 0.25} q0.08 -0.07 0.16 0 q0.08 0.07 0.16 0`" fill="none" :stroke="pal.shine" stroke-width="0.04" stroke-linecap="round" />
      <path v-if="!frozen" class="wave wave--b" :d="`M${pondBox.x + pondBox.w - 0.5} ${pondBox.y + pondBox.h - 0.25} q0.08 -0.07 0.16 0 q0.08 0.07 0.16 0`" fill="none" :stroke="pal.shine" stroke-width="0.04" stroke-linecap="round" />
    </template>
  </g>
</template>
<style scoped>
.flow {
  animation: flow linear infinite;
}
@keyframes flow {
  to {
    stroke-dashoffset: -1.6;
  }
}
.wave {
  animation: wave 3s ease-in-out infinite;
}
.wave--b {
  animation-delay: -1.4s;
}
@keyframes wave {
  50% {
    opacity: 0.35;
  }
}
@media (prefers-reduced-motion: reduce) {
  .flow,
  .wave {
    animation: none;
  }
}
</style>
