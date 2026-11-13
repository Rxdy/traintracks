<script setup lang="ts">
import { computed } from 'vue'
import CoinIcon from './CoinIcon.vue'

// Gains présentés comme une facture : une ligne par gain avec le montant à droite, un trait, puis le total.
const props = defineProps<{ lines: { label: string; amount: number }[] }>()
const rows = computed(() => props.lines.filter((l) => l.amount > 0))
const total = computed(() => rows.value.reduce((s, l) => s + l.amount, 0))
</script>

<template>
  <div v-if="total > 0" class="receipt" data-test="receipt">
    <div v-for="l in rows" :key="l.label" class="row" data-test="receipt-line">
      <span class="label">{{ l.label }}</span>
      <span class="fill" aria-hidden="true"></span>
      <b class="amount">+{{ l.amount }}</b>
    </div>
    <div class="rule" aria-hidden="true"></div>
    <div class="row total" data-test="receipt-total">
      <span class="label">Total</span>
      <span class="fill" aria-hidden="true"></span>
      <b class="amount">+{{ total }} <CoinIcon size="1.1em" /></b>
    </div>
  </div>
</template>

<style scoped>
.receipt {
  width: min(15rem, 100%);
  padding: 0.5rem 0.2rem 0;
  font-variant-numeric: tabular-nums;
  color: #374151;
}
.row {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  font-size: 0.95rem;
}
.fill {
  flex: 1;
  border-bottom: 2px dotted #cbd5e1;
  transform: translateY(-0.25em);
}
.amount {
  font-weight: 800;
  color: #111827;
  white-space: nowrap;
}
.rule {
  height: 2px;
  margin: 0.35rem 0;
  background: #1f2937;
  border-radius: 2px;
}
.total {
  font-size: 1.15rem;
  font-weight: 800;
  color: #92400e;
}
.total .amount {
  color: #92400e;
}
</style>
