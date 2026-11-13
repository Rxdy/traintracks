<script setup lang="ts">
import type { Pal } from '../../scenery/themes'
// Une case de champ. Les sillons sont à des positions fixes dans la case : deux cases voisines du même champ se
// raccordent sans couture.
defineProps<{ pal: Pal; v: number; dir?: 'h' | 'v' }>()
</script>
<template>
  <g>
    <rect width="100" height="100" :fill="pal.crops[v % pal.crops.length][0]" />
    <template v-for="k in 5" :key="k">
      <rect v-if="dir === 'h'" x="0" :y="(k - 1) * 20 + 10" width="100" height="10" :fill="pal.crops[v % pal.crops.length][1]" />
      <rect v-else :x="(k - 1) * 20 + 10" y="0" width="10" height="100" :fill="pal.crops[v % pal.crops.length][1]" />
    </template>
  </g>
</template>
