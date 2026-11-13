// Comptes joueur : tout passe par le serveur (/api). Le navigateur ne garde ni mot de passe ni compte :
// la session est un cookie HttpOnly que le JavaScript ne peut pas lire.
import { ref } from 'vue'
import { api } from './api'

export interface User {
  name: string
  email: string
  provider: 'local' | 'google'
}

export type AuthResult = { ok: true; message?: string } | { ok: false; error: string }

// Seuil de robustesse (en bits) ; le serveur recalcule et fait foi.
export const MIN_BITS = 50

export const user = ref<User | null>(null)
// Message à afficher une fois (ex. résultat du lien de confirmation d'e-mail).
export const notice = ref('')

const OFFLINE = 'Serveur injoignable : vérifie ta connexion.'

interface ServerUser {
  pseudo: string
  email: string
  provider: 'local' | 'google'
}
const toUser = (u: ServerUser): User => ({ name: u.pseudo, email: u.email, provider: u.provider })

// Au démarrage : le cookie de session dit-il qui je suis ?
export async function refreshSession(): Promise<void> {
  const r = await api('GET', '/api/me')
  user.value = r?.status === 200 ? toUser((r.data as { user: ServerUser }).user) : null
}

// Lien reçu par e-mail : https://site/?confirm=JETON
export async function confirmFromUrl(search = window.location.search): Promise<void> {
  const token = new URLSearchParams(search).get('confirm')
  if (!token) return
  const r = await api('POST', '/api/auth/confirm', { token })
  notice.value = r?.status === 200 ? 'Adresse confirmée ! Tu peux te connecter.' : 'Lien de confirmation invalide ou expiré.'
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
  if (r.status === 409) return { ok: false, error: 'Ce pseudo est déjà pris.' }
  if (r.status === 422) return { ok: false, error: `Mot de passe trop faible (${r.data.bits} bits, ${r.data.min} requis).` }
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

export function logout(): void {
  user.value = null
  void api('POST', '/api/auth/logout', {})
}
