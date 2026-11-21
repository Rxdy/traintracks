<script setup lang="ts">
import { computed, inject, onMounted, onUnmounted, ref } from 'vue'
import { MAX_PER_WAGON, TRAIN_SLOTS, WAGON_DEFS } from '../../../shared/wagons.js'
import { freeCount, loadTrain, myTrain, selectPreset, setTrain } from '../myTrain'
import { styleOf, wagonLabel } from '../trainStyle'
import CoinIcon from '../components/CoinIcon.vue'
import WagonThumb from '../components/WagonThumb.vue'

// « Mon train », sur toute la page : 3 trains enregistrés (celui « en route » roule dans le Trajet), le train choisi en grand,
// la collection dessous, la machine à côté.
// Glisser-déposer : un wagon de la collection vers une place du train ; un wagon du train vers une autre place ;
// un wagon du train vers la collection pour le ranger. Au toucher : un wagon du train puis une autre place les échange,
// un wagon de la collection va au bout du train.
const openMachine = inject<() => void>('openMachine', () => undefined)

const editing = ref(myTrain.value.active) // le train affiché (pas forcément celui qui roule)
const cars = computed(() => myTrain.value.presets[editing.value] ?? [])
const slots = computed(() => Array.from({ length: TRAIN_SLOTS }, (_, k) => cars.value[k] ?? null))
const total = computed(() => Object.values(myTrain.value.owned).reduce((a, b) => a + b, 0))
const picked = ref<number | null>(null)
const msg = ref('')

onMounted(async () => {
  await loadTrain()
  editing.value = myTrain.value.active
})

async function save(next: string[]): Promise<void> {
  msg.value = ''
  if (!(await setTrain(next, editing.value))) msg.value = 'Le train n\'a pas pu être rangé. Réessaie.'
}
function chooseTab(k: number): void {
  editing.value = k
  picked.value = null
  msg.value = ''
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
    <!-- les 3 trains enregistrés -->
    <div class="tabs" role="tablist" aria-label="Mes trains">
      <button
        v-for="k in [0, 1, 2]"
        :key="k"
        type="button"
        role="tab"
        class="tab"
        :class="{ on: editing === k }"
        :aria-selected="editing === k"
        :data-test="'preset-' + k"
        @click="chooseTab(k)"
      >
        Train {{ k + 1 }}
        <span v-if="myTrain.active === k" class="road" data-test="preset-active">en route</span>
      </button>
      <button v-if="editing !== myTrain.active" type="button" class="btn btn--small roll" data-test="preset-roll" @click="rollThis">Faire rouler ce train</button>
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
      <template v-else>Glisse un wagon de ta collection sur une place, ou un wagon du train vers une autre place. Glisse-le vers la collection (ou ✕) pour le ranger.</template>
      <b>{{ cars.length }}/{{ TRAIN_SLOTS }}</b>
    </p>
    <p v-if="msg" class="err" data-test="train-msg">{{ msg }}</p>

    <div class="below">
      <!-- la collection : on y dépose un wagon du train pour le ranger -->
      <div class="collection card" :class="{ over: drag?.over === 'collection' }" data-drop="collection">
        <h2>Ma collection <span>· {{ total }} wagons, jusqu'à {{ MAX_PER_WAGON }} de chaque</span></h2>
        <div class="grid">
          <button
            v-for="w in WAGON_DEFS"
            :key="w.id"
            type="button"
            class="item"
            :class="{ off: !myTrain.owned[w.id], ghosted: dragId === w.id && drag?.src.kind === 'coll', spent: !!myTrain.owned[w.id] && freeCount(w.id, cars) <= 0 }"
            :disabled="!myTrain.owned[w.id]"
            :data-test="'coll-' + w.id"
            :aria-label="myTrain.owned[w.id] ? w.name + ', ' + myTrain.owned[w.id] + ' sur ' + MAX_PER_WAGON : 'À découvrir'"
            @pointerdown="myTrain.owned[w.id] && down($event, { kind: 'coll', id: w.id })"
            @click="click(() => tapCollection(w.id))()"
          >
            <span class="count" data-test="coll-count">{{ myTrain.owned[w.id] ?? 0 }}/{{ MAX_PER_WAGON }}</span>
            <WagonThumb :id="w.id" />
            <span class="name">{{ myTrain.owned[w.id] ? w.name : 'À découvrir' }}</span>
          </button>
        </div>
      </div>

      <!-- la machine -->
      <div class="machine-card">
        <strong>WAGON SURPRISE</strong>
        <span>Un wagon au hasard, on gagne à chaque fois.</span>
        <span class="left" data-test="train-left">Encore {{ myTrain.left }} wagons à gagner</span>
        <button type="button" class="btn btn--small pull" data-test="open-machine" @click="openMachine()">Tirer · {{ myTrain.price }} <CoinIcon /></button>
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
.tabs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}
.tab {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.45rem 1rem;
  border-radius: 999px;
  border: 2px solid #fff;
  background: rgba(255, 255, 255, 0.85);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
.tab.on {
  background: #f59e0b;
  color: #3b2400;
  border-color: #fde68a;
}
.road {
  padding: 0.05rem 0.5rem;
  border-radius: 999px;
  background: #16a34a;
  color: #fff;
  font-size: 0.75rem;
}
.roll {
  margin-left: auto;
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
  display: grid;
  grid-template-columns: minmax(0, 1fr) 15rem;
  gap: 0.75rem;
  align-items: start;
}
@media (max-width: 48rem) {
  .below {
    grid-template-columns: minmax(0, 1fr);
  }
  .machine-card {
    order: -1;
  }
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
.machine-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.45rem;
  padding: 1rem;
  border-radius: 1.2rem;
  border: 3px solid #fde68a;
  background: linear-gradient(#b91c1c, #7f1d1d);
  color: #fff;
  text-align: center;
  font-size: 0.9rem;
}
.machine-card strong {
  color: #fde68a;
  letter-spacing: 0.06em;
  font-size: 1.05rem;
}
.machine-card .left {
  color: #fde68a;
  font-weight: 800;
}
.pull {
  background: #fbbf24;
  color: #3b2400;
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
