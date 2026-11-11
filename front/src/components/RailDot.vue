<script setup lang="ts">
import type { RailVariant } from '../puzzle'

// Marque « il y a un rail ici », orientation encore inconnue : un point de la
// couleur du rail (bleu joueur, vert départ, rouge sortie).
withDefaults(defineProps<{ variant?: RailVariant }>(), { variant: 'user' })
</script>

<template>
  <svg
    class="dot"
    :class="'dot--' + variant"
    viewBox="0 0 100 100"
    data-test="rail-dot"
    :data-variant="variant"
    aria-hidden="true"
  >
    <circle cx="50" cy="50" r="15" />
  </svg>
</template>

<style scoped>
.dot {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  --dot-color: #2563eb;
}
.dot--entry {
  --dot-color: #16a34a;
}
.dot--exit {
  --dot-color: #dc2626;
}
.dot circle {
  fill: var(--dot-color);
}
</style>
