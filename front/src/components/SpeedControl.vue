<script setup lang="ts">
// La vitesse du train : trois crans, en haut à droite pendant le Trajet. Le cran actif est coloré ; un clic sur un autre l'active.
export type Speed = 'slow' | 'normal' | 'fast'
defineProps<{ modelValue: Speed }>()
defineEmits<{ (e: 'update:modelValue', v: Speed): void }>()
const STEPS: { id: Speed; label: string; n: number }[] = [
  { id: 'slow', label: 'Lent', n: 1 },
  { id: 'normal', label: 'Normal', n: 2 },
  { id: 'fast', label: 'Rapide', n: 3 },
]
</script>

<template>
  <div class="speed" role="group" aria-label="Vitesse du train" data-test="speed">
    <button
      v-for="s in STEPS"
      :key="s.id"
      type="button"
      :class="{ on: modelValue === s.id }"
      :data-test="'speed-' + s.id"
      :aria-pressed="modelValue === s.id"
      :aria-label="s.label"
      :title="s.label"
      @click="$emit('update:modelValue', s.id)"
    >
      <svg v-for="i in s.n" :key="i" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 1l6 4-6 4z" /></svg>
    </button>
  </div>
</template>

<style scoped>
.speed {
  position: fixed;
  top: max(0.75rem, env(safe-area-inset-top));
  right: max(0.75rem, env(safe-area-inset-right));
  z-index: 9; /* au-dessus du paysage et de la barre du haut */
  display: flex;
  gap: 0.2rem;
  padding: 0.25rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}
button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  min-width: 2.6rem;
  height: 2.2rem;
  padding: 0 0.5rem;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: #6b7a90;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
}
button:hover:not(.on) {
  background: #eef1f6;
}
button.on {
  background: #f59e0b;
  color: #3b2400;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}
button:focus-visible {
  outline: 3px solid #1d4ed8;
  outline-offset: 2px;
}
svg {
  width: 0.8rem;
  height: 0.8rem;
  fill: currentColor;
  margin-right: -0.15rem;
}
@media (prefers-reduced-motion: reduce) {
  button {
    transition: none;
  }
}
</style>
