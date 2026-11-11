<script setup lang="ts">
import { computed } from 'vue'
import type { Side } from '../cell'
import type { RailVariant } from '../puzzle'
import { railShapeForSides } from '../rails'

// Rendu SVG d'un rail raccordé à un ensemble de côtés (2 rails + traverses).
// La couleur dépend de la nature du rail : départ (vert), sortie (rouge),
// joueur (bleu).
const props = withDefaults(
  defineProps<{
    sides: Side[]
    variant?: RailVariant
  }>(),
  { variant: 'user' },
)

const shape = computed(() => railShapeForSides(props.sides))
</script>

<template>
  <svg
    class="rail"
    :class="'rail--' + variant"
    viewBox="0 0 100 100"
    data-test="rail"
    :data-sides="sides.join('-')"
    :data-variant="variant"
    aria-hidden="true"
  >
    <path
      v-for="(d, i) in shape.sleepers"
      :key="'sleeper-' + i"
      class="sleeper"
      :d="d"
    />
    <path v-for="(d, i) in shape.rails" :key="'rail-' + i" class="rail-line" :d="d" />
  </svg>
</template>

<style scoped>
.rail {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  /* Couleurs par défaut (rail joueur : bleu) */
  --rail-color: #2563eb;
  --tie-color: #93c5fd;
}

.rail--entry {
  --rail-color: #16a34a; /* vert : départ */
  --tie-color: #86efac;
}

.rail--exit {
  --rail-color: #dc2626; /* rouge : sortie */
  --tie-color: #fca5a5;
}

.sleeper {
  stroke: var(--tie-color);
  stroke-width: 7;
  fill: none;
}

.rail-line {
  stroke: var(--rail-color);
  stroke-width: 6;
  fill: none;
  stroke-linecap: round;
}
</style>
