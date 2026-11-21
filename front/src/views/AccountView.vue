<script setup lang="ts">
import { computed, inject, nextTick, onUnmounted, ref, watch } from 'vue'
import AuthPanel from '../components/AuthPanel.vue'
import MyTrain from '../components/MyTrain.vue'
import PasswordMeter from '../components/PasswordMeter.vue'
import Avatar from '../components/Avatar.vue'
import { AVATARS, avatarOf } from '../avatars'
import { avatars, buyAvatar, changePseudo, pseudoPrompt, loadAvatars, selectAvatar, user, logout, deleteAccount, notice, resetToken, changeEmail, changePassword, forgotPassword, estimateBits, MIN_BITS, setLeaderboard, fetchExport, importFile } from '../auth'

const go = inject<(view: string) => void>('go', () => undefined)
const openMachine = inject<() => void>('openMachine', () => undefined)

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

// Compte créé par Google : pas de mot de passe tant qu'on n'en a pas défini un (par un lien envoyé à l'adresse du compte).
const googleOnly = computed(() => user.value?.localLogin === false)
const linkMsg = ref<{ ok: boolean; text: string } | null>(null)
async function sendSetPasswordLink(): Promise<void> {
  if (busy.value || !user.value) return
  busy.value = true
  const r = await forgotPassword(user.value.email)
  busy.value = false
  linkMsg.value = { ok: r.ok, text: r.ok ? 'Un lien vient d\'être envoyé à ton adresse e-mail (valable 1 h).' : r.error }
}

// Changer de mot de passe : l'ancien est redemandé ; même seuil de robustesse que l'inscription (le serveur recalcule).
const pwOpen = ref(false)
const pwCurrent = ref('')
const pwNew = ref('')
const pwConfirm = ref('')
const pwBits = ref(0)
const pwMsg = ref<{ ok: boolean; text: string } | null>(null)
let pwSeq = 0
watch(pwNew, async (v) => {
  const mine = ++pwSeq
  const b = await estimateBits(v, [user.value?.name ?? '', user.value?.email ?? '', (user.value?.email ?? '').split('@')[0]])
  if (mine === pwSeq) pwBits.value = b // ignore une réponse arrivée après une frappe plus récente
})
const pwMismatch = computed(() => pwConfirm.value !== '' && pwConfirm.value !== pwNew.value)
const pwReady = computed(() => !busy.value && !!pwCurrent.value && pwBits.value >= MIN_BITS && pwConfirm.value === pwNew.value)
function pwReset(): void {
  pwOpen.value = false
  pwCurrent.value = pwNew.value = pwConfirm.value = ''
  pwBits.value = 0
}
async function submitPassword(): Promise<void> {
  if (!pwReady.value) return
  busy.value = true
  const r = await changePassword(pwCurrent.value, pwNew.value)
  busy.value = false
  pwMsg.value = { ok: r.ok, text: r.ok ? (r.message ?? '') : r.error }
  if (r.ok) pwReset()
}

// Avatars : la même liste pour tout le monde, sans libellé. Les gratuits et ceux déjà achetés se choisissent d'un clic ;
// un avatar payant ouvre une confirmation avec son prix (le serveur fait foi : prix, possession, solde).
// Pseudo : un crayon à côté, un petit champ pour le changer.
const editingPseudo = ref(false)
const pseudoDraft = ref('')
const pseudoMsg = ref('')
function editPseudo(): void {
  pseudoDraft.value = user.value?.name ?? ''
  pseudoMsg.value = ''
  editingPseudo.value = true
}
async function savePseudo(): Promise<void> {
  const v = pseudoDraft.value.trim()
  if (!v || v === user.value?.name) {
    editingPseudo.value = false
    return
  }
  busy.value = true
  const r = await changePseudo(v)
  busy.value = false
  if (r.ok) editingPseudo.value = false
  else pseudoMsg.value = r.error
}
// Premier passage par Google : le pseudo a été tiré au hasard, on propose tout de suite d'en choisir un (champ ouvert, texte sélectionné).
const welcome = ref(false)
watch(
  () => pseudoPrompt.value && !!user.value,
  async (v) => {
    if (!v) return
    pseudoPrompt.value = false
    welcome.value = true
    editPseudo()
    await nextTick()
    const el = document.getElementById('pseudo-input') as HTMLInputElement | null
    el?.focus()
    el?.select()
  },
  { immediate: true },
)
watch(editingPseudo, (v) => v || (welcome.value = false))
const picker = ref(false) // la feuille des avatars : fermée par défaut (la page Compte reste courte, surtout sur téléphone)
const buying = ref<string | null>(null) // avatar payant en cours de confirmation
const onEsc = (e: KeyboardEvent): void => {
  if (e.key === 'Escape') closePicker()
}
function openPicker(): void {
  avatarMsg.value = null
  buying.value = null
  picker.value = true
  window.addEventListener('keydown', onEsc)
}
function closePicker(): void {
  picker.value = false
  buying.value = null
  window.removeEventListener('keydown', onEsc)
}
onUnmounted(() => window.removeEventListener('keydown', onEsc))
const avatarMsg = ref<{ ok: boolean; text: string } | null>(null)
const coins = computed(() => avatars.value?.coins ?? 0)
const owns = (id: string): boolean => (avatarOf(id)?.price ?? 1) === 0 || (avatars.value?.owned.includes(id) ?? false)
const missing = computed(() => (buying.value ? Math.max(0, (avatarOf(buying.value)?.price ?? 0) - coins.value) : 0))
void loadAvatars()
async function pick(id: string): Promise<void> {
  avatarMsg.value = null
  if (!owns(id)) {
    buying.value = buying.value === id ? null : id
    return
  }
  buying.value = null
  const r = await selectAvatar(id)
  if (r.ok) closePicker()
  else avatarMsg.value = { ok: false, text: r.error }
}
async function confirmBuy(): Promise<void> {
  const id = buying.value
  if (!id || busy.value || missing.value > 0) return
  busy.value = true
  const r = await buyAvatar(id)
  busy.value = false
  if (r.ok) {
    await selectAvatar(id) // on l'adopte tout de suite
    closePicker()
    return
  }
  avatarMsg.value = { ok: false, text: r.error }
}

// Classement : apparaître ou non (seuls le pseudo et l'avatar sont montrés).
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
    <template v-if="!user || resetToken">
      <AuthPanel />
      <MyTrain v-if="!resetToken" @machine="openMachine()" />
    </template>
    <div v-else class="me">
      <!-- profil -->
      <div class="card profile">
        <button type="button" class="me-btn" data-test="avatar-change" aria-label="Changer d'avatar" :aria-expanded="picker" @click="openPicker">
          <Avatar :id="user.avatar" class="me-avatar" data-test="my-avatar" />
          <span class="edit" aria-hidden="true">✎</span>
        </button>
        <form v-if="editingPseudo" class="pseudo-edit" data-test="pseudo-form" @submit.prevent="savePseudo">
          <input id="pseudo-input" v-model="pseudoDraft" class="field" maxlength="24" autocomplete="nickname" aria-label="Nouveau pseudo" data-test="pseudo-input" />
          <div class="row">
            <button type="button" class="btn btn--ghost btn--small" data-test="pseudo-cancel" @click="editingPseudo = false">Annuler</button>
            <button type="submit" class="btn btn--small" :disabled="busy" data-test="pseudo-save">Enregistrer</button>
          </div>
          <p v-if="welcome && !pseudoMsg" class="hint" data-test="pseudo-welcome">Bienvenue ! Google ne donne pas de pseudo : on t'en a tiré un au hasard. Choisis le tien.</p>
          <p v-if="pseudoMsg" class="err" data-test="pseudo-msg">{{ pseudoMsg }}</p>
        </form>
        <h2 v-else class="pseudo-line">
          <span data-test="pseudo">{{ user.name }}</span>
          <button type="button" class="pen" data-test="pseudo-edit" aria-label="Changer de pseudo" title="Changer de pseudo" @click="editPseudo">✎</button>
        </h2>
        <p class="mail">{{ user.email }}</p>
        <p class="tag">Compte {{ user.provider === 'google' ? 'Google' : 'e-mail' }}</p>
        <button type="button" class="btn btn--ghost btn--small" data-test="logout" @click="logout">Se déconnecter</button>
      </div>

      <!-- Feuille des avatars : sur téléphone elle monte du bas de l'écran (liste qui défile), sur grand écran elle est centrée -->
      <div v-if="picker" class="sheet-back" data-test="avatar-sheet" @click.self="closePicker">
        <section class="sheet" role="dialog" aria-modal="true" aria-label="Choisir un avatar">
          <header class="sheet-head">
            <h3>Choisis ton avatar</h3>
            <p class="coins" data-test="avatar-coins">{{ coins }} pièces</p>
            <button type="button" class="close" data-test="avatar-close" aria-label="Fermer" @click="closePicker">✕</button>
          </header>
          <div class="sheet-body" data-test="avatar-block">
            <div class="avatars" role="group" aria-label="Avatars">
              <button
                v-for="a in AVATARS"
                :key="a.id"
                type="button"
                class="av"
                :class="{ on: user.avatar === a.id, locked: !owns(a.id), asking: buying === a.id }"
                :aria-pressed="user.avatar === a.id"
                :aria-label="owns(a.id) ? 'Avatar' : 'Avatar à débloquer, ' + a.price + ' pièces'"
                :data-test="'avatar-' + a.id"
                @click="pick(a.id)"
              >
                <Avatar :id="a.id" />
                <span v-if="!owns(a.id)" class="price" data-test="avatar-price">{{ a.price }}</span>
              </button>
            </div>
          </div>
          <footer v-if="buying || avatarMsg" class="sheet-foot">
            <div v-if="buying" class="buy" data-test="avatar-buy">
              <Avatar :id="buying" class="buy-pic" />
              <div class="buy-text">
                <p v-if="missing > 0" class="hint" data-test="avatar-missing">Il te manque {{ missing }} pièce{{ missing > 1 ? 's' : '' }}.</p>
                <p v-else class="hint">{{ avatarOf(buying)?.price }} pièces, il t'en restera {{ coins - (avatarOf(buying)?.price ?? 0) }}.</p>
                <div class="row">
                  <button type="button" class="btn btn--ghost btn--small" data-test="avatar-cancel" @click="buying = null">Annuler</button>
                  <button type="button" class="btn btn--small" :disabled="busy || missing > 0" data-test="avatar-confirm" @click="confirmBuy">Débloquer</button>
                </div>
              </div>
            </div>
            <p v-if="avatarMsg" :class="avatarMsg.ok ? 'ok' : 'err'" data-test="avatar-msg">{{ avatarMsg.text }}</p>
          </footer>
        </section>
      </div>

      <MyTrain @machine="openMachine()" />

      <section class="card" data-test="email-block">
        <h3>Adresse e-mail</h3>
        <p v-if="googleOnly" class="hint" data-test="email-google">Pour changer d'adresse, définis d'abord un mot de passe (rubrique « Mot de passe »).</p>
        <button v-else-if="!changing" type="button" class="btn btn--ghost btn--small" data-test="email-open" @click="changing = true">Changer mon adresse e-mail</button>
        <form v-else-if="changing" class="confirm" data-test="email-form" @submit.prevent="submitEmail">
          <p class="hint">Un lien sera envoyé à la nouvelle adresse. Ton adresse actuelle ne change qu'après ce clic.</p>
          <input v-model="newEmail" class="field" type="email" placeholder="Nouvelle adresse e-mail" autocomplete="email" data-test="email-new" />
          <input v-model="emailPassword" class="field" type="password" placeholder="Ton mot de passe" autocomplete="current-password" data-test="email-password" />
          <div class="row">
            <button type="button" class="btn btn--ghost btn--small" data-test="email-cancel" @click="changing = false">Annuler</button>
            <button type="submit" class="btn btn--small" :disabled="busy || !newEmail || !emailPassword" data-test="email-send">Envoyer le lien</button>
          </div>
        </form>
        <p v-if="emailMsg" :class="emailMsg.ok ? 'ok' : 'err'" data-test="email-msg">{{ emailMsg.text }}</p>
      </section>

      <section class="card" data-test="password-block">
        <h3>Mot de passe</h3>
        <template v-if="googleOnly">
          <p class="hint" data-test="password-google">Tu te connectes avec Google : ton compte n'a pas de mot de passe. Pour changer d'adresse ou supprimer ton compte, définis-en un : un lien est envoyé à {{ user.email }}.</p>
          <button type="button" class="btn btn--ghost btn--small" :disabled="busy" data-test="password-link" @click="sendSetPasswordLink">Définir un mot de passe</button>
          <p v-if="linkMsg" :class="linkMsg.ok ? 'ok' : 'err'" data-test="password-link-msg">{{ linkMsg.text }}</p>
        </template>
        <template v-else>
          <button v-if="!pwOpen" type="button" class="btn btn--ghost btn--small" data-test="password-open" @click="pwOpen = true">Changer mon mot de passe</button>
          <form v-else class="confirm" data-test="password-form" @submit.prevent="submitPassword">
            <p class="hint">Les autres appareils seront déconnectés.</p>
            <input v-model="pwCurrent" class="field" type="password" placeholder="Mot de passe actuel" autocomplete="current-password" data-test="password-current" />
            <input v-model="pwNew" class="field" type="password" placeholder="Nouveau mot de passe" autocomplete="new-password" data-test="password-new" />
            <PasswordMeter :bits="pwBits" />
            <input v-model="pwConfirm" class="field" type="password" placeholder="Confirme le nouveau mot de passe" autocomplete="new-password" data-test="password-confirm" />
            <p v-if="pwMismatch" class="err" data-test="password-mismatch">Les deux mots de passe ne sont pas identiques.</p>
            <div class="row">
              <button type="button" class="btn btn--ghost btn--small" data-test="password-cancel" @click="pwReset">Annuler</button>
              <button type="submit" class="btn btn--small" :disabled="!pwReady" data-test="password-send">Changer le mot de passe</button>
            </div>
          </form>
        </template>
        <p v-if="pwMsg" :class="pwMsg.ok ? 'ok' : 'err'" data-test="password-msg">{{ pwMsg.text }}</p>
      </section>

      <section class="card">
        <h3>Classement</h3>
        <label class="check">
          <input type="checkbox" :checked="user.leaderboard !== false" data-test="leaderboard-toggle" @change="toggleLeaderboard" />
          <span>Apparaître dans le classement</span>
        </label>
        <p class="hint">Seuls ton pseudo et ton avatar sont montrés.</p>
      </section>

      <section class="card" data-test="data-block">
        <h3>Mes données</h3>
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

      <section class="card danger">
        <h3>Supprimer le compte</h3>
        <p v-if="googleOnly" class="hint" data-test="delete-google">Pour supprimer ton compte, définis d'abord un mot de passe (rubrique « Mot de passe »).</p>
        <button v-else-if="!confirming" type="button" class="btn btn--ghost btn--small stop-ghost" data-test="delete-open" @click="confirming = true">Supprimer mon compte</button>
        <form v-else-if="confirming" class="confirm" data-test="delete-form" @submit.prevent="remove">
          <p class="hint">Ton compte, ta progression, tes pièces et tes aides seront effacés définitivement. Il n'y a pas de retour possible.</p>
          <input v-model="password" class="field" type="password" placeholder="Ton mot de passe" autocomplete="current-password" data-test="delete-password" />
          <p v-if="error" class="err" data-test="delete-error">{{ error }}</p>
          <div class="row">
            <button type="button" class="btn btn--ghost btn--small" data-test="delete-cancel" @click="cancel">Annuler</button>
            <button type="submit" class="btn btn--small stop" :disabled="busy || !password" data-test="delete-confirm">Supprimer définitivement</button>
          </div>
        </form>
      </section>
    </div>
  </section>
</template>

<style scoped>
/* Chaque rubrique est une carte blanche (même langage que l'accueil et le tutoriel). */
.me {
  width: min(26rem, 100%);
  display: grid;
  gap: 0.8rem;
}
.card {
  display: grid;
  gap: 0.6rem;
  justify-items: center;
  padding: 0.9rem 1.1rem 1rem;
  border: 3px solid #fff;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: var(--shadow);
  text-align: center;
  color: #374151;
}
h3 {
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}
.profile {
  gap: 0.25rem;
  padding-top: 1.1rem;
}
.me-btn {
  position: relative;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: none;
  cursor: pointer;
}
.me-btn .edit {
  position: absolute;
  right: -0.2rem;
  bottom: -0.1rem;
  display: grid;
  place-items: center;
  width: 1.6rem;
  height: 1.6rem;
  border: 2px solid #fff;
  border-radius: 50%;
  background: #2563eb;
  color: #fff;
  font-size: 0.8rem;
  box-shadow: var(--shadow);
}
.me-avatar {
  --avatar: 4.2rem;
}
/* La feuille des avatars */
.sheet-back {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: flex-end; /* téléphone : collée en bas */
  justify-content: center;
  background: rgba(15, 23, 42, 0.5);
}
.sheet {
  display: flex;
  flex-direction: column;
  width: min(100%, 30rem);
  max-height: 85dvh;
  border-radius: 22px 22px 0 0;
  background: #fff;
  box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.3);
  padding-bottom: env(safe-area-inset-bottom);
}
@media (min-width: 640px) {
  .sheet-back {
    align-items: center;
  }
  .sheet {
    max-height: min(85dvh, 36rem);
    border-radius: 22px;
  }
}
.sheet-head {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 0.1rem;
  padding: 0.9rem 3rem 0.5rem;
}
.close {
  position: absolute;
  top: 0.6rem;
  right: 0.6rem;
  width: 2.4rem;
  height: 2.4rem; /* assez grand pour le doigt */
  border: 0;
  border-radius: 50%;
  background: #f1f5f9;
  color: #374151;
  font-size: 1rem;
  cursor: pointer;
}
.sheet-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0.3rem 0.9rem 0.9rem;
}
.sheet-foot {
  padding: 0.6rem 0.9rem 0.8rem;
  border-top: 1px solid #e5e7eb;
  background: #fffbeb;
}
.pseudo-line {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}
.pen {
  width: 2rem;
  height: 2rem;
  border: 0;
  border-radius: 50%;
  background: #eff6ff;
  color: #2563eb;
  font-size: 0.95rem;
  cursor: pointer;
}
.pseudo-edit {
  display: grid;
  gap: 0.5rem;
  justify-items: center;
  width: 100%;
}
.coins {
  font-size: 0.85rem;
  font-weight: 700;
  color: #92400e;
}
.avatars {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(3.4rem, 1fr));
  gap: 0.5rem;
  width: 100%;
}
.av {
  position: relative;
  display: grid;
  place-items: center;
  padding: 0.25rem;
  border: 3px solid transparent;
  border-radius: 16px;
  background: none;
  cursor: pointer;
}
.av .avatar-pic {
  --avatar: 2.7rem;
}
.av.on {
  border-color: #2563eb;
  background: #eff6ff;
}
.av.locked .avatar-pic {
  opacity: 0.55;
  filter: grayscale(0.5);
}
.av.asking {
  border-color: #f59e0b;
}
.price {
  position: absolute;
  right: -0.1rem;
  bottom: -0.1rem;
  min-width: 1.7rem;
  padding: 0 0.35rem;
  border-radius: 999px;
  background: #1f2937;
  color: #fff;
  font-size: 0.7rem;
  font-weight: 800;
  line-height: 1.2rem;
}
.buy {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}
.buy-text {
  display: grid;
  gap: 0.4rem;
}
.buy-pic {
  --avatar: 3.4rem;
}
h2 {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--ink);
  overflow-wrap: anywhere;
}
.mail {
  font-size: 0.95rem;
  overflow-wrap: anywhere;
}
.tag {
  margin-bottom: 0.5rem;
  padding: 0.1rem 0.7rem;
  border-radius: 999px;
  background: #eff6ff;
  color: var(--blue-dark);
  font-size: 0.78rem;
  font-weight: 700;
}
.check {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-weight: 700;
  color: var(--ink);
  text-align: left;
}
.check input {
  width: 1.2rem;
  height: 1.2rem;
}
.hint {
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.4;
  color: var(--muted);
}
.ok {
  margin: 0;
  font-weight: 700;
  color: #15803d;
  font-size: 0.88rem;
}
.err {
  margin: 0;
  color: #b91c1c;
  font-weight: 600;
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
.confirm {
  width: 100%;
  display: grid;
  gap: 0.6rem;
}
.row {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.stop-ghost {
  color: #b91c1c;
  border-color: #fecaca;
}
.stop {
  background: #dc2626;
  box-shadow: 0 6px 16px rgba(220, 38, 38, 0.3);
}
.stop:hover:not(:disabled) {
  background: #b91c1c;
}
</style>
