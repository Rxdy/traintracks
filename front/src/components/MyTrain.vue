<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { MAX_PER_WAGON, TRAIN_SLOTS, WAGON_DEFS } from '../../../shared/wagons.js'
import { freeCount, loadTrain, myTrain, setTrain } from '../myTrain'
import { styleOf, wagonLabel } from '../trainStyle'
import CoinIcon from './CoinIcon.vue'
import WagonThumb from './WagonThumb.vue'

// « Mon train » (page Compte) : le train en haut (la locomotive et 6 places), la collection dessous, et la machine.
// Toucher un wagon du train le choisit ; toucher ensuite une autre place les échange ; ✕ le range dans la collection.
// Toucher un wagon de la collection l'ajoute au bout du train. Ce train roule dans le Trajet, sur l'accueil et au chargement.
const emit = defineEmits<{ (e: 'machine'): void }>()

const picked = ref<number | null>(null) // place choisie dans le train, en attente d'un échange
const msg = ref('')
const train = computed(() => myTrain.value.train)
const slots = computed(() => Array.from({ length: TRAIN_SLOTS }, (_, k) => train.value[k] ?? null))
const total = computed(() => Object.values(myTrain.value.owned).reduce((a, b) => a + b, 0))
const nameOf = styleOf
const label = wagonLabel

onMounted(() => void loadTrain())

async function save(cars: string[]): Promise<void> {
  msg.value = ''
  if (!(await setTrain(cars))) msg.value = 'Le train n\'a pas pu être rangé. Réessaie.'
}

function tapSlot(k: number): void {
  if (picked.value === null) {
    if (train.value[k]) picked.value = k
    return
  }
  const from = picked.value
  picked.value = null
  if (from === k) return
  const cars = [...train.value]
  const to = Math.min(k, cars.length - 1) // une place vide après le train : le wagon va au bout
  const [w] = cars.splice(from, 1)
  cars.splice(to, 0, w!)
  void save(cars)
}

function remove(k: number): void {
  picked.value = null
  void save(train.value.filter((_, j) => j !== k))
}

function add(id: string): void {
  if (train.value.length >= TRAIN_SLOTS) {
    msg.value = 'Ton train est plein : range un wagon (✕) pour faire de la place.'
    return
  }
  if (freeCount(id) <= 0) {
    msg.value = 'Tous tes wagons de ce type sont déjà dans le train.'
    return
  }
  void save([...train.value, id])
}
</script>

<template>
  <section class="card my-train" data-test="my-train">
    <h2>Mon train</h2>
    <!-- le train, sur sa voie -->
    <div class="track" data-test="train-row">
      <span class="car loco"><WagonThumb id="loco" /></span>
      <template v-for="(id, k) in slots" :key="k">
        <span v-if="id" class="car" :class="{ picked: picked === k, long: nameOf(id).length > 1 }" :style="{ '--len': nameOf(id).length }">
          <button type="button" class="pick" :data-test="'train-car-' + k" :aria-label="label(id) + (picked === k ? ', choisi' : '')" :aria-pressed="picked === k" @click="tapSlot(k)"><WagonThumb :id="id" /></button>
          <button type="button" class="x" :data-test="'train-remove-' + k" :aria-label="'Ranger ' + label(id)" @click="remove(k)">✕</button>
        </span>
        <button v-else type="button" class="car empty" :data-test="'train-slot-' + k" :aria-label="picked !== null ? 'Mettre ici' : 'Place libre'" @click="tapSlot(k)">+</button>
      </template>
    </div>
    <p class="hint">{{ picked !== null ? 'Touche une autre place pour l\'y mettre.' : 'Touche un wagon puis une autre place pour changer l\'ordre. ✕ le range.' }} {{ train.length }}/{{ TRAIN_SLOTS }}</p>
    <p v-if="msg" class="err" data-test="train-msg">{{ msg }}</p>

    <div class="below">
      <!-- la collection -->
      <div class="collection">
        <h3>Ma collection <span>· {{ total }} wagons, jusqu'à {{ MAX_PER_WAGON }} de chaque</span></h3>
        <div class="grid">
          <button
            v-for="w in WAGON_DEFS"
            :key="w.id"
            type="button"
            class="item"
            :class="{ off: !myTrain.owned[w.id] }"
            :disabled="!myTrain.owned[w.id]"
            :data-test="'coll-' + w.id"
            :aria-label="myTrain.owned[w.id] ? label(w.id) + ', ' + myTrain.owned[w.id] + ' sur ' + MAX_PER_WAGON + ' : ajouter au train' : 'À découvrir'"
            @click="add(w.id)"
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
        <button type="button" class="btn btn--small pull" data-test="open-machine" @click="emit('machine')">Tirer · {{ myTrain.price }} <CoinIcon /></button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.my-train h2 {
  margin: 0 0 0.5rem;
}
.track {
  max-width: 100%;
  box-sizing: border-box;
  display: flex;
  align-items: flex-end;
  gap: 0.3rem;
  padding: 0.6rem 0.6rem 0.9rem;
  border-radius: 1rem;
  background: linear-gradient(transparent 70%, #6b7280 70% 74%, transparent 74%), linear-gradient(#e8f5e1, #cfe9bf);
  overflow-x: auto;
}
.car {
  position: relative;
  flex: none;
  width: calc(3.5rem * var(--len, 1));
}
.car.loco {
  width: 3.5rem;
}
.pick {
  display: block;
  width: 100%;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 0.6rem;
  background: none;
  cursor: pointer;
}
.car.picked .pick {
  border-color: #f59e0b;
  background: rgba(253, 230, 138, 0.5);
  transform: translateY(-0.3rem);
}
.x {
  position: absolute;
  right: -0.2rem;
  top: -0.3rem;
  width: 1.3rem;
  height: 1.3rem;
  border-radius: 50%;
  border: 0;
  background: #fff;
  color: #b91c1c;
  font-weight: 800;
  font-size: 0.75rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  cursor: pointer;
}
.car.empty {
  width: 3rem;
  height: 2.2rem;
  border: 2px dashed #64748b;
  border-radius: 0.6rem;
  background: rgba(255, 255, 255, 0.45);
  color: #475569;
  font-weight: 800;
  font-size: 1.2rem;
  cursor: pointer;
}
.hint {
  margin: 0.35rem 0 0;
  font-size: 0.85rem;
  color: #374151;
}
.err {
  color: #b91c1c;
  margin: 0.3rem 0 0;
}
.my-train {
  min-width: 0;
  max-width: 100%;
}
/* la machine d'abord (une bande), la collection dessous : la carte Compte est étroite */
.below {
  display: flex;
  flex-direction: column-reverse;
  gap: 0.75rem;
  margin-top: 0.75rem;
}
.collection h3 {
  margin: 0 0 0.4rem;
  font-size: 1rem;
}
.collection h3 span {
  font-weight: 500;
  font-size: 0.85rem;
  color: #4b5563;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(4.6rem, 1fr));
  gap: 0.4rem;
}
.item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
  padding: 0.35rem 0.25rem 0.3rem;
  border-radius: 0.8rem;
  border: 2px solid #e2e8f0;
  background: #f8fafc;
  cursor: pointer;
  font: inherit;
}
.item.off {
  border-style: dashed;
  background: #f1f5f9;
  color: #64748b;
  cursor: default;
}
.item.off :deep(.thumb) {
  filter: grayscale(1) brightness(1.35) opacity(0.45);
}
.count {
  position: absolute;
  right: 0.25rem;
  top: 0.2rem;
  padding: 0 0.35rem;
  border-radius: 0.6rem;
  background: #1f2937;
  color: #fff;
  font-size: 0.7rem;
  font-weight: 700;
}
.item.off .count {
  background: #94a3b8;
}
.name {
  font-size: 0.75rem;
  font-weight: 700;
  text-align: center;
  line-height: 1.15;
}
.machine-card {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 0.4rem;
  padding: 0.8rem;
  border-radius: 1rem;
  border: 3px solid #fde68a;
  background: linear-gradient(#b91c1c, #7f1d1d);
  color: #fff;
  text-align: center;
  font-size: 0.85rem;
}
.machine-card strong {
  color: #fde68a;
  letter-spacing: 0.06em;
}
.machine-card .left {
  color: #fde68a;
  font-weight: 800;
}
.pull {
  background: #fbbf24;
  color: #3b2400;
}
</style>
