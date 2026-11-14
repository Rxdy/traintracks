import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import AccountView from './views/AccountView.vue'
import AuthPanel from './components/AuthPanel.vue'
import { authErrorFromUrl, changePassword, googleEnabled, loadProviders, notice, user } from './auth'

function mockFetch(...replies: { status: number; body?: object }[]) {
  const calls: { url: string; init?: RequestInit }[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    const r = replies.shift() ?? { status: 500 }
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status })
  }))
  return calls
}
enableAutoUnmount(afterEach)
afterEach(() => vi.unstubAllGlobals())

const alice = { name: 'Alice', email: 'alice@x.fr', provider: 'local' as const, leaderboard: true }
const FORT = 'bleu-fenetre-cactus-moteur-zebre'
const NEUF = 'orange-tableau-lampe-riviere-sable'

beforeEach(() => {
  user.value = { ...alice }
  notice.value = ''
  googleEnabled.value = false
})

describe('Connexion avec Google : bouton et erreurs', () => {
  it('le bouton n\'apparaît que si le serveur propose Google ; sinon la mention « pas encore disponible »', async () => {
    user.value = null
    const off = mount(AuthPanel)
    expect(off.find('[data-test=google]').exists()).toBe(false)
    expect(off.find('[data-test=google-off]').exists()).toBe(true)

    mockFetch({ status: 200, body: { google: true } })
    await loadProviders()
    expect(googleEnabled.value).toBe(true)
    const on = mount(AuthPanel)
    const bouton = on.find('[data-test=google]')
    expect(bouton.exists()).toBe(true)
    expect(bouton.attributes('href')).toBe('/api/auth/google/start') // un simple lien vers le serveur : aucun secret dans le navigateur
    expect(bouton.text()).toBe('Continuer avec Google')
    expect(on.find('[data-test=google-off]').exists()).toBe(false)
  })

  it('serveur injoignable ou Google non configuré : le bouton reste masqué', async () => {
    mockFetch({ status: 200, body: { google: false } })
    await loadProviders()
    expect(googleEnabled.value).toBe(false)
    mockFetch({ status: 500 })
    await loadProviders()
    expect(googleEnabled.value).toBe(false)
  })

  it('retour en erreur de Google : un message simple, et l\'adresse est nettoyée', () => {
    window.history.replaceState(null, '', '/?auth_error=google')
    authErrorFromUrl()
    expect(notice.value).toBe('La connexion avec Google a échoué. Réessaie.')
    expect(window.location.search).toBe('')
    window.history.replaceState(null, '', '/?auth_error=google_email')
    authErrorFromUrl()
    expect(notice.value).toContain('n\'a pas confirmé ton adresse')
    notice.value = ''
    authErrorFromUrl('')
    expect(notice.value).toBe('') // rien dans l'adresse : rien à dire
  })
})

describe('Compte : changer de mot de passe', () => {
  it('ancien mot de passe redemandé, nouveau avec indicateur, envoi seulement quand tout est bon', async () => {
    const w = mount(AccountView)
    expect(w.find('[data-test=password-form]').exists()).toBe(false)
    await w.find('[data-test=password-open]').trigger('click')
    expect(w.find('[data-test=password-send]').attributes('disabled')).toBeDefined()

    await w.find('[data-test=password-current]').setValue(FORT)
    await w.find('[data-test=password-new]').setValue('Password123!') // trop faible
    await w.find('[data-test=password-confirm]').setValue('Password123!')
    await new Promise((r) => setTimeout(r, 400)) // l'estimation de robustesse se charge à la demande
    await flushPromises()
    expect(w.find('[data-test=password-send]').attributes('disabled')).toBeDefined() // sous le seuil : bouton inactif

    await w.find('[data-test=password-new]').setValue(NEUF)
    await w.find('[data-test=password-confirm]').setValue('autre-chose')
    await new Promise((r) => setTimeout(r, 400))
    await flushPromises()
    expect(w.find('[data-test=password-mismatch]').exists()).toBe(true)
    expect(w.find('[data-test=password-send]').attributes('disabled')).toBeDefined()

    await w.find('[data-test=password-confirm]').setValue(NEUF)
    await flushPromises()
    expect(w.find('[data-test=password-send]').attributes('disabled')).toBeUndefined()

    const calls = mockFetch({ status: 200, body: { ok: true } })
    await w.find('[data-test=password-form]').trigger('submit')
    await flushPromises()
    expect(calls[0].url).toBe('/api/account/password')
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ currentPassword: FORT, newPassword: NEUF })
    expect(w.find('[data-test=password-msg]').text()).toContain('autres appareils')
    expect(w.find('[data-test=password-form]').exists()).toBe(false) // formulaire refermé et vidé
  })

  it('messages clairs : mot de passe actuel faux, trop d\'essais, trop faible, identique', async () => {
    const cas: [number, object, string][] = [
      [403, { error: 'wrong_password' }, 'Mot de passe actuel incorrect.'],
      [429, { error: 'locked', retryAfterSec: 600 }, 'Trop d\'essais : réessaie dans'],
      [400, { error: 'weak', bits: 20, min: 36 }, 'trop faible'],
      [400, { error: 'same' }, 'différent de l\'ancien'],
    ]
    for (const [status, body, texte] of cas) {
      mockFetch({ status, body })
      const r = await changePassword(FORT, NEUF)
      expect(r.ok).toBe(false)
      expect(r.ok ? '' : r.error).toContain(texte)
    }
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('réseau') }))
    expect(await changePassword(FORT, NEUF)).toEqual({ ok: false, error: 'Serveur injoignable : vérifie ta connexion.' })
  })
})

describe('Compte créé par Google, sans mot de passe', () => {
  beforeEach(() => {
    user.value = { name: 'Cheminot4821', email: 'g@gmail.com', provider: 'google', leaderboard: true, localLogin: false }
  })

  it('pas de formulaire de mot de passe : on propose d\'en définir un, par un lien envoyé à l\'adresse du compte', async () => {
    const w = mount(AccountView)
    expect(w.find('[data-test=password-open]').exists()).toBe(false)
    expect(w.find('[data-test=password-google]').text()).toContain('g@gmail.com')
    const calls = mockFetch({ status: 200, body: { ok: true } })
    await w.find('[data-test=password-link]').trigger('click')
    await flushPromises()
    expect(calls[0].url).toBe('/api/auth/forgot')
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ email: 'g@gmail.com' })
    expect(w.find('[data-test=password-link-msg]').text()).toContain('lien')
  })

  it('changer d\'adresse et supprimer le compte renvoient d\'abord vers la définition du mot de passe', () => {
    const w = mount(AccountView)
    expect(w.find('[data-test=email-open]').exists()).toBe(false)
    expect(w.find('[data-test=email-google]').exists()).toBe(true)
    expect(w.find('[data-test=delete-open]').exists()).toBe(false)
    expect(w.find('[data-test=delete-google]').exists()).toBe(true)
  })

  it('un compte avec mot de passe garde tous les formulaires', () => {
    user.value = { ...alice }
    const w = mount(AccountView)
    expect(w.find('[data-test=password-open]').exists()).toBe(true)
    expect(w.find('[data-test=email-open]').exists()).toBe(true)
    expect(w.find('[data-test=delete-open]').exists()).toBe(true)
    expect(w.find('[data-test=email-google]').exists()).toBe(false)
  })
})
