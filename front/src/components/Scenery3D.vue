<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { Scenery } from '../scenery'
import type { Route } from '../trainRoute'

// Décor 3D d'un niveau gagné : même place et même taille que le décor SVG (SceneryLayer), sous les rails de la grille.
// Vue du dessus calée sur les cases. Three.js n'est chargé qu'ici, à la première victoire (fichier à part).
// En cas d'échec (pas de WebGL, chargement raté), on prévient le parent, qui remet le décor classique.
const props = defineProps<{ scenery: Scenery; route: Route | null }>()
const emit = defineEmits<{ (e: 'fail'): void }>()

const box = computed(() => {
  const s = props.scenery
  const board = s.rows - s.margin.y - s.margin.b
  const u = 100 / (board + 1)
  return { width: `${s.cols * u}%`, height: `${s.frame.visibleRows * u}%`, left: `${(1 - s.margin.x) * u}%`, top: `${(1 - s.margin.y) * u}%` }
})

const canvas = ref<HTMLCanvasElement | null>(null)
const ready = ref(false)
let stop: (() => void) | null = null
let gone = false
onMounted(async () => {
  const sc = props.scenery
  try {
    const { acquireWorld, releaseWorld, makeRenderer, THREE } = await import('../scenery3d/world')
    if (gone || !canvas.value) return
    const world = await acquireWorld(sc, props.route)
    if (gone) return releaseWorld(sc)
    const r = makeRenderer(canvas.value)
    const top = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 60)
    top.up.set(0, 0, -1)
    // vue du dessus calée en haut, comme le SVG (« xMidYMin slice ») : toute la largeur, le bas rogné
    const onSize = (w: number, h: number) => {
      const viewH = (sc.cols * h) / w
      Object.assign(top, { left: -sc.cols / 2, right: sc.cols / 2, top: viewH / 2, bottom: -viewH / 2 })
      top.position.set(sc.cols / 2, 20, viewH / 2)
      top.lookAt(sc.cols / 2, 0, viewH / 2)
      top.updateProjectionMatrix()
    }
    r.fit(onSize)
    const remove = world.addView(() => {
      r.check(onSize)
      world.setMode('top')
      r.draw(world.scene, top)
    })
    stop = () => {
      remove()
      r.dispose()
      releaseWorld(sc)
    }
    ready.value = true
  } catch {
    if (!gone) emit('fail')
  }
})
onUnmounted(() => {
  gone = true
  stop?.()
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
