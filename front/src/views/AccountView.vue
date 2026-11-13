<script setup lang="ts">
import AuthPanel from '../components/AuthPanel.vue'
import { user, logout } from '../auth'
</script>

<template>
  <section data-test="account">
    <AuthPanel v-if="!user" />
    <div v-else class="me">
      <h2 class="halo">{{ user.name }}</h2>
      <p class="halo">{{ user.email }}</p>
      <p class="note halo">Compte {{ user.provider === 'google' ? 'Google' : 'e-mail' }}</p>
      <button type="button" class="btn btn--ghost" data-test="logout" @click="logout">Se déconnecter</button>
    </div>
  </section>
</template>

<style scoped>
.me {
  display: grid;
  gap: 0.6rem;
  justify-items: center;
  text-align: center;
}
h2 {
  font-weight: 800;
}
.note {
  font-size: 0.9rem;
}
</style>
