<script setup lang="ts">
// Marque ✕ : le joueur pense qu'il n'y a PAS de rail dans cette case.
</script>

<template>
  <svg
    class="blocked"
    viewBox="0 0 100 100"
    data-test="blocked"
    aria-hidden="true"
  >
    <path d="M 32 32 L 68 68" />
    <path d="M 68 32 L 32 68" />
  </svg>
</template>

<style scoped>
.blocked {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.blocked path {
  stroke: #cbd5e1;
  stroke-width: 9;
  stroke-linecap: round;
  fill: none;
}
</style>
