import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import AidBar from './components/AidBar.vue'
import CoinBadge from './components/CoinBadge.vue'
import TrackGrid from './components/TrackGrid.vue'
import { aids, coins, refreshWallet, type AidInfo } from './wallet'
import { samplePuzzle, sampleSolution, type Given } from './puzzle'

const aid = (id: AidInfo['id'], over: Partial<AidInfo> = {}): AidInfo => ({
  id, price: { colors: 10, cell: 20, cannon: 30, line: 50 }[id], unlockLevel: 10, unlocked: true, stock: 3, cap: 3, demoPending: false, usedThisLevel: false, ...over,
})

// Faux serveur : une réponse par appel, et la liste des appels pour les inspecter.
function server(...replies: { status?: number; body?: object }[]) {
  const calls: { url: string; body: Record<string, unknown> | null }[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url !== '/api/aids') calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null }) // le rafraîchissement du solde n'est pas l'objet des tests
    const r = url === '/api/aids' ? { status: 200, body: { coins: coins.value ?? 0, aids: aids.value } } : (replies.shift() ?? { status: 500 })
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status ?? 200 })
  }))
  return calls
}
const bar = (props: Record<string, unknown> = {}) => mount(AidBar, { props: { size: 6, snapshot: () => ({ edges: ['h:0:0'], crosses: ['1:1'], marks: 2 }), ...props } })

beforeEach(() => {
  coins.value = 40
  aids.value = []
})
afterEach(() => vi.unstubAllGlobals())

describe('pièces affichées', () => {
  it('le solde vient du serveur', async () => {
    aids.value = []
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ coins: 85, aids: [] }), { status: 200 })))
    coins.value = null
    const w = mount(CoinBadge)
    expect(w.find('[data-test=coins-value]').text()).toBe('…')
    await flushPromises()
    expect(w.find('[data-test=coins-value]').text()).toBe('85')
  })
  it('refreshWallet ignore une réponse en erreur', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })))
    coins.value = 7
    await refreshWallet()
    expect(coins.value).toBe(7)
  })
})

describe('présentation d\'un pouvoir qui vient de se débloquer', () => {
  it('au niveau du déblocage, tant que l\'essai offert n\'a pas servi : encadré sans bouton OK, bouton qui clignote, grille bloquée', async () => {
    aids.value = [aid('colors', { unlockLevel: 20, demoPending: true }), aid('cell', { unlockLevel: 50, unlocked: false })]
    const w = bar({ level: 20 })
    const box = w.find('[data-test=aid-new]')
    expect(box.exists()).toBe(true)
    expect(box.text()).toContain('Nouveau pouvoir : Couleurs')
    expect(w.find('[data-test=aid-try]').exists()).toBe(true) // « essaie-le maintenant »
    expect(w.find('[data-test=aid-new-ok]').exists()).toBe(false) // on ne peut pas l'écarter avant d'avoir essayé
    expect(w.find('[data-test=aid-colors]').classes()).toEqual(expect.arrayContaining(['fresh', 'pulse']))
    expect(w.emitted('forced')?.at(-1)).toEqual([true]) // la grille refuse les tracés
  })
  it('après l\'essai : la grille se débloque, l\'encadré se ferme avec OK ; ailleurs il n\'apparaît pas', async () => {
    aids.value = [aid('colors', { unlockLevel: 20, demoPending: false, usedThisLevel: true }), aid('cell', { unlockLevel: 50, unlocked: false })]
    const w = bar({ level: 20 })
    expect(w.emitted('forced')?.at(-1)).toEqual([false])
    expect(w.find('[data-test=aid-colors]').classes()).not.toContain('pulse')
    await w.find('[data-test=aid-new-ok]').trigger('click')
    expect(w.find('[data-test=aid-new]').exists()).toBe(false)
    expect(bar({ level: 21 }).find('[data-test=aid-new]').exists()).toBe(false)
    expect(bar().find('[data-test=aid-new]').exists()).toBe(false)
  })
  it('pendant l\'essai obligatoire, un autre pouvoir renvoie vers le nouveau', async () => {
    aids.value = [aid('colors', { stock: 3 }), aid('cell', { unlockLevel: 50, demoPending: true })]
    const w = bar({ level: 50 })
    await w.find('[data-test=aid-colors]').trigger('click')
    expect(w.find('[data-test=aid-message]').text()).toContain('Essaie d\'abord ton nouveau pouvoir : Une case')
  })
})

describe('barre des aides', () => {
  it('ne montre que les aides débloquées : un rond avec une image et un compteur (4 au déblocage, 3 après l\'essai offert)', () => {
    aids.value = [aid('colors', { demoPending: true }), aid('cell', { stock: 2 }), aid('cannon', { stock: 0 }), aid('line', { unlocked: false })]
    const w = bar()
    expect(w.findAll('.aid')).toHaveLength(4) // 3 pouvoirs + 1 emplacement vide
    expect(w.find('[data-test=aid-line] [data-test=aid-slot]').exists()).toBe(true) // « Une ligne » : emplacement vide
    expect(w.find('[data-test=aid-colors] svg').attributes('data-icon')).toBe('colors') // l'image du pouvoir
    expect(w.find('[data-test=aid-colors] [data-test=aid-count]').text()).toBe('4') // 3 en stock + 1 offerte
    expect(w.find('[data-test=aid-cell] [data-test=aid-count]').text()).toBe('2')
    expect(w.find('[data-test=aid-cannon] [data-test=aid-count]').text()).toContain('30') // à zéro : le prix
    expect(w.find('[data-test=aid-colors]').text()).not.toMatch(/Couleurs/) // pas de texte dans le rond
    expect(w.find('[data-test=aid-colors]').attributes('aria-label')).toContain('4 restantes')
  })
  it('le compteur baisse à chaque usage : 4, puis 3 après l\'essai offert, puis 2', async () => {
    aids.value = [aid('colors', { demoPending: true })]
    const w = bar()
    const n = () => w.find('[data-test=aid-count]').text()
    expect(n()).toBe('4')
    aids.value = [aid('colors', { demoPending: false, usedThisLevel: true })] // le serveur a répondu : essai offert consommé
    await w.vm.$nextTick()
    expect(n()).toBe('3')
    aids.value = [aid('colors', { stock: 2 })]
    await w.vm.$nextTick()
    expect(n()).toBe('2')
  })
  it('dès le niveau 1, tous les emplacements sont visibles, vides : le joueur comprend qu\'il existe d\'autres pouvoirs', async () => {
    aids.value = (['colors', 'cell', 'cannon', 'line'] as const).map((id, i) => aid(id, { unlocked: false, stock: 0, unlockLevel: [20, 50, 80, 110][i] }))
    const server_ = server()
    const w = bar()
    expect(w.findAll('.aid.locked')).toHaveLength(4)
    expect(w.findAll('[data-test=aid-slot]')).toHaveLength(4)
    expect(w.find('[data-test=aid-count]').exists()).toBe(false) // pas de compteur sur un emplacement vide
    expect(w.find('[data-test=aid-cell]').attributes('title')).toContain('niveau 50')
    await w.find('[data-test=aid-cell]').trigger('click')
    expect(w.find('[data-test=aid-message]').text()).toBe('Ce pouvoir se débloque au niveau 50.')
    expect(server_).toHaveLength(0) // aucun appel au serveur
  })

  it('le message d\'un pouvoir ne reste pas sur l\'écran : il se ferme au toucher, sinon tout seul au bout de 4 s', async () => {
    vi.useFakeTimers()
    aids.value = (['colors', 'cell', 'cannon', 'line'] as const).map((id, i) => aid(id, { unlocked: false, stock: 0, unlockLevel: [20, 50, 80, 110][i] }))
    server()
    const w = bar()
    await w.find('[data-test=aid-cell]').trigger('click')
    await w.find('[data-test=aid-message]').trigger('click')
    expect(w.find('[data-test=aid-message]').exists()).toBe(false)
    await w.find('[data-test=aid-cell]').trigger('click')
    expect(w.find('[data-test=aid-message]').exists()).toBe(true)
    vi.advanceTimersByTime(4100)
    await w.vm.$nextTick()
    expect(w.find('[data-test=aid-message]').exists()).toBe(false)
    vi.useRealTimers()
  })
  it('un pouvoir qui se débloque prend la place de son emplacement vide', async () => {
    aids.value = [aid('colors', { unlocked: false, stock: 0 }), aid('cell', { unlocked: false, stock: 0 })]
    const w = bar()
    expect(w.find('[data-test=aid-colors] [data-test=aid-slot]').exists()).toBe(true)
    aids.value = [aid('colors', { demoPending: true }), aid('cell', { unlocked: false, stock: 0 })]
    await w.vm.$nextTick()
    expect(w.find('[data-test=aid-colors] [data-test=aid-slot]').exists()).toBe(false)
    expect(w.find('[data-test=aid-colors] [data-test=aid-count]').text()).toBe('4')
    expect(w.find('[data-test=aid-cell] [data-test=aid-slot]').exists()).toBe(true)
  })
  it('Couleurs : s\'active tout de suite, sans cible, et prévient la grille', async () => {
    aids.value = [aid('colors', { demoPending: true })]
    const calls = server({ body: { ok: true, demo: true, result: { active: true } } })
    const w = bar()
    await w.find('[data-test=aid-colors]').trigger('click')
    await flushPromises()
    expect(calls[0].body).toMatchObject({ aid: 'colors' })
    expect(w.emitted('colors')).toHaveLength(1)
    expect(w.find('[data-test=aid-message]').text()).toContain('activés sur ce niveau')
    expect(w.find('[data-test=aid-colors] svg').attributes('data-icon')).toBe('colors')
  })
  it('Canon : part tout de suite, sans cible, et dit combien de cases sont révélées', async () => {
    aids.value = [aid('cannon', { demoPending: true })]
    const calls = server({ body: { ok: true, demo: true, result: { givens: [{ row: 0, col: 0, sides: ['top', 'right'] }, { row: 1, col: 2, sides: ['left', 'bottom'] }, { row: 3, col: 1, sides: ['top', 'bottom'] }], crosses: [] } } })
    const w = bar()
    await w.find('[data-test=aid-cannon]').trigger('click')
    await flushPromises()
    expect(calls[0].body).toMatchObject({ aid: 'cannon' })
    expect((w.emitted('picking') ?? []).some((e) => e[0] === true)).toBe(false) // pas de choix de case
    expect(w.emitted('reveal')![0][0]).toHaveLength(3)
    expect(w.find('[data-test=aid-message]').text()).toBe('3 cases révélées. (offerte)')
    expect(w.find('[data-test=aid-cannon] svg').attributes('data-icon')).toBe('cannon')
  })
  it('Canon avec tout déjà posé : message clair, rien n\'est révélé', async () => {
    aids.value = [aid('cannon')]
    server({ status: 409, body: { error: 'nothing' } })
    const w = bar()
    await w.find('[data-test=aid-cannon]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test=aid-message]').text()).toContain('déjà bien posé')
    expect(w.emitted('reveal')).toBeUndefined()
  })
  it('Une case : la grille passe en mode choix, le toucher envoie la case, le résultat est posé', async () => {
    aids.value = [aid('cell')]
    const given: Given = { row: 2, col: 3, sides: ['left', 'bottom'] }
    const calls = server({ body: { ok: true, demo: false, result: { givens: [given], crosses: [] } } })
    const w = bar()
    await w.find('[data-test=aid-cell]').trigger('click')
    expect(w.emitted('picking')!.at(-1)).toEqual([true])
    expect(w.find('[data-test=aid-hint]').exists()).toBe(true)
    ;(w.vm as unknown as { onPick(r: number, c: number): void }).onPick(2, 3)
    await flushPromises()
    expect(calls[0].body).toMatchObject({ aid: 'cell', target: { row: 2, col: 3 } })
    expect(w.emitted('reveal')![0]).toEqual([[given], []])
    expect(w.emitted('picking')!.at(-1)).toEqual([false])
  })
  it('Une case hors de la voie : une croix', async () => {
    aids.value = [aid('cell')]
    server({ body: { ok: true, demo: false, result: { givens: [], crosses: [{ row: 0, col: 0 }] } } })
    const w = bar()
    await w.find('[data-test=aid-cell]').trigger('click')
    ;(w.vm as unknown as { onPick(r: number, c: number): void }).onPick(0, 0)
    await flushPromises()
    expect(w.emitted('reveal')![0]).toEqual([[], [{ row: 0, col: 0 }]])
  })
  it('Une ligne : choix d\'une ligne ou d\'une colonne (numérotées à partir de 1, envoyées à partir de 0)', async () => {
    aids.value = [aid('line')]
    const calls = server({ body: { ok: true, demo: false, result: { givens: [], crosses: [] } } }, { body: { ok: true, demo: false, result: { givens: [], crosses: [] } } })
    const w = bar()
    await w.find('[data-test=aid-line]').trigger('click')
    expect(w.findAll('[data-test^=aid-row-]')).toHaveLength(6)
    await w.find('[data-test=aid-row-1]').trigger('click')
    await flushPromises()
    expect(calls[0].body).toMatchObject({ target: { axis: 'row', index: 1 } })
    await w.find('[data-test=aid-line]').trigger('click')
    await w.find('[data-test=aid-col-4]').trigger('click')
    await flushPromises()
    expect(calls[1].body).toMatchObject({ target: { axis: 'col', index: 4 } })
  })
  it('Annuler ferme le choix sans rien envoyer', async () => {
    aids.value = [aid('line')]
    const calls = server()
    const w = bar()
    await w.find('[data-test=aid-line]').trigger('click')
    await w.find('[data-test=aid-cancel]').trigger('click')
    expect(w.find('[data-test=aid-panel]').exists()).toBe(false)
    expect(calls).toHaveLength(0)
  })

  it('stock vide : le prix est affiché, rien n\'est acheté avant la confirmation', async () => {
    aids.value = [aid('cell', { stock: 0 })]
    const calls = server({ body: { ok: true, coins: 20, stock: 1 } })
    const w = bar()
    await w.find('[data-test=aid-cell]').trigger('click')
    expect(w.find('[data-test=aid-panel]').text()).toContain('20') // prix de « Une case »
    expect(calls).toHaveLength(0)
    await w.find('[data-test=aid-confirm]').trigger('click')
    await flushPromises()
    expect(calls[0]).toEqual({ url: '/api/aids/buy', body: { aid: 'cell' } })
    expect(w.find('[data-test=aid-message]').text()).toBe('Acheté.')
  })
  it('achat refusé (pas assez de pièces) : message du serveur', async () => {
    aids.value = [aid('cell', { stock: 0 })]
    server({ status: 402, body: { error: 'poor' } })
    const w = bar()
    await w.find('[data-test=aid-cell]').trigger('click')
    await w.find('[data-test=aid-confirm]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test=aid-message]').text()).toBe('Pas assez de pièces.')
  })
  it('déjà utilisée sur ce niveau : rien n\'est envoyé', async () => {
    aids.value = [aid('colors', { usedThisLevel: true })]
    const calls = server()
    const w = bar()
    await w.find('[data-test=aid-colors]').trigger('click')
    expect(w.find('[data-test=aid-message]').text()).toBe('Déjà utilisée sur ce niveau.')
    expect(calls).toHaveLength(0)
  })
  it('erreurs du serveur : messages clairs, rien n\'est posé', async () => {
    aids.value = [aid('colors')]
    server({ status: 402, body: { error: 'no_stock' } }, { status: 409, body: { error: 'nothing' } })
    const w = bar()
    await w.find('[data-test=aid-colors]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test=aid-message]').text()).toContain('rachète')
    expect(w.emitted('reveal')).toBeUndefined()
  })
})

// --- La grille applique les rails révélés ------------------------------------------------------------------
const sol = sampleSolution
function givenAt(i: number): Given {
  const side = (a: number[], b: number[]) => (b[0] < a[0] ? 'top' : b[0] > a[0] ? 'bottom' : b[1] < a[1] ? 'left' : 'right')
  return { row: sol[i][0], col: sol[i][1], sides: [side(sol[i], sol[i - 1]), side(sol[i], sol[i + 1])] as Given['sides'] }
}
const edgeBetween = (a: number[], b: number[]) => (a[0] === b[0] ? `h:${a[0]}:${Math.min(a[1], b[1])}` : `v:${Math.min(a[0], b[0])}:${a[1]}`)
type GridApi = { reveal(g: Given[], c: { row: number; col: number }[]): void; snapshotForAid(): { edges: string[]; crosses: string[] } }

describe('grille : rails révélés', () => {
  const mountGrid = (props: Record<string, unknown> = {}) => mount(TrackGrid, { props: { puzzle: samplePuzzle, ...props }, attachTo: document.body })

  it('pose les deux liaisons de la case, dans le bon sens', async () => {
    const w = mountGrid()
    const api = w.vm as unknown as GridApi
    api.reveal([givenAt(2)], [])
    await w.vm.$nextTick()
    const e = api.snapshotForAid().edges
    expect(e).toContain(edgeBetween(sol[1], sol[2]))
    expect(e).toContain(edgeBetween(sol[2], sol[3]))
    expect(e).toHaveLength(2)
    w.unmount()
  })
  it('la case révélée est verrouillée : un toucher ne l\'efface pas, ni « Effacer tout », ni annuler', async () => {
    const w = mountGrid()
    const api = w.vm as unknown as GridApi
    api.reveal([givenAt(2)], [])
    await w.vm.$nextTick()
    const [r, c] = sol[2]
    await w.find(`[data-r="${r}"][data-c="${c}"]`).trigger('pointerdown')
    window.dispatchEvent(new Event('pointerup'))
    await w.find('.clear').trigger('click')
    await w.vm.$nextTick()
    expect(api.snapshotForAid().edges).toHaveLength(2)
    await w.find('[data-test=undo]').trigger('click')
    expect(api.snapshotForAid().edges).toHaveLength(2)
    w.unmount()
  })
  it('efface une liaison fausse du joueur qui touchait la case révélée', async () => {
    const w = mountGrid()
    const api = w.vm as unknown as GridApi
    // une case de la voie qui a un voisin libre (hors voie, dans la grille)
    const onPath = (n: number[]) => sol.some((s) => s[0] === n[0] && s[1] === n[1])
    let idx = -1
    let free: number[] = []
    for (let i = 2; i < sol.length - 2 && idx < 0; i++) {
      const [r, c] = sol[i]
      const n = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].find((x) => x[0] >= 0 && x[1] >= 0 && x[0] < 8 && x[1] < 8 && !onPath(x))
      if (n) { idx = i; free = n }
    }
    expect(idx).toBeGreaterThan(0)
    const [r, c] = sol[idx]
    await w.find(`[data-r="${r}"][data-c="${c}"]`).trigger('pointerdown')
    await w.find(`[data-r="${free[0]}"][data-c="${free[1]}"]`).trigger('pointerenter')
    window.dispatchEvent(new Event('pointerup'))
    expect(api.snapshotForAid().edges).toContain(edgeBetween([r, c], free))
    api.reveal([givenAt(idx)], [])
    await w.vm.$nextTick()
    expect(api.snapshotForAid().edges).not.toContain(edgeBetween([r, c], free))
    w.unmount()
  })
  it('une case révélée vide reçoit une croix', async () => {
    const w = mountGrid()
    const api = w.vm as unknown as GridApi
    api.reveal([], [{ row: 0, col: 7 }])
    await w.vm.$nextTick()
    expect(api.snapshotForAid().crosses).toContain('0:7')
    expect(w.find('[data-r="0"][data-c="7"]').classes()).toContain('cell--cross')
    w.unmount()
  })
  it('mode « choisir une case » : le toucher envoie la case et ne trace rien', async () => {
    const w = mountGrid({ picking: true })
    const [r, c] = [3, 3]
    await w.find(`[data-r="${r}"][data-c="${c}"]`).trigger('pointerdown')
    window.dispatchEvent(new Event('pointerup'))
    expect(w.emitted('pick')).toEqual([[3, 3]])
    expect((w.vm as unknown as GridApi).snapshotForAid().edges).toEqual([])
    expect(w.find('.board').classes()).toContain('picking')
    w.unmount()
  })
  it('reprise : les cases déjà révélées sur ce niveau sont réappliquées au chargement', async () => {
    const w = mountGrid({ initial: { givens: [givenAt(2), givenAt(3)], crosses: [{ row: 0, col: 7 }] } })
    await w.vm.$nextTick()
    const snap = (w.vm as unknown as GridApi).snapshotForAid()
    expect(snap.edges).toHaveLength(3)
    expect(snap.crosses).toContain('0:7')
    w.unmount()
  })
})
