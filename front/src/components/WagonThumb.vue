<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { webglAvailable } from '../decor'
import { styleOf } from '../trainStyle'
import TrainCar from './TrainCar.vue'

// Un wagon en vignette : le vrai modèle 3D (rendu une fois, voir scenery3d/wagonThumbs.ts), ou, sans 3D, le dessin vu du dessus.
// id = identifiant du catalogue (shared/wagons.ts), ou « loco » pour la locomotive.
const props = defineProps<{ id: string }>()
const src = ref('')
const flat = ref(!webglAvailable())

async function load(): Promise<void> {
  if (flat.value) return
  try {
    const { wagonThumb } = await import('../scenery3d/wagonThumbs')
    src.value = wagonThumb(props.id)
  } catch {
    flat.value = true
  }
}
onMounted(load)
watch(() => props.id, load)
</script>

<template>
  <img v-if="src" class="thumb" :src="src" alt="" draggable="false" />
  <svg v-else class="thumb" viewBox="-0.7 -0.25 1.4 0.5" aria-hidden="true">
    <TrainCar :i="id === 'loco' ? 0 : 1" :wagon="id === 'loco' ? null : styleOf(id)" :transform="id !== 'loco' && styleOf(id).length > 1 ? `scale(${1 / styleOf(id).length})` : undefined" />
  </svg>
</template>

<style scoped>
.thumb {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 8 / 5;
  object-fit: contain;
  pointer-events: none;
}
</style>
