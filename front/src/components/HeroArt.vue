<script setup lang="ts">
import hero from '../assets/hero.webp'
// Illustration du grand cube « Niveau » : un petit plateau de 4×4 avec sa voie, son train et quelques arbres, rendu avec le
// moteur 3D du décor (dev/renderArt.ts, page /render-art.html) pour ressembler au jeu.
// `plain` : seulement un fond de campagne, sans plateau (pour les médaillons).
defineProps<{ plain?: boolean }>()
</script>

<template>
  <img v-if="!plain" class="art" :src="hero" alt="" aria-hidden="true" draggable="false" />
  <svg v-else class="art" viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <linearGradient id="hero-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#7cc4ff" />
        <stop offset="0.55" stop-color="#c9e9ff" />
        <stop offset="0.56" stop-color="#8fd19e" />
        <stop offset="1" stop-color="#4faf7b" />
      </linearGradient>
    </defs>
    <rect width="200" height="200" fill="url(#hero-sky)" />
    <circle cx="160" cy="38" r="16" fill="#fde68a" />
    <ellipse cx="46" cy="40" rx="22" ry="8" fill="#fff" opacity="0.9" />
  </svg>
</template>

<style scoped>
.art {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
  user-select: none;
}
</style>
