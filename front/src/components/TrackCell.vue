<script setup lang="ts">
import type { CellMark, Side } from '../cell'
import type { RailVariant } from '../puzzle'
import RailPiece from './RailPiece.vue'
import RailDot from './RailDot.vue'
import BlockedMark from './BlockedMark.vue'
import RockMark from './RockMark.vue'

// Une case jouable. Son rendu dépend de la marque choisie par le joueur.
//   - `sides`   : côtés connectés du rail (calculés en amont par le plateau)
//   - `variant` : nature du rail (départ / sortie / joueur) → couleur
withDefaults(
  defineProps<{
    mark?: CellMark
    sides?: Side[] | null
    variant?: RailVariant
  }>(),
  { mark: 'empty', sides: null, variant: 'user' },
)
</script>

<template>
  <div
    class="cell"
    :class="['cell--' + mark, mark === 'rail' ? 'cell--' + variant : '']"
    data-test="cell"
    role="gridcell"
  >
    <RockMark v-if="mark === 'rock'" />
    <BlockedMark v-else-if="mark === 'cross'" />
    <template v-else-if="mark === 'rail'">
      <RailPiece v-if="sides" :sides="sides" :variant="variant" />
      <RailDot v-else :variant="variant" />
    </template>
  </div>
</template>

<style scoped>
.cell {
  position: relative;
  background: #ffffff;
  border: 1px solid #cbd2dc;
  cursor: pointer;
  transition: background 0.12s ease;
}

.cell:hover {
  background: #f1f5fb;
}

/* Les cases de départ / sortie sont verrouillées : pas de curseur "cliquable". */
.cell--entry,
.cell--exit,
.cell--given,
.cell--rock {
  cursor: default;
}
</style>
