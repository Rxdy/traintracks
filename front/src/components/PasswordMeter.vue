<script setup lang="ts">
import { computed } from 'vue'
import { MIN_BITS } from '../auth'

// Indicateur de robustesse : une barre qui se colore, sans aucun chiffre. Un repère marque le seuil à dépasser.
//   - sous le seuil : du rouge à l'orange, plus la couleur est forte plus on s'approche ;
//   - dès le seuil : vert ;
//   - au-delà : le vert s'enrichit (vert franc, puis turquoise, puis bleu profond) pour dire « très robuste ».
const props = defineProps<{ bits: number }>()

const MAX = MIN_BITS * 2.4 // la barre est pleine à cette robustesse (une phrase de quatre mots)
const ratio = computed(() => Math.min(1, Math.max(0, props.bits / MAX)))
const mark = (MIN_BITS / MAX) * 100 // position du seuil sur la barre, en %
const passed = computed(() => props.bits >= MIN_BITS)
// teinte : 0 (rouge) → 40 (orange) sous le seuil ; 140 (vert) au seuil → 215 (bleu) tout au bout
const hue = computed(() => {
  if (!passed.value) return Math.round((props.bits / MIN_BITS) * 40)
  const beyond = Math.min(1, (props.bits - MIN_BITS) / (MAX - MIN_BITS))
  return Math.round(140 + beyond * 75)
})
const color = computed(() => `hsl(${hue.value} 75% ${passed.value ? 38 : 46}%)`)
const level = computed(() => {
  const b = props.bits
  if (b <= 0) return 'none'
  if (b < MIN_BITS * 0.5) return 'low'
  if (b < MIN_BITS) return 'mid'
  if (b < MIN_BITS * 1.6) return 'ok'
  return b < MIN_BITS * 2.2 ? 'good' : 'great'
})
const LABELS: Record<string, string> = { none: '', low: 'Trop faible', mid: 'Presque', ok: 'Suffisant', good: 'Solide', great: 'Très robuste' }
</script>

<template>
  <div class="meter" data-test="meter" :class="level">
    <div class="bar" role="progressbar" aria-label="Robustesse du mot de passe" :aria-valuetext="LABELS[level] || 'Vide'" :aria-valuenow="Math.round(ratio * 100)" aria-valuemin="0" aria-valuemax="100">
      <span data-test="meter-fill" :data-hue="hue" :style="{ width: ratio * 100 + '%', background: color }"></span>
      <i class="mark" aria-hidden="true" :style="{ left: mark + '%' }"></i>
    </div>
    <p class="txt" data-test="meter-text">
      <template v-if="level !== 'none'">{{ LABELS[level] }}</template>
      <template v-else>Une phrase de plusieurs mots marche très bien.</template>
    </p>
  </div>
</template>

<style scoped>
.meter {
  display: grid;
  gap: 0.3rem;
  text-align: left;
}
.bar {
  position: relative;
  height: 0.6rem;
  border-radius: 999px;
  background: #e5e7eb;
  overflow: hidden;
}
.bar span {
  display: block;
  height: 100%;
  border-radius: 999px;
  transition: width 0.15s, background 0.15s;
}
/* repère du seuil */
.mark {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  margin-left: -1px;
  background: #1f2937;
  opacity: 0.55;
}
.txt {
  font-size: 0.8rem;
  font-weight: 600;
  background: #fff;
  border-radius: 10px;
  padding: 0.15rem 0.6rem;
}
</style>
