import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { enableAutoUnmount, mount, flushPromises } from '@vue/test-utils'
import AccountView from './views/AccountView.vue'
import StatsView from './views/StatsView.vue'
import RankingView from './views/RankingView.vue'
import { confirmEmailChangeFromUrl, notice, user } from './auth'

// Faux serveur : une réponse par appel, et la liste des appels.
function mockFetch(...replies: { status: number; body?: object }[]) {
  const calls: { url: string; init?: RequestInit }[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    const r = replies.shift() ?? { status: 500 }
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status })
  }))
  return calls
}
// Chaque composant monté est démonté après le test : sinon il réagirait aux changements de `user` des tests suivants.
enableAutoUnmount(afterEach)
const later = (ms = 30) => new Promise((r) => setTimeout(r, ms)) // FileReader est asynchrone (jsdom)
const readBlob = (b: Blob) => new Promise<string>((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.readAsText(b) })
const alice = { name: 'Alice', email: 'alice@x.fr', provider: 'local' as const, leaderboard: true }
beforeEach(() => {
  user.value = { ...alice }
  notice.value = ''
})
afterEach(() => vi.unstubAllGlobals())

describe('Compte : changer d\'adresse e-mail', () => {
  it('mot de passe demandé, lien envoyé à la nouvelle adresse, message clair', async () => {
    const w = mount(AccountView)
    expect(w.find('[data-test=email-form]').exists()).toBe(false)
    await w.find('[data-test=email-open]').trigger('click')
    expect(w.find('[data-test=email-send]').attributes('disabled')).toBeDefined() // rien à envoyer encore
    await w.find('[data-test=email-new]').setValue('neuve@x.fr')
    await w.find('[data-test=email-password]').setValue('bleu-fenetre-cactus-moteur-zebre')
    const calls = mockFetch({ status: 200, body: { ok: true } })
    await w.find('[data-test=email-form]').trigger('submit')
    await flushPromises()
    expect(calls[0].url).toBe('/api/account/email')
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ email: 'neuve@x.fr', password: 'bleu-fenetre-cactus-moteur-zebre' })
    expect(w.find('[data-test=email-msg]').text()).toContain('lien')
    expect(user.value?.email).toBe('alice@x.fr') // l'adresse ne change qu'après le clic sur le lien
    expect(w.find('[data-test=email-form]').exists()).toBe(false)
  })
  it('erreurs : mot de passe incorrect, adresse déjà utilisée', async () => {
    const w = mount(AccountView)
    for (const [status, text] of [[403, 'Mot de passe incorrect'], [409, 'a déjà un compte']] as const) {
      await w.find('[data-test=email-open]').trigger('click')
      await w.find('[data-test=email-new]').setValue('neuve@x.fr')
      await w.find('[data-test=email-password]').setValue('x')
      mockFetch({ status, body: { error: 'x' } })
      await w.find('[data-test=email-form]').trigger('submit')
      await flushPromises()
      expect(w.find('[data-test=email-msg]').text()).toContain(text)
      expect(w.find('[data-test=email-form]').exists()).toBe(true) // le formulaire reste, pour corriger
      await w.find('[data-test=email-cancel]').trigger('click')
    }
  })
  it('lien reçu par e-mail : ?email-change=… confirme, rafraîchit le compte et nettoie l\'adresse', async () => {
    const calls = mockFetch({ status: 200, body: { ok: true } }, { status: 200, body: { user: { id: '1', pseudo: 'Alice', email: 'neuve@x.fr', provider: 'local', leaderboard: true } } })
    await confirmEmailChangeFromUrl('?email-change=tok123')
    expect(calls[0].url).toBe('/api/account/email/confirm')
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ token: 'tok123' })
    expect(notice.value).toContain('confirmée')
    expect(user.value?.email).toBe('neuve@x.fr')
    mockFetch({ status: 400 })
    await confirmEmailChangeFromUrl('?email-change=vieux')
    expect(notice.value).toContain('invalide')
    const none = mockFetch()
    await confirmEmailChangeFromUrl('')
    expect(none).toHaveLength(0)
  })
})

describe('Compte : classement et données', () => {
  it('case « Apparaître dans le classement » : envoie le choix, retient la réponse du serveur', async () => {
    const w = mount(AccountView)
    const box = w.find('[data-test=leaderboard-toggle]')
    expect((box.element as HTMLInputElement).checked).toBe(true)
    const calls = mockFetch({ status: 200, body: { ok: true } })
    await box.setValue(false)
    await flushPromises()
    expect(calls[0].url).toBe('/api/account/leaderboard')
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ visible: false })
    expect(user.value?.leaderboard).toBe(false)
  })
  it('export : télécharge le fichier du serveur tel quel', async () => {
    const w = mount(AccountView)
    const file = { format: 'traintracks-export', version: 1, signature: 'ab'.repeat(32), journey: [] }
    mockFetch({ status: 200, body: file })
    const created: Blob[] = []
    vi.stubGlobal('URL', { createObjectURL: (b: Blob) => (created.push(b), 'blob:x'), revokeObjectURL: () => undefined })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    await w.find('[data-test=export]').trigger('click')
    await flushPromises()
    expect(click).toHaveBeenCalled()
    expect(JSON.parse(await readBlob(created[0]))).toEqual(file)
    expect(w.find('[data-test=data-msg]').text()).toContain('téléchargé')
    click.mockRestore()
  })
  it('import : un export valide est envoyé ; messages pour déjà importé, modifié, invalide', async () => {
    const w = mount(AccountView)
    const send = async (content: string) => {
      const input = w.find('[data-test=import]')
      Object.defineProperty(input.element, 'files', { value: [new File([content], 'x.json', { type: 'application/json' })], configurable: true })
      await input.trigger('change')
      await later()
      await flushPromises()
    }
    const calls = mockFetch({ status: 200, body: { ok: true, levels: 3, daily: 1 } })
    await send(JSON.stringify({ format: 'traintracks-export', version: 1 }))
    expect(calls[0].url).toBe('/api/account/import')
    expect(w.find('[data-test=data-msg]').text()).toContain('3 niveaux')
    mockFetch({ status: 409 })
    await send('{"a":1}')
    expect(w.find('[data-test=data-msg]').text()).toContain('déjà été importé')
    mockFetch({ status: 403 })
    await send('{"a":1}')
    expect(w.find('[data-test=data-msg]').text()).toContain('modifié')
    const none = mockFetch()
    await send('pas du json')
    expect(w.find('[data-test=data-msg]').text()).toContain('invalide')
    expect(none).toHaveLength(0) // rien n'est envoyé au serveur
  })
})

describe('page Statistiques', () => {
  it('niveaux, temps de jeu, records, par taille de grille, pièces, environnement', async () => {
    mockFetch({ status: 200, body: {
      journey: { level: 31, total: 299, allDone: false, solved: 30, totalTimeMs: 3_900_000, avgMs: 130_000, fastest: { level: 4, timeMs: 8_000 }, slowest: { level: 29, timeMs: 400_000 }, bySize: [{ size: 4, count: 10, avgMs: 20_000, bestMs: 8_000 }, { size: 5, count: 20, avgMs: 150_000, bestMs: 40_000 }], coinsEarned: 400, coins: 250, firstSolvedAt: '2026-11-01T10:00:00Z' },
      daily: { count: 2, avgMs: 60_000, bestMs: 50_000, worstMs: 70_000, streak: 2, bestStreak: 5 },
    } })
    const w = mount(StatsView)
    await flushPromises()
    expect(w.find('[data-test=highest]').text()).toBe('31')
    expect(w.find('[data-test=solved]').text()).toBe('30')
    expect(w.find('[data-test=playtime]').text()).toBe('1 h 05')
    expect(w.find('[data-test=fastest]').text()).toBe('0:08')
    expect(w.text()).toContain('niv. 29')
    expect(w.find('[data-test=coins-earned]').text()).toBe('400')
    expect(w.findAll('[data-test=by-size] li').map((l) => l.text())).toEqual(['4×410 niveauxmoy. 0:20record 0:08', '5×520 niveauxmoy. 2:30record 0:40'])
    expect(w.find('[data-test=place]').text()).toContain('Forêt') // niveaux 26 à 50
    expect(w.find('[data-test=streak]').text()).toBe('2')
    expect(w.find('[data-test=best-streak]').text()).toBe('5')
  })
  it('non connecté : le formulaire de connexion', () => {
    user.value = null
    expect(mount(StatsView).find('[data-test=auth]').exists()).toBe(true)
  })
})

describe('page Classement', () => {
  const board = (extra: object = {}) => ({ board: 'voyage', entries: [{ rank: 1, pseudo: 'Zoé', value: 120, me: false }, { rank: 2, pseudo: 'Alice', value: 90, me: true }, { rank: 3, pseudo: 'Bob', value: 12, me: false }], me: { rank: 2, value: 90 }, total: 3, ...extra })

  it('Voyage : rangs, pseudos, niveaux ; ma ligne est repérée ; ma place', async () => {
    mockFetch({ status: 200, body: board() })
    const w = mount(RankingView)
    await flushPromises()
    const rows = w.findAll('[data-test=ranking-row]')
    expect(rows.map((r) => r.text())).toEqual(['1ZoéNiveau 120', '2AliceNiveau 90', '3BobNiveau 12'])
    expect(rows[1].classes()).toContain('me')
    expect(w.find('[data-test=ranking-me]').text()).toContain('2')
    expect(w.find('[data-test=ranking-me]').text()).toContain('sur 3')
  })
  it('onglets Du jour (temps) et Séries (jours), avec le bon appel', async () => {
    const calls = mockFetch({ status: 200, body: board() }, { status: 200, body: board({ board: 'jour', entries: [{ rank: 1, pseudo: 'Bob', value: 61_000, me: false }], me: null, total: 1 }) }, { status: 200, body: board({ board: 'serie', entries: [{ rank: 1, pseudo: 'Zoé', value: 5, me: false }], me: null, total: 1 }) })
    const w = mount(RankingView)
    await flushPromises()
    await w.find('[data-test=tab-jour]').trigger('click')
    await flushPromises()
    expect(calls[1].url).toBe('/api/leaderboard?board=jour')
    expect(w.find('[data-test=ranking-row]').text()).toContain('1:01')
    expect(w.find('[data-test=ranking-hidden]').exists()).toBe(true) // connectée mais pas dans ce classement
    await w.find('[data-test=tab-serie]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test=ranking-row]').text()).toContain('5 jours')
  })
  it('masqué : le dit et renvoie vers le Compte ; vide : message ; hors ligne : message', async () => {
    user.value = { ...alice, leaderboard: false }
    mockFetch({ status: 200, body: board({ me: null }) })
    const w = mount(RankingView)
    await flushPromises()
    expect(w.find('[data-test=ranking-hidden]').text()).toContain('Compte')
    mockFetch({ status: 200, body: board({ entries: [], me: null, total: 0 }) })
    await w.find('[data-test=tab-jour]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test=ranking-empty]').exists()).toBe(true)
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline') }))
    await w.find('[data-test=tab-serie]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test=ranking-error]').exists()).toBe(true)
  })
  it('sans compte : lisible par tous, avec un lien pour se connecter', async () => {
    user.value = null
    mockFetch({ status: 200, body: board({ me: null }) })
    const w = mount(RankingView)
    await flushPromises()
    expect(w.findAll('[data-test=ranking-row]')).toHaveLength(3)
    expect(w.find('[data-test=ranking-login]').exists()).toBe(true)
  })
})
