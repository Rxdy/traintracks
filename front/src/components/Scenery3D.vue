<script setup lang="ts">
import { reducedMotion } from '../settings'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { Scenery } from '../scenery'
import { pointAt, type Route } from '../trainRoute'
import { carLength, carOffsets } from '../trainStyle'
import { trainWagons } from '../myTrain'
import { PAL } from '../scenery'
import { animalScale, ANIMALS_3D } from '../scenery/animals3d'
import type { LandFrame } from '../scenery/motion'

// Décor 3D d'un niveau gagné : même place et même taille que le décor SVG (SceneryLayer), sous les rails de la grille.
// Vue du dessus calée sur les cases. Three.js n'est chargé qu'ici, à la première victoire (fichier à part).
// En cas d'échec (pas de WebGL, chargement raté), on prévient le parent, qui remet le décor classique.
// `train` : la voie suivie et la position de la locomotive (cases) ; le train roule DANS la scène 3D, les arbres devant la voie le cachent.
// `held` : décor PRÉPARÉ pendant le Plateau (la voie est connue d'avance, la solution est unique). Il est construit et dessiné une fois,
// caché : la construction des milliers d'objets, l'envoi des textures et la compilation des shaders (très lente sur iPhone) ne tombent
// plus au premier passage du train. Il attend en pause ; quand `held` repasse à faux (la victoire), il apparaît et s'anime.
const props = defineProps<{ scenery: Scenery; route: Route | null; train?: { route: Route; s: number } | null; life?: LandFrame | null; held?: boolean }>()
const emit = defineEmits<{ (e: 'fail'): void; (e: 'ready'): void; (e: 'warm'): void }>()

const box = computed(() => {
  const s = props.scenery
  const board = s.rows - s.margin.y - s.margin.b
  const u = 100 / (board + 1)
  return { width: `${s.cols * u}%`, height: `${s.frame.visibleRows * u}%`, left: `${(1 - s.margin.x) * u}%`, top: `${(1 - s.margin.y) * u}%` }
})

const canvas = ref<HTMLCanvasElement | null>(null)
const ready = ref(false)
let stop: (() => void) | null = null
let release: (() => void) | null = null
let gone = false
// après la mise à jour de la page (flush: 'post') : le canevas n'est plus masqué, il a sa vraie taille quand on la lui donne
// (avant, il la mesurait masqué, donc nulle, et gardait son image d'échauffement de 300×150 étirée : tout était flou)
watch(
  () => props.held,
  (h) => {
    if (!h) release?.()
  },
  { flush: 'post' },
)
onMounted(async () => {
  const sc = props.scenery
  try {
    const { acquireWorld, releaseWorld, makeRenderer, THREE } = await import('../scenery3d/world')
    if (gone || !canvas.value) return
    const world = await acquireWorld(sc, props.route)
    if (gone) return releaseWorld(sc)
    if (props.held) world.hold(true)
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
    const { makeAnimal } = await import('../scenery3d/animals')
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
    // les animaux (même simulation que le SVG de SceneryLife) : posés sur le sol de la scène, ils passent sous le train et derrière les arbres
    const critters = new THREE.Group()
    const unCritters = world.add(critters)
    const snow = !!PAL[sc.theme].snow
    const living = new Map<number, { a: NonNullable<ReturnType<typeof makeAnimal>>; born: number }>()
    const syncAnimals = () => {
      const now = performance.now()
      const live = new Set<number>()
      for (const s of props.life?.animals ?? []) {
        if (!ANIMALS_3D.has(s.kind)) continue
        live.add(s.id)
        let e = living.get(s.id)
        if (!e) {
          const a = makeAnimal(s.kind, snow, s.id)
          if (!a) continue
          critters.add(a.group)
          living.set(s.id, (e = { a, born: now }))
        }
        const k = animalScale(s.kind) * Math.min(1, (now - e.born) / 600) // il apparaît en grandissant
        e.a.group.scale.setScalar(Math.max(0.001, k))
        e.a.group.position.set(s.x, e.a.lift ?? 0, s.y)
        e.a.group.rotation.y = e.a.front ? -Math.PI / 2 : s.face > 0 ? 0 : Math.PI
        e.a.pose(s)
      }
      for (const [id, e] of living) if (!live.has(id)) (critters.remove(e.a.group), living.delete(id))
    }
    // la barrière du fond du passage à niveau : en 3D, pour que le train passe DEVANT elle (celle du devant reste dessinée en SVG, par-dessus)
    const road = sc.road
    const far = new THREE.Group()
    let setBarrier: (barrier: number, lights: boolean) => void = () => undefined
    if (road?.crossing) {
      const uc = (road.axis === 'v' ? road.crossing[0] : road.crossing[1]) + 0.5
      const m = road.line + 0.5
      const lx = -0.42, ly = uc - 0.3 // le pied, dans le repère de la route (comme le SVG de SceneryLife)
      far.position.set(road.axis === 'v' ? m + lx : ly, 0, road.axis === 'v' ? ly : m + lx)
      const flat = (w: number, h: number, d: number, color: string, x: number, y: number) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.6 }))
        mesh.position.set(x, y, 0)
        mesh.castShadow = true
        return mesh
      }
      const arm = new THREE.Group()
      arm.add(flat(0.62, 0.05, 0.05, '#ffffff', 0.29, 0.14))
      for (let k = 0; k < 3; k++) arm.add(flat(0.08, 0.052, 0.052, '#dc2626', 0.12 + k * 0.17, 0.14))
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.14, 12), new THREE.MeshStandardMaterial({ color: '#374151' }))
      post.position.y = 0.07
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), new THREE.MeshStandardMaterial({ color: '#7f1d1d', emissive: '#000000' }))
      lamp.position.set(road.axis === 'v' ? 0 : -0.1, 0.2, road.axis === 'v' ? -0.1 : 0)
      far.add(post, arm, lamp)
      setBarrier = (barrier, lights) => {
        const a = ((-85 + 85 * barrier) * Math.PI) / 180 // 0 : baissée en travers de la route, -85° : relevée
        // même sens que le SVG : le bras tourne dans le plan de la route
        const dX = road.axis === 'v' ? Math.cos(a) : Math.sin(a)
        const dZ = road.axis === 'v' ? Math.sin(a) : Math.cos(a)
        arm.rotation.y = -Math.atan2(dZ, dX)
        const mat = lamp.material as InstanceType<typeof THREE.MeshStandardMaterial>
        mat.color.set(lights ? '#ef4444' : '#7f1d1d')
        mat.emissive.set(lights ? '#ef4444' : '#000000')
      }
      setBarrier(props.life?.barrier ?? 0, props.life?.lights ?? false)
    }
    const unFar = world.add(far)
    // les voitures de la route (même simulation que le SVG de SceneryLife) : en 3D, le train passe devant celles qui attendent
    const roadCars = new THREE.Group()
    const unCars = world.add(roadCars)
    const carMats = new Map<string, InstanceType<typeof THREE.MeshStandardMaterial>>()
    const carMat = (color: string) => carMats.get(color) ?? carMats.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.55 })).get(color)!
    const carBoxes = new Map<string, InstanceType<typeof THREE.BoxGeometry>>()
    const box = (w: number, h: number, d: number) => {
      const key = `${w}:${h}:${d}`
      return carBoxes.get(key) ?? carBoxes.set(key, new THREE.BoxGeometry(w, h, d)).get(key)!
    }
    const part = (g: InstanceType<typeof THREE.Group>, w: number, h: number, d: number, color: string, x: number, y: number) => {
      const mesh = new THREE.Mesh(box(w, h, d), carMat(color))
      mesh.position.set(x, y, 0)
      mesh.castShadow = true
      g.add(mesh)
    }
    const shown = new Map<number, InstanceType<typeof THREE.Group>>()
    const syncCars = () => {
      if (!road) return
      const cars3 = props.life?.cars ?? []
      const m = road.line + 0.5
      const live = new Set<number>()
      for (const c of cars3) {
        live.add(c.id)
        let g = shown.get(c.id)
        if (!g) {
          g = new THREE.Group()
          if (c.kind === 1) {
            part(g, 0.3, 0.1, 0.2, '#e5e7eb', -0.09, 0.07) // la remorque
            part(g, 0.15, 0.08, 0.2, c.color, 0.145, 0.06) // la cabine
          } else {
            part(g, 0.32, 0.07, 0.18, c.color, 0, 0.055) // la caisse
            part(g, 0.09, 0.05, 0.14, '#bfe3fa', -0.02, 0.115) // l'habitacle
          }
          roadCars.add(g)
          shown.set(c.id, g)
        }
        g.position.set(road.axis === 'v' ? m + c.lane : c.u, 0, road.axis === 'v' ? c.u : m + c.lane)
        g.rotation.y = road.axis === 'v' ? (c.dir > 0 ? -Math.PI / 2 : Math.PI / 2) : c.dir > 0 ? 0 : Math.PI
      }
      for (const [id, g] of shown) if (!live.has(id)) (roadCars.remove(g), shown.delete(id))
    }
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
      setBarrier(props.life?.barrier ?? 0, props.life?.lights ?? false)
      syncCars()
      syncAnimals()
      placeTrain()
      const s = props.train?.s ?? -1
      const rolling = train.visible && s !== lastS && !still
      lastS = s
      // dans le repère du monde (avant la vue cavalière, que le monde applique lui-même à la fumée)
      cars[0]!.updateMatrix()
      steam.update(dt, chimney.copy(CHIMNEY).applyMatrix4(cars[0]!.matrix), rolling)
      r.draw(world.scene, top)
      if (!ready.value) {
        ready.value = true
        emit('ready')
      }
    })
    stop = () => {
      remove()
      unTrain()
      unFar()
      unCars()
      unCritters()
      carMats.forEach((x) => x.dispose())
      carBoxes.forEach((x) => x.dispose())
      far.traverse((o) => {
        const m = o as InstanceType<typeof THREE.Mesh>
        if (!m.isMesh) return
        m.geometry.dispose()
        ;(m.material as { dispose(): void }).dispose()
      })
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
    // `ready` (le décor apparaît en fondu, les rails des cases s'effacent) seulement après la PREMIÈRE image : la compilation
    // des shaders bloque le navigateur ~0,2 à 0,5 s, et elle ne doit pas tomber au milieu du fondu.
    ready.value = false
    release = () => {
      release = null
      r.fit(onSize) // préparé caché (taille nulle) : la vraie taille, avant la première image visible
      world.hold(false)
    }
    if (props.held) {
      // une image d'échauffement, cachée : shaders compilés et textures envoyées maintenant. Le train (d'habitude invisible ici), sa fumée,
      // une voiture et tous les animaux y sont : ils n'arrivent que pendant le Trajet et leurs matériaux ont des variantes que le décor n'a
      // pas (transparence, ombres) ; sinon leur compilation tombait au départ du train (une saccade de plus d'une seconde sur téléphone).
      const probe = new THREE.Group()
      part(probe, 0.1, 0.1, 0.1, '#ffffff', 0, 0)
      // tous les animaux possibles (feu de camp et poussière sont transparents : d'autres variantes de shaders), en rang au milieu
      ;[...ANIMALS_3D].forEach((kind, i) => {
        const critter = makeAnimal(kind, snow, i)
        if (!critter) return
        critter.group.position.set((i % 6) * 0.4 - 1, 0, Math.floor(i / 6) * 0.4 - 0.6)
        probe.add(critter.group)
      })
      // la fumée de la locomotive (transparente), qui n'apparaît qu'au départ du train : ses bouffées visibles le temps de l'image
      const puffs: InstanceType<typeof THREE.Mesh>[] = []
      steam.group.traverse((o) => {
        const m = o as InstanceType<typeof THREE.Mesh>
        if (m.isMesh && !m.visible) (puffs.push(m), (m.visible = true), m.position.set(sc.cols / 2, 0.4, sc.rows / 2))
      })
      // caché, le canevas n'a pas de taille : on cadre la caméra sur le décor (mêmes proportions), sinon presque tout serait hors champ
      // et resterait à compiler ; témoins et train au milieu, dans le champ de la caméra comme dans celui de l'ombre
      onSize(sc.cols, sc.frame.visibleRows)
      probe.position.set(sc.cols / 2, 0, sc.rows / 2)
      train.position.set(sc.cols / 2, 0, sc.rows / 2)
      const unProbe = world.add(probe)
      train.visible = true
      r.draw(world.scene, top)
      train.visible = false
      train.position.set(0, 0, 0)
      for (const m of puffs) m.visible = false
      unProbe()
      emit('warm')
    } else release()
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
  <canvas ref="canvas" class="scenery3d" :class="{ ready, held }" :style="box" data-test="scenery-3d" aria-hidden="true" />
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
/* préparé pendant le Plateau : ne prend aucune place (il déborderait de la grille, qui n'a pas encore rétréci) */
.scenery3d.held {
  display: none;
}
</style>
