<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { pointAt, speedFactor, type Route } from '../trainRoute'

// Locomotive + wagons qui roulent le long du trajet, entrée → sortie.
// `speed` : cases/s en ligne droite. Le train ralentit dans les virages (voir speedFactor) et change de vitesse en douceur (inertie).
const props = withDefaults(
  // clip : zone (en cases) où le train est visible. Hors de cette zone (le décor), il disparaît : il ne roule jamais sur
  // l'interface (récapitulatif, pouvoirs, bouton Suivant).
  defineProps<{ route: Route; size: number; speed?: number; wagons?: number; clip?: { x: number; y: number; w: number; h: number } }>(),
  { speed: 1.9, wagons: 3 },
)
const emit = defineEmits<{ (e: 'done'): void; (e: 'progress', s: number): void }>()

const SPACING = 0.62
const COLORS = ['#2563eb', '#f59e0b', '#16a34a', '#8b5cf6', '#ec4899']
const total = computed(() => props.wagons * SPACING)

// Distance parcourue par la locomotive. On part avec tout le train déjà posé
// sur la voie (queue en 0), pour que les wagons ne soient jamais empilés.
const s = ref(total.value)
let timer = 0
let last = 0
let v = props.speed // vitesse actuelle : rejoint doucement la vitesse voulue

const cars = computed(() =>
  Array.from({ length: props.wagons + 1 }, (_, i) => ({
    i,
    ...pointAt(props.route, s.value - i * SPACING),
  })),
)

onMounted(() => {
  last = Date.now()
  timer = window.setInterval(() => {
    const now = Date.now()
    const dt = Math.min(0.1, (now - last) / 1000)
    v += (props.speed * speedFactor(props.route, s.value) - v) * Math.min(1, dt * 3.5)
    s.value += dt * v
    last = now
    emit('progress', s.value)
    // fini quand la locomotive atteint le bout du trajet, hors de l'écran :
    // les wagons la suivent encore sur la voie, rien ne s'écrase.
    if (s.value >= props.route.length) {
      s.value = props.route.length
      clearInterval(timer)
      emit('done')
    }
  }, 30)
})
onUnmounted(() => clearInterval(timer))
</script>

<template>
  <svg
    class="train"
    :viewBox="`-1 -1 ${size + 1} ${size + 1}`"
    data-test="train"
    aria-hidden="true"
  >
    <defs v-if="clip">
      <clipPath id="train-clip"><rect :x="clip.x" :y="clip.y" :width="clip.w" :height="clip.h" /></clipPath>
    </defs>
    <g :clip-path="clip ? 'url(#train-clip)' : undefined">
    <g
      v-for="car in [...cars].reverse()"
      :key="car.i"
      :transform="`translate(${car.x} ${car.y}) rotate(${car.angle})`"
    >
      <template v-if="car.i === 0">
        <!-- locomotive (avance vers +x) : capot rouge, cabine sombre, phare -->
        <rect x="-0.2" y="-0.11" width="0.42" height="0.22" rx="0.05" fill="#dc2626" stroke="#00000044" stroke-width="0.012" />
        <rect x="0.02" y="-0.085" width="0.12" height="0.17" rx="0.02" fill="#7f1d1d" />
        <rect x="-0.18" y="-0.07" width="0.13" height="0.14" rx="0.02" fill="#fecaca" opacity="0.6" />
        <circle cx="0.18" cy="0" r="0.05" fill="#fde68a" />
      </template>
      <template v-else>
        <rect x="-0.26" y="-0.1" width="0.52" height="0.2" rx="0.04" :fill="COLORS[car.i % COLORS.length]" stroke="#00000044" stroke-width="0.012" />
        <rect x="-0.2" y="-0.07" width="0.4" height="0.14" rx="0.02" fill="#fff" opacity="0.28" />
      </template>
    </g>
    <g v-if="cars[0]" class="smoke" :style="{ transform: `translate(${cars[0].x}px, ${cars[0].y}px)` }">
      <circle v-for="i in 3" :key="'s' + i" cx="0" cy="-0.1" r="0.03" fill="#f8fafc" opacity="0">
        <animate attributeName="cy" from="-0.1" to="-0.36" dur="1.2s" :begin="`${-i * 0.4}s`" repeatCount="indefinite" />
        <animate attributeName="cx" from="0" to="-0.08" dur="1.2s" :begin="`${-i * 0.4}s`" repeatCount="indefinite" />
        <animate attributeName="r" from="0.03" to="0.1" dur="1.2s" :begin="`${-i * 0.4}s`" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.7;0" dur="1.2s" :begin="`${-i * 0.4}s`" repeatCount="indefinite" />
      </circle>
    </g>
    </g>
  </svg>
</template>

<style scoped>
.train {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}
</style>
