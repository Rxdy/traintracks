<script setup lang="ts">
import HeroArt from './HeroArt.vue'
import MenuIcon from './MenuIcon.vue'

// Médaillon illustré en haut des pages de menu : même fond de campagne que le
// grand cube de l'accueil, avec l'icône de la page (celle du petit cube).
defineProps<{ name: 'daily' | 'tuto' | 'stats' | 'account'; initial?: string }>()
</script>

<template>
  <div class="badge" data-test="badge" aria-hidden="true">
    <HeroArt plain />
    <span class="ico"><MenuIcon :name="name" :initial="initial" /></span>
  </div>
</template>

<style scoped>
.badge {
  position: relative;
  flex: none;
  width: 5.4rem;
  height: 5.4rem;
  border: 3px solid #fff;
  border-radius: 24%;
  overflow: hidden;
  box-shadow: 0 8px 22px rgba(30, 64, 175, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
}
.ico {
  position: relative;
  width: 3.6rem;
  height: 3.6rem;
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.3));
}
</style>
