<script setup lang="ts">
// Quitter la partie : un rond rouge, une croix blanche, aucun libellé (le nom accessible reste « Quitter »).
// Zone de toucher de 44 px minimum ; le cercle blanc le garde lisible sur le décor.
</script>

<template>
  <button type="button" class="quit" aria-label="Quitter" title="Quitter">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /></svg>
  </button>
</template>

<style scoped>
.quit {
  display: grid;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  padding: 0;
  border: 0.16rem solid #fff;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 28%, #f87171, #dc2626 55%, #b91c1c);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
  cursor: pointer;
  transition: transform 0.12s ease, filter 0.12s ease;
}
.quit:hover {
  filter: brightness(1.08);
}
.quit:active {
  transform: scale(0.94);
}
.quit:focus-visible {
  outline: 3px solid #1d4ed8;
  outline-offset: 2px;
}
.quit svg {
  width: 62%;
  height: 62%;
  fill: none;
  stroke: #fff;
  stroke-width: 3.4;
  stroke-linecap: round;
}
</style>
