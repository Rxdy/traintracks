<script setup lang="ts">
import { computed } from 'vue'
import { MIN_BITS } from '../auth'

// Indicateur de robustesse : barre, libellé et bits. Sous le seuil, le compte ne peut pas être créé.
const props = defineProps<{ bits: number }>()

const ratio = computed(() => Math.min(1, props.bits / MIN_BITS))
const ok = computed(() => props.bits >= MIN_BITS)
const level = computed(() => (ok.value ? 'ok' : props.bits >= MIN_BITS * 0.7 ? 'mid' : 'low'))
const label = computed(() => {
  if (props.bits <= 0) return ''
  if (props.bits < MIN_BITS * 0.4) return 'Beaucoup trop faible'
  if (props.bits < MIN_BITS * 0.7) return 'Trop faible'
  if (props.bits < MIN_BITS) return 'Presque'
  return props.bits >= MIN_BITS * 1.6 ? 'Excellent' : 'Solide'
})
</script>

<template>
  <div class="meter" data-test="meter" :class="level">
    <div class="bar" role="progressbar" :aria-valuenow="Math.round(bits)" :aria-valuemin="0" :aria-valuemax="MIN_BITS">
      <span :style="{ width: ratio * 100 + '%' }"></span>
    </div>
    <p class="txt" data-test="meter-text">
      <template v-if="bits > 0">{{ label }} · {{ Math.round(bits) }} / {{ MIN_BITS }} bits</template>
      <template v-else>Au moins {{ MIN_BITS }} bits requis : une phrase de plusieurs mots marche très bien.</template>
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
  height: 0.5rem;
  border-radius: 999px;
  background: #e5e7eb;
  overflow: hidden;
}
.bar span {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: #dc2626;
  transition: width 0.15s, background 0.15s;
}
.meter.mid .bar span {
  background: #f59e0b;
}
.meter.ok .bar span {
  background: #16a34a;
}
.txt {
  font-size: 0.8rem;
  font-weight: 600;
  background: #fff;
  border-radius: 10px;
  padding: 0.15rem 0.6rem;
}
</style>
