<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import type { Theme } from '../scenery'
import type { Home3D } from '../scenery3d/home'

// Fond 3D du menu (voir scenery3d/home.ts). Three.js est chargé à part : le dessin SVG du fond reste affiché
// en attendant, et il reprend la main en cas d'échec.
const props = defineProps<{ theme: Theme }>()
const emit = defineEmits<{ (e: 'ready'): void; (e: 'fail'): void }>()

const canvas = ref<HTMLCanvasElement | null>(null)
const ready = ref(false)
let view: Home3D | null = null
let gone = false
onMounted(async () => {
  try {
    const { createHome } = await import('../scenery3d/home')
    if (gone || !canvas.value) return
    const v = await createHome(canvas.value, props.theme)
    if (gone) return v.dispose()
    view = v
    ready.value = true
    emit('ready')
  } catch {
    if (!gone) emit('fail')
  }
})
onUnmounted(() => {
  gone = true
  view?.dispose()
})
</script>

<template>
  <canvas ref="canvas" class="home3d" :class="{ ready }" data-test="home-3d" aria-hidden="true" />
</template>

<style scoped>
.home3d {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  opacity: 0;
  transition: opacity 1s ease;
}
.home3d.ready {
  opacity: 1;
}
</style>
