<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { webglAvailable } from '../decor'
import { styleOf } from '../trainStyle'
import type { Depot, DepotPick } from '../scenery3d/depot'

// Le dépôt en 3D (scenery3d/depot.ts) : les 3 trains sur leurs voies, celui « en route » au quai, les garages au fond
// et l'entrepôt de la collection derrière. Ce qu'on touche remonte par `pick`. Sans 3D : `fallback` (le parent montre des boutons).
const props = defineProps<{ presets: string[][]; active: number }>()
const emit = defineEmits<{ (e: 'pick', p: DepotPick): void; (e: 'fallback'): void }>()

const canvas = ref<HTMLCanvasElement | null>(null)
const ok = ref(webglAvailable())
let depot: Depot | null = null
let gone = false
const styles = computed(() => props.presets.map((p) => p.map(styleOf)))

onMounted(async () => {
  if (!ok.value) return emit('fallback')
  try {
    const { createDepot } = await import('../scenery3d/depot')
    if (gone || !canvas.value) return
    depot = createDepot(canvas.value, (p) => emit('pick', p))
    depot.setTrains(styles.value)
    depot.setActive(props.active)
  } catch {
    ok.value = false
    emit('fallback')
  }
})
watch(styles, (s) => depot?.setTrains(s))
watch(() => props.active, (a) => depot?.setActive(a))
onUnmounted(() => {
  gone = true
  depot?.dispose()
})
</script>

<template>
  <div v-if="ok" class="depot" data-test="depot">
    <canvas ref="canvas" aria-label="Le dépôt : touche un train pour le faire rouler, un garage pour le personnaliser, l'entrepôt pour ta collection" role="img" />
  </div>
</template>

<style scoped>
.depot {
  position: relative;
  overflow: hidden;
  border-radius: 1.2rem;
  border: 3px solid #fff;
  background: #9fd07f;
  box-shadow: 0 3px 10px rgba(30, 64, 175, 0.15);
}
canvas {
  display: block;
  width: 100%;
  height: max(16rem, min(calc(100dvh - 10rem), 50vw));
  touch-action: manipulation;
}
</style>
