<script setup lang="ts">
import { onMounted } from 'vue'
import { loadTrain, myTrain } from '../myTrain'
import WagonThumb from './WagonThumb.vue'

// Page Compte : un aperçu du train qui roule, et l'accès à la page Mon train (collection, 3 trains, machine).
const emit = defineEmits<{ (e: 'open'): void }>()
onMounted(() => void loadTrain())
</script>

<template>
  <section class="card train-card" data-test="train-card">
    <h2>Mon train</h2>
    <div class="row" aria-hidden="true">
      <span class="car"><WagonThumb id="loco" /></span>
      <span v-for="(id, k) in myTrain.train" :key="k" class="car"><WagonThumb :id="id" /></span>
    </div>
    <button type="button" class="btn btn--small" data-test="open-train" @click="emit('open')">Personnaliser mon train</button>
  </section>
</template>

<style scoped>
.train-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}
.train-card h2 {
  margin: 0;
}
.row {
  display: flex;
  align-items: flex-end;
  gap: 0.15rem;
  max-width: 100%;
  overflow: hidden;
}
.car {
  flex: none;
  width: 3.2rem;
}
</style>
