<script setup lang="ts">
import { computed } from 'vue'
import type { Scenery, Theme } from '../scenery'
import type { Route } from '../trainRoute'

// Le paysage d'un niveau gagné, dessiné SOUS les rails (qui restent des éléments de la grille).
// Unité de dessin : 1 case = 1×1 pour le tracé continu (ballast, rivière), 100×100 pour les motifs d'une case.
const props = defineProps<{ scenery: Scenery; route: Route | null }>()

interface Pal {
  a: string // herbe / sol
  b: string // damier léger
  bed: string // lit de la voie
  bedEdge: string
  bank: string // berge
  water: string
  shine: string
  canopy: [string, string, string] // arbres feuillus
  fruit: string | null
  pine: [string, string] // sapins
  snow: boolean // neige sur sapins, toits et montagnes
  crops: [string, string][]
  walls: string[]
  roofs: string[]
  dots: [string, string, string] // fleurs, feuilles mortes, cailloux, bosses de neige
  tuft: string
  rock: [string, string] // rochers
}
const PAL: Record<Theme, Pal> = {
  plaine: {
    a: '#9bd66f', b: '#8acb5f', bed: '#e6d9ab', bedEdge: '#c9b784', bank: '#e2d6a4', water: '#4aa8e8', shine: '#8fcdf5',
    canopy: ['#3f9d4a', '#4cae56', '#45a550'], fruit: '#ef4444', pine: ['#2f7d4a', '#3a9158'], snow: false,
    crops: [['#e9c75b', '#dcb549'], ['#7cc653', '#6bb745'], ['#b98a5a', '#a67a4c']],
    walls: ['#fdf3dc', '#fbd9d0', '#f9e5a6', '#ffffff'], roofs: ['#c2410c', '#9a3412', '#1d4ed8', '#b45309'],
    dots: ['#ffffff', '#fde68a', '#ffffff'], tuft: '#5fae45', rock: ['#9ca3af', '#6b7280'],
  },
  foret: {
    a: '#68b563', b: '#5ba857', bed: '#d9c9a0', bedEdge: '#b8a57a', bank: '#cdbf94', water: '#3f9fd6', shine: '#85c8ee',
    canopy: ['#2f8a42', '#3a9a4c', '#2a7d3d'], fruit: null, pine: ['#25663d', '#2f7d4a'], snow: false,
    crops: [['#e9c75b', '#dcb549']],
    walls: ['#c79a63', '#b98a55', '#d2a770', '#a97c4d'], roofs: ['#5b3a21', '#4a2f1b', '#2f5d3a', '#6b4226'],
    dots: ['#fca5a5', '#fde68a', '#ffffff'], tuft: '#3f8f3f', rock: ['#9ca3af', '#6b7280'],
  },
  automne: {
    a: '#d2c872', b: '#c7bd63', bed: '#e3cf9c', bedEdge: '#bfa56d', bank: '#d9c58b', water: '#5aa5c9', shine: '#9ccbe2',
    canopy: ['#e0792b', '#f0a03a', '#c4541f'], fruit: '#7c2d12', pine: ['#3d6b3a', '#4a7d44'], snow: false,
    crops: [['#e5b94a', '#d5a53a'], ['#c9833a', '#b9722d'], ['#a8794e', '#966a42']],
    walls: ['#f6e3c0', '#f3d1b0', '#efe0a6', '#fff4e0'], roofs: ['#9a3412', '#7c2d12', '#b45309', '#78350f'],
    dots: ['#e0792b', '#b4361b', '#f0a03a'], tuft: '#a8892f', rock: ['#a39a8c', '#7a7165'],
  },
  montagne: {
    a: '#a9c49a', b: '#9dba8e', bed: '#d3cab8', bedEdge: '#b3a892', bank: '#dfe6e8', water: '#55bfd6', shine: '#a6e2ee',
    canopy: ['#4a8a55', '#559860', '#3f7d4b'], fruit: null, pine: ['#2d6a4a', '#37805a'], snow: false,
    crops: [['#cdbf6a', '#bdaf5c']],
    walls: ['#c79a63', '#d9b98a', '#b98a55', '#e8d4b0'], roofs: ['#6b3a22', '#7c2d12', '#374151', '#9a3412'],
    dots: ['#d1d5db', '#e5e7eb', '#9ca3af'], tuft: '#7e9c70', rock: ['#9aa3ad', '#6b7280'],
  },
  hiver: {
    a: '#f2f6fb', b: '#e5edf6', bed: '#cdd7e3', bedEdge: '#aebbcb', bank: '#ffffff', water: '#bfe4f5', shine: '#ffffff',
    canopy: ['#dce7f1', '#edf3f9', '#cbd9e8'], fruit: null, pine: ['#2f6b57', '#3b806a'], snow: true,
    crops: [['#e5edf6', '#d6e1ee']],
    walls: ['#f6e3c0', '#f3d1b0', '#efe0a6', '#fff4e0'], roofs: ['#f8fbff', '#eef4fa', '#f8fbff', '#e6eef7'],
    dots: ['#dbe7f3', '#cbd9e8', '#ffffff'], tuft: '#b4c4d6', rock: ['#b5bfcb', '#8a96a5'],
  },
}
const pal = computed(() => PAL[props.scenery.theme])
const grass = computed(() => ({ a: pal.value.a, b: pal.value.b }))
const CROPS = computed(() => pal.value.crops)
const WALLS = computed(() => pal.value.walls)
const ROOFS = computed(() => pal.value.roofs)

const n = computed(() => props.scenery.size)

const items = computed(() => {
  const out: { r: number; c: number; kind: string; v: number; dir?: 'h' | 'v'; d: number }[] = []
  props.scenery.tiles.forEach((row, r) =>
    row.forEach((t, c) => {
      if (t.kind === 'rail' || props.scenery.water.has(`${r},${c}`)) return
      out.push({ r, c, kind: t.kind, v: t.v, dir: t.dir, d: (r + c) * 70 })
    }),
  )
  return out
})

const ballast = computed(() => (props.route ? 'M' + props.route.points.map((p) => `${p.x} ${p.y}`).join(' L') : ''))

// Rivière : ligne lissée, les coins sont arrondis (courbes quadratiques entre milieux de segments).
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
  <svg class="scenery" :viewBox="`0 0 ${n} ${n}`" preserveAspectRatio="none" data-test="scenery" aria-hidden="true">
    <rect :width="n" :height="n" :fill="grass.a" />
    <!-- herbe : damier très léger -->
    <template v-for="(row, r) in scenery.tiles" :key="'g' + r">
      <rect v-for="(_t, c) in row" :key="'g' + r + '-' + c" v-show="(r + c) % 2" :x="c" :y="r" width="1" height="1" :fill="grass.b" />
    </template>

    <!-- champs -->
    <g v-for="it in items.filter((i) => i.kind === 'field')" :key="'f' + it.r + '-' + it.c" class="pop" :style="{ animationDelay: it.d + 'ms' }" :transform="`translate(${it.c} ${it.r}) scale(0.01)`">
      <rect width="100" height="100" :fill="CROPS[it.v][0]" />
      <template v-for="k in 5" :key="k">
        <rect v-if="it.dir === 'h'" x="0" :y="(k - 1) * 20 + 10" width="100" height="10" :fill="CROPS[it.v][1]" />
        <rect v-else :x="(k - 1) * 20 + 10" y="0" width="10" height="100" :fill="CROPS[it.v][1]" />
      </template>
    </g>

    <!-- lit de la voie -->
    <path v-if="ballast" :d="ballast" fill="none" :stroke="pal.bedEdge" stroke-width="0.68" stroke-linejoin="round" />
    <path v-if="ballast" :d="ballast" fill="none" :stroke="pal.bed" stroke-width="0.58" stroke-linejoin="round" />

    <!-- eau : rivière (passe sous la voie : le rail fait pont) ou étang -->
    <template v-if="riverPath">
      <path :d="riverPath" fill="none" :stroke="pal.bank" stroke-width="0.66" stroke-linecap="round" stroke-linejoin="round" />
      <path :d="riverPath" fill="none" :stroke="pal.water" stroke-width="0.52" stroke-linecap="round" stroke-linejoin="round" />
      <path :d="riverPath" fill="none" :stroke="pal.shine" stroke-width="0.1" stroke-dasharray="0.3 0.45" stroke-linecap="round" stroke-linejoin="round" />
    </template>
    <!-- ponts : là où la voie franchit la rivière, un tablier avec garde-corps porte les rails -->
    <g v-for="[k, axis] in [...scenery.bridges]" :key="'b' + k">
      <template v-for="rc in [k.split(',').map(Number)]" :key="k">
        <template v-if="axis === 'h'">
          <rect :x="rc[1] + 0.07" :y="rc[0] + 0.2" width="0.86" height="0.64" rx="0.03" fill="#000" opacity="0.18" />
          <rect :x="rc[1] + 0.08" :y="rc[0] + 0.19" width="0.84" height="0.62" fill="#c3bdaf" />
          <rect :x="rc[1] + 0.06" :y="rc[0] + 0.16" width="0.88" height="0.07" rx="0.02" fill="#8d877a" />
          <rect :x="rc[1] + 0.06" :y="rc[0] + 0.77" width="0.88" height="0.07" rx="0.02" fill="#8d877a" />
        </template>
        <template v-else>
          <rect :x="rc[1] + 0.2" :y="rc[0] + 0.07" width="0.64" height="0.86" rx="0.03" fill="#000" opacity="0.18" />
          <rect :x="rc[1] + 0.19" :y="rc[0] + 0.08" width="0.62" height="0.84" fill="#c3bdaf" />
          <rect :x="rc[1] + 0.16" :y="rc[0] + 0.06" width="0.07" height="0.88" rx="0.02" fill="#8d877a" />
          <rect :x="rc[1] + 0.77" :y="rc[0] + 0.06" width="0.07" height="0.88" rx="0.02" fill="#8d877a" />
        </template>
      </template>
    </g>
    <template v-if="pondBox">
      <rect :x="pondBox.x - 0.05" :y="pondBox.y - 0.05" :width="pondBox.w + 0.1" :height="pondBox.h + 0.1" rx="0.4" :fill="pal.bank" />
      <rect :x="pondBox.x" :y="pondBox.y" :width="pondBox.w" :height="pondBox.h" rx="0.36" :fill="pal.water" />
      <rect :x="pondBox.x + 0.2" :y="pondBox.y + 0.2" :width="pondBox.w * 0.35" height="0.06" rx="0.03" :fill="pal.shine" />
    </template>

    <!-- motifs d'une case -->
    <template v-for="it in items" :key="'s' + it.r + '-' + it.c">
      <g v-if="it.kind !== 'field'" class="pop" :style="{ animationDelay: it.d + 'ms' }" :transform="`translate(${it.c} ${it.r}) scale(0.01)`">
        <!-- herbe : fleurs, feuilles, cailloux, bosses de neige selon la saison -->
        <template v-if="it.kind === 'grass'">
          <g v-if="it.v === 0">
            <circle cx="28" cy="66" r="5" :fill="pal.dots[0]" /><circle cx="64" cy="40" r="5" :fill="pal.dots[1]" /><circle cx="74" cy="74" r="4.5" :fill="pal.dots[2]" />
          </g>
          <g v-else-if="it.v === 1">
            <path d="M30 70 l4 -12 l4 12 M62 46 l4 -12 l4 12" :stroke="pal.tuft" stroke-width="3" fill="none" stroke-linecap="round" />
          </g>
        </template>

        <!-- arbre feuillu (couleurs de la saison ; en hiver : givré) -->
        <template v-else-if="it.kind === 'tree'">
          <ellipse cx="50" cy="84" rx="28" ry="8" fill="#000" opacity="0.14" />
          <rect x="45" y="56" width="10" height="28" rx="3" fill="#7a4e2d" />
          <circle cx="50" cy="40" r="26" :fill="pal.canopy[0]" />
          <circle cx="38" cy="48" r="17" :fill="pal.canopy[1]" />
          <circle cx="62" cy="46" r="17" :fill="pal.canopy[2]" />
          <template v-if="pal.fruit && it.v === 2"><circle cx="44" cy="36" r="4" :fill="pal.fruit" /><circle cx="60" cy="48" r="4" :fill="pal.fruit" /></template>
        </template>

        <!-- sapin -->
        <template v-else-if="it.kind === 'pine'">
          <ellipse cx="50" cy="88" rx="22" ry="6" fill="#000" opacity="0.14" />
          <rect x="46" y="72" width="8" height="16" fill="#6b4226" />
          <path d="M50 8 L74 42 H60 L80 70 H20 L40 42 H26 Z" :fill="pal.pine[0]" />
          <path d="M50 8 L64 42 H50 L66 70 H50 Z" :fill="pal.pine[1]" opacity="0.7" />
          <template v-if="pal.snow">
            <path d="M50 8 L61 24 L50 21 L39 24 Z" fill="#fff" /><path d="M40 42 L47 38 L58 38 L62 42 L50 46 Z" fill="#fff" /><path d="M24 69 L32 60 L68 60 L76 69 L60 66 L40 66 Z" fill="#fff" />
          </template>
        </template>

        <!-- maison / chalet / cabane (toit enneigé en hiver) -->
        <template v-else-if="it.kind === 'house'">
          <ellipse cx="50" cy="86" rx="38" ry="7" fill="#000" opacity="0.14" />
          <rect x="18" y="44" width="64" height="40" :fill="WALLS[it.v]" stroke="#a8977a" stroke-width="2.5" />
          <path d="M10 46 L50 14 L90 46 Z" :fill="ROOFS[it.v]" :stroke="pal.snow ? '#b4c4d6' : '#00000030'" stroke-width="2" stroke-linejoin="round" />
          <rect x="44" y="58" width="14" height="26" rx="2" fill="#7a4e2d" />
          <rect x="24" y="54" width="12" height="12" fill="#bfe3fa" stroke="#a8977a" stroke-width="2" />
          <rect x="66" y="54" width="12" height="12" fill="#bfe3fa" stroke="#a8977a" stroke-width="2" />
          <rect x="66" y="22" width="8" height="14" fill="#a8977a" />
          <path v-if="pal.snow" d="M66 22 h8 v-3 h-8 Z" fill="#fff" />
        </template>

        <!-- montagne (neige au sommet) -->
        <template v-else-if="it.kind === 'mountain'">
          <ellipse cx="50" cy="88" rx="44" ry="8" fill="#000" opacity="0.16" />
          <path :d="it.v === 1 ? 'M4 88 L34 30 L52 58 L68 24 L96 88 Z' : 'M6 88 L38 18 L62 56 L72 40 L94 88 Z'" :fill="pal.rock[0]" :stroke="pal.rock[1]" stroke-width="2.5" stroke-linejoin="round" />
          <path :d="it.v === 1 ? 'M68 24 L58 44 L66 40 L72 46 L78 40 Z' : 'M38 18 L26 42 L34 38 L40 46 L48 38 Z'" fill="#fff" />
          <path :d="it.v === 1 ? 'M68 24 L96 88 L66 88 Z' : 'M38 18 L62 56 L72 40 L94 88 L48 88 Z'" :fill="pal.rock[1]" opacity="0.28" />
        </template>

        <!-- rocher isolé -->
        <template v-else-if="it.kind === 'boulder'">
          <ellipse cx="50" cy="78" rx="30" ry="7" fill="#000" opacity="0.14" />
          <path d="M22 76 Q20 50 40 44 Q62 38 76 56 Q84 70 78 76 Z" :fill="pal.rock[0]" :stroke="pal.rock[1]" stroke-width="2.5" stroke-linejoin="round" />
          <path d="M40 44 Q62 38 76 56 L60 54 Z" fill="#fff" opacity="0.35" />
        </template>

        <!-- bonhomme de neige -->
        <template v-else-if="it.kind === 'snowman'">
          <ellipse cx="50" cy="86" rx="22" ry="6" fill="#000" opacity="0.12" />
          <circle cx="50" cy="68" r="17" fill="#fff" stroke="#b4c4d6" stroke-width="2" />
          <circle cx="50" cy="42" r="12" fill="#fff" stroke="#b4c4d6" stroke-width="2" />
          <rect x="40" y="26" width="20" height="6" fill="#374151" /><rect x="44" y="14" width="12" height="14" fill="#374151" />
          <path d="M50 42 l12 3 l-12 3 Z" fill="#f97316" /><circle cx="46" cy="39" r="1.8" fill="#111827" /><circle cx="54" cy="39" r="1.8" fill="#111827" />
        </template>
      </g>
    </template>
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
  animation: scene-in 0.7s ease both;
}
@keyframes scene-in {
  from {
    opacity: 0;
  }
}
.pop {
  animation: pop 0.5s ease both;
}
@keyframes pop {
  from {
    opacity: 0;
  }
}
</style>
