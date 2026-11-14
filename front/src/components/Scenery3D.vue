<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { Scenery } from '../scenery'
import type { Route } from '../trainRoute'

// Décor 3D d'un niveau gagné : même place et même taille que le décor SVG (SceneryLayer), sous les rails de la grille.
// À plat (tilt = 0), vue du dessus calée sur les cases ; incliné, vraie perspective (la grille est alors cachée par le parent,
// et ce sont les rails et le train 3D qu'on voit). Three.js n'est chargé qu'ici, à la première victoire (fichier à part).
// En cas d'échec (pas de WebGL, chargement raté), on prévient le parent, qui remet le décor classique.
const props = defineProps<{ scenery: Scenery; route: Route | null; trainRoute?: Route | null; trainS?: number; tilt?: number; yaw?: number }>()
const emit = defineEmits<{ (e: 'fail'): void }>()

const box = computed(() => {
  const s = props.scenery
  const board = s.rows - s.margin.y - s.margin.b
  const u = 100 / (board + 1)
  return { width: `${s.cols * u}%`, height: `${s.frame.visibleRows * u}%`, left: `${-s.margin.x * u}%`, top: `${-s.margin.y * u}%` }
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
    const persp = new THREE.PerspectiveCamera(32, 1, 0.1, 120)
    let viewH = sc.rows
    let aspect = 1
    // vue du dessus calée en haut, comme le SVG (« xMidYMin slice ») : toute la largeur, le bas rogné
    const onSize = (w: number, h: number) => {
      aspect = w / h
      viewH = (sc.cols * h) / w
      Object.assign(top, { left: -sc.cols / 2, right: sc.cols / 2, top: viewH / 2, bottom: -viewH / 2 })
      top.position.set(sc.cols / 2, 20, viewH / 2)
      top.lookAt(sc.cols / 2, 0, viewH / 2)
      top.updateProjectionMatrix()
      persp.aspect = aspect
      persp.updateProjectionMatrix()
    }
    r.fit(onSize)
    const target = new THREE.Vector3()
    const remove = world.addView(() => {
      r.check(onSize)
      const tilt = Math.max(0, Math.min(70, props.tilt ?? 0))
      if (tilt < 1) {
        world.setMode('top')
        r.renderer.render(world.scene, top)
        return
      }
      world.setMode('free')
      world.setTrain(props.trainRoute ?? null, props.trainS ?? -1)
      // en orbite autour du centre de la zone visible ; à la même distance que la vue du dessus (toute la largeur)
      target.set(sc.cols / 2, 0, viewH / 2)
      const hfov = 2 * Math.atan(Math.tan((persp.fov * Math.PI) / 360) * aspect)
      const d = (sc.cols / 2 / Math.tan(hfov / 2)) * 0.92
      const a = (Math.max(4, tilt) * Math.PI) / 180
      const y = ((props.yaw ?? 0) * Math.PI) / 180
      persp.position.set(target.x + Math.sin(a) * Math.sin(y) * d, Math.cos(a) * d, target.z + Math.sin(a) * Math.cos(y) * d)
      persp.lookAt(target)
      r.renderer.render(world.scene, persp)
    })
    stop = () => {
      remove()
      r.renderer.dispose()
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
