<script setup lang="ts">
// Pont : tablier de pierre avec garde-corps, sous les rails, là où la voie franchit la rivière.
// `axis` : sens de la voie ('h' = gauche-droite). Unité : 1 case = 1×1, posé en (c, r).
defineProps<{ r: number; c: number; axis: 'h' | 'v' }>()
</script>
<template>
  <g>
    <template v-if="axis === 'h'">
      <rect :x="c + 0.07" :y="r + 0.2" width="0.86" height="0.64" rx="0.03" fill="#000" opacity="0.18" />
      <rect :x="c + 0.08" :y="r + 0.19" width="0.84" height="0.62" fill="#c3bdaf" />
      <rect :x="c + 0.06" :y="r + 0.16" width="0.88" height="0.07" rx="0.02" fill="#8d877a" />
      <rect :x="c + 0.06" :y="r + 0.77" width="0.88" height="0.07" rx="0.02" fill="#8d877a" />
    </template>
    <template v-else>
      <rect :x="c + 0.2" :y="r + 0.07" width="0.64" height="0.86" rx="0.03" fill="#000" opacity="0.18" />
      <rect :x="c + 0.19" :y="r + 0.08" width="0.62" height="0.84" fill="#c3bdaf" />
      <rect :x="c + 0.16" :y="r + 0.06" width="0.07" height="0.88" rx="0.02" fill="#8d877a" />
      <rect :x="c + 0.77" :y="r + 0.06" width="0.07" height="0.88" rx="0.02" fill="#8d877a" />
    </template>
  </g>
</template>
