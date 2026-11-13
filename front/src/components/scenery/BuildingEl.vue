<script setup lang="ts">
import type { Pal } from '../../scenery/themes'
// Immeuble (ville) : corps haut, grille de fenêtres dont quelques-unes éclairées, toit-terrasse avec sa cheminée.
// La hauteur et la couleur varient avec `v`. Case de 100×100.
const props = defineProps<{ pal: Pal; v: number }>()
const h = [44, 58, 36, 50][props.v % 4]
const wall = props.pal.walls[props.v % props.pal.walls.length]
const roof = props.pal.roofs[props.v % props.pal.roofs.length]
const rows = Math.floor((h - 8) / 12)
const lit = (r: number, c: number) => (r * 3 + c * 5 + props.v) % 4 === 0
</script>
<template>
  <g>
    <ellipse cx="52" cy="90" rx="38" ry="7" fill="#000" opacity="0.18" />
    <rect :x="22" :y="88 - h" width="56" :height="h" :fill="wall" stroke="#00000030" stroke-width="2" />
    <rect :x="18" :y="82 - h" width="64" height="10" :fill="roof" rx="1.5" />
    <rect :x="62" :y="72 - h" width="9" height="10" fill="#6b7280" />
    <template v-for="r in rows" :key="r">
      <rect v-for="c in 3" :key="c" :x="26 + (c - 1) * 17" :y="84 - h + r * 12 - 4" width="11" height="8" :fill="lit(r, c) ? '#fde68a' : '#a9c7e0'" stroke="#00000025" stroke-width="1" />
    </template>
    <rect x="42" y="74" width="16" height="14" rx="1.5" fill="#4b3a2c" />
  </g>
</template>
