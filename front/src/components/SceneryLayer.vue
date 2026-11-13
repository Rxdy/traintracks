<script setup lang="ts">
import { computed } from 'vue'
import type { Scenery } from '../scenery'
import { PAL } from '../scenery'
import type { Route } from '../trainRoute'
import TreeEl from './scenery/TreeEl.vue'
import PineEl from './scenery/PineEl.vue'
import HouseEl from './scenery/HouseEl.vue'
import FieldEl from './scenery/FieldEl.vue'
import MountainEl from './scenery/MountainEl.vue'
import BoulderEl from './scenery/BoulderEl.vue'
import SnowmanEl from './scenery/SnowmanEl.vue'
import GrassEl from './scenery/GrassEl.vue'
import RiverEl from './scenery/RiverEl.vue'
import BridgeEl from './scenery/BridgeEl.vue'

// Assemble le paysage d'un niveau gagné, SOUS les rails (qui restent des éléments de la grille).
// Ordre de dessin : sol, champs, lit de la voie, eau, ponts, puis les éléments debout (arbres, maisons…).
// Chaque élément a son propre fichier (components/scenery/) ; le générateur (scenery/generate.ts) décide où.
const props = defineProps<{ scenery: Scenery; route: Route | null }>()

const pal = computed(() => PAL[props.scenery.theme])
const n = computed(() => props.scenery.size)

const items = computed(() => {
  const out: { r: number; c: number; kind: string; v: number; dir?: 'h' | 'v'; d: number }[] = []
  props.scenery.tiles.forEach((row, r) =>
    row.forEach((t, c) => {
      if (t.kind === 'rail' || props.scenery.water.has(`${r},${c}`)) return
      out.push({ r, c, kind: t.kind, v: t.v, dir: t.dir, d: 500 + (r + c) * 120 })
    }),
  )
  return out
})
const fields = computed(() => items.value.filter((i) => i.kind === 'field'))
const standing = computed(() => items.value.filter((i) => i.kind !== 'field'))
const ballast = computed(() => (props.route ? 'M' + props.route.points.map((p) => `${p.x} ${p.y}`).join(' L') : ''))
const bridges = computed(() => [...props.scenery.bridges].map(([k, axis]) => ({ k, axis, rc: k.split(',').map(Number) })))
</script>

<template>
  <svg class="scenery" :viewBox="`0 0 ${n} ${n}`" preserveAspectRatio="none" data-test="scenery" aria-hidden="true">
    <rect :width="n" :height="n" :fill="pal.a" />
    <template v-for="(row, r) in scenery.tiles" :key="'g' + r">
      <rect v-for="(_t, c) in row" :key="'g' + r + '-' + c" v-show="(r + c) % 2" :x="c" :y="r" width="1" height="1" :fill="pal.b" />
    </template>

    <g v-for="it in fields" :key="'f' + it.r + '-' + it.c" class="pop" :style="{ animationDelay: it.d + 'ms' }" :transform="`translate(${it.c} ${it.r}) scale(0.01)`">
      <FieldEl :pal="pal" :v="it.v" :dir="it.dir" />
    </g>

    <path v-if="ballast" :d="ballast" fill="none" :stroke="pal.bedEdge" stroke-width="0.68" stroke-linejoin="round" />
    <path v-if="ballast" :d="ballast" fill="none" :stroke="pal.bed" stroke-width="0.58" stroke-linejoin="round" />

    <RiverEl :scenery="scenery" :pal="pal" />
    <BridgeEl v-for="b in bridges" :key="'b' + b.k" :r="b.rc[0]" :c="b.rc[1]" :axis="b.axis" />

    <g v-for="it in standing" :key="'s' + it.r + '-' + it.c" class="pop" :style="{ animationDelay: it.d + 'ms' }" :transform="`translate(${it.c} ${it.r}) scale(0.01)`">
      <GrassEl v-if="it.kind === 'grass'" :pal="pal" :v="it.v" />
      <TreeEl v-else-if="it.kind === 'tree'" :pal="pal" :v="it.v" />
      <PineEl v-else-if="it.kind === 'pine'" :pal="pal" />
      <HouseEl v-else-if="it.kind === 'house'" :pal="pal" :v="it.v" />
      <MountainEl v-else-if="it.kind === 'mountain'" :pal="pal" :v="it.v" />
      <BoulderEl v-else-if="it.kind === 'boulder'" :pal="pal" />
      <SnowmanEl v-else-if="it.kind === 'snowman'" />
    </g>
  </svg>
</template>

<style scoped>
.scenery {
  position: absolute;
  left: 0;
  top: 0;
  width: calc(100% * var(--size) / (var(--size) + 1));
  height: calc(100% * var(--size) / (var(--size) + 1));
  border-radius: 10px;
  pointer-events: none;
  overflow: hidden;
  animation: scene-in 1.8s ease-in-out both;
}
@keyframes scene-in {
  from {
    opacity: 0;
  }
}
.pop {
  animation: pop 1s ease-in-out both;
}
@keyframes pop {
  from {
    opacity: 0;
  }
}
</style>
