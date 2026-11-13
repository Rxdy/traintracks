<script setup lang="ts">
// Image de chaque pouvoir (dessin simple, sans texte) : un canon, une case, une voie qui s'allonge, une ligne.
defineProps<{ name: 'colors' | 'cell' | 'cannon' | 'line' | 'lock' }>()
</script>

<template>
  <svg viewBox="0 0 32 32" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" :data-icon="name">
    <template v-if="name === 'colors'">
      <rect x="4" y="5" width="9" height="9" rx="2" fill="#16a34a" stroke="none" />
      <rect x="19" y="5" width="9" height="9" rx="2" fill="#dc2626" stroke="none" />
      <rect x="4" y="18" width="9" height="9" rx="2" fill="#f59e0b" stroke="none" />
      <rect x="19" y="18" width="9" height="9" rx="2" fill="#2563eb" stroke="none" />
    </template>
    <template v-else-if="name === 'lock'">
      <rect x="7" y="14" width="18" height="13" rx="3" />
      <path d="M11 14v-3.5a5 5 0 0 1 10 0V14" />
    </template>
    <template v-else-if="name === 'cannon'">
      <path d="M4 22l16-9 3 5.5-16 9z" fill="currentColor" stroke="none" />
      <circle cx="9" cy="26" r="3.2" fill="currentColor" stroke="none" />
      <circle cx="26" cy="9" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="27" cy="19" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="20" cy="4.5" r="1.6" fill="currentColor" stroke="none" />
    </template>
    <template v-else-if="name === 'cell'">
      <rect x="5" y="5" width="22" height="22" rx="4" stroke-dasharray="3 3.2" />
      <rect x="11" y="11" width="10" height="10" rx="2.5" fill="currentColor" stroke="none" />
    </template>
    <template v-else>
      <rect x="3" y="12" width="5.5" height="8" rx="1.5" fill="currentColor" stroke="none" />
      <rect x="10.5" y="12" width="5.5" height="8" rx="1.5" fill="currentColor" stroke="none" />
      <rect x="18" y="12" width="5.5" height="8" rx="1.5" fill="currentColor" stroke="none" />
      <rect x="25.5" y="12" width="4" height="8" rx="1.5" fill="currentColor" stroke="none" />
    </template>
  </svg>
</template>
