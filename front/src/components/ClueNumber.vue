<script setup lang="ts">
import type { ClueStatus } from '../lines'
// Un compteur : nombre de rails attendus sur une ligne ou une colonne.
withDefaults(
  defineProps<{
    value: number
    orientation: 'row' | 'col'
    status?: ClueStatus
    // Pouvoir « Une ligne » en attente : le compteur s'éclaire et se touche pour choisir sa ligne ou sa colonne.
    pickable?: boolean
  }>(),
  { status: 'open' },
)
defineEmits<{ (e: 'pick'): void }>()
</script>

<template>
  <button
    v-if="pickable"
    type="button"
    class="clue clue--pick"
    :class="['clue--' + orientation, 'clue--' + status]"
    data-test="clue"
    :aria-label="orientation === 'row' ? 'Révéler cette ligne' : 'Révéler cette colonne'"
    @click="$emit('pick')"
  >
    {{ value }}
  </button>
  <div
    v-else
    class="clue"
    :class="['clue--' + orientation, 'clue--' + status]"
    data-test="clue"
    :aria-label="orientation === 'row' ? 'Compteur ligne' : 'Compteur colonne'"
  >
    {{ value }}
  </div>
</template>

<style scoped>
/* À choisir (pouvoir « Une ligne ») : cerclé d'orange, il pulse doucement. */
.clue--pick {
  border: 3px solid #f59e0b;
  padding: 0;
  font-family: inherit;
  cursor: pointer;
  box-shadow: 0 0 0 0.2rem rgba(245, 158, 11, 0.35);
  animation: clue-pick 1.2s ease-in-out infinite;
}
@keyframes clue-pick {
  50% {
    box-shadow: 0 0 0 0.35rem rgba(245, 158, 11, 0.2);
  }
}
@media (prefers-reduced-motion: reduce) {
  .clue--pick {
    animation: none;
  }
}
/* Un compteur : une plaque bleu nuit, chiffre blanc. Elle vire au vert quand la ligne est faite (ou forcée), au rouge quand elle déborde. */
.clue {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 13%;
  border-radius: 20%;
  background: #2f4a6b;
  box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.22), 0 1px 2px rgba(15, 30, 55, 0.25);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  font-size: clamp(0.85rem, 3.4vmin, 1.35rem);
  color: #fff;
  user-select: none;
  transition: background 0.15s ease;
}
.clue--done,
.clue--forced {
  background: #16803c;
}
.clue--over {
  background: #b91c1c;
}
</style>
