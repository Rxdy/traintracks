<script setup lang="ts">
// Pièce dessinée (pas d'emoji) : un disque doré avec un liseré et un relief.
defineProps<{ size?: string }>()
</script>

<template>
  <svg class="coin-icon" viewBox="0 0 24 24" :width="size ?? '1em'" :height="size ?? '1em'" aria-hidden="true" data-test="coin-icon">
    <circle cx="12" cy="12" r="10.5" fill="#f4b400" stroke="#b7791f" stroke-width="1.6" />
    <circle cx="12" cy="12" r="7.2" fill="none" stroke="#fde68a" stroke-width="1.6" />
    <path d="M12 7.6v8.8M9.6 10.1c0-1 1-1.7 2.4-1.7s2.4.7 2.4 1.6c0 2.3-4.8 1.2-4.8 3.6 0 1 1.1 1.7 2.4 1.7s2.4-.6 2.4-1.7" fill="none" stroke="#92400e" stroke-width="1.3" stroke-linecap="round" />
  </svg>
</template>

<style scoped>
.coin-icon {
  display: inline-block;
  vertical-align: -0.15em;
  flex: none;
}
</style>
