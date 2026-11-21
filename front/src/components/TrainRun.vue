<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { pointAt, speedFactor, type Route } from '../trainRoute'
import { CAR_SPACING, WAGONS } from '../trainStyle'
import TrainCar from './TrainCar.vue'

// Locomotive + wagons qui roulent le long du trajet, entrée → sortie.
// `speed` : cases/s en ligne droite. Le train ralentit dans les virages (voir speedFactor) et change de vitesse en douceur (inertie).
const props = withDefaults(
  // clip : zone (en cases) où le train est visible. Hors de cette zone (le décor), il disparaît : il ne roule jamais sur
  // l'interface (récapitulatif, pouvoirs, bouton Suivant).
  defineProps<{ route: Route; size: number; ghost?: boolean; speed?: number; wagons?: number; stopStart?: number; stopEnd?: number; clip?: { x: number; y: number; w: number; h: number } }>(),
  { speed: 1.9, wagons: WAGONS },
)
const emit = defineEmits<{ (e: 'done'): void; (e: 'progress', s: number): void }>()

const SPACING = CAR_SPACING
const total = computed(() => props.wagons * SPACING)

// Distance parcourue par la locomotive. On part avec tout le train déjà posé
// sur la voie (queue en 0), pour que les wagons ne soient jamais empilés.
// Avec une gare de départ (`stopStart` : où la locomotive attend), le train démarre à l'arrêt, à quai, et repart après une courte attente.
// Avec une gare d'arrivée (`stopEnd`), il ralentit sur les 3 dernières cases et s'arrête à quai. Sans gare : comme avant.
const s = ref(props.stopStart ?? total.value)
let timer = 0
let last = 0
let v = props.stopStart != null ? 0 : props.speed // vitesse actuelle : rejoint doucement la vitesse voulue
let hold = props.stopStart != null ? 1.2 : 0 // attente à quai avant de partir (s)
const BRAKE = 3 // cases de freinage avant la gare d'arrivée

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
    last = now
    if (hold > 0) {
      hold -= dt
      emit('progress', s.value)
      return
    }
    let want = props.speed * speedFactor(props.route, s.value)
    if (props.stopEnd != null) want = Math.max(0.25, want * Math.min(1, (props.stopEnd - s.value) / BRAKE))
    v += (want - v) * Math.min(1, dt * 3.5)
    s.value += dt * v
    emit('progress', s.value)
    if (props.stopEnd != null && s.value >= props.stopEnd - 0.02) {
      // arrivé à quai : le train s'arrête, puis la suite s'affiche après une courte pause
      s.value = props.stopEnd
      clearInterval(timer)
      emit('progress', s.value)
      window.setTimeout(() => emit('done'), 800)
      return
    }
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
  <!-- ghost : le train est dessiné par la scène 3D (Scenery3D) ; ici on ne garde que la marche (vitesse, position, arrivée) -->
  <svg
    v-show="!ghost"
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
      <TrainCar :i="car.i" />
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
