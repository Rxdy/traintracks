<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { webglAvailable } from '../decor'
import { styleOf } from '../trainStyle'
import type { Depot } from '../scenery3d/depot'

// Le dépôt de Mon train (scenery3d/depot.ts) : les 3 trains enregistrés sur leurs voies, celui « en route » au quai.
// Toucher un garage ou un train : `pick` (le train à personnaliser). Sans 3D, rien : les onglets suffisent.
const props = defineProps<{ presets: string[][]; active: number; editing: number }>()
const emit = defineEmits<{ (e: 'pick', slot: number): void }>()

const canvas = ref<HTMLCanvasElement | null>(null)
const ok = ref(webglAvailable())
let depot: Depot | null = null
let gone = false
const styles = computed(() => props.presets.map((p) => p.map(styleOf)))

onMounted(async () => {
  if (!ok.value) return
  try {
    const { createDepot } = await import('../scenery3d/depot')
    if (gone || !canvas.value) return
    depot = createDepot(canvas.value, (k) => emit('pick', k))
    depot.setTrains(styles.value)
    depot.setState(props.active, props.editing)
  } catch {
    ok.value = false
  }
})
watch(styles, (s) => depot?.setTrains(s))
watch(() => [props.active, props.editing] as const, ([a, e]) => depot?.setState(a, e))
onUnmounted(() => {
  gone = true
  depot?.dispose()
})
</script>

<template>
  <div v-if="ok" class="depot card" data-test="depot">
    <canvas ref="canvas" aria-label="Le dépôt : touche un garage pour personnaliser son train" role="img" />
  </div>
</template>

<style scoped>
.depot {
  position: relative;
  padding: 0;
  overflow: hidden;
  border-radius: 1.2rem;
  border: 3px solid #fff;
  background: linear-gradient(#cfe9bf, #a8d48a);
  box-shadow: 0 3px 10px rgba(30, 64, 175, 0.15);
}
canvas {
  display: block;
  width: 100%;
  height: clamp(9rem, 19vw, 16rem);
  touch-action: manipulation;
}
</style>
