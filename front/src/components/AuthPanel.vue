<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { login, register, estimateBits, MIN_BITS } from '../auth'
import PasswordMeter from './PasswordMeter.vue'

// Connexion / inscription. L'inscription exige un mot de passe d'au moins MIN_BITS bits (indicateur en direct)
// puis une confirmation par e-mail. Connexion Google : pas encore (elle sera vérifiée par le serveur).
const mode = ref<'login' | 'register'>('login')
const name = ref('')
const email = ref('')
const password = ref('')
const error = ref('')
const info = ref('')
const busy = ref(false)
const bits = ref(0)

let seq = 0
watch([password, name, email], async () => {
  const mine = ++seq
  const b = mode.value === 'register' ? await estimateBits(password.value, [name.value, email.value, email.value.split('@')[0]]) : 0
  if (mine === seq) bits.value = b // ignore une réponse arrivée après une frappe plus récente
})

const canSubmit = computed(() => !busy.value && (mode.value === 'login' || bits.value >= MIN_BITS))

async function submit(): Promise<void> {
  if (!canSubmit.value) return
  busy.value = true
  const res =
    mode.value === 'register'
      ? await register(name.value, email.value, password.value)
      : await login(email.value, password.value)
  busy.value = false
  error.value = res.ok ? '' : res.error
  if (res.ok && res.message) {
    info.value = res.message
    password.value = ''
  }
}

function switchMode(): void {
  mode.value = mode.value === 'login' ? 'register' : 'login'
  error.value = ''
  info.value = ''
  bits.value = 0
}
</script>

<template>
  <div class="auth" data-test="auth">
    <h2 class="halo">{{ mode === 'login' ? 'Connexion' : 'Créer un compte' }}</h2>

    <p class="google-off halo" data-test="google-off">Google : pas encore disponible.</p>

    <p class="or halo">ou avec une adresse e-mail</p>

    <p v-if="info" class="ok" data-test="info">{{ info }}</p>

    <form v-else @submit.prevent="submit" data-test="auth-form">
      <input v-if="mode === 'register'" class="field" v-model="name" placeholder="Pseudo" autocomplete="nickname" data-test="name" />
      <input class="field" v-model="email" type="email" placeholder="E-mail" autocomplete="email" data-test="email" />
      <input class="field" v-model="password" type="password" placeholder="Mot de passe" :autocomplete="mode === 'login' ? 'current-password' : 'new-password'" data-test="password" />
      <PasswordMeter v-if="mode === 'register'" :bits="bits" />
      <p v-if="error" class="err" data-test="error">{{ error }}</p>
      <button type="submit" class="btn" :disabled="!canSubmit" data-test="submit">
        {{ mode === 'login' ? 'Se connecter' : 'Créer mon compte' }}
      </button>
    </form>

    <button type="button" class="btn btn--ghost btn--small" data-test="switch" @click="switchMode">
      {{ mode === 'login' ? 'Pas de compte ? Créer un compte' : 'Déjà un compte ? Se connecter' }}
    </button>
  </div>
</template>

<style scoped>
.auth {
  display: grid;
  gap: 0.8rem;
  width: min(20rem, 100%);
  margin: 0 auto;
  text-align: center;
  color: #374151;
}
h2 {
  font-weight: 800;
}
form {
  display: grid;
  gap: 0.65rem;
}
.or,
.google-off {
  font-size: 0.85rem;
}
.ok {
  color: #166534;
  font-size: 0.9rem;
  font-weight: 600;
  padding: 0.5rem 0.8rem;
  border-radius: 12px;
  background: #fff;
}
.err {
  color: #b91c1c;
  font-size: 0.85rem;
  font-weight: 600;
  padding: 0.3rem 0.8rem;
  border-radius: 12px;
  background: #fff;
}
form .btn,
.auth > .btn {
  justify-self: center;
}
.field {
  box-shadow: var(--shadow);
  border-color: #fff;
}
</style>
