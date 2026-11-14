<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import type { Scenery } from '../scenery'
import type { Route } from '../trainRoute'
import { cameraAt } from '../cabView'

// Pare-brise en vraie 3D : la caméra est dans la locomotive, sur le MÊME monde que le plateau (scenery3d/world.ts).
// Elle suit la position du train et le cap lissé calculé par CabinWindshield (pas de tournis dans les virages).
// En cas d'échec, on prévient le parent, qui garde le pare-brise dessiné.
const props = defineProps<{ scenery: Scenery; route: Route; rails?: Route | null; progress?: number; heading?: number | null }>()
const emit = defineEmits<{ (e: 'fail'): void }>()

const canvas = ref<HTMLCanvasElement | null>(null)
const ready = ref(false)
let stop: (() => void) | null = null
let gone = false
onMounted(async () => {
  const sc = props.scenery
  try {
    const { acquireWorld, releaseWorld, makeRenderer, THREE } = await import('../scenery3d/world')
    if (gone || !canvas.value) return
    const world = await acquireWorld(sc, props.rails ?? null)
    if (gone) return releaseWorld(sc)
    const r = makeRenderer(canvas.value, true)
    const cam = new THREE.PerspectiveCamera(58, 3, 0.05, 80)
    const onSize = (w: number, h: number) => {
      cam.aspect = w / h
      cam.updateProjectionMatrix()
    }
    r.fit(onSize)
    const ahead = new THREE.Vector3()
    const remove = world.addView(() => {
      r.check(onSize)
      world.setMode('cab')
      const c = cameraAt(props.route, Math.max(0, props.progress ?? 0), props.heading ?? undefined)
      const x = c.x + sc.margin.x
      const z = c.y + sc.margin.y
      cam.position.set(x, 0.42, z)
      ahead.set(x + c.hx * 3, 0.3, z + c.hy * 3) // regard à peine vers le bas : la voie devant, l'horizon dans le tiers haut
      cam.lookAt(ahead)
      r.renderer.render(world.scene, cam)
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
  <canvas ref="canvas" class="pb3d" :class="{ ready }" data-test="windshield-3d" aria-hidden="true" />
</template>

<style scoped>
.pb3d {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.8s ease;
}
.pb3d.ready {
  opacity: 1;
}
</style>
