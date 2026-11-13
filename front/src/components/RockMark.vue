<script setup lang="ts">
// Rocher : la voie ne passe jamais ici et on ne peut rien y poser.
</script>

<template>
  <svg class="rock" viewBox="0 0 100 100" data-test="rock" aria-label="rocher" role="img">
    <path d="M 12 78 L 20 44 L 40 20 L 66 22 L 88 50 L 84 78 Z" />
    <path class="shade" d="M 40 20 L 66 22 L 88 50 L 62 48 Z" />
  </svg>
</template>

<style scoped>
.rock {
  position: absolute;
  inset: 6%;
  width: 88%;
  height: 88%;
  pointer-events: none;
}
.rock path {
  fill: #9ca3af;
  stroke: #6b7280;
  stroke-width: 3;
  stroke-linejoin: round;
}
.rock .shade {
  fill: #cbd5e1;
  stroke: none;
}
</style>
