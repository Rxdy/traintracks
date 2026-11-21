// Comptes joueur : tout passe par le serveur (/api). Le navigateur ne garde ni mot de passe ni compte :
// la session est un cookie HttpOnly que le JavaScript ne peut pas lire.
import { ref } from 'vue'
import { api } from './api'
import { DEFAULT_AVATAR } from './avatars'

export interface User {
  name: string
  email: string
  provider: 'local' | 'google'
  leaderboard?: boolean // apparaît dans le classement (oui si non précisé)
  avatar?: string // identifiant de la liste fixe (avatars/)
  localLogin?: boolean // peut se connecter par mot de passe (non si le compte vient de Google et n'en a pas défini) ; oui si non précisé
}

export type AuthResult = { ok: true; message?: string } | { ok: false; error: string }

// Seuil de robustesse (en bits) ; le serveur recalcule et fait foi.
export const MIN_BITS = 36

export const user = ref<User | null>(null)
// Message à afficher une fois (ex. résultat du lien de confirmation d'e-mail).
export const notice = ref('')

const OFFLINE = 'Serveur injoignable : vérifie ta connexion.'

interface ServerUser {
  pseudo: string
  email: string
  provider: 'local' | 'google'
  leaderboard?: boolean
  avatar?: string
  localLogin?: boolean
}
const toUser = (u: ServerUser): User => ({ name: u.pseudo, email: u.email, provider: u.provider, leaderboard: u.leaderboard !== false, avatar: u.avatar ?? DEFAULT_AVATAR, localLogin: u.localLogin !== false })

// Au démarrage : le cookie de session dit-il qui je suis ?
export async function refreshSession(): Promise<void> {
  const r = await api('GET', '/api/me')
  user.value = r?.status === 200 ? toUser((r.data as { user: ServerUser }).user) : null
}

// Connexion avec Google : le serveur dit si elle est configurée (sinon le bouton n'apparaît pas).
export const googleEnabled = ref(false)
export async function loadProviders(): Promise<void> {
  const r = await api('GET', '/api/auth/providers')
  googleEnabled.value = r?.status === 200 && r.data.google === true
}

// Premier passage par Google : le compte vient d'être créé avec un pseudo tiré au hasard (?bienvenue=1) ; l'écran Compte
// s'ouvre avec le champ du pseudo, pour que le joueur choisisse le sien.
export const pseudoPrompt = ref(false)
export function welcomeFromUrl(search = window.location.search): void {
  if (new URLSearchParams(search).get('bienvenue') !== '1') return
  pseudoPrompt.value = true
  history.replaceState(null, '', window.location.pathname)
}

// Retour de Google en échec : le serveur revient sur le site avec ?auth_error=… (jamais de détail technique).
export function authErrorFromUrl(search = window.location.search): void {
  const code = new URLSearchParams(search).get('auth_error')
  if (!code) return
  notice.value =
    code === 'google_email'
      ? 'Google n\'a pas confirmé ton adresse e-mail : connexion impossible avec ce compte.'
      : 'La connexion avec Google a échoué. Réessaie.'
  history.replaceState(null, '', window.location.pathname)
}

// Lien reçu par e-mail : https://site/?confirm=JETON
export async function confirmFromUrl(search = window.location.search): Promise<void> {
  const token = new URLSearchParams(search).get('confirm')
  if (!token) return
  const r = await api('POST', '/api/auth/confirm', { token })
  notice.value = r?.status === 200 ? 'Adresse confirmée ! Tu peux te connecter.' : 'Lien de confirmation invalide ou expiré.'
  history.replaceState(null, '', window.location.pathname)
}

// Lien reçu par e-mail : https://site/?reset=JETON → l'écran Compte propose de choisir un nouveau mot de passe.
export const resetToken = ref('')
export function resetFromUrl(search = window.location.search): void {
  const token = new URLSearchParams(search).get('reset')
  if (!token) return
  resetToken.value = token
  history.replaceState(null, '', window.location.pathname)
}

// Robustesse en bits, estimée dans le navigateur pour l'indicateur (chargée à la demande : la bibliothèque est
// lourde). Même calcul que le serveur, qui recalcule de toute façon à l'inscription.
export async function estimateBits(password: string, inputs: string[] = []): Promise<number> {
  if (!password) return 0
  const mod = (await import('zxcvbn')) as unknown as { default?: typeof import('zxcvbn') }
  const zxcvbn = mod.default ?? (mod as unknown as typeof import('zxcvbn'))
  const r = zxcvbn(password.slice(0, 100), inputs.filter(Boolean))
  return Math.round(r.guesses_log10 * Math.log2(10) * 10) / 10
}

const minutes = (s: number) => Math.max(1, Math.ceil(s / 60))

export async function register(name: string, email: string, password: string): Promise<AuthResult> {
  const r = await api('POST', '/api/auth/register', { pseudo: name, email, password })
  if (!r) return { ok: false, error: OFFLINE }
  if (r.status === 201) return { ok: true, message: 'Vérifie ta boîte mail : un lien te permet de confirmer ton adresse (valable 24 h).' }
  if (r.status === 409) {
    if (r.data.error === 'email_taken') return { ok: false, error: 'Cette adresse e-mail a déjà un compte. Connecte-toi, ou utilise « Mot de passe oublié ».' }
    return { ok: false, error: 'Ce pseudo est déjà pris.' }
  }
  if (r.status === 422) return { ok: false, error: 'Mot de passe trop faible : allonge-le ou mélange davantage de caractères.' }
  if (r.data.field === 'pseudo') return { ok: false, error: 'Pseudo invalide : 2 à 24 caractères (lettres, chiffres, . _ -).' }
  if (r.data.field === 'email') return { ok: false, error: 'Adresse e-mail invalide.' }
  return { ok: false, error: 'Inscription impossible.' }
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const r = await api('POST', '/api/auth/login', { email, password })
  if (!r) return { ok: false, error: OFFLINE }
  if (r.status === 200) {
    user.value = toUser((r.data as { user: ServerUser }).user)
    return { ok: true }
  }
  if (r.status === 429) return { ok: false, error: `Trop d'essais : réessaie dans ${minutes(r.retryAfter)} min.` }
  if (r.status === 403) return { ok: false, error: 'Confirme d\'abord ton adresse e-mail (lien reçu par mail).' }
  return { ok: false, error: 'E-mail ou mot de passe incorrect.' }
}

// Mot de passe oublié : la réponse du serveur est la même que l'adresse ait un compte ou non.
export async function forgotPassword(email: string): Promise<AuthResult> {
  const r = await api('POST', '/api/auth/forgot', { email })
  if (!r) return { ok: false, error: OFFLINE }
  return { ok: true, message: "Si un compte existe pour cette adresse, un lien vient d'être envoyé (valable 1 h)." }
}

export async function resetPassword(token: string, password: string): Promise<AuthResult> {
  const r = await api('POST', '/api/auth/reset', { token, password })
  if (!r) return { ok: false, error: OFFLINE }
  if (r.status === 200) {
    resetToken.value = ''
    return { ok: true, message: 'Mot de passe modifié. Tu peux te connecter.' }
  }
  if (r.status === 422) return { ok: false, error: 'Mot de passe trop faible : allonge-le ou mélange davantage de caractères.' }
  return { ok: false, error: 'Lien invalide ou expiré. Demande un nouveau lien.' }
}

// Droit à l'effacement : supprime le compte et toutes ses données.
export async function deleteAccount(password: string): Promise<AuthResult> {
  const r = await api('POST', '/api/auth/delete-account', { password })
  if (!r) return { ok: false, error: OFFLINE }
  if (r.status === 200) {
    user.value = null
    return { ok: true, message: 'Compte supprimé.' }
  }
  if (r.status === 429) return { ok: false, error: `Trop d'essais : réessaie dans ${minutes(r.retryAfter)} min.` }
  return { ok: false, error: 'Mot de passe incorrect.' }
}

export function logout(): void {
  user.value = null
  void api('POST', '/api/auth/logout', {})
}

// --- Changer d'adresse e-mail : un lien part vers la NOUVELLE boîte ; l'adresse ne change qu'une fois confirmée ---
export async function changeEmail(newEmail: string, password: string): Promise<AuthResult> {
  const r = await api('POST', '/api/account/email', { email: newEmail, password })
  if (!r) return { ok: false, error: OFFLINE }
  if (r.status === 200) return { ok: true, message: 'Un lien vient d\'être envoyé à la nouvelle adresse (valable 1 h). Ton adresse actuelle ne change qu\'après ce clic.' }
  if (r.status === 429) return { ok: false, error: `Trop d'essais : réessaie dans ${minutes(r.retryAfter)} min.` }
  if (r.status === 403) return { ok: false, error: 'Mot de passe incorrect.' }
  if (r.status === 409) return { ok: false, error: 'Cette adresse e-mail a déjà un compte.' }
  if (r.data.error === 'same') return { ok: false, error: 'C\'est déjà l\'adresse de ton compte.' }
  if (r.data.error === 'invalid_email') return { ok: false, error: 'Adresse e-mail invalide.' }
  return { ok: false, error: 'Changement impossible.' }
}

// --- Changer de mot de passe, connecté : l'ancien est redemandé ; les autres appareils sont déconnectés ---
export async function changePassword(currentPassword: string, newPassword: string): Promise<AuthResult> {
  const r = await api('POST', '/api/account/password', { currentPassword, newPassword })
  if (!r) return { ok: false, error: OFFLINE }
  if (r.status === 200) return { ok: true, message: 'Mot de passe modifié. Les autres appareils ont été déconnectés.' }
  if (r.status === 429) return { ok: false, error: `Trop d'essais : réessaie dans ${minutes(r.retryAfter)} min.` }
  if (r.status === 403) return { ok: false, error: 'Mot de passe actuel incorrect.' }
  if (r.data.error === 'weak') return { ok: false, error: 'Mot de passe trop faible : allonge-le ou mélange davantage de caractères.' }
  if (r.data.error === 'same') return { ok: false, error: 'Le nouveau mot de passe doit être différent de l\'ancien.' }
  return { ok: false, error: 'Changement impossible.' }
}

// Lien reçu par e-mail : https://site/?email-change=JETON
export async function confirmEmailChangeFromUrl(search = window.location.search): Promise<void> {
  const token = new URLSearchParams(search).get('email-change')
  if (!token) return
  const r = await api('POST', '/api/account/email/confirm', { token })
  notice.value = r?.status === 200 ? 'Nouvelle adresse confirmée.' : r?.status === 409 ? 'Cette adresse est déjà utilisée par un autre compte.' : 'Lien invalide ou expiré.'
  if (r?.status === 200) await refreshSession()
  history.replaceState(null, '', window.location.pathname)
}

// --- Pseudo : modifiable par tous les comptes (ceux créés par Google reçoivent un pseudo au hasard) ---
export async function changePseudo(pseudo: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await api('POST', '/api/account/pseudo', { pseudo })
  if (r?.status === 200) {
    if (user.value) user.value = { ...user.value, name: (r.data as { pseudo: string }).pseudo }
    return { ok: true }
  }
  if (r?.status === 409) return { ok: false, error: 'Ce pseudo est déjà pris.' }
  if (r?.status === 400) return { ok: false, error: '2 à 24 caractères : lettres, chiffres, « _ », « . » ou « - ».' }
  return { ok: false, error: 'Serveur injoignable : vérifie ta connexion.' }
}

// --- Classement : apparaître ou non ---
export async function setLeaderboard(visible: boolean): Promise<boolean> {
  const r = await api('POST', '/api/account/leaderboard', { visible })
  if (r?.status !== 200) return false
  if (user.value) user.value = { ...user.value, leaderboard: visible }
  return true
}

// --- Mes données : export (fichier signé par le serveur) et import ---
export async function fetchExport(): Promise<Record<string, unknown> | null> {
  const r = await api('GET', '/api/account/export')
  return r?.status === 200 ? r.data : null
}
export type ImportOutcome = { ok: true; levels: number; daily: number } | { ok: false; error: string }
export async function importFile(file: unknown): Promise<ImportOutcome> {
  const r = await api('POST', '/api/account/import', file as object)
  if (!r) return { ok: false, error: OFFLINE }
  if (r.status === 200) return { ok: true, levels: Number(r.data.levels ?? 0), daily: Number(r.data.daily ?? 0) }
  if (r.status === 409) return { ok: false, error: 'Ce fichier a déjà été importé : il ne sert qu\'une fois.' }
  if (r.status === 403) return { ok: false, error: 'Fichier modifié ou venant d\'un autre serveur : import refusé.' }
  return { ok: false, error: 'Fichier invalide : choisis un export Train Tracks.' }
}

// --- Avatars : une liste fixe ; les payants s'achètent avec les pièces (le serveur fait foi) ---
export interface AvatarState {
  current: string
  owned: string[] // les avatars payants déjà achetés
  coins: number
}
export const avatars = ref<AvatarState | null>(null)

function takeAvatars(data: Record<string, unknown>): void {
  const st = { current: String(data.current), owned: (data.owned as string[]) ?? [], coins: Number(data.coins ?? 0) }
  avatars.value = st
  if (user.value) user.value = { ...user.value, avatar: st.current }
}

export async function loadAvatars(): Promise<void> {
  const r = await api('GET', '/api/avatars')
  if (r?.status === 200) takeAvatars(r.data)
}

export async function selectAvatar(id: string): Promise<AuthResult> {
  const r = await api('POST', '/api/avatars/select', { id })
  if (!r) return { ok: false, error: OFFLINE }
  if (r.status === 200) {
    takeAvatars(r.data)
    return { ok: true }
  }
  return { ok: false, error: 'Cet avatar n\'est pas encore à toi.' }
}

export async function buyAvatar(id: string): Promise<AuthResult> {
  const r = await api('POST', '/api/avatars/buy', { id })
  if (!r) return { ok: false, error: OFFLINE }
  if (r.status === 200) {
    takeAvatars(r.data)
    return { ok: true }
  }
  if (r.status === 402) return { ok: false, error: 'Pas assez de pièces.' }
  if (r.status === 409) return { ok: false, error: 'Tu as déjà cet avatar.' }
  return { ok: false, error: 'Achat impossible.' }
}
