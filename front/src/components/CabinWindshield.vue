<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { cabView, trackHeading, VIEW } from '../cabView'
import { PAL, type Theme } from '../scenery/themes'
import type { Scenery } from '../scenery/generate'
import type { Route } from '../trainRoute'
import type { LandFrame } from '../scenery/motion'
import Windshield3D from './Windshield3D.vue'
import { webglAvailable } from '../decor'

// Pare-brise de la cabine. Quand le train roule, c'est la VRAIE carte vue de la locomotive : le trajet, les arbres, les maisons, les
// champs, l'eau et la route sont ceux du décor, projetés en perspective depuis la position du train (voir cabView.ts). Une maison à droite de
// la voie sur la carte est à droite ici, au moment où le petit train la dépasse. Sans carte (avant la victoire) : une voie droite, fixe.
// Aucun clic, aucun son : c'est un décor.
const props = defineProps<{ scene?: { route: Route; scenery: Scenery; rails?: Route | null } | null; progress?: number; running?: boolean; theme?: Theme; land?: LandFrame | null }>()

// Décor 3D choisi et possible : la vraie 3D vue de la locomotive, par-dessus le dessin (qui reste en secours).
const failed3d = ref(false)
const use3d = computed(() => !!props.scene && !failed3d.value && webglAvailable())

const pal = computed(() => PAL[props.scene?.scenery.theme ?? props.theme ?? 'plaine'] ?? PAL.plaine)
// Le cap de la caméra suit celui de la voie EN DOUCEUR (filtre + vitesse de rotation limitée) : dans un virage la vue pivote lentement, sans tournis.
const heading = ref<number | null>(null)
let lastTick: number | null = null
let lastRoute: Route | null = null
let lastProgress = 0
watch(
  () => [props.scene, props.progress] as const,
  () => {
    if (!props.scene) {
      heading.value = null
      lastTick = null
      return
    }
    const p = props.progress ?? 0
    const target = trackHeading(props.scene.route, p)
    const now = performance.now()
    const dt = lastTick === null ? 0 : Math.min(0.1, (now - lastTick) / 1000)
    lastTick = now
    // Nouveau trajet ou train reparti en arrière (niveau suivant, train relancé) : on se cale tout de suite dans l'axe de la
    // voie. Sinon la caméra partirait du cap de la fin du trajet précédent et pivoterait au départ, sans raison visible.
    const restart = props.scene.route !== lastRoute || p < lastProgress - 0.5
    lastRoute = props.scene.route
    lastProgress = p
    if (heading.value === null || dt === 0 || restart) {
      heading.value = target
      return
    }
    const gap = Math.atan2(Math.sin(target - heading.value), Math.cos(target - heading.value)) // plus court chemin
    const wanted = gap * (1 - Math.exp(-dt * 2.6))
    const most = (50 * Math.PI * dt) / 180 // jamais plus de 50° par seconde
    heading.value += Math.max(-most, Math.min(most, wanted))
  },
  { immediate: true, flush: 'sync' },
)
const view = computed(() => (props.scene ? cabView(props.scene.scenery, props.scene.route, props.progress ?? 0, { heading: heading.value ?? undefined, land: props.land }) : null))
// Tout ce qui se dessine debout, du plus loin au plus proche : les objets du décor et ce qui bouge.
const drawList = computed(() => {
  const v = view.value
  if (!v) return []
  return [...v.sprites.map((t) => ({ ...t, t: 'tile' as const })), ...v.live].sort((a, b) => b.f - a.f)
})
const BIRD_COLORS: Record<string, string> = { gull: '#f8fafc', crow: '#111827', eagle: '#5b3a21', parrot: '#22c55e', vulture: '#1f2937', bat: '#111827', pigeon: '#94a3b8', drone: '#475569' }
const pts = (p: [number, number][]) => p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
const groundFill = (q: { kind: string; v: number }) =>
  q.kind === 'water' ? pal.value.water : q.kind === 'road' ? pal.value.road : q.kind === 'path' ? pal.value.bed : q.kind === 'field' ? pal.value.crops[q.v % pal.value.crops.length][0] : pal.value.b
const place = (s: { x: number; y: number; u: number }) => `translate(${s.x.toFixed(1)} ${s.y.toFixed(1)}) scale(${s.u.toFixed(2)})`
// Collines lointaines : elles tournent avec le cap du train dans les virages.
const hillShift = computed(() => (((((view.value?.heading ?? 0) * 70) % 340) + 340) % 340) * -1)

// Voie droite, fixe : ce qu'on voit avant que la carte existe.
const HORIZON = VIEW.horizon
const calmSleepers = [66, 70.5, 76.5, 84.5, 95, 109].map((y, i) => ({ y, x1: 170 - (101 * (y - HORIZON)) / 58 - 3, x2: 170 + (101 * (y - HORIZON)) / 58 + 3, w: 1 + i * 0.7 }))
</script>

<template>
  <div class="pb-wrap">
  <svg class="pare-brise" viewBox="0 0 340 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true" data-test="cabin-windshield" :data-running="props.running ? 'true' : 'false'" :data-mapped="view ? 'true' : 'false'" :data-heading="heading === null ? undefined : heading.toFixed(3)">
    <defs>
      <linearGradient id="pb-ciel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cc4f0" /><stop offset="1" stop-color="#dbeefe" /></linearGradient>
    </defs>
    <rect width="340" :height="HORIZON" fill="url(#pb-ciel)" />
    <g :transform="`translate(${hillShift} 0)`" :fill="pal.b">
      <path d="M0 62 L40 50 L80 59 L130 48 L190 60 L250 49 L300 58 L340 52 L340 66 L0 66Z" />
      <path transform="translate(340 0)" d="M0 62 L40 50 L80 59 L130 48 L190 60 L250 49 L300 58 L340 52 L340 66 L0 66Z" />
      <path transform="translate(680 0)" d="M0 62 L40 50 L80 59 L130 48 L190 60 L250 49 L300 58 L340 52 L340 66 L0 66Z" />
    </g>
    <rect y="62" width="340" height="58" :fill="pal.a" />

    <template v-if="view">
      <!-- le sol de la carte : herbe en damier, champs, eau, route -->
      <polygon v-for="(q, i) in view.ground" :key="'g' + i" :points="pts(q.pts)" :fill="groundFill(q)" />
      <!-- la voie -->
      <polygon v-if="view.ballast" :points="pts(view.ballast)" :fill="pal.bed" />
      <line v-for="(t, i) in view.sleepers" :key="'t' + i" :x1="t.x1" :x2="t.x2" :y1="t.y" :y2="t.y" :stroke="pal.rail.tie" :stroke-width="t.w" stroke-linecap="round" />
      <polyline v-for="(r, i) in view.rails" :key="'r' + i" :points="pts(r)" fill="none" :stroke="pal.rail.rail" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
      <!-- les objets de la carte, du plus loin au plus proche (1 unité = 1 case) -->
      <template v-for="(s, i) in drawList" :key="'d' + i">
      <g v-if="s.t === 'tile'" :transform="place(s)" :data-kind="s.kind">
        <template v-if="s.kind === 'tree'">
          <rect x="-0.05" y="-0.3" width="0.1" height="0.3" :fill="pal.trunk ?? '#5b3a21'" />
          <circle cx="0" cy="-0.52" r="0.3" :fill="pal.canopy[s.v % 3]" />
        </template>
        <template v-else-if="s.kind === 'pine'">
          <rect x="-0.04" y="-0.2" width="0.08" height="0.2" :fill="pal.trunk ?? '#5b3a21'" />
          <polygon points="0,-1.05 -0.3,-0.55 0.3,-0.55" :fill="pal.pine[s.v % 2]" />
          <polygon points="0,-0.8 -0.36,-0.25 0.36,-0.25" :fill="pal.pine[(s.v + 1) % 2]" />
          <polygon v-if="pal.snow" points="0,-1.05 -0.12,-0.85 0.12,-0.85" fill="#fff" />
        </template>
        <template v-else-if="s.kind === 'house'">
          <rect x="-0.3" y="-0.36" width="0.6" height="0.36" :fill="pal.walls[s.v % pal.walls.length]" />
          <polygon points="-0.37,-0.36 0,-0.64 0.37,-0.36" :fill="pal.roofs[s.v % pal.roofs.length]" />
          <rect x="-0.05" y="-0.2" width="0.1" height="0.2" fill="#7c2d12" /><rect x="0.12" y="-0.28" width="0.1" height="0.1" fill="#93c5fd" /><rect x="-0.22" y="-0.28" width="0.1" height="0.1" fill="#93c5fd" />
        </template>
        <template v-else-if="s.kind === 'windmill'">
          <polygon points="-0.15,0 0.15,0 0.09,-0.72 -0.09,-0.72" :fill="pal.walls[0]" />
          <polygon points="-0.13,-0.72 0,-0.9 0.13,-0.72" :fill="pal.roofs[0]" />
          <g stroke="#7c2d12" stroke-width="0.05" stroke-linecap="round"><line x1="0" y1="-0.72" x2="-0.4" y2="-1.1" /><line x1="0" y1="-0.72" x2="0.4" y2="-1.1" /><line x1="0" y1="-0.72" x2="0.4" y2="-0.34" /><line x1="0" y1="-0.72" x2="-0.4" y2="-0.34" /></g>
        </template>
        <template v-else-if="s.kind === 'cactus'">
          <rect x="-0.06" y="-0.6" width="0.12" height="0.6" rx="0.06" fill="#3f9d4a" /><rect x="-0.22" y="-0.4" width="0.1" height="0.2" rx="0.05" fill="#3f9d4a" /><rect x="0.12" y="-0.46" width="0.1" height="0.2" rx="0.05" fill="#3f9d4a" />
        </template>
        <template v-else-if="s.kind === 'palm'">
          <path d="M0 0 Q0.06 -0.4 0.02 -0.8" fill="none" stroke="#92400e" stroke-width="0.08" stroke-linecap="round" />
          <ellipse cx="-0.2" cy="-0.82" rx="0.26" ry="0.08" fill="#22a34a" /><ellipse cx="0.24" cy="-0.82" rx="0.26" ry="0.08" fill="#22a34a" /><ellipse cx="0" cy="-0.95" rx="0.1" ry="0.22" fill="#16a34a" />
        </template>
        <template v-else-if="s.kind === 'boulder'">
          <ellipse cx="0" cy="-0.12" rx="0.24" ry="0.15" :fill="pal.rock[0]" /><ellipse cx="0.05" cy="-0.16" rx="0.12" ry="0.07" :fill="pal.rock[1]" />
        </template>
        <template v-else-if="s.kind === 'mountain'">
          <polygon points="-0.75,0 0,-1.15 0.75,0" fill="#8b95a1" /><polygon points="-0.22,-0.82 0,-1.15 0.22,-0.82" :fill="pal.cap ?? '#fff'" />
        </template>
        <template v-else-if="s.kind === 'snowman'">
          <circle cx="0" cy="-0.12" r="0.14" fill="#fff" stroke="#cbd5e1" stroke-width="0.02" /><circle cx="0" cy="-0.34" r="0.1" fill="#fff" stroke="#cbd5e1" stroke-width="0.02" /><circle cx="0" cy="-0.5" r="0.07" fill="#fff" stroke="#cbd5e1" stroke-width="0.02" />
        </template>
        <template v-else-if="s.kind === 'deadtree'">
          <path d="M0 0 L0 -0.5 M0 -0.3 L-0.18 -0.5 M0 -0.4 L0.16 -0.6" fill="none" stroke="#4b3b2a" stroke-width="0.07" stroke-linecap="round" />
        </template>
        <template v-else-if="s.kind === 'building'">
          <rect x="-0.26" y="-1" width="0.52" height="1" fill="#64748b" />
          <g fill="#fde68a"><rect x="-0.17" y="-0.85" width="0.1" height="0.1" /><rect x="0.07" y="-0.85" width="0.1" height="0.1" /><rect x="-0.17" y="-0.6" width="0.1" height="0.1" /><rect x="0.07" y="-0.6" width="0.1" height="0.1" /><rect x="-0.17" y="-0.35" width="0.1" height="0.1" /><rect x="0.07" y="-0.35" width="0.1" height="0.1" /></g>
        </template>
        <template v-else-if="s.kind === 'mesa'">
          <rect x="-0.5" y="-0.55" width="1" height="0.55" fill="#c2693c" /><rect x="-0.5" y="-0.55" width="1" height="0.1" fill="#d98a5c" />
        </template>
        <template v-else-if="s.kind === 'dune'">
          <ellipse cx="0" cy="-0.1" rx="0.6" ry="0.16" fill="#e0c17c" />
        </template>
        <template v-else-if="s.kind === 'skull'">
          <circle cx="0" cy="-0.12" r="0.1" fill="#f1f5f9" /><rect x="-0.05" y="-0.06" width="0.1" height="0.06" fill="#f1f5f9" />
        </template>
        <template v-else>
          <!-- cratère, obsidienne, évent… -->
          <ellipse cx="0" cy="-0.08" rx="0.3" ry="0.1" fill="#2b2b33" />
        </template>
      </g>
      <!-- ce qui bouge sur la carte : les mêmes voitures, barrières et animaux que sur le décor -->
      <g v-else-if="s.t === 'car'" :transform="place(s)" data-live="car">
        <g v-if="s.side !== 0" :transform="`scale(${s.side} 1)`">
          <template v-if="s.kind === 1">
            <rect x="-0.26" y="-0.3" width="0.32" height="0.22" rx="0.02" fill="#e5e7eb" stroke="#00000033" stroke-width="0.01" /><rect x="0.08" y="-0.22" width="0.17" height="0.14" rx="0.03" :fill="s.color" /><rect x="0.15" y="-0.2" width="0.06" height="0.07" fill="#9ccbe2" />
          </template>
          <template v-else>
            <rect x="-0.22" y="-0.18" width="0.44" height="0.11" rx="0.03" :fill="s.color" stroke="#00000033" stroke-width="0.01" /><rect x="-0.1" y="-0.27" width="0.22" height="0.1" rx="0.03" fill="#bfe3fa" /><rect x="0.17" y="-0.16" width="0.04" height="0.04" fill="#fde68a" />
          </template>
          <circle cx="-0.13" cy="-0.05" r="0.055" fill="#111827" /><circle cx="0.13" cy="-0.05" r="0.055" fill="#111827" />
        </g>
        <g v-else>
          <rect x="-0.12" y="-0.22" width="0.24" height="0.15" rx="0.03" :fill="s.color" stroke="#00000033" stroke-width="0.01" /><rect x="-0.08" y="-0.2" width="0.16" height="0.06" fill="#bfe3fa" />
          <circle cx="-0.08" cy="-0.1" r="0.025" :fill="s.away ? '#ef4444' : '#fde68a'" /><circle cx="0.08" cy="-0.1" r="0.025" :fill="s.away ? '#ef4444' : '#fde68a'" />
          <rect x="-0.14" y="-0.07" width="0.05" height="0.07" fill="#111827" /><rect x="0.09" y="-0.07" width="0.05" height="0.07" fill="#111827" />
        </g>
      </g>
      <g v-else-if="s.t === 'barrier'" data-live="barrier">
        <line :x1="s.base[0]" :y1="s.base[1]" :x2="s.top[0]" :y2="s.top[1]" stroke="#374151" :stroke-width="s.w" stroke-linecap="round" />
        <line :x1="s.top[0]" :y1="s.top[1]" :x2="s.tip[0]" :y2="s.tip[1]" stroke="#fff" :stroke-width="s.w * 1.1" stroke-linecap="butt" />
        <line :x1="s.top[0]" :y1="s.top[1]" :x2="s.tip[0]" :y2="s.tip[1]" stroke="#dc2626" :stroke-width="s.w * 1.1" :stroke-dasharray="`${s.w * 1.4} ${s.w * 1.4}`" />
        <circle :cx="s.top[0]" :cy="s.top[1] - s.w * 1.3" :r="s.w * 0.9" :fill="s.lights ? '#ef4444' : '#7f1d1d'" />
      </g>
      <g v-else-if="s.t === 'animal'" :transform="`translate(${s.x.toFixed(1)} ${s.y.toFixed(1)}) scale(${(s.u * s.flip).toFixed(2)} ${s.u.toFixed(2)})`" :data-live="s.kind">
        <template v-if="s.kind === 'deer'">
          <ellipse cx="0" cy="-0.26" rx="0.17" ry="0.09" fill="#a16207" /><g stroke="#7c4a05" stroke-width="0.03" stroke-linecap="round"><line x1="-0.1" y1="-0.2" x2="-0.1" y2="-0.02" /><line x1="0.1" y1="-0.2" x2="0.1" y2="-0.02" /></g>
          <path d="M0.12 -0.3 L0.19 -0.44" stroke="#a16207" stroke-width="0.05" stroke-linecap="round" /><circle cx="0.2" cy="-0.46" r="0.045" fill="#a16207" /><path d="M0.18 -0.5 L0.15 -0.6 M0.22 -0.5 L0.25 -0.6" stroke="#5b3a21" stroke-width="0.02" />
        </template>
        <template v-else-if="s.kind === 'rabbit'">
          <ellipse cx="0" cy="-0.08" rx="0.09" ry="0.07" fill="#e5e7eb" /><circle cx="0.09" cy="-0.13" r="0.045" fill="#e5e7eb" /><rect x="0.07" y="-0.27" width="0.03" height="0.12" rx="0.015" fill="#e5e7eb" /><rect x="0.11" y="-0.26" width="0.03" height="0.11" rx="0.015" fill="#e5e7eb" /><circle cx="-0.1" cy="-0.09" r="0.025" fill="#fff" />
        </template>
        <template v-else-if="s.kind === 'squirrel'">
          <path d="M-0.05 -0.06 q-0.16 -0.02 -0.12 -0.16 q0.05 -0.1 0.12 -0.03" fill="#c2652a" /><ellipse cx="0" cy="-0.06" rx="0.07" ry="0.05" fill="#d9772f" /><circle cx="0.07" cy="-0.1" r="0.036" fill="#d9772f" />
        </template>
        <template v-else-if="s.kind === 'owl'">
          <ellipse cx="0" cy="-0.08" rx="0.1" ry="0.12" fill="#8b6f47" /><circle cx="-0.04" cy="-0.1" r="0.04" fill="#fff7d6" /><circle cx="0.04" cy="-0.1" r="0.04" fill="#fff7d6" /><circle cx="-0.04" cy="-0.1" r="0.018" fill="#111827" /><circle cx="0.04" cy="-0.1" r="0.018" fill="#111827" /><path d="M-0.012 -0.07 l0.012 0.03 l0.012 -0.03z" fill="#f59e0b" />
        </template>
        <template v-else-if="s.kind === 'sheep'">
          <circle cx="-0.05" cy="-0.1" r="0.06" fill="#f8fafc" /><circle cx="0.03" cy="-0.12" r="0.07" fill="#f8fafc" /><circle cx="0.08" cy="-0.08" r="0.05" fill="#f8fafc" /><ellipse cx="0.14" cy="-0.1" rx="0.04" ry="0.035" fill="#3b3b3b" /><rect x="-0.04" y="-0.06" width="0.02" height="0.06" fill="#3b3b3b" /><rect x="0.05" y="-0.06" width="0.02" height="0.06" fill="#3b3b3b" />
        </template>
        <template v-else-if="s.kind === 'cow'">
          <ellipse cx="0" cy="-0.16" rx="0.16" ry="0.08" fill="#fff" /><circle cx="-0.04" cy="-0.17" r="0.035" fill="#1f2937" /><ellipse cx="0.19" cy="-0.15" rx="0.05" ry="0.04" fill="#fff" /><ellipse cx="0.23" cy="-0.14" rx="0.02" ry="0.018" fill="#f9a8b4" /><g stroke="#374151" stroke-width="0.03"><line x1="-0.1" y1="-0.1" x2="-0.1" y2="0" /><line x1="0.1" y1="-0.1" x2="0.1" y2="0" /></g>
        </template>
        <template v-else-if="s.kind === 'tractor'">
          <circle cx="-0.08" cy="-0.07" r="0.07" fill="#1f2937" /><circle cx="0.11" cy="-0.045" r="0.045" fill="#1f2937" /><rect x="0" y="-0.12" width="0.18" height="0.07" rx="0.015" fill="#dc2626" /><rect x="-0.12" y="-0.2" width="0.12" height="0.12" rx="0.015" fill="#b91c1c" /><rect x="-0.1" y="-0.18" width="0.08" height="0.05" fill="#bfdbfe" />
        </template>
        <template v-else-if="s.kind === 'hedgehog'">
          <ellipse cx="0" cy="-0.06" rx="0.11" ry="0.07" fill="#6b4f35" /><circle cx="0.11" cy="-0.05" r="0.035" fill="#d6b88a" />
        </template>
        <template v-else-if="s.kind === 'butterfly'">
          <g :transform="`scale(1 ${0.6 + 0.4 * Math.abs(Math.sin(s.time * 12))})`"><ellipse cx="-0.05" cy="-0.06" rx="0.06" ry="0.05" fill="#f472b6" /><ellipse cx="0.05" cy="-0.06" rx="0.06" ry="0.05" fill="#fbbf24" /></g>
        </template>
        <template v-else-if="s.kind === 'cat'">
          <ellipse cx="0" cy="-0.09" rx="0.11" ry="0.07" fill="#9ca3af" /><circle cx="0.11" cy="-0.14" r="0.05" fill="#9ca3af" /><path d="M-0.1 -0.1 q-0.12 -0.06 -0.05 -0.2" fill="none" stroke="#9ca3af" stroke-width="0.04" stroke-linecap="round" />
        </template>
        <template v-else-if="s.kind === 'lizard'">
          <ellipse cx="0" cy="-0.04" rx="0.12" ry="0.035" fill="#4ade80" /><path d="M-0.1 -0.04 q-0.12 0.02 -0.18 -0.03" fill="none" stroke="#4ade80" stroke-width="0.03" stroke-linecap="round" />
        </template>
        <template v-else-if="s.kind === 'scorpion'">
          <ellipse cx="0" cy="-0.05" rx="0.09" ry="0.05" fill="#7f1d1d" /><path d="M-0.08 -0.06 q-0.14 -0.06 -0.06 -0.2 q0.04 -0.04 0.08 0" fill="none" stroke="#7f1d1d" stroke-width="0.035" stroke-linecap="round" />
        </template>
        <template v-else>
          <ellipse cx="0" cy="-0.1" rx="0.07" ry="0.08" fill="#86efac" /><circle cx="0" cy="-0.22" r="0.07" fill="#86efac" /><circle cx="-0.03" cy="-0.23" r="0.02" fill="#111827" /><circle cx="0.03" cy="-0.23" r="0.02" fill="#111827" />
        </template>
      </g>
      <g v-else-if="s.t === 'bird'" :transform="`translate(${s.x.toFixed(1)} ${s.y.toFixed(1)}) scale(${s.u.toFixed(2)})`" data-live="bird">
        <path :d="`M-0.22 ${0.04 + s.flap * 0.1} Q-0.1 ${-0.08 - s.flap * 0.1} 0 0 Q0.1 ${-0.08 - s.flap * 0.1} 0.22 ${0.04 + s.flap * 0.1}`" fill="none" :stroke="BIRD_COLORS[s.kind] ?? '#111827'" stroke-width="0.05" stroke-linecap="round" />
      </g>
      </template>
    </template>
    <template v-else>
      <polygon points="170,62 36,120 304,120" :fill="pal.bed" />
      <line v-for="(t, i) in calmSleepers" :key="'c' + i" :x1="t.x1" :x2="t.x2" :y1="t.y" :y2="t.y" :stroke="pal.rail.tie" :stroke-width="t.w" stroke-linecap="round" />
      <line x1="170" :y1="HORIZON" x2="78" y2="120" :stroke="pal.rail.rail" stroke-width="2.6" stroke-linecap="round" />
      <line x1="170" :y1="HORIZON" x2="262" y2="120" :stroke="pal.rail.rail" stroke-width="2.6" stroke-linecap="round" />
    </template>
    <!-- montants du pare-brise -->
    <polygon points="0,0 26,0 6,120 0,120" fill="#0b1220" /><polygon points="340,0 314,0 334,120 340,120" fill="#0b1220" />
  </svg>
    <Windshield3D v-if="use3d && scene" :key="'w3d-' + scene.scenery.seed" :scenery="scene.scenery" :route="scene.route" :rails="scene.rails" :progress="progress" :heading="heading" @fail="failed3d = true" />
  </div>
</template>

<style scoped>
.pb-wrap {
  position: relative;
  width: 100%;
  height: 100%;
}
.pare-brise {
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
</style>
