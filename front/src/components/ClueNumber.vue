<script setup lang="ts">
import type { ClueStatus } from '../lines'
// Un compteur : nombre de rails attendus sur une ligne ou une colonne.
withDefaults(
  defineProps<{
    value: number
    orientation: 'row' | 'col'
    status?: ClueStatus
  }>(),
  { status: 'open' },
)
</script>

<template>
  <div
    class="clue"
    :class="['clue--' + orientation, 'clue--' + status]"
    data-test="clue"
    :aria-label="orientation === 'row' ? 'Compteur ligne' : 'Compteur colonne'"
  >
    {{ value }}
  </div>
</template>

<style scoped>
.clue {
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: clamp(0.85rem, 3.4vmin, 1.35rem);
  color: #1f2937;
  user-select: none;
  transition: color 0.15s ease;
}
.clue--done {
  color: #16a34a;
}
.clue--forced {
  color: #16a34a;
}
.clue--over {
  color: #dc2626;
}
</style>
