<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { pointAt, type Route } from '../trainRoute'

// Locomotive + wagons qui roulent le long du trajet, entrée → sortie.
// `speed` : cases/s, CONSTANTE de l'apparition à la disparition (pas d'accélération hors de la grille).
const props = withDefaults(
  defineProps<{ route: Route; size: number; speed?: number; wagons?: number }>(),
  { speed: 3.2, wagons: 3 },
)
const emit = defineEmits<{ (e: 'done'): void }>()

const SPACING = 0.66
const COLORS = ['#2563eb', '#f59e0b', '#16a34a', '#8b5cf6', '#ec4899']
const total = computed(() => props.wagons * SPACING)

// Distance parcourue par la locomotive. On part avec tout le train déjà posé
// sur la voie (queue en 0), pour que les wagons ne soient jamais empilés.
const s = ref(total.value)
let timer = 0
let last = 0

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
    s.value += ((now - last) / 1000) * props.speed
    last = now
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
    :viewBox="`0 0 ${size + 1} ${size + 1}`"
    data-test="train"
    aria-hidden="true"
  >
    <g
      v-for="car in [...cars].reverse()"
      :key="car.i"
      :transform="`translate(${car.x} ${car.y}) rotate(${car.angle})`"
    >
      <template v-if="car.i === 0">
        <!-- locomotive (avance vers +x) -->
        <rect x="-0.3" y="-0.17" width="0.6" height="0.34" rx="0.06" fill="#dc2626" stroke="#7f1d1d" stroke-width="0.025" />
        <rect x="-0.3" y="-0.17" width="0.22" height="0.34" rx="0.05" fill="#991b1b" />
        <rect x="0.12" y="-0.07" width="0.1" height="0.14" rx="0.02" fill="#111827" />
        <circle cx="0.27" cy="0" r="0.045" fill="#fde68a" />
      </template>
      <template v-else>
        <rect x="-0.25" y="-0.15" width="0.5" height="0.3" rx="0.05" :fill="COLORS[car.i % COLORS.length]" stroke="#111827" stroke-opacity="0.45" stroke-width="0.025" />
        <line x1="-0.1" y1="-0.15" x2="-0.1" y2="0.15" stroke="#fff" stroke-opacity="0.5" stroke-width="0.02" />
        <line x1="0.1" y1="-0.15" x2="0.1" y2="0.15" stroke="#fff" stroke-opacity="0.5" stroke-width="0.02" />
      </template>
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
