<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { inject } from 'vue'
import { forgotPassword, googleEnabled, login, register, resetPassword, resetToken, estimateBits, notice, MIN_BITS } from '../auth'
import PasswordMeter from './PasswordMeter.vue'

// Connexion / inscription. L'inscription exige un mot de passe d'au moins MIN_BITS bits (indicateur en direct)
// puis une confirmation par e-mail. Connexion Google : un lien vers le serveur (jamais de secret dans le navigateur) ; masquée si le serveur ne la propose pas.
const go = inject<(view: string) => void>('go', () => undefined)
// 'forgot' : demander le lien ; 'reset' : choisir le nouveau mot de passe (arrivée par le lien reçu).
const mode = ref<'login' | 'register' | 'forgot' | 'reset'>(resetToken.value ? 'reset' : 'login')
watch(resetToken, (t) => t && (mode.value = 'reset'))
const name = ref('')
const email = ref('')
const password = ref('')
const confirm = ref('') // inscription et nouveau mot de passe : à saisir deux fois
const visible = ref(false) // afficher le mot de passe en clair
const error = ref('')
const info = ref('')
const busy = ref(false)
const bits = ref(0)

let seq = 0
watch([password, name, email], async () => {
  const mine = ++seq
  const b = mode.value === 'register' || mode.value === 'reset' ? await estimateBits(password.value, [name.value, email.value, email.value.split('@')[0]]) : 0
  if (mine === seq) bits.value = b // ignore une réponse arrivée après une frappe plus récente
})

const needsStrong = computed(() => mode.value === 'register' || mode.value === 'reset')
const mismatch = computed(() => needsStrong.value && confirm.value !== '' && confirm.value !== password.value)
const canSubmit = computed(() => !busy.value && (!needsStrong.value || (bits.value >= MIN_BITS && confirm.value === password.value)))

async function submit(): Promise<void> {
  if (!canSubmit.value) return
  busy.value = true
  const res =
    mode.value === 'register'
      ? await register(name.value, email.value, password.value)
      : mode.value === 'forgot'
        ? await forgotPassword(email.value)
        : mode.value === 'reset'
          ? await resetPassword(resetToken.value, password.value)
          : await login(email.value, password.value)
  busy.value = false
  error.value = res.ok ? '' : res.error
  if (res.ok && res.message) {
    password.value = ''
    confirm.value = ''
    if (mode.value === 'reset') {
      notice.value = res.message
      mode.value = 'login'
    } else info.value = res.message
  }
}

function open(m: 'login' | 'register' | 'forgot'): void {
  mode.value = m
  error.value = ''
  info.value = ''
  bits.value = 0
  confirm.value = ''
}

</script>

<template>
  <div class="auth" data-test="auth">
    <h2 class="halo">{{ { login: 'Connexion', register: 'Créer un compte', forgot: 'Mot de passe oublié', reset: 'Nouveau mot de passe' }[mode] }}</h2>

    <template v-if="mode === 'login' || mode === 'register'">
      <a v-if="googleEnabled" class="btn btn--ghost google" href="/api/auth/google/start" data-test="google">Continuer avec Google</a>
      <p v-else class="google-off halo" data-test="google-off">Google : pas encore disponible.</p>
      <p class="or halo">ou avec une adresse e-mail</p>
    </template>
    <p v-else-if="mode === 'forgot'" class="or halo">Indique l'adresse de ton compte : tu recevras un lien pour choisir un nouveau mot de passe.</p>

    <p v-if="info" class="ok" data-test="info">{{ info }}</p>

    <form v-else @submit.prevent="submit" data-test="auth-form">
      <input v-if="mode === 'register'" class="field" v-model="name" placeholder="Pseudo" autocomplete="nickname" data-test="name" />
      <input v-if="mode !== 'reset'" class="field" v-model="email" type="email" placeholder="E-mail" autocomplete="email" data-test="email" />
      <div v-if="mode !== 'forgot'" class="pw">
        <input class="field" v-model="password" :type="visible ? 'text' : 'password'" :placeholder="mode === 'reset' ? 'Nouveau mot de passe' : 'Mot de passe'" :autocomplete="mode === 'login' ? 'current-password' : 'new-password'" data-test="password" />
        <button type="button" class="eye" :aria-pressed="visible" data-test="show-password" @click="visible = !visible">{{ visible ? 'Masquer' : 'Afficher' }}</button>
      </div>
      <PasswordMeter v-if="needsStrong" :bits="bits" />
      <input v-if="needsStrong" class="field" v-model="confirm" :type="visible ? 'text' : 'password'" placeholder="Confirme le mot de passe" autocomplete="new-password" data-test="confirm" />
      <p v-if="mismatch" class="err" data-test="mismatch">Les deux mots de passe ne sont pas identiques.</p>
      <p v-if="error" class="err" data-test="error">{{ error }}</p>
      <button type="submit" class="btn" :disabled="!canSubmit" data-test="submit">
        {{ { login: 'Se connecter', register: 'Créer mon compte', forgot: 'Envoyer le lien', reset: 'Changer le mot de passe' }[mode] }}
      </button>
    </form>

    <button v-if="mode === 'login'" type="button" class="link" data-test="forgot" @click="open('forgot')">Mot de passe oublié ?</button>
    <button v-if="mode === 'login' || mode === 'register'" type="button" class="btn btn--ghost btn--small" data-test="switch" @click="open(mode === 'login' ? 'register' : 'login')">
      {{ mode === 'login' ? 'Pas de compte ? Créer un compte' : 'Déjà un compte ? Se connecter' }}
    </button>
    <button v-else type="button" class="btn btn--ghost btn--small" data-test="back" @click="open('login')">Retour à la connexion</button>
    <p v-if="mode === 'register'" class="legal-note halo">
      En créant un compte, tu acceptes la <button type="button" class="link" data-test="legal-link" @click="go('legal')">politique de confidentialité</button>.
    </p>
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
.google {
  text-align: center;
  text-decoration: none;
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
.pw {
  position: relative;
}
.pw .field {
  width: 100%;
  padding-right: 5.2rem;
}
.eye {
  position: absolute;
  top: 50%;
  right: 0.5rem;
  transform: translateY(-50%);
  border: 0;
  background: none;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--blue);
  cursor: pointer;
}
form .btn,
.auth > .btn {
  justify-self: center;
}
.link {
  justify-self: center;
  border: 0;
  background: none;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 700;
  color: #1d4ed8;
  text-decoration: underline;
  cursor: pointer;
  padding: 0;
}
.legal-note {
  font-size: 0.8rem;
}
.field {
  box-shadow: var(--shadow);
  border-color: #fff;
}
</style>
