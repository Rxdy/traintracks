import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import AuthPanel from './components/AuthPanel.vue'
import PasswordMeter from './components/PasswordMeter.vue'
import { confirmFromUrl, deleteAccount, estimateBits, forgotPassword, login, logout, notice, refreshSession, register, resetFromUrl, resetPassword, resetToken, user, MIN_BITS } from './auth'
import AccountView from './views/AccountView.vue'
import LegalView from './views/LegalView.vue'
import { flushPromises } from '@vue/test-utils'

// Faux serveur : chaque appel consomme la réponse suivante.
function mockFetch(...replies: { status: number; body?: object; headers?: Record<string, string> }[]) {
  const calls: { url: string; init?: RequestInit }[] = []
  const f = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    const r = replies.shift() ?? { status: 500 }
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status, headers: r.headers })
  })
  vi.stubGlobal('fetch', f)
  return calls
}

beforeEach(() => {
  user.value = null
  notice.value = ''
})
afterEach(() => vi.unstubAllGlobals())

describe('estimation de robustesse', () => {
  it('note bas les mots de passe courants et haut les phrases', async () => {
    expect(await estimateBits('Password123!')).toBeLessThan(MIN_BITS)
    expect(await estimateBits('123456')).toBeLessThan(10)
    expect(await estimateBits('bleu-fenetre-cactus-moteur-zebre')).toBeGreaterThanOrEqual(MIN_BITS)
    expect(await estimateBits('')).toBe(0)
  })
})

describe('PasswordMeter', () => {
  it('affiche les bits et la couleur selon le seuil', () => {
    const low = mount(PasswordMeter, { props: { bits: 12 } })
    expect(low.find('[data-test=meter]').classes()).toContain('low')
    expect(low.text()).toContain('12 / 50 bits')
    expect(mount(PasswordMeter, { props: { bits: 40 } }).find('[data-test=meter]').classes()).toContain('mid')
    const ok = mount(PasswordMeter, { props: { bits: 55 } })
    expect(ok.find('[data-test=meter]').classes()).toContain('ok')
    expect(ok.text()).toContain('Solide')
    expect(mount(PasswordMeter, { props: { bits: 0 } }).text()).toContain('50 bits')
  })
})

describe('inscription (AuthPanel)', () => {
  async function fill(w: ReturnType<typeof mount>, password: string) {
    await w.find('[data-test=switch]').trigger('click')
    await w.find('[data-test=name]').setValue('Rudy')
    await w.find('[data-test=email]').setValue('rudy@x.fr')
    await w.find('[data-test=password]').setValue(password)
    await vi.waitFor(() => expect(w.find('[data-test=meter-text]').text()).not.toContain('Au moins'))
  }
  it('le bouton reste inactif sous 50 bits, et aucun envoi n\'est possible', async () => {
    const calls = mockFetch()
    const w = mount(AuthPanel)
    await fill(w, 'Password123!')
    expect(w.find('[data-test=submit]').attributes('disabled')).toBeDefined()
    await w.find('[data-test=auth-form]').trigger('submit')
    expect(calls).toHaveLength(0)
  })
  it('au-dessus du seuil : envoie pseudo, e-mail, mot de passe, puis demande de confirmer l\'e-mail (pas de connexion)', async () => {
    const calls = mockFetch({ status: 201, body: { ok: true } })
    const w = mount(AuthPanel)
    await fill(w, 'bleu-fenetre-cactus-moteur-zebre')
    expect(w.find('[data-test=submit]').attributes('disabled')).toBeUndefined()
    await w.find('[data-test=auth-form]').trigger('submit')
    await vi.waitFor(() => expect(w.find('[data-test=info]').exists()).toBe(true))
    expect(w.find('[data-test=info]').text()).toContain('boîte mail')
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ pseudo: 'Rudy', email: 'rudy@x.fr', password: 'bleu-fenetre-cactus-moteur-zebre' })
    expect(user.value).toBeNull()
  })
})

describe('connexion et messages d\'erreur', () => {
  it('connecte et expose le pseudo', async () => {
    mockFetch({ status: 200, body: { user: { id: '1', pseudo: 'Rudy', email: 'r@x.fr', provider: 'local' } } })
    expect(await login('r@x.fr', 'x')).toEqual({ ok: true })
    expect(user.value).toEqual({ name: 'Rudy', email: 'r@x.fr', provider: 'local' })
  })
  it('messages distincts : mauvais identifiants, e-mail non confirmé, trop d\'essais, serveur injoignable', async () => {
    mockFetch({ status: 401 })
    expect(await login('a', 'b')).toEqual({ ok: false, error: 'E-mail ou mot de passe incorrect.' })
    mockFetch({ status: 403 })
    expect(await login('a', 'b')).toMatchObject({ ok: false, error: expect.stringContaining('Confirme') })
    mockFetch({ status: 429, headers: { 'retry-after': '900' }, body: { error: 'locked' } })
    expect(await login('a', 'b')).toEqual({ ok: false, error: "Trop d'essais : réessaie dans 15 min." })
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline') }))
    expect(await login('a', 'b')).toMatchObject({ ok: false, error: expect.stringContaining('injoignable') })
    expect(user.value).toBeNull()
  })
  it('inscription : pseudo pris et mot de passe refusé par le serveur', async () => {
    mockFetch({ status: 409, body: { error: 'pseudo_taken' } })
    expect(await register('a', 'a@b.fr', 'x')).toEqual({ ok: false, error: 'Ce pseudo est déjà pris.' })
    mockFetch({ status: 409, body: { error: 'email_taken' } })
    expect(await register('a', 'a@b.fr', 'x')).toMatchObject({ ok: false, error: expect.stringContaining('a déjà un compte') })
    mockFetch({ status: 422, body: { error: 'weak', bits: 20, min: 50 } })
    expect(await register('a', 'a@b.fr', 'x')).toMatchObject({ ok: false, error: expect.stringContaining('20 bits') })
  })
})

describe('session', () => {
  it('au démarrage, le cookie de session identifie le joueur', async () => {
    mockFetch({ status: 200, body: { user: { id: '1', pseudo: 'Rudy', email: 'r@x.fr', provider: 'local' } } })
    await refreshSession()
    expect(user.value?.name).toBe('Rudy')
    mockFetch({ status: 401 })
    await refreshSession()
    expect(user.value).toBeNull()
  })
  it('la déconnexion vide l\'état tout de suite et prévient le serveur', async () => {
    user.value = { name: 'R', email: 'r@x.fr', provider: 'local' }
    const calls = mockFetch({ status: 200 })
    logout()
    expect(user.value).toBeNull()
    expect(calls[0].url).toBe('/api/auth/logout')
  })
  it('aucun mot de passe ni compte n\'est écrit dans le navigateur', async () => {
    localStorage.clear()
    mockFetch({ status: 201 })
    await register('Rudy', 'r@x.fr', 'bleu-fenetre-cactus-moteur-zebre')
    expect(Object.keys(localStorage).filter((k) => /account|user|pass/i.test(k))).toEqual([])
  })
})

describe('lien de confirmation', () => {
  it('confirme puis nettoie l\'adresse', async () => {
    const calls = mockFetch({ status: 200 })
    await confirmFromUrl('?confirm=abc123')
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ token: 'abc123' })
    expect(notice.value).toContain('confirmée')
  })
  it('signale un lien invalide ; ne fait rien sans jeton', async () => {
    mockFetch({ status: 400 })
    await confirmFromUrl('?confirm=nope')
    expect(notice.value).toContain('invalide')
    notice.value = ''
    const calls = mockFetch()
    await confirmFromUrl('?autre=1')
    expect(calls).toHaveLength(0)
    expect(notice.value).toBe('')
  })
})


describe('mot de passe oublié', () => {
  it('la réponse ne dit pas si l\'adresse a un compte', async () => {
    const calls = mockFetch({ status: 200, body: { ok: true } })
    const r = await forgotPassword('a@b.fr')
    expect(r).toMatchObject({ ok: true })
    expect(calls[0].url).toBe('/api/auth/forgot')
    expect((r as { message: string }).message).toContain('Si un compte existe')
  })
  it('le lien ?reset=… est lu puis retiré de l\'adresse', () => {
    resetToken.value = ''
    resetFromUrl('?reset=abc123')
    expect(resetToken.value).toBe('abc123')
    resetToken.value = ''
  })
  it('nouveau mot de passe : succès, trop faible, lien invalide', async () => {
    resetToken.value = 'abc'
    mockFetch({ status: 200 })
    expect(await resetPassword('abc', 'x')).toMatchObject({ ok: true })
    expect(resetToken.value).toBe('')
    mockFetch({ status: 422, body: { bits: 10, min: 50 } })
    expect(await resetPassword('abc', 'x')).toMatchObject({ ok: false, error: expect.stringContaining('trop faible') })
    mockFetch({ status: 400 })
    expect(await resetPassword('abc', 'x')).toMatchObject({ ok: false, error: expect.stringContaining('expiré') })
  })
  it('l\'écran de connexion propose « Mot de passe oublié ? » puis le formulaire d\'e-mail', async () => {
    const w = mount(AuthPanel)
    await w.find('[data-test=forgot]').trigger('click')
    expect(w.find('h2').text()).toBe('Mot de passe oublié')
    expect(w.find('[data-test=password]').exists()).toBe(false)
    const calls = mockFetch({ status: 200 })
    await w.find('[data-test=email]').setValue('a@b.fr')
    await w.find('[data-test=auth-form]').trigger('submit')
    await flushPromises()
    expect(calls[0].url).toBe('/api/auth/forgot')
    expect(w.find('[data-test=info]').text()).toContain('Si un compte existe')
  })
  it('arrivée par le lien : formulaire de nouveau mot de passe, sans e-mail', async () => {
    resetToken.value = 'tok'
    const w = mount(AuthPanel)
    expect(w.find('h2').text()).toBe('Nouveau mot de passe')
    expect(w.find('[data-test=email]').exists()).toBe(false)
    expect(w.findComponent(PasswordMeter).exists()).toBe(true)
    resetToken.value = ''
  })
})

describe('suppression du compte', () => {
  it('envoie le mot de passe, déconnecte et vide le compte', async () => {
    user.value = { name: 'Rudy', email: 'r@x.fr', provider: 'local' }
    const calls = mockFetch({ status: 200 })
    expect(await deleteAccount('secret')).toMatchObject({ ok: true })
    expect(calls[0].url).toBe('/api/auth/delete-account')
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ password: 'secret' })
    expect(user.value).toBeNull()
  })
  it('mauvais mot de passe : le compte reste', async () => {
    user.value = { name: 'Rudy', email: 'r@x.fr', provider: 'local' }
    mockFetch({ status: 403 })
    expect(await deleteAccount('faux')).toMatchObject({ ok: false, error: 'Mot de passe incorrect.' })
    expect(user.value).not.toBeNull()
  })
  it('l\'écran Compte demande confirmation et mot de passe avant de supprimer', async () => {
    user.value = { name: 'Rudy', email: 'r@x.fr', provider: 'local' }
    const w = mount(AccountView)
    expect(w.find('[data-test=delete-form]').exists()).toBe(false)
    await w.find('[data-test=delete-open]').trigger('click')
    expect(w.find('[data-test=delete-form]').text()).toContain('définitivement')
    expect(w.find('[data-test=delete-confirm]').attributes('disabled')).toBeDefined() // pas de mot de passe : bouton inactif
    await w.find('[data-test=delete-cancel]').trigger('click')
    expect(w.find('[data-test=delete-form]').exists()).toBe(false)
  })
})

describe('mentions légales', () => {
  it('affiche l\'éditeur et le contact venus du serveur, et « à renseigner » sinon', async () => {
    mockFetch({ status: 200, body: { name: 'Jeanne Dupont', contact: 'c@exemple.fr', host: 'l\'éditeur' } })
    const w = mount(LegalView)
    await flushPromises()
    expect(w.find('[data-test=legal-name]').text()).toBe('Jeanne Dupont')
    expect(w.find('[data-test=legal-contact]').text()).toBe('c@exemple.fr')
    mockFetch({ status: 200, body: { name: '', contact: '', host: '' } })
    const empty = mount(LegalView)
    await flushPromises()
    expect(empty.find('[data-test=legal-name]').text()).toBe('à renseigner')
    expect(empty.text()).toContain('Supprimer mon compte')
  })
})

describe('changer de compte sur le même appareil', () => {
  it('Compte : se déconnecter, puis se connecter avec un autre compte', async () => {
    user.value = { name: 'Alice', email: 'alice@x.fr', provider: 'local' }
    const w = mount(AccountView)
    expect(w.text()).toContain('Alice')
    expect(w.text()).toContain('alice@x.fr')

    // déconnexion : l'état est vidé tout de suite, l'écran propose la connexion
    const calls = mockFetch({ status: 200 })
    await w.find('[data-test=logout]').trigger('click')
    await flushPromises()
    expect(calls[0].url).toBe('/api/auth/logout')
    expect(user.value).toBeNull()
    expect(w.find('[data-test=auth]').exists()).toBe(true)
    expect(w.find('h2').text()).toBe('Connexion')
    expect(w.text()).not.toContain('Alice')

    // connexion avec un autre compte
    const calls2 = mockFetch({ status: 200, body: { user: { id: '2', pseudo: 'Bob', email: 'bob@x.fr', provider: 'local' } } })
    await w.find('[data-test=email]').setValue('bob@x.fr')
    await w.find('[data-test=password]').setValue('bleu-fenetre-cactus-moteur-zebre')
    await w.find('[data-test=auth-form]').trigger('submit')
    await flushPromises()
    expect(calls2[0].url).toBe('/api/auth/login')
    expect(JSON.parse(String(calls2[0].init?.body))).toMatchObject({ email: 'bob@x.fr' })
    expect(user.value).toEqual({ name: 'Bob', email: 'bob@x.fr', provider: 'local' })
    expect(w.text()).toContain('Bob')
    expect(w.text()).toContain('bob@x.fr')
    expect(w.text()).not.toContain('Alice')
  })
  it('inscription : l\'adresse déjà utilisée est signalée dans le formulaire', async () => {
    const w = mount(AuthPanel)
    await w.find('[data-test=switch]').trigger('click')
    expect(w.find('h2').text()).toBe('Créer un compte')
    await w.find('[data-test=name]').setValue('Alice2')
    await w.find('[data-test=email]').setValue('alice@x.fr')
    await w.find('[data-test=password]').setValue('bleu-fenetre-cactus-moteur-zebre')
    await flushPromises()
    await new Promise((r) => setTimeout(r, 50))
    mockFetch({ status: 409, body: { error: 'email_taken' } })
    await w.find('[data-test=auth-form]').trigger('submit')
    await flushPromises()
    expect(w.find('[data-test=error]').text()).toContain('a déjà un compte')
  })
})
