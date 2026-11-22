<script setup lang="ts">
import { inject, onMounted, ref } from 'vue'
import { loadTrain, myTrain, selectPreset } from '../myTrain'
import DepotView from '../components/DepotView.vue'
import type { DepotPick } from '../scenery3d/depot'

// Mon train : le dépôt, rien d'autre. Toucher un train le fait rouler (il s'avance au quai, l'ancien recule),
// un garage ouvre la personnalisation de son train, l'entrepôt ouvre la collection.
const go = inject<(view: string, slot?: number) => void>('go', () => undefined)
const flat = ref(false) // pas de 3D : des boutons à la place
const msg = ref('')
onMounted(() => void loadTrain())

async function pick(p: DepotPick): Promise<void> {
  msg.value = ''
  if (p.kind === 'collection') return go('collection')
  if (p.kind === 'garage') return go('trainEdit', p.slot)
  if (p.slot !== myTrain.value.active && !(await selectPreset(p.slot))) msg.value = 'Ce train n\'a pas pu partir. Réessaie.'
}
</script>

<template>
  <section class="depot-page" data-test="depot-page">
    <DepotView :presets="myTrain.presets" :active="myTrain.active" full @pick="pick" @fallback="flat = true" />
    <p class="hint" data-test="depot-hint">Touche un train pour le faire rouler · un garage pour le personnaliser · l'entrepôt pour voir ta collection</p>
    <p v-if="msg" class="err" data-test="depot-msg">{{ msg }}</p>
    <!-- sans 3D : les mêmes choix, en boutons -->
    <div v-if="flat" class="flat">
      <div v-for="k in [0, 1, 2]" :key="k" class="slot">
        <strong>Train {{ k + 1 }}</strong>
        <span v-if="myTrain.active === k" class="road">en route</span>
        <button v-else type="button" class="btn btn--small" :data-test="'depot-roll-' + k" @click="pick({ kind: 'train', slot: k })">Faire rouler</button>
        <button type="button" class="btn btn--ghost btn--small" :data-test="'depot-garage-' + k" @click="pick({ kind: 'garage', slot: k })">Personnaliser</button>
      </div>
      <button type="button" class="btn btn--small" data-test="depot-collection" @click="pick({ kind: 'collection' })">Ma collection</button>
    </div>
  </section>
</template>

<style scoped>
.depot-page {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  width: 100%;
}
.hint {
  position: fixed;
  z-index: 2;
  left: 50%;
  bottom: max(1rem, calc(env(safe-area-inset-bottom) + 0.6rem));
  transform: translateX(-50%);
  width: max-content;
  max-width: calc(100vw - 2rem);
  margin: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  padding: 0.35rem 0.9rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.9);
  font-size: 0.9rem;
  font-weight: 600;
  text-align: center;
}
.err {
  position: fixed;
  z-index: 2;
  left: 50%;
  bottom: 4.5rem;
  transform: translateX(-50%);
  margin: 0;
  align-self: center;
  padding: 0.3rem 0.8rem;
  border-radius: 0.8rem;
  background: #fef2f2;
  color: #b91c1c;
  font-weight: 700;
}
.flat {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  justify-content: center;
}
.slot {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.9rem;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.95);
}
.road {
  padding: 0.05rem 0.5rem;
  border-radius: 999px;
  background: #16a34a;
  color: #fff;
  font-size: 0.8rem;
}
</style>
