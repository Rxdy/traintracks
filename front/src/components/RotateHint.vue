<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

// Téléphone et tablette : le jeu se joue couché, et seulement couché (une seule mise en page à soigner).
// Tenu debout, un écran plein demande de tourner l'appareil. L'ordinateur (souris, pavé tactile) n'est pas concerné, même
// dans une fenêtre étroite. L'appli installée démarre déjà couchée (manifeste) ; dans le navigateur, on ne peut pas
// verrouiller l'écran, d'où ce message.
const QUERY = '(pointer: coarse) and (orientation: portrait)'
const upright = ref(false)
let mq: MediaQueryList | null = null
const update = (): void => {
  upright.value = !!mq?.matches
}
onMounted(() => {
  mq = window.matchMedia?.(QUERY) ?? null
  update()
  mq?.addEventListener('change', update)
})
onUnmounted(() => mq?.removeEventListener('change', update))
</script>

<template>
  <div v-if="upright" class="rotate" data-test="rotate-hint" role="alertdialog" aria-labelledby="rotate-title">
    <svg class="phone" viewBox="0 0 120 120" aria-hidden="true">
      <rect x="38" y="18" width="44" height="80" rx="8" fill="#fff" stroke="#1f2937" stroke-width="4" />
      <circle cx="60" cy="88" r="3" fill="#1f2937" />
      <path d="M96 52a36 36 0 0 0-22-30" fill="none" stroke="#f59e0b" stroke-width="5" stroke-linecap="round" />
      <path d="M70 14l5 9-10 2" fill="none" stroke="#f59e0b" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    <p id="rotate-title" class="title">Tourne ton appareil</p>
    <p class="text">Train Tracks se joue à l'horizontale.</p>
  </div>
</template>

<style scoped>
.rotate {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  padding: 2rem;
  background: linear-gradient(#a5d8ff, #e7f5ff);
  color: #1f2937;
  text-align: center;
}
.phone {
  width: 8rem;
  height: 8rem;
  animation: tilt 2.4s ease-in-out infinite;
}
@keyframes tilt {
  0%,
  35% {
    transform: rotate(0deg);
  }
  60%,
  100% {
    transform: rotate(-90deg);
  }
}
.title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 800;
}
.text {
  margin: 0;
  font-size: 1rem;
  color: #4b5563;
}
@media (prefers-reduced-motion: reduce) {
  .phone {
    animation: none;
    transform: rotate(-90deg);
  }
}
</style>
