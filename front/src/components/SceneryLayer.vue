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
import RoadEl from './scenery/RoadEl.vue'
import WaterLife from './scenery/WaterLife.vue'
import WindmillEl from './scenery/WindmillEl.vue'
import CactusEl from './scenery/CactusEl.vue'
import PalmEl from './scenery/PalmEl.vue'
import CraterEl from './scenery/CraterEl.vue'
import VentEl from './scenery/VentEl.vue'
import DeadTreeEl from './scenery/DeadTreeEl.vue'
import SkullEl from './scenery/SkullEl.vue'
import BuildingEl from './scenery/BuildingEl.vue'
import MesaEl from './scenery/MesaEl.vue'
import DuneEl from './scenery/DuneEl.vue'

// Assemble le paysage d'un niveau gagné, SOUS les rails (qui restent des éléments de la grille).
// Ordre de dessin : sol, champs, lit de la voie, eau, ponts, puis les éléments debout (arbres, maisons…).
// Chaque élément a son propre fichier (components/scenery/) ; le générateur (scenery/generate.ts) décide où.
const props = defineProps<{ scenery: Scenery; route: Route | null }>()

const pal = computed(() => PAL[props.scenery.theme])
// Fusion : la glace en haut à gauche, le feu en bas à droite ; chaque case prend la palette de son côté.
const palFor = (r: number, c: number) => (props.scenery.theme === 'fusion' ? (r + c > (props.scenery.rows + props.scenery.cols) / 2 - 1 ? PAL.volcan : PAL.hiver) : pal.value)
const rows = computed(() => props.scenery.rows)
const cols = computed(() => props.scenery.cols)
// Le décor est plus grand que la grille de jeu : il déborde de --margin cases de chaque côté (plus en largeur qu'en hauteur
// sur un grand écran). Position et taille en % de la grille de jeu (qui fait (taille + 1) cases avec la colonne des indices).
const box = computed(() => {
  const s = props.scenery
  const board = s.rows - 2 * s.margin.y
  const u = 100 / (board + 1)
  return { width: `${s.cols * u}%`, height: `${s.rows * u}%`, left: `${-s.margin.x * u}%`, top: `${-s.margin.y * u}%` }
})

const items = computed(() => {
  const out: { r: number; c: number; kind: string; v: number; dir?: 'h' | 'v'; d: number }[] = []
  props.scenery.tiles.forEach((row, r) =>
    row.forEach((t, c) => {
      if (t.kind === 'rail' || t.kind === 'road' || props.scenery.water.has(`${r},${c}`)) return
      out.push({ r, c, kind: t.kind, v: t.v, dir: t.dir, d: 500 + (r + c) * 120 })
    }),
  )
  return out
})
const fields = computed(() => items.value.filter((i) => i.kind === 'field'))
const standing = computed(() => items.value.filter((i) => i.kind !== 'field'))
// la voie de la grille de jeu est donnée dans son propre repère : on la décale de la marge du décor
const ballast = computed(() => (props.route ? 'M' + props.route.points.map((p) => `${p.x + props.scenery.margin.x} ${p.y + props.scenery.margin.y}`).join(' L') : ''))
const extPaths = computed(() => props.scenery.ext.map((e) => 'M' + e.map((p) => `${p.x} ${p.y}`).join(' L')))
const bridges = computed(() => [...props.scenery.bridges].map(([k, axis]) => ({ k, axis, rc: k.split(',').map(Number) })))
</script>

<template>
  <svg class="scenery" :style="box" :viewBox="`0 0 ${cols} ${rows}`" preserveAspectRatio="none" data-test="scenery" aria-hidden="true">
    <rect :width="cols" :height="rows" :fill="pal.a" />
    <template v-for="(row, r) in scenery.tiles" :key="'g' + r">
      <template v-for="(_t, c) in row" :key="'g' + r + '-' + c">
        <rect v-if="scenery.theme === 'fusion'" :x="c" :y="r" width="1" height="1" :fill="(r + c) % 2 ? palFor(r, c).b : palFor(r, c).a" />
        <rect v-else v-show="(r + c) % 2" :x="c" :y="r" width="1" height="1" :fill="pal.b" />
      </template>
    </template>

    <g v-for="it in fields" :key="'f' + it.r + '-' + it.c" class="pop" :style="{ animationDelay: it.d + 'ms' }" :transform="`translate(${it.c} ${it.r}) scale(0.01)`">
      <FieldEl :pal="palFor(it.r, it.c)" :v="it.v" :dir="it.dir" />
    </g>

    <path v-if="ballast" :d="ballast" fill="none" :stroke="pal.bedEdge" stroke-width="0.68" stroke-linejoin="round" />
    <path v-if="ballast" :d="ballast" fill="none" :stroke="pal.bed" stroke-width="0.58" stroke-linejoin="round" />

    <RoadEl v-if="scenery.road" :road="scenery.road" :rows="rows" :cols="cols" :pal="pal" />

    <RiverEl :scenery="scenery" :pal="pal" />
    <WaterLife :scenery="scenery" />
    <BridgeEl v-for="b in bridges" :key="'b' + b.k" :r="b.rc[0]" :c="b.rc[1]" :axis="b.axis" />

    <!-- prolongements de la voie hors de la grille de jeu (qui, elle, ne dessine que ses cases) : au-dessus des ponts -->
    <template v-for="(d, i) in extPaths" :key="'x' + i">
      <path :d="d" fill="none" :stroke="pal.rail.tie" stroke-width="0.4" stroke-dasharray="0.07 0.2" />
      <path :d="d" fill="none" :stroke="pal.rail.rail" stroke-width="0.2" />
      <path :d="d" fill="none" :stroke="pal.bed" stroke-width="0.1" />
    </template>

    <g v-for="it in standing" :key="'s' + it.r + '-' + it.c" class="pop" :style="{ animationDelay: it.d + 'ms' }" :transform="`translate(${it.c} ${it.r}) scale(0.01)`">
      <GrassEl v-if="it.kind === 'grass'" :pal="palFor(it.r, it.c)" :v="it.v" />
      <TreeEl v-else-if="it.kind === 'tree'" :pal="palFor(it.r, it.c)" :v="it.v" />
      <PineEl v-else-if="it.kind === 'pine'" :pal="palFor(it.r, it.c)" />
      <HouseEl v-else-if="it.kind === 'house'" :pal="palFor(it.r, it.c)" :v="it.v" />
      <MountainEl v-else-if="it.kind === 'mountain'" :pal="palFor(it.r, it.c)" :v="it.v" />
      <BoulderEl v-else-if="it.kind === 'boulder'" :pal="palFor(it.r, it.c)" />
      <SnowmanEl v-else-if="it.kind === 'snowman'" />
      <WindmillEl v-else-if="it.kind === 'windmill'" />
      <CactusEl v-else-if="it.kind === 'cactus'" :pal="palFor(it.r, it.c)" :v="it.v" />
      <PalmEl v-else-if="it.kind === 'palm'" :pal="palFor(it.r, it.c)" :v="it.v" />
      <CraterEl v-else-if="it.kind === 'crater'" :pal="palFor(it.r, it.c)" :v="it.v" />
      <VentEl v-else-if="it.kind === 'vent'" :pal="palFor(it.r, it.c)" :v="it.v" />
      <DeadTreeEl v-else-if="it.kind === 'deadtree'" :pal="palFor(it.r, it.c)" :v="it.v" />
      <SkullEl v-else-if="it.kind === 'skull'" :pal="palFor(it.r, it.c)" :v="it.v" />
      <BuildingEl v-else-if="it.kind === 'building'" :pal="palFor(it.r, it.c)" :v="it.v" />
      <MesaEl v-else-if="it.kind === 'mesa'" :pal="palFor(it.r, it.c)" :v="it.v" />
      <DuneEl v-else-if="it.kind === 'dune'" :pal="palFor(it.r, it.c)" :v="it.v" />
    </g>
  </svg>
</template>

<style scoped>
.scenery {
  position: absolute;
  border-radius: calc(10px / var(--k, 1));
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
