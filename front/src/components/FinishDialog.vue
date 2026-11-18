<script setup lang="ts">
// La fin du trajet : une fenêtre au centre de l'écran, fond assombri, par-dessus le paysage. Le corps (temps, gains) vient du parent ;
// « Revoir le trajet » la ferme et relance le train, « Suivant » passe à la suite.
defineProps<{
  open: boolean
  title?: string
  nextLabel?: string
  canNext?: boolean // faux : plus de suite, `endMessage` remplace le bouton
  endMessage?: string
  busy?: boolean
}>()
defineEmits<{ (e: 'replay'): void; (e: 'next'): void }>()
</script>

<template>
  <div class="overlay" :class="{ open }" :aria-hidden="!open">
    <div class="card" role="dialog" aria-modal="true" :aria-label="title ?? 'Niveau terminé'" data-test="finish">
      <h2 class="win" data-test="win">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        {{ title ?? 'Niveau terminé' }}
      </h2>
      <slot />
      <div class="btns">
        <button type="button" class="btn replay" data-test="replay-trip" :tabindex="open ? 0 : -1" @click="$emit('replay')">Revoir le trajet</button>
        <button v-if="canNext !== false" type="button" class="btn next" data-test="next" :tabindex="open ? 0 : -1" :disabled="busy" @click="$emit('next')">
          {{ nextLabel ?? 'Niveau suivant' }}
        </button>
      </div>
      <p v-if="canNext === false && endMessage" class="end" data-test="coming-soon">{{ endMessage }}</p>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(10, 18, 30, 0);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.5s ease, background 0.5s ease;
}
.overlay.open {
  opacity: 1;
  background: rgba(10, 18, 30, 0.58);
  pointer-events: auto;
}
.card {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  width: min(100%, 24rem);
  padding: 1.3rem 1.3rem 1.2rem;
  border-radius: 1.2rem;
  background: #fff;
  color: #1c2430;
  box-shadow: 0 0.6rem 2.4rem rgba(0, 0, 0, 0.55);
  transform: translateY(0.8rem) scale(0.96);
  transition: transform 0.5s cubic-bezier(0.3, 0.8, 0.3, 1) 0.1s;
}
.open .card {
  transform: none;
}
.win {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  margin: 0;
  font-size: 1.6rem;
  font-weight: 800;
  color: #15803d;
}
.win svg {
  width: 1.5rem;
  height: 1.5rem;
  fill: none;
  stroke: #16a34a;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.card :deep(.receipt) {
  width: 100%;
}
.btns {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin-top: 0.2rem;
}
.btns .btn {
  flex: 1;
  justify-content: center;
  padding: 0.8rem 1rem;
  font-size: 1.05rem;
  font-weight: 700;
  border-radius: 0.8rem;
}
.replay {
  border: 2px solid #8fa0bb;
  background: #fff;
  color: #1c2430;
}
.next {
  background: #16a34a;
  color: #fff;
  box-shadow: 0 0.15rem 0 #15803d;
}
.next:hover:not(:disabled) {
  background: #15803d;
}
.end {
  margin: 0;
  text-align: center;
  font-size: 0.9rem;
  line-height: 1.3;
  color: #374151;
}
@media (min-aspect-ratio: 1/1) {
  .card {
    width: min(100%, 28rem);
  }
  .btns {
    flex-direction: row;
  }
}
@media (prefers-reduced-motion: reduce) {
  .overlay,
  .card {
    transition: opacity 0.2s ease;
    transform: none;
  }
}
</style>
