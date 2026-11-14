<script setup lang="ts">
import { computed } from 'vue'
import { AVATAR_ART, DEFAULT_AVATAR } from '../avatars'

// Un avatar : un dessin fixe du jeu, découpé en rond. Aucun libellé (le joueur n'en a pas besoin) ; la taille se règle par CSS (--avatar, 2.4rem par défaut).
// Le dessin vient du code (avatars/svg.ts), jamais d'un joueur : l'injecter tel quel est sans risque.
const props = defineProps<{ id?: string }>()
const art = computed(() => AVATAR_ART[props.id ?? ''] ?? AVATAR_ART[DEFAULT_AVATAR])
const inner = computed(() => `<rect width="100" height="100" fill="${art.value.bg}"/>${art.value.body}`)
</script>

<template>
  <span class="avatar-pic" aria-hidden="true" data-test="avatar-pic" :data-avatar="props.id">
    <svg viewBox="0 0 100 100" v-html="inner" />
  </span>
</template>

<style scoped>
.avatar-pic {
  display: inline-block;
  flex: none;
  width: var(--avatar, 2.4rem);
  height: var(--avatar, 2.4rem);
  border-radius: 50%;
  overflow: hidden;
  line-height: 0;
  box-shadow: 0 0 0 2px #fff;
}
svg {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
