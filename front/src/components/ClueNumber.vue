<script setup lang="ts">
// Un compteur : nombre de rails attendus sur une ligne ou une colonne.
defineProps<{
  value: number
  orientation: 'row' | 'col'
}>()
</script>

<template>
  <div
    class="clue"
    :class="'clue--' + orientation"
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
}
</style>
