<script setup lang="ts">
import { inject, ref } from 'vue'
import AuthPanel from '../components/AuthPanel.vue'
import { user, logout, deleteAccount, notice, resetToken, changeEmail, setLeaderboard, fetchExport, importFile } from '../auth'

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
// Changer d'adresse e-mail : mot de passe demandé ; un lien part vers la NOUVELLE adresse.
const changing = ref(false)
const newEmail = ref('')
const emailPassword = ref('')
const emailMsg = ref<{ ok: boolean; text: string } | null>(null)
async function submitEmail(): Promise<void> {
  if (busy.value || !newEmail.value || !emailPassword.value) return
  busy.value = true
  const r = await changeEmail(newEmail.value, emailPassword.value)
  busy.value = false
  emailMsg.value = { ok: r.ok, text: r.ok ? (r.message ?? '') : r.error }
  if (r.ok) {
    changing.value = false
    newEmail.value = ''
    emailPassword.value = ''
  }
}

// Classement : apparaître ou non (seul le pseudo est montré).
async function toggleLeaderboard(e: Event): Promise<void> {
  const box = e.target as HTMLInputElement
  const ok = await setLeaderboard(box.checked)
  if (!ok) box.checked = !box.checked
}

// Mes données : un fichier signé par le serveur, qu'on peut réimporter (une seule fois, sur n'importe quel compte).
const dataMsg = ref<{ ok: boolean; text: string } | null>(null)
async function exportMine(): Promise<void> {
  const data = await fetchExport()
  if (!data) {
    dataMsg.value = { ok: false, text: 'Export impossible : vérifie ta connexion.' }
    return
  }
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `train-tracks-${user.value?.name ?? 'donnees'}.json`
  a.click()
  URL.revokeObjectURL(url)
  dataMsg.value = { ok: true, text: 'Fichier téléchargé. Garde-le : il permet de retrouver ta progression.' }
}
// File.text() n'existe pas partout (anciens navigateurs, tests) : repli sur FileReader.
const readText = (file: File): Promise<string> =>
  typeof file.text === 'function'
    ? file.text()
    : new Promise((resolve, reject) => {
        const fr = new FileReader()
        fr.onload = () => resolve(String(fr.result))
        fr.onerror = () => reject(fr.error)
        fr.readAsText(file)
      })
async function importMine(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  let parsed: unknown
  try {
    parsed = JSON.parse(await readText(file))
  } catch {
    dataMsg.value = { ok: false, text: 'Fichier invalide : choisis un export Train Tracks.' }
    return
  }
  const r = await importFile(parsed)
  dataMsg.value = r.ok
    ? { ok: true, text: `${r.levels} niveau${r.levels > 1 ? 'x' : ''} et ${r.daily} puzzle${r.daily > 1 ? 's' : ''} du jour importés. Les pièces et les aides ne sont pas copiées.` }
    : { ok: false, text: r.error }
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

      <section class="block" data-test="email-block">
        <button v-if="!changing" type="button" class="link" data-test="email-open" @click="changing = true">Changer mon adresse e-mail</button>
        <form v-else class="confirm" data-test="email-form" @submit.prevent="submitEmail">
          <p>Un lien sera envoyé à la nouvelle adresse. Ton adresse actuelle ne change qu'après ce clic.</p>
          <input v-model="newEmail" class="field" type="email" placeholder="Nouvelle adresse e-mail" autocomplete="email" data-test="email-new" />
          <input v-model="emailPassword" class="field" type="password" placeholder="Ton mot de passe" autocomplete="current-password" data-test="email-password" />
          <div class="row">
            <button type="button" class="btn btn--ghost btn--small" data-test="email-cancel" @click="changing = false">Annuler</button>
            <button type="submit" class="btn btn--small" :disabled="busy || !newEmail || !emailPassword" data-test="email-send">Envoyer le lien</button>
          </div>
        </form>
        <p v-if="emailMsg" :class="emailMsg.ok ? 'ok' : 'err'" data-test="email-msg">{{ emailMsg.text }}</p>
      </section>

      <section class="block">
        <label class="check">
          <input type="checkbox" :checked="user.leaderboard !== false" data-test="leaderboard-toggle" @change="toggleLeaderboard" />
          <span>Apparaître dans le classement <small>(seul le pseudo est montré)</small></span>
        </label>
      </section>

      <section class="block" data-test="data-block">
        <p class="note">Mes données</p>
        <div class="row">
          <button type="button" class="btn btn--ghost btn--small" data-test="export" @click="exportMine">Exporter</button>
          <label class="btn btn--ghost btn--small file" data-test="import-label">
            Importer
            <input type="file" accept="application/json,.json" data-test="import" @change="importMine" />
          </label>
        </div>
        <p class="hint">L'export est un fichier signé : ta progression et ton puzzle du jour. Un fichier ne s'importe qu'une fois ; les pièces et aides ne sont pas copiées.</p>
        <p v-if="dataMsg" :class="dataMsg.ok ? 'ok' : 'err'" data-test="data-msg">{{ dataMsg.text }}</p>
      </section>

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
.block {
  width: min(20rem, 100%);
  display: grid;
  gap: 0.45rem;
  justify-items: center;
  margin-top: 0.8rem;
}
.check {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  text-align: left;
}
.check small {
  font-weight: 500;
  color: #6b7280;
}
.hint {
  margin: 0;
  font-size: 0.78rem;
  color: #6b7280;
}
.ok {
  margin: 0;
  font-weight: 700;
  color: #15803d;
  font-size: 0.88rem;
}
.file {
  position: relative;
  cursor: pointer;
}
.file input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
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
