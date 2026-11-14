import { describe, it, expect, vi, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { LESSONS } from './tutorial'
import TutorialView from './views/TutorialView.vue'
import LandscapeBg from './components/LandscapeBg.vue'
import { PAL } from './scenery'
import { themeForLevel } from './scenery'
import { homeTheme, setHomeLevel } from './journey'

type W = ReturnType<typeof mount>
const cell = (w: W, r: number, c: number) => w.find(`[data-r="${r}"][data-c="${c}"]`)
const title = (w: W) => w.find('[data-test=coach-title]').text()
const text = (w: W) => w.find('[data-test=coach-text]').text()
const hint = (w: W) => w.find('[data-test=hint]')
const dragCells = async (w: W, path: [number, number][], up = true) => {
  await cell(w, ...path[0]).trigger('pointerdown')
  for (const [r, c] of path.slice(1)) await cell(w, r, c).trigger('pointerenter')
  if (up) window.dispatchEvent(new Event('pointerup'))
  await flushPromises()
}
const tap = async (w: W, r: number, c: number) => {
  await cell(w, r, c).trigger('pointerdown')
  window.dispatchEvent(new Event('pointerup'))
  await flushPromises()
}
const cross = async (w: W, r: number, c: number) => {
  await cell(w, r, c).trigger('pointerdown', { button: 0 })
  await cell(w, r, c).trigger('contextmenu')
  window.dispatchEvent(new Event('pointerup'))
  await flushPromises()
}
const click = async (w: W, id: string) => {
  await w.find(`[data-test=${id}]`).trigger('click')
  await flushPromises()
}
const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms))
const sol = (id: string) => LESSONS.find((l) => l.id === id)!.solution

// Joue un exercice en entier, comme le demande le pas à pas.
async function play(w: W, id: string) {
  for (const st of LESSONS.find((l) => l.id === id)!.steps) {
    const a = st.action
    if (a.type === 'info') await click(w, 'ok')
    else if (a.type === 'drag') await dragCells(w, a.path)
    else if (a.type === 'tap') for (const [r, c] of a.cells) await tap(w, r, c)
    else for (const [r, c] of a.cells) await cross(w, r, c)
  }
}

function mockReward(reply: { status: number; body?: object }) {
  const calls: { url: string; body: unknown }[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init?.body ?? '{}')) })
    return new Response(JSON.stringify(reply.body ?? {}), { status: reply.status })
  }))
  return calls
}

describe('tutoriel : exercices à une seule action', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('le premier exercice est une grille 1×4, sans décor ni train ni chrono', () => {
    const w = mount(TutorialView, { attachTo: document.body })
    expect(title(w)).toBe('Tracer une voie')
    expect(w.findAll('[data-r]')).toHaveLength(4)
    expect(w.find('[data-test=timer]').exists()).toBe(false)
    expect(w.find('.scenery, [data-test=finish], .train').exists()).toBe(false)
    expect(w.find('[data-test=next]').exists()).toBe(false)
    expect(w.text()).toContain('rapporte 50 pièces')
    w.unmount()
  })

  it('tout autre geste que celui demandé est refusé : toucher, croix, départ à côté, lâcher trop tôt', async () => {
    const w = mount(TutorialView, { attachTo: document.body })
    await tap(w, 0, 2)
    expect(hint(w).text()).toContain('départ')
    await cross(w, 0, 2)
    expect(hint(w).text()).toContain('chemin')
    await dragCells(w, [[0, 2], [0, 3]]) // ne part pas du départ
    expect(hint(w).text()).toContain('départ')
    await dragCells(w, [[0, 0], [0, 1], [0, 2]]) // lâché avant la sortie
    expect(hint(w).text()).toContain('sortie')
    expect(w.findAll('.cell--rail').length).toBe(2) // départ et sortie seulement : le tracé a été annulé
    expect(w.find('[data-test=next]').exists()).toBe(false)
    w.unmount()
  })

  it('le chemin s\'allume case après case, dans l\'ordre, sans parler de souris ni de doigt', () => {
    const w = mount(TutorialView, { attachTo: document.body })
    const lit = w.findAll('.seq')
    expect(lit).toHaveLength(4)
    expect(lit.map((c) => c.attributes('style'))).toEqual(['--i: 0;', '--i: 1;', '--i: 2;', '--i: 3;'])
    expect(w.find('.start').attributes('data-c')).toBe('0') // la première case est marquée comme départ
    expect(text(w)).not.toMatch(/souris|doigt/i)
    w.unmount()
  })

  it('croix : la consigne dépend de l\'appareil (clic droit sur ordinateur, appui maintenu sur écran tactile)', async () => {
    const mk = async (coarse: boolean) => {
      vi.stubGlobal('matchMedia', (q: string) => ({ matches: coarse && q.includes('coarse') }))
      const w = mount(TutorialView, { attachTo: document.body })
      for (const id of ['trace', 'clues', 'mark']) {
        await play(w, id)
        await click(w, 'next')
      }
      await click(w, 'ok')
      return w
    }
    const desktop = await mk(false)
    expect(text(desktop)).toContain('clic droit')
    await tap(desktop, 0, 0)
    expect(hint(desktop).text()).toContain('clic droit')
    desktop.unmount()
    const phone = await mk(true)
    expect(text(phone)).toContain('doigt appuyé')
    expect(text(phone)).not.toContain('clic droit')
    await tap(phone, 0, 0)
    expect(hint(phone).text()).toContain('appuyé')
    phone.unmount()
  })

  it('on ne peut pas sauter une case en glissant', async () => {
    const w = mount(TutorialView, { attachTo: document.body })
    await dragCells(w, [[0, 0], [0, 3]])
    expect(w.find('[data-test=next]').exists()).toBe(false)
    w.unmount()
  })

  it('exercice 1 réussi : « suivant » ouvre l\'exercice 2, grille 3×3', async () => {
    const w = mount(TutorialView, { attachTo: document.body })
    await play(w, 'trace')
    expect(text(w)).toContain('première voie')
    await click(w, 'next')
    expect(title(w)).toBe('Lire les chiffres')
    expect(w.findAll('[data-r]')).toHaveLength(9)
    w.unmount()
  })

  it('sur un pas de lecture, la grille est inerte jusqu\'à « Compris »', async () => {
    const w = mount(TutorialView, { attachTo: document.body })
    await play(w, 'trace')
    await click(w, 'next')
    expect(w.find('[data-test=ok]').exists()).toBe(true)
    expect(w.find('.focus').exists()).toBe(true) // le chiffre dont on parle est mis en avant
    await dragCells(w, sol('clues'))
    expect(w.find('[data-test=next]').exists()).toBe(false)
    await click(w, 'ok')
    await click(w, 'ok')
    expect(w.find('[data-test=ok]').exists()).toBe(false)
    await dragCells(w, sol('clues'))
    expect(w.find('[data-test=next]').exists()).toBe(true)
    w.unmount()
  })

  it('repères : seules les cases en surbrillance se touchent, un appui long ou une croix est refusé', async () => {
    const w = mount(TutorialView, { attachTo: document.body })
    await play(w, 'trace')
    await click(w, 'next')
    await play(w, 'clues')
    await click(w, 'next')
    expect(title(w)).toBe('Poser des repères')
    await click(w, 'ok')
    expect(w.findAll('.target')).toHaveLength(3)
    await tap(w, 0, 1) // hors consigne
    expect(hint(w).text()).toContain('surbrillance')
    await cross(w, 1, 0)
    expect(hint(w).text()).toContain('simple touche')
    for (const c of [0, 1, 2]) await tap(w, 1, c)
    expect(w.find('[data-test=next]').exists()).toBe(true)
    w.unmount()
  })

  it('croix : un simple toucher est refusé, seule la croix sur les cases visées compte', async () => {
    const w = mount(TutorialView, { attachTo: document.body })
    for (const id of ['trace', 'clues', 'mark']) {
      await play(w, id)
      await click(w, 'next')
    }
    expect(title(w)).toBe('Barrer avec des croix')
    expect(w.findAll('[data-r]')).toHaveLength(12) // 4 lignes × 3 colonnes
    await click(w, 'ok')
    await tap(w, 0, 0)
    expect(hint(w).text()).toContain('clic droit')
    await cross(w, 1, 1) // hors consigne
    expect(w.findAll('.cell--cross')).toHaveLength(0)
    for (const r of [0, 1, 2, 3]) await cross(w, r, 0)
    expect(w.findAll('.cell--cross')).toHaveLength(4)
    expect(w.find('[data-test=next]').exists()).toBe(true)
    w.unmount()
  })

  async function toCircuit(w: W) {
    for (const id of ['trace', 'clues', 'mark', 'cross']) {
      await play(w, id)
      await click(w, 'next')
    }
    expect(title(w)).toBe('Ton premier circuit')
  }

  it('circuit réussi : le serveur reçoit le tracé et verse la récompense', async () => {
    const w = mount(TutorialView, { attachTo: document.body })
    await toCircuit(w)
    const calls = mockReward({ status: 200, body: { ok: true, earned: 50, coins: 50 } })
    await play(w, 'circuit')
    await wait()
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('/api/tutorial/complete')
    expect((calls[0].body as { edges: string[] }).edges).toHaveLength(sol('circuit').length - 1)
    expect(w.find('[data-test=receipt-total]').text()).toContain('+50')
    // fin : deux boutons seulement, « Rejouer » et « Quitter »
    expect(w.find('[data-test=restart]').text()).toBe('Rejouer')
    expect(w.find('[data-test=leave]').text()).toBe('Quitter')
    await click(w, 'restart')
    expect(title(w)).toBe('Tracer une voie') // on repart à l'exercice 1, étape 1
    expect(w.find('[data-test=coach]').text()).toContain('Exercice 1 sur')
    w.unmount()
  })

  it('fin du tutoriel : « Quitter » ramène à l\'accueil', async () => {
    const go = vi.fn()
    const w = mount(TutorialView, { attachTo: document.body, global: { provide: { go } } })
    await toCircuit(w)
    mockReward({ status: 200, body: { ok: true, earned: 0, coins: 50 } })
    await play(w, 'circuit')
    await wait()
    await click(w, 'leave')
    expect(go).toHaveBeenCalledWith('home')
    w.unmount()
  })

  it('récompense déjà reçue : on le dit, sans afficher de gain', async () => {
    const w = mount(TutorialView, { attachTo: document.body })
    await toCircuit(w)
    mockReward({ status: 200, body: { ok: true, earned: 0, coins: 50 } })
    await play(w, 'circuit')
    await wait()
    expect(w.find('[data-test=already]').exists()).toBe(true)
    expect(w.find('[data-test=receipt]').exists()).toBe(false)
    w.unmount()
  })

  it('serveur injoignable : un message, pas de récompense inventée', async () => {
    const w = mount(TutorialView, { attachTo: document.body })
    await toCircuit(w)
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('réseau') }))
    await play(w, 'circuit')
    await wait()
    expect(w.find('[data-test=reward-failed]').exists()).toBe(true)
    w.unmount()
  })
})

describe('paysage de l\'accueil selon le biome', () => {
  it('prend les couleurs du biome : herbe, voie et ciel changent', () => {
    const plaine = mount(LandscapeBg, { props: { theme: 'plaine' } })
    const desert = mount(LandscapeBg, { props: { theme: 'desert' } })
    expect(plaine.attributes('data-theme')).toBe('plaine')
    expect(desert.attributes('data-theme')).toBe('desert')
    expect(plaine.html()).toContain(PAL.plaine.a)
    expect(desert.html()).toContain(PAL.desert.a)
    expect(desert.html()).not.toContain(PAL.plaine.a)
    expect(plaine.attributes('style')).not.toBe(desert.attributes('style'))
  })
  it('sans biome : la plaine ; la nuit (lune, néon) montre des étoiles', () => {
    expect(mount(LandscapeBg).attributes('data-theme')).toBe('plaine')
    expect(mount(LandscapeBg).find('[data-test=stars]').exists()).toBe(false)
    expect(mount(LandscapeBg, { props: { theme: 'lune' } }).find('[data-test=stars]').exists()).toBe(true)
  })
  it('le biome suit le niveau en cours', () => {
    setHomeLevel(1)
    expect(homeTheme.value).toBe(themeForLevel(1))
    setHomeLevel(61)
    expect(homeTheme.value).toBe(themeForLevel(61))
    expect(themeForLevel(61)).not.toBe(themeForLevel(1))
  })
})
