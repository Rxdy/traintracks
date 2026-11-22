<script setup lang="ts">
import { reducedMotion } from '../settings'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { Scenery } from '../scenery'
import { pointAt, type Route } from '../trainRoute'
import { carLength, carOffsets } from '../trainStyle'
import { trainWagons } from '../myTrain'

// Décor 3D d'un niveau gagné : même place et même taille que le décor SVG (SceneryLayer), sous les rails de la grille.
// Vue du dessus calée sur les cases. Three.js n'est chargé qu'ici, à la première victoire (fichier à part).
// En cas d'échec (pas de WebGL, chargement raté), on prévient le parent, qui remet le décor classique.
// `train` : la voie suivie et la position de la locomotive (cases) ; le train roule DANS la scène 3D, les arbres devant la voie le cachent.
const props = defineProps<{ scenery: Scenery; route: Route | null; train?: { route: Route; s: number } | null }>()
const emit = defineEmits<{ (e: 'fail'): void; (e: 'ready'): void }>()

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
    // le train, en 3D (même modèle que les icônes) : posé sur la voie à chaque image d'après la position de la locomotive
    const { makeCar, makeSteam, makeWagon, CHIMNEY } = await import('../scenery3d/trainModel')
    if (gone) return releaseWorld(sc)
    const train = new THREE.Group()
    // le train du joueur (Mon train), figé pour ce trajet
    const wagons = [...trainWagons.value]
    const offsets = carOffsets(wagons)
    const halves = [null, ...wagons].map((w) => carLength(w) * 0.36) // où sont les essieux (ou bogies) avant et arrière
    const cars = [makeCar(0), ...wagons.map(makeWagon)]
    cars.forEach((c) => train.add(c))
    train.visible = false
    const unTrain = world.add(train)
    // fumée de la locomotive (rien si le joueur a demandé moins d'animations)
    const still = reducedMotion()
    const steam = makeSteam()
    const unSteam = world.add(steam.group)
    const chimney = new THREE.Vector3()
    let lastS = -1
    const placeTrain = () => {
      const tr = props.train
      train.visible = !!tr && tr.s >= 0
      if (!tr || tr.s < 0) return
      // chaque voiture posée sur ses deux essieux : un wagon long coupe le virage comme un vrai, sans sortir de la voie
      cars.forEach((car, i) => {
        const c = tr.s - offsets[i]!
        const a = pointAt(tr.route, c + halves[i]!)
        const b = pointAt(tr.route, c - halves[i]!)
        car.position.set((a.x + b.x) / 2 + sc.margin.x, 0, (a.y + b.y) / 2 + sc.margin.y)
        // aux deux bouts de la voie, les essieux se rejoignent : on garde alors le sens de la voie
        const far = Math.hypot(a.x - b.x, a.y - b.y) > 0.05
        car.rotation.y = far ? -Math.atan2(a.y - b.y, a.x - b.x) : (-pointAt(tr.route, c).angle * Math.PI) / 180
      })
    }
    const remove = world.addView((_t, dt) => {
      r.check(onSize)
      placeTrain()
      const s = props.train?.s ?? -1
      const rolling = train.visible && s !== lastS && !still
      lastS = s
      // dans le repère du monde (avant la vue cavalière, que le monde applique lui-même à la fumée)
      cars[0]!.updateMatrix()
      steam.update(dt, chimney.copy(CHIMNEY).applyMatrix4(cars[0]!.matrix), rolling)
      r.draw(world.scene, top)
    })
    stop = () => {
      remove()
      unTrain()
      unSteam()
      steam.dispose()
      train.traverse((o) => {
        const m = o as InstanceType<typeof THREE.Mesh>
        if (!m.isMesh) return
        m.geometry.dispose()
        ;([] as { dispose(): void }[]).concat(m.material as never).forEach((x) => x.dispose())
      })
      r.dispose()
      releaseWorld(sc)
    }
    ready.value = true
    emit('ready')
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
