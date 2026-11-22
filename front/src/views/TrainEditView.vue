<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { TRAIN_SLOTS, WAGON_DEFS } from '../../../shared/wagons.js'
import { freeCount, loadTrain, myTrain, selectPreset, setTrain } from '../myTrain'
import { styleOf, wagonLabel } from '../trainStyle'
import WagonThumb from '../components/WagonThumb.vue'

// Personnaliser un train (un des 3 du dépôt, ouvert en touchant son garage) : le train en grand sur sa voie, tes wagons dessous.
// Glisser-déposer : un wagon de la collection vers une place du train ; un wagon du train vers une autre place ;
// un wagon du train vers la collection pour le ranger. Au toucher : un wagon du train puis une autre place les échange,
// un wagon de la collection va au bout du train.
const props = defineProps<{ slot: number }>()
const editing = computed(() => props.slot) // le train personnalisé (pas forcément celui qui roule)
const cars = computed(() => myTrain.value.presets[editing.value] ?? [])
const slots = computed(() => Array.from({ length: TRAIN_SLOTS }, (_, k) => cars.value[k] ?? null))
// seulement les wagons qu'on a : la collection entière a sa page (l'entrepôt du dépôt)
const mine = computed(() => WAGON_DEFS.filter((w) => (myTrain.value.owned[w.id] ?? 0) > 0))
const picked = ref<number | null>(null)
const msg = ref('')

onMounted(() => void loadTrain())

async function save(next: string[]): Promise<void> {
  msg.value = ''
  if (!(await setTrain(next, editing.value))) msg.value = 'Le train n\'a pas pu être rangé. Réessaie.'
}
async function rollThis(): Promise<void> {
  if (!(await selectPreset(editing.value))) msg.value = 'Ce train n\'a pas pu partir. Réessaie.'
}

// --- les gestes -------------------------------------------------------------------------------------------
function moveCar(from: number, to: number): void {
  const next = [...cars.value]
  const [w] = next.splice(from, 1)
  next.splice(Math.min(to, next.length), 0, w!)
  void save(next)
}
function insertWagon(id: string, at: number): void {
  if (freeCount(id, cars.value) <= 0) {
    msg.value = 'Tous tes wagons de ce type sont déjà dans ce train.'
    return
  }
  const next = [...cars.value]
  if (next.length >= TRAIN_SLOTS) {
    if (at >= next.length) {
      msg.value = 'Ce train est plein : dépose le wagon sur une place pour l\'échanger.'
      return
    }
    next.splice(at, 1, id) // train plein : le wagon remplace celui de cette place, qui retourne dans la collection
  } else next.splice(Math.min(at, next.length), 0, id)
  void save(next)
}
function removeCar(k: number): void {
  picked.value = null
  void save(cars.value.filter((_, j) => j !== k))
}
function tapSlot(k: number): void {
  if (picked.value === null) {
    if (cars.value[k]) picked.value = k
    return
  }
  const from = picked.value
  picked.value = null
  if (from !== k) moveCar(from, k)
}
function tapCollection(id: string): void {
  picked.value = null
  insertWagon(id, cars.value.length)
}

// --- glisser-déposer (souris et doigt) ---------------------------------------------------------------------
type Source = { kind: 'car'; index: number; id: string } | { kind: 'coll'; id: string }
const drag = ref<{ src: Source; x: number; y: number; over: string | null } | null>(null)
let start: { src: Source; x: number; y: number; pointer: number } | null = null
let swallowClick = false

function down(e: PointerEvent, src: Source): void {
  if (e.button !== 0) return
  start = { src, x: e.clientX, y: e.clientY, pointer: e.pointerId }
}
function targetAt(x: number, y: number): string | null {
  const el = document.elementFromPoint(x, y)?.closest('[data-drop]') as HTMLElement | null
  return el?.dataset.drop ?? null
}
function move(e: PointerEvent): void {
  if (!start || e.pointerId !== start.pointer) return
  if (!drag.value) {
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < 8) return
    drag.value = { src: start.src, x: e.clientX, y: e.clientY, over: null }
    picked.value = null
  }
  e.preventDefault()
  drag.value = { ...drag.value, x: e.clientX, y: e.clientY, over: targetAt(e.clientX, e.clientY) }
}
function up(e: PointerEvent): void {
  if (!start || e.pointerId !== start.pointer) return
  const d = drag.value
  start = null
  drag.value = null
  if (!d) return
  swallowClick = true // le relâcher d'un glisser n'est pas un toucher
  window.setTimeout(() => (swallowClick = false), 0)
  const over = targetAt(e.clientX, e.clientY)
  if (!over) return
  if (over === 'collection') {
    if (d.src.kind === 'car') removeCar(d.src.index)
    return
  }
  const at = Number(over.slice(5)) // « slot-3 »
  if (d.src.kind === 'car') {
    if (d.src.index !== at) moveCar(d.src.index, at)
  } else insertWagon(d.src.id, at)
}
const click = (f: () => void) => () => {
  if (!swallowClick) f()
}
onMounted(() => {
  window.addEventListener('pointermove', move, { passive: false })
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', up)
})
onUnmounted(() => {
  window.removeEventListener('pointermove', move)
  window.removeEventListener('pointerup', up)
  window.removeEventListener('pointercancel', up)
})
const dragId = computed(() => drag.value?.src.id ?? null)
</script>

<template>
  <section class="train-page" data-test="train-page" :class="{ dragging: !!drag }">
    <div class="head">
      <span v-if="myTrain.active === slot" class="road" data-test="preset-active">en route</span>
      <button v-else type="button" class="btn btn--small" data-test="preset-roll" @click="rollThis">Faire rouler ce train</button>
    </div>

    <!-- le train, en grand, sur sa voie -->
    <div class="track card" data-test="train-row">
      <span class="car loco"><WagonThumb id="loco" /></span>
      <template v-for="(id, k) in slots" :key="k">
        <span
          v-if="id"
          class="car"
          :class="{ picked: picked === k, ghosted: drag?.src.kind === 'car' && drag.src.index === k, over: drag?.over === 'slot-' + k }"
          :style="{ '--len': styleOf(id).length }"
          :data-drop="'slot-' + k"
        >
          <button
            type="button"
            class="pick"
            :data-test="'train-car-' + k"
            :aria-label="wagonLabel(id) + (picked === k ? ', choisi' : '')"
            :aria-pressed="picked === k"
            @pointerdown="down($event, { kind: 'car', index: k, id })"
            @click="click(() => tapSlot(k))()"
          >
            <WagonThumb :id="id" />
          </button>
          <span class="nm">{{ wagonLabel(id) }}</span>
          <button type="button" class="x" :data-test="'train-remove-' + k" :aria-label="'Ranger ' + wagonLabel(id)" @click="removeCar(k)">✕</button>
        </span>
        <button v-else type="button" class="car empty" :class="{ over: drag?.over === 'slot-' + k }" :data-drop="'slot-' + k" :data-test="'train-slot-' + k" aria-label="Place libre" @click="click(() => tapSlot(k))()">+</button>
      </template>
    </div>
    <p class="hint">
      <template v-if="picked !== null">Touche une autre place pour l'y mettre.</template>
      <template v-else>Glisse un de tes wagons sur une place, ou un wagon du train vers une autre place. Glisse-le vers tes wagons pour le ranger.</template>
      <b>{{ cars.length }}/{{ TRAIN_SLOTS }}</b>
    </p>
    <p v-if="msg" class="err" data-test="train-msg">{{ msg }}</p>

    <div class="below">
      <!-- tes wagons : on y dépose un wagon du train pour le ranger -->
      <div class="collection card" :class="{ over: drag?.over === 'collection' }" data-drop="collection">
        <h2>Tes wagons</h2>
        <div class="grid">
          <button
            v-for="w in mine"
            :key="w.id"
            type="button"
            class="item"
            :class="{ off: !myTrain.owned[w.id], ghosted: dragId === w.id && drag?.src.kind === 'coll', spent: !!myTrain.owned[w.id] && freeCount(w.id, cars) <= 0 }"
            :disabled="!myTrain.owned[w.id]"
            :data-test="'coll-' + w.id"
            :aria-label="w.name + ', ' + freeCount(w.id, cars) + ' libre' + (freeCount(w.id, cars) > 1 ? 's' : '')"
            @pointerdown="myTrain.owned[w.id] && down($event, { kind: 'coll', id: w.id })"
            @click="click(() => tapCollection(w.id))()"
          >
            <span class="count" data-test="coll-count" title="libres pour ce train">{{ Math.max(0, freeCount(w.id, cars)) }}</span>
            <WagonThumb :id="w.id" />
            <span class="name">{{ w.name }}</span>
          </button>
        </div>
      </div>

    </div>

    <!-- le wagon qui suit le doigt pendant un glisser -->
    <div v-if="drag" class="ghost" :style="{ left: drag.x + 'px', top: drag.y + 'px', '--len': styleOf(drag.src.id).length }" aria-hidden="true">
      <WagonThumb :id="drag.src.id" />
    </div>
  </section>
</template>

<style scoped>
.train-page {
  --car: clamp(4.6rem, 10vw, 8.5rem);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
  touch-action: pan-y;
}
.train-page.dragging {
  touch-action: none;
  user-select: none;
}
.card {
  border-radius: 1.2rem;
  border: 3px solid #fff;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 3px 10px rgba(30, 64, 175, 0.15);
}
.road {
  padding: 0.05rem 0.5rem;
  border-radius: 999px;
  background: #16a34a;
  color: #fff;
  font-size: 0.75rem;
}
.track {
  display: flex;
  align-items: flex-end;
  gap: 0.4rem;
  padding: 0.9rem 1rem 1.3rem;
  background: linear-gradient(transparent 76%, #6b7280 76% 79%, #8a5a2b 79% 84%, transparent 84%), linear-gradient(#e8f5e1, #cfe9bf);
  overflow-x: auto;
  min-height: calc(var(--car) * 0.85);
}
.car {
  position: relative;
  flex: none;
  width: calc(var(--car) * var(--len, 1));
  display: flex;
  flex-direction: column;
  align-items: center;
}
.car.loco {
  width: var(--car);
}
.pick {
  display: block;
  width: 100%;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 0.8rem;
  background: none;
  cursor: grab;
  touch-action: none;
}
.car.picked .pick {
  border-color: #f59e0b;
  background: rgba(253, 230, 138, 0.5);
  transform: translateY(-0.35rem);
}
.car.ghosted {
  opacity: 0.35;
}
.car.over .pick,
.car.empty.over {
  border-color: #2563eb;
  background: rgba(191, 219, 254, 0.6);
}
.nm {
  margin-top: 0.1rem;
  font-size: 0.78rem;
  font-weight: 700;
  white-space: nowrap;
}
.x {
  position: absolute;
  right: 0;
  top: -0.35rem;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  border: 0;
  background: #fff;
  color: #b91c1c;
  font-weight: 800;
  font-size: 0.8rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  cursor: pointer;
}
.car.empty {
  width: calc(var(--car) * 0.8);
  height: calc(var(--car) * 0.55);
  align-self: center;
  justify-content: center;
  border: 2px dashed #64748b;
  border-radius: 0.8rem;
  background: rgba(255, 255, 255, 0.5);
  color: #475569;
  font-weight: 800;
  font-size: 1.4rem;
  cursor: pointer;
}
.hint {
  margin: 0;
  padding: 0.4rem 0.8rem;
  border-radius: 0.8rem;
  background: rgba(255, 255, 255, 0.85);
  font-size: 0.9rem;
}
.hint b {
  margin-left: 0.4rem;
}
.err {
  margin: 0;
  align-self: flex-start;
  padding: 0.35rem 0.8rem;
  border-radius: 0.8rem;
  background: #fef2f2;
  border: 2px solid #fca5a5;
  color: #b91c1c;
  font-weight: 700;
}
.below {
  display: block;
}
.head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: 2rem;
}
.head .road {
  padding: 0.25rem 0.8rem;
  font-size: 0.9rem;
}
.head h2 {
  margin: 0;
  padding: 0.25rem 0.9rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  font-size: 1.2rem;
}
.collection {
  padding: 0.8rem 1rem 1rem;
}
.collection.over {
  border-color: #2563eb;
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.25);
}
.collection h2 {
  margin: 0 0 0.6rem;
  font-size: 1.1rem;
}
.collection h2 span {
  font-weight: 500;
  font-size: 0.9rem;
  color: #4b5563;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(7.5rem, 1fr));
  gap: 0.55rem;
}
.item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  padding: 0.45rem 0.35rem 0.4rem;
  border-radius: 0.9rem;
  border: 2px solid #e2e8f0;
  background: #f8fafc;
  cursor: grab;
  font: inherit;
  touch-action: none;
}
.item.spent {
  opacity: 0.55;
}
.item.ghosted {
  opacity: 0.35;
}
.item.off {
  border-style: dashed;
  background: #f1f5f9;
  color: #64748b;
  cursor: default;
  touch-action: auto;
}
.item.off :deep(.thumb) {
  filter: grayscale(1) brightness(1.35) opacity(0.45);
}
.count {
  position: absolute;
  right: 0.3rem;
  top: 0.25rem;
  padding: 0 0.4rem;
  border-radius: 0.6rem;
  background: #1f2937;
  color: #fff;
  font-size: 0.75rem;
  font-weight: 700;
}
.item.off .count {
  background: #94a3b8;
}
.name {
  font-size: 0.85rem;
  font-weight: 700;
}
.ghost {
  position: fixed;
  z-index: 90;
  width: calc(var(--car) * var(--len, 1));
  transform: translate(-50%, -60%) rotate(-4deg);
  pointer-events: none;
  filter: drop-shadow(0 10px 8px rgba(0, 0, 0, 0.35));
}
</style>
