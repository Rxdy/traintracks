<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { Scenery } from '../scenery'
import type { Route } from '../trainRoute'
import type { View3D } from '../scenery3d/build'

// Décor 3D d'un niveau gagné : même place et même taille que le décor SVG (SceneryLayer), sous les rails de la grille.
// Three.js n'est chargé qu'ici, à la première victoire (fichier à part) : l'accueil et la partie ne s'alourdissent pas.
// En cas d'échec (pas de WebGL, chargement raté), on prévient le parent, qui remet le décor classique.
const props = defineProps<{ scenery: Scenery; route: Route | null }>()
const emit = defineEmits<{ (e: 'fail'): void }>()

const box = computed(() => {
  const s = props.scenery
  const board = s.rows - s.margin.y - s.margin.b
  const u = 100 / (board + 1)
  return { width: `${s.cols * u}%`, height: `${s.frame.visibleRows * u}%`, left: `${-s.margin.x * u}%`, top: `${-s.margin.y * u}%` }
})

const canvas = ref<HTMLCanvasElement | null>(null)
const ready = ref(false)
let view: View3D | null = null
let gone = false
onMounted(async () => {
  try {
    const { createView } = await import('../scenery3d/build')
    if (gone || !canvas.value) return
    const v = await createView(canvas.value, props.scenery, props.route)
    if (gone) return v.dispose()
    view = v
    ready.value = true
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
  <canvas ref="canvas" class="scenery3d" :class="{ ready }" :style="box" data-test="scenery-3d" aria-hidden="true" />
</template>

<style scoped>
.scenery3d {
  position: absolute;
  border-radius: calc(10px / var(--k, 1));
  pointer-events: none;
  opacity: 0;
  transition: opacity 1.2s ease-in-out;
}
.scenery3d.ready {
  opacity: 1;
}
</style>
