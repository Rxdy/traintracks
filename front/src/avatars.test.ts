import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import AccountView from './views/AccountView.vue'
import RankingView from './views/RankingView.vue'
import Avatar from './components/Avatar.vue'
import MenuIcon from './components/MenuIcon.vue'
import { AVATAR_ART, AVATAR_IDS, AVATARS, DEFAULT_AVATAR } from './avatars'
import { avatars, user } from './auth'

enableAutoUnmount(afterEach)
afterEach(() => vi.unstubAllGlobals())

// Faux serveur : une réponse par « MÉTHODE /adresse », et la liste des appels.
function route(table: Record<string, { status: number; body?: object }>) {
  const calls: { key: string; body?: unknown }[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${url}`
    calls.push({ key, body: init?.body ? JSON.parse(String(init.body)) : undefined })
    const r = table[key] ?? { status: 404 }
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status })
  }))
  return calls
}
const alice = { name: 'Alice', email: 'alice@x.fr', provider: 'local' as const, leaderboard: true, avatar: 'loco' }
beforeEach(() => {
  user.value = { ...alice }
  avatars.value = null
})
const monter = async (state: { current: string; owned: string[]; coins: number }, extra: Record<string, { status: number; body?: object }> = {}, ouvrir = true) => {
  const calls = route({ 'GET /api/avatars': { status: 200, body: state }, ...extra })
  const w = mount(AccountView)
  await flushPromises()
  if (ouvrir) await w.find('[data-test=avatar-change]').trigger('click') // la liste n'apparaît qu'en cliquant sur son avatar
  return { w, calls }
}

describe('les dessins', () => {
  it('chaque avatar de la liste a son dessin, et il n\'y en a pas en trop', () => {
    expect(Object.keys(AVATAR_ART).sort()).toEqual([...AVATAR_IDS].sort())
    expect(AVATARS).toHaveLength(40)
  })

  it('chaque dessin est un SVG valide, sans script ni lien externe (le dessin vient du code, jamais d\'un joueur)', () => {
    for (const [id, a] of Object.entries(AVATAR_ART)) {
      const doc = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${a.body}</svg>`, 'image/svg+xml')
      expect(doc.querySelector('parsererror'), id).toBeNull()
      expect(a.body, id).not.toMatch(/<script|javascript:|href=|on\w+=/i)
      expect(a.bg, id).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('le composant montre le dessin demandé, et le dessin par défaut si l\'identifiant est inconnu ou absent', () => {
    const w = mount(Avatar, { props: { id: 'loup' } })
    expect(w.find('svg').html()).toContain(AVATAR_ART.loup.body.slice(0, 30))
    expect(w.text()).toBe('') // aucun libellé
    expect(mount(Avatar, { props: { id: 'inconnu' } }).find('svg').html()).toContain(AVATAR_ART[DEFAULT_AVATAR].bg)
    expect(mount(Avatar).find('svg').html()).toContain(AVATAR_ART[DEFAULT_AVATAR].bg)
  })

  it('l\'icône Compte du menu montre l\'avatar du joueur connecté ; sans avatar, l\'initiale (repli)', () => {
    expect(mount(MenuIcon, { props: { name: 'account', avatar: 'chat' } }).find('[data-test=menu-avatar]').exists()).toBe(true)
    const repli = mount(MenuIcon, { props: { name: 'account', initial: 'R' } })
    expect(repli.find('[data-test=menu-avatar]').exists()).toBe(false)
    expect(repli.find('[data-test=initial]').text()).toBe('R')
  })
})

describe('Compte : choisir et acheter un avatar', () => {
  it('la page Compte ne montre pas toute la liste : seulement mon avatar, la liste s\'ouvre en cliquant dessus et se ferme', async () => {
    const { w } = await monter({ current: 'loco', owned: [], coins: 100 }, {}, false)
    expect(w.find('[data-test=my-avatar]').exists()).toBe(true)
    expect(w.findAll('[data-test=avatar-block] .av')).toHaveLength(0)
    await w.find('[data-test=avatar-change]').trigger('click')
    expect(w.findAll('[data-test=avatar-block] .av')).toHaveLength(40)
    await w.find('[data-test=avatar-close]').trigger('click')
    expect(w.find('[data-test=avatar-sheet]').exists()).toBe(false)
  })

  it('toute la liste est montrée sans aucun nom : seulement des images, et le prix sur ceux qui se paient', async () => {
    const { w } = await monter({ current: 'loco', owned: [], coins: 100 })
    const boutons = w.findAll('[data-test=avatar-block] .av')
    expect(boutons).toHaveLength(40)
    for (const b of boutons) expect(b.text().replace(/\d+/g, '').trim()).toBe('') // pas de texte autre que le prix
    expect(w.findAll('[data-test=avatar-price]')).toHaveLength(32) // 40 moins 8 gratuits
    expect(w.find('[data-test=avatar-loco]').attributes('aria-pressed')).toBe('true')
    expect(w.find('[data-test=avatar-coins]').text()).toBe('100 pièces')
  })

  it('un avatar gratuit se choisit d\'un clic', async () => {
    const { w, calls } = await monter({ current: 'loco', owned: [], coins: 100 }, { 'POST /api/avatars/select': { status: 200, body: { ok: true, current: 'canard', owned: [], coins: 100 } } })
    await w.find('[data-test=avatar-canard]').trigger('click')
    await flushPromises()
    expect(calls.at(-1)).toEqual({ key: 'POST /api/avatars/select', body: { id: 'canard' } })
    expect(user.value?.avatar).toBe('canard')
    expect(w.find('[data-test=avatar-sheet]').exists()).toBe(false) // la feuille se referme une fois choisi
  })

  it('un avatar payant ne s\'achète pas d\'un clic : il demande confirmation avec le prix', async () => {
    const { w, calls } = await monter({ current: 'loco', owned: [], coins: 400 })
    await w.find('[data-test=avatar-cerf]').trigger('click') // 300 pièces
    expect(w.find('[data-test=avatar-buy]').exists()).toBe(true)
    expect(w.find('[data-test=avatar-buy]').text()).toContain('300 pièces, il t\'en restera 100')
    expect(calls.some((c) => c.key.includes('buy'))).toBe(false) // rien n'est acheté sans confirmation
    await w.find('[data-test=avatar-cancel]').trigger('click')
    expect(w.find('[data-test=avatar-buy]').exists()).toBe(false)
  })

  it('pas assez de pièces : on dit combien il en manque, et le bouton est inactif', async () => {
    const { w } = await monter({ current: 'loco', owned: [], coins: 100 })
    await w.find('[data-test=avatar-loup]').trigger('click') // 500
    expect(w.find('[data-test=avatar-missing]').text()).toBe('Il te manque 400 pièces.')
    expect(w.find('[data-test=avatar-confirm]').attributes('disabled')).toBeDefined()
  })

  it('confirmé : acheté, puis adopté tout de suite', async () => {
    const { w, calls } = await monter(
      { current: 'loco', owned: [], coins: 400 },
      {
        'POST /api/avatars/buy': { status: 200, body: { ok: true, current: 'loco', owned: ['cerf'], coins: 100 } },
        'POST /api/avatars/select': { status: 200, body: { ok: true, current: 'cerf', owned: ['cerf'], coins: 100 } },
      },
    )
    await w.find('[data-test=avatar-cerf]').trigger('click')
    await w.find('[data-test=avatar-confirm]').trigger('click')
    await flushPromises()
    expect(calls.map((c) => c.key).slice(-2)).toEqual(['POST /api/avatars/buy', 'POST /api/avatars/select'])
    expect(user.value?.avatar).toBe('cerf')
    expect(w.find('[data-test=avatar-sheet]').exists()).toBe(false)
    await w.find('[data-test=avatar-change]').trigger('click') // on rouvre : le solde est à jour et il n'a plus de prix
    expect(w.find('[data-test=avatar-coins]').text()).toBe('100 pièces')
    expect(w.find('[data-test=avatar-cerf] [data-test=avatar-price]').exists()).toBe(false) // plus de prix : il est à moi
  })

  it('un avatar déjà acheté se choisit d\'un clic, sans rien payer', async () => {
    const { w, calls } = await monter({ current: 'loco', owned: ['hibou'], coins: 0 }, { 'POST /api/avatars/select': { status: 200, body: { ok: true, current: 'hibou', owned: ['hibou'], coins: 0 } } })
    await w.find('[data-test=avatar-hibou]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test=avatar-buy]').exists()).toBe(false)
    expect(calls.at(-1)?.key).toBe('POST /api/avatars/select')
  })

  it('le serveur refuse (solde insuffisant, déjà acheté) : un message clair, rien ne change', async () => {
    const { w } = await monter({ current: 'loco', owned: [], coins: 600 }, { 'POST /api/avatars/buy': { status: 402, body: { error: 'poor' } } })
    await w.find('[data-test=avatar-loup]').trigger('click')
    await w.find('[data-test=avatar-confirm]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test=avatar-msg]').text()).toBe('Pas assez de pièces.')
    expect(user.value?.avatar).toBe('loco')
  })
})

describe('Classement : l\'avatar à côté du pseudo', () => {
  it('chaque ligne montre l\'avatar choisi', async () => {
    route({ 'GET /api/leaderboard?board=voyage': { status: 200, body: { board: 'voyage', entries: [{ rank: 1, pseudo: 'Alice', avatar: 'tgv', value: 12, me: false }, { rank: 2, pseudo: 'Bob', avatar: 'chat', value: 9, me: false }], me: null, total: 2 } } })
    const w = mount(RankingView)
    await flushPromises()
    const lignes = w.findAll('[data-test=ranking-row]')
    expect(lignes).toHaveLength(2)
    expect(lignes[0].find('[data-test=avatar-pic]').attributes('data-avatar')).toBe('tgv')
    expect(lignes[1].find('[data-test=avatar-pic]').attributes('data-avatar')).toBe('chat')
    expect(lignes[0].find('.pseudo').text()).toBe('Alice')
  })
})
