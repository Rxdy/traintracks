<script setup lang="ts">
import { inject, ref } from 'vue'
import AuthPanel from '../components/AuthPanel.vue'
import { user, logout, deleteAccount, notice, resetToken } from '../auth'

const go = inject<(view: string) => void>('go', () => undefined)

// Suppression du compte : le mot de passe est redemandé, puis tout est effacé côté serveur.
const confirming = ref(false)
const password = ref('')
const error = ref('')
const busy = ref(false)

async function remove(): Promise<void> {
  if (busy.value || !password.value) return
  busy.value = true
  const r = await deleteAccount(password.value)
  busy.value = false
  if (r.ok) {
    notice.value = 'Compte supprimé. Toutes tes données ont été effacées.'
    go('home')
    return
  }
  error.value = r.error
}
function cancel(): void {
  confirming.value = false
  password.value = ''
  error.value = ''
}
</script>

<template>
  <section data-test="account">
    <AuthPanel v-if="!user || resetToken" />
    <div v-else class="me">
      <h2 class="halo">{{ user.name }}</h2>
      <p class="halo">{{ user.email }}</p>
      <p class="note halo">Compte {{ user.provider === 'google' ? 'Google' : 'e-mail' }}</p>
      <button type="button" class="btn btn--ghost" data-test="logout" @click="logout">Se déconnecter</button>

      <div class="danger">
        <button v-if="!confirming" type="button" class="link" data-test="delete-open" @click="confirming = true">Supprimer mon compte</button>
        <form v-else class="confirm" data-test="delete-form" @submit.prevent="remove">
          <p>Ton compte, ta progression, tes pièces et tes aides seront effacés définitivement. Il n'y a pas de retour possible.</p>
          <input v-model="password" class="field" type="password" placeholder="Ton mot de passe" autocomplete="current-password" data-test="delete-password" />
          <p v-if="error" class="err" data-test="delete-error">{{ error }}</p>
          <div class="row">
            <button type="button" class="btn btn--ghost btn--small" data-test="delete-cancel" @click="cancel">Annuler</button>
            <button type="submit" class="btn btn--small stop" :disabled="busy || !password" data-test="delete-confirm">Supprimer définitivement</button>
          </div>
        </form>
      </div>
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
.danger {
  margin-top: 1.2rem;
  width: min(20rem, 100%);
}
.link {
  border: 0;
  background: none;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 700;
  color: #b91c1c;
  text-decoration: underline;
  cursor: pointer;
  padding: 0;
}
.confirm {
  display: grid;
  gap: 0.6rem;
  padding: 0.8rem;
  border-radius: 16px;
  background: #fff;
  box-shadow: var(--shadow);
  font-size: 0.85rem;
  color: #374151;
}
.err {
  color: #b91c1c;
  font-weight: 600;
}
.row {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
}
.stop {
  background: #dc2626;
  box-shadow: 0 6px 16px rgba(220, 38, 38, 0.3);
}
.stop:hover:not(:disabled) {
  background: #b91c1c;
}
</style>
