<script setup lang="ts">
import { computed, inject, onMounted, ref } from 'vue'
import { MAX_PER_WAGON, WAGON_DEFS } from '../../../shared/wagons.js'
import { loadTrain, myTrain } from '../myTrain'
import CoinIcon from '../components/CoinIcon.vue'
import WagonThumb from '../components/WagonThumb.vue'

// La collection (l'entrepôt du dépôt) : tous les wagons, ceux qu'on a (n/6) et ceux à découvrir, et la machine.
// Toucher un wagon qu'on a le montre en grand.
const openMachine = inject<() => void>('openMachine', () => undefined)
onMounted(() => void loadTrain())

const total = computed(() => Object.values(myTrain.value.owned).reduce((a, b) => a + b, 0))
const families = [
  { id: 'base', title: 'Wagons' },
  { id: 'fret', title: 'Fret' },
] as const
const shown = ref<string | null>(null)
const big = computed(() => (shown.value ? WAGON_DEFS.find((w) => w.id === shown.value) ?? null : null))
</script>

<template>
  <section class="coll-page" data-test="collection-page">
    <div class="top">
      <div class="machine-card">
        <strong>WAGON SURPRISE</strong>
        <span class="left" data-test="train-left">Encore {{ myTrain.left }} wagons à gagner</span>
        <button type="button" class="btn btn--small pull" data-test="open-machine" @click="openMachine()">Tirer · {{ myTrain.price }} <CoinIcon /></button>
      </div>
      <p class="sum" data-test="collection-total">{{ total }} wagons · jusqu'à {{ MAX_PER_WAGON }} de chaque</p>
    </div>

    <div v-for="f in families" :key="f.id" class="family card">
      <h2>{{ f.title }}</h2>
      <div class="grid">
        <button
          v-for="w in WAGON_DEFS.filter((x) => x.family === f.id)"
          :key="w.id"
          type="button"
          class="item"
          :class="{ off: !myTrain.owned[w.id] }"
          :disabled="!myTrain.owned[w.id]"
          :data-test="'coll-' + w.id"
          :aria-label="myTrain.owned[w.id] ? w.name + ', ' + myTrain.owned[w.id] + ' sur ' + MAX_PER_WAGON : 'À découvrir'"
          @click="shown = w.id"
        >
          <span class="count" data-test="coll-count">{{ myTrain.owned[w.id] ?? 0 }}/{{ MAX_PER_WAGON }}</span>
          <WagonThumb :id="w.id" />
          <span class="name">{{ myTrain.owned[w.id] ? w.name : 'À découvrir' }}</span>
        </button>
      </div>
    </div>

    <!-- un wagon en grand -->
    <div v-if="big" class="back" data-test="wagon-big" @click="shown = null">
      <figure class="big card" @click.stop>
        <WagonThumb :id="big.id" />
        <figcaption><strong>{{ big.name }}</strong> · {{ myTrain.owned[big.id] ?? 0 }}/{{ MAX_PER_WAGON }}</figcaption>
        <button type="button" class="btn btn--ghost btn--small" data-test="wagon-big-close" @click="shown = null">Fermer</button>
      </figure>
    </div>
  </section>
</template>

<style scoped>
.coll-page {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
}
.card {
  border-radius: 1.2rem;
  border: 3px solid #fff;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 3px 10px rgba(30, 64, 175, 0.15);
}
.top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}
.sum {
  margin: 0;
  padding: 0.35rem 0.9rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.9);
  font-weight: 700;
}
.family {
  padding: 0.8rem 1rem 1rem;
}
.family h2 {
  margin: 0 0 0.6rem;
  font-size: 1.1rem;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
  gap: 0.6rem;
}
.item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  padding: 0.5rem 0.4rem 0.45rem;
  border-radius: 0.9rem;
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
  right: 0.35rem;
  top: 0.3rem;
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
  font-size: 0.9rem;
  font-weight: 700;
}
.machine-card {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 1rem;
  border-radius: 1.2rem;
  border: 3px solid #fde68a;
  background: linear-gradient(#b91c1c, #7f1d1d);
  color: #fff;
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
.back {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(15, 23, 42, 0.55);
}
.big {
  margin: 0;
  width: min(36rem, 90vw);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}
</style>
