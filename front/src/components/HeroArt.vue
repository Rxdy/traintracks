<script setup lang="ts">
// `plain` : seulement le fond de campagne (pour les médaillons).
defineProps<{ plain?: boolean }>()
// Illustration du grand cube : une mini grille avec une voie qui serpente et
// sa locomotive, sur un fond de campagne.
</script>

<template>
  <svg class="art" viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
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

    <template v-if="!plain">
    <!-- grille -->
    <g transform="translate(46 40) scale(0.78)">
    <g fill="#ffffff" fill-opacity="0.55" stroke="#ffffff" stroke-opacity="0.9" stroke-width="1.2">
      <template v-for="r in 4" :key="r">
        <rect v-for="c in 4" :key="c" :x="(c - 1) * 34" :y="(r - 1) * 34" width="34" height="34" />
      </template>
    </g>
    <!-- voie : départ à gauche, deux virages, sortie en bas -->
    <g fill="none" stroke-linecap="butt">
      <path d="M-10 17 H17 Q34 17 34 34 V51 Q34 68 51 68 H85 Q102 68 102 85 V100 Q102 118 85 118 H51 V136 " stroke="#6b4a2f" stroke-width="13" />
      <path d="M-10 17 H17 Q34 17 34 34 V51 Q34 68 51 68 H85 Q102 68 102 85 V100 Q102 118 85 118 H51 V136 " stroke="#2563eb" stroke-width="7" />
      <path d="M-10 17 H17 Q34 17 34 34 V51 Q34 68 51 68 H85 Q102 68 102 85 V100 Q102 118 85 118 H51 V136 " stroke="#fff" stroke-width="1.4" stroke-dasharray="3 5" />
    </g>
    <!-- locomotive, au bout de la voie -->
    <g transform="translate(51 122) rotate(90)">
      <rect x="-15" y="-9" width="30" height="18" rx="4" fill="#dc2626" stroke="#7f1d1d" stroke-width="1.4" />
      <rect x="-15" y="-9" width="11" height="18" rx="3" fill="#991b1b" />
      <rect x="6" y="-4" width="5" height="8" rx="1" fill="#111827" />
      <circle cx="13" cy="0" r="2.4" fill="#fde68a" />
    </g>
    </g>
    </template>
  </svg>
</template>

<style scoped>
.art {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
</style>
