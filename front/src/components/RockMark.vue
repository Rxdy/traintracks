<script setup lang="ts">
// Bloc plein : la voie ne passe jamais ici et on ne peut rien y poser. À la victoire, il devient une montagne.
</script>

<template>
  <svg class="rock" viewBox="0 0 100 100" data-test="rock" aria-label="rocher" role="img">
    <rect x="4" y="4" width="92" height="92" rx="10" />
  </svg>
</template>

<style scoped>
.rock {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  transition: opacity 0.4s ease;
}
.rock rect {
  fill: #111827;
}
</style>
