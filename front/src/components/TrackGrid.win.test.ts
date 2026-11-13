import { describe, it, expect, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mount } from '@vue/test-utils'
import TrackGrid from './TrackGrid.vue'
import TrainRun from './TrainRun.vue'
import { samplePuzzle, sampleSolution } from '../puzzle'
import { timing } from '../scenery'

describe('TrackGrid : victoire', () => {
  it('détecte la solution tracée, lance le train et émet solved', async () => {
    const w = mount(TrackGrid, { props: { puzzle: samplePuzzle }, attachTo: document.body })
    const cell = (r: number, c: number) => w.find(`[data-r="${r}"][data-c="${c}"]`)
    expect(w.find('[data-test=win]').exists()).toBe(false)
    const [r0, c0] = sampleSolution[0]
    await cell(r0, c0).trigger('pointerdown')
    for (const [r, c] of sampleSolution.slice(1)) await cell(r, c).trigger('pointerenter')
    window.dispatchEvent(new Event('pointerup'))
    await w.vm.$nextTick()
    // d'abord le train passe ; le résultat n'apparaît qu'une fois le train arrivé
    expect(w.find('[data-test=train]').exists()).toBe(true)
    expect(w.emitted('solved')).toHaveLength(1)
    expect(w.find('[data-test=finish]').exists()).toBe(false)
    w.findComponent(TrainRun).vm.$emit('done')
    await w.vm.$nextTick()
    expect(w.find('[data-test=win]').exists()).toBe(true)
    expect(w.find('[data-test=result-time]').exists()).toBe(true)
    w.unmount()
  })

  it('colore un compteur en vert quand la ligne est complète — seulement si l\'aide « Couleurs » est active', async () => {
    const w = mount(TrackGrid, { props: { puzzle: samplePuzzle, colorHints: true } })
    // ligne 4 : compteur 1 → un seul rail suffit
    const cell = w.find('[data-r="4"][data-c="0"]')
    await cell.trigger('pointerdown')
    window.dispatchEvent(new Event('pointerup'))
    await w.vm.$nextTick()
    const clues = w.findAll('[data-test=clue]')
    // ordre : pour chaque ligne r, son compteur est à l'index (r*1)
    expect(clues[4].classes()).toContain('clue--done')
  })
})

describe('TrackGrid : indicateurs de couleur désactivés par défaut', () => {
  it('même une ligne complète ne change pas la couleur du compteur sans l\'aide', async () => {
    const w = mount(TrackGrid, { props: { puzzle: samplePuzzle } })
    await w.find('[data-r="4"][data-c="0"]').trigger('pointerdown')
    window.dispatchEvent(new Event('pointerup'))
    await w.vm.$nextTick()
    for (const c of w.findAll('[data-test=clue]')) expect(c.classes(), c.text()).toContain('clue--open')
    await w.setProps({ colorHints: true }) // l'aide s'active en cours de niveau
    expect(w.findAll('[data-test=clue]')[4].classes()).toContain('clue--done')
  })
})

describe('TrackGrid : clic droit / deux doigts', () => {
  it('pose une croix, sans poser de rail', async () => {
    const w = mount(TrackGrid, { props: { puzzle: samplePuzzle } })
    const cell = w.find('[data-r="5"][data-c="1"]')
    // Ordre réel sous Linux : pointerdown (bouton 2) → contextmenu → pointerup
    await cell.trigger('pointerdown', { button: 2 })
    await cell.trigger('contextmenu')
    window.dispatchEvent(new Event('pointerup'))
    await w.vm.$nextTick()
    expect(w.find('[data-r="5"][data-c="1"]').classes()).toContain('cell--cross')
  })
})

describe('TrackGrid : aide des compteurs', () => {
  it('au départ aucun compteur n\'est coloré, même un 0 ou un compteur forcé', async () => {
    const { levels } = await import('../testLevels')
    const w = mount(TrackGrid, { props: { puzzle: levels[0].puzzle } }) // niveau 1 : contient des 0
    for (const c of w.findAll('[data-test=clue]')) {
      expect(c.classes(), c.text()).toContain('clue--open')
    }
  })
})

describe('TrackGrid : suite après l\'animation', () => {
  it('le résultat (temps, « Suivant ») s\'affiche au centre de la grille, seulement une fois le train arrivé', async () => {
    const w = mount(TrackGrid, {
      props: { puzzle: samplePuzzle, officialMs: 83_000 },
      attachTo: document.body,
      slots: { win: '<template #win><button data-test="next">Suivant</button></template>' },
    })
    const cell = (r: number, c: number) => w.find(`[data-r="${r}"][data-c="${c}"]`)
    const [r0, c0] = sampleSolution[0]
    await cell(r0, c0).trigger('pointerdown')
    for (const [r, c] of sampleSolution.slice(1)) await cell(r, c).trigger('pointerenter')
    window.dispatchEvent(new Event('pointerup'))
    await w.vm.$nextTick()
    expect(w.find('[data-test=next]').exists()).toBe(false) // le train roule : pas encore de « Suivant »
    w.findComponent(TrainRun).vm.$emit('done')
    await w.vm.$nextTick()
    expect(w.find('[data-test=next]').exists()).toBe(true)
    expect(w.find('[data-test=finish] [data-test=next]').exists()).toBe(true) // dans le panneau, sur la grille
    expect(w.find('[data-test=result-time]').text()).toContain('1:23') // temps officiel du serveur
    w.unmount()
  })
})

describe('TrackGrid : tactile', () => {
  it('l\'appui long pose une croix, et le contextmenu qui le suit sur mobile ne la retire pas', async () => {
    vi.useFakeTimers()
    const w = mount(TrackGrid, { props: { puzzle: samplePuzzle }, attachTo: document.body })
    const cell = w.find('[data-r="5"][data-c="1"]')
    await cell.trigger('pointerdown', { button: 0 })
    vi.advanceTimersByTime(500)
    await w.vm.$nextTick()
    expect(w.find('[data-r="5"][data-c="1"]').classes()).toContain('cell--cross')
    await cell.trigger('contextmenu') // envoyé par Android juste après
    window.dispatchEvent(new Event('pointerup'))
    await w.vm.$nextTick()
    expect(w.find('[data-r="5"][data-c="1"]').classes()).toContain('cell--cross')
    w.unmount()
    vi.useRealTimers()
  })
})

describe('TrackGrid : validation par le serveur', () => {
  async function solve(w: ReturnType<typeof mount>) {
    const cell = (r: number, c: number) => w.find(`[data-r="${r}"][data-c="${c}"]`)
    const [r0, c0] = sampleSolution[0]
    await cell(r0, c0).trigger('pointerdown')
    for (const [r, c] of sampleSolution.slice(1)) await cell(r, c).trigger('pointerenter')
    window.dispatchEvent(new Event('pointerup'))
  }
  it('envoie le tracé et n\'accorde la victoire (et le train) qu\'après la réponse « juste »', async () => {
    let answer!: (ok: boolean) => void
    const validate = vi.fn(() => new Promise<boolean>((r) => (answer = r)))
    const w = mount(TrackGrid, { props: { puzzle: samplePuzzle, validate }, attachTo: document.body })
    await solve(w)
    await flushPromises()
    expect(validate).toHaveBeenCalledTimes(1)
    const edges = validate.mock.calls[0] as unknown as [number, string[]]
    expect(edges[1].every((e) => /^[hv]:\d+:\d+$/.test(e))).toBe(true)
    expect(w.find('[data-test=verifying]').exists()).toBe(true)
    expect(w.find('[data-test=win]').exists()).toBe(false) // pas de victoire tant que le serveur n'a pas répondu
    expect(w.find('[data-test=train]').exists()).toBe(false)
    expect(w.emitted('solved')).toBeUndefined()
    answer(true)
    await flushPromises()
    expect(w.find('[data-test=train]').exists()).toBe(true) // le serveur a dit « juste » : le train part
    expect(w.emitted('solved')).toHaveLength(1)
    w.findComponent(TrainRun).vm.$emit('done')
    await flushPromises()
    expect(w.find('[data-test=win]').exists()).toBe(true)
    w.unmount()
  })
  it('si le serveur refuse : pas de victoire, message, et « Réessayer » renvoie le tracé', async () => {
    const validate = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    const w = mount(TrackGrid, { props: { puzzle: samplePuzzle, validate }, attachTo: document.body })
    await solve(w)
    await flushPromises()
    expect(w.find('[data-test=win]').exists()).toBe(false)
    expect(w.find('[data-test=verify-error]').text()).toContain('serveur')
    await w.find('[data-test=retry]').trigger('click')
    await flushPromises()
    expect(validate).toHaveBeenCalledTimes(2)
    expect(w.find('[data-test=train]').exists()).toBe(true)
    w.findComponent(TrainRun).vm.$emit('done')
    await flushPromises()
    expect(w.find('[data-test=win]').exists()).toBe(true)
    w.unmount()
  })
  it('une erreur réseau (exception) est traitée comme un refus', async () => {
    const validate = vi.fn().mockRejectedValue(new Error('offline'))
    const w = mount(TrackGrid, { props: { puzzle: samplePuzzle, validate }, attachTo: document.body })
    await solve(w)
    await flushPromises()
    expect(w.find('[data-test=win]').exists()).toBe(false)
    expect(w.find('[data-test=verify-error]').exists()).toBe(true)
    w.unmount()
  })
  it('sans serveur à interroger (puzzle du jour pour l\'instant), la victoire reste locale', async () => {
    const w = mount(TrackGrid, { props: { puzzle: samplePuzzle }, attachTo: document.body })
    await solve(w)
    await flushPromises()
    expect(w.find('[data-test=train]').exists()).toBe(true)
    w.findComponent(TrainRun).vm.$emit('done')
    await flushPromises()
    expect(w.find('[data-test=win]').exists()).toBe(true)
    w.unmount()
  })
})

describe('TrackGrid : décor à la victoire', () => {
  it('le décor se dévoile d\'abord, le train ne démarre qu\'ensuite', async () => {
    vi.useFakeTimers()
    timing.revealMs = 2800
    try {
      const w = mount(TrackGrid, { props: { puzzle: samplePuzzle, theme: 'hiver' }, attachTo: document.body })
      expect(w.find('[data-test=scenery]').exists()).toBe(false) // pendant la partie : grille nue
      const cell = (r: number, c: number) => w.find(`[data-r="${r}"][data-c="${c}"]`)
      await cell(...(sampleSolution[0] as [number, number])).trigger('pointerdown')
      for (const [r, c] of sampleSolution.slice(1)) await cell(r, c).trigger('pointerenter')
      window.dispatchEvent(new Event('pointerup'))
      await w.vm.$nextTick()
      expect(w.find('[data-test=scenery]').exists()).toBe(true)
      expect(w.find('.board').classes()).toContain('board--won')
      expect(w.find('[data-test=train]').exists()).toBe(false)
      vi.advanceTimersByTime(2900)
      await w.vm.$nextTick()
      expect(w.find('[data-test=train]').exists()).toBe(true)
      w.unmount()
    } finally {
      timing.revealMs = 0
      vi.useRealTimers()
    }
  })
})

describe('TrackGrid : compteurs à la victoire', () => {
  it('les chiffres indicateurs s\'effacent quand le décor apparaît (la mise en page reste)', async () => {
    const w = mount(TrackGrid, { props: { puzzle: samplePuzzle }, attachTo: document.body })
    expect(w.find('.board').classes()).not.toContain('board--won')
    const cell = (r: number, c: number) => w.find(`[data-r="${r}"][data-c="${c}"]`)
    await cell(sampleSolution[0][0], sampleSolution[0][1]).trigger('pointerdown')
    for (const [r, c] of sampleSolution.slice(1)) await cell(r, c).trigger('pointerenter')
    window.dispatchEvent(new Event('pointerup'))
    await w.vm.$nextTick()
    expect(w.find('.board').classes()).toContain('board--won') // la règle CSS .board--won .clue les masque
    expect(w.findAll('[data-test=clue]').length).toBe(samplePuzzle.size * 2) // toujours dans le DOM : rien ne bouge
    w.unmount()
  })
})

describe('TrackGrid : réduire le résultat pour voir le décor', () => {
  it('on réduit la fenêtre, on relance le train, puis on la rouvre', async () => {
    const w = mount(TrackGrid, { props: { puzzle: samplePuzzle }, attachTo: document.body })
    const cell = (r: number, c: number) => w.find(`[data-r="${r}"][data-c="${c}"]`)
    await cell(sampleSolution[0][0], sampleSolution[0][1]).trigger('pointerdown')
    for (const [r, c] of sampleSolution.slice(1)) await cell(r, c).trigger('pointerenter')
    window.dispatchEvent(new Event('pointerup'))
    await w.vm.$nextTick()
    w.findComponent(TrainRun).vm.$emit('done')
    await w.vm.$nextTick()
    expect(w.find('[data-test=finish]').exists()).toBe(true)
    expect(w.find('[data-test=undo]').exists()).toBe(false) // fin de partie : les outils de tracé laissent la place
    expect(w.find('[data-test=replay]').exists()).toBe(true)

    await w.find('[data-test=fold]').trigger('click') // réduit : le décor est libre
    expect(w.find('[data-test=finish]').exists()).toBe(false)
    expect(w.find('[data-test=scenery]').exists()).toBe(true)

    await w.find('[data-test=replay]').trigger('click') // le train repart
    await w.vm.$nextTick()
    await w.vm.$nextTick()
    expect(w.find('[data-test=train]').exists()).toBe(true)
    expect(w.find('[data-test=replay]').attributes('disabled')).toBeDefined() // pas de relance pendant que le train roule
    w.findComponent(TrainRun).vm.$emit('done')
    await w.vm.$nextTick()
    expect(w.find('[data-test=finish]').exists()).toBe(false) // reste réduit après le passage du train
    expect(w.find('[data-test=replay]').attributes('disabled')).toBeUndefined()

    await w.find('[data-test=reopen]').trigger('click')
    expect(w.find('[data-test=finish]').exists()).toBe(true)
    w.unmount()
  })
})

describe('TrackGrid : téléphone', () => {
  it('pas de fenêtre sur la grille : le résultat s\'affiche sous la grille, dans la zone de victoire', async () => {
    const real = window.matchMedia
    window.matchMedia = ((q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
    try {
      const w = mount(TrackGrid, { props: { puzzle: samplePuzzle }, attachTo: document.body })
      await w.vm.$nextTick()
      expect(w.find('.win-zone').classes()).toContain('win-zone--compact') // la place est prise avant la victoire
      const cell = (r: number, c: number) => w.find(`[data-r="${r}"][data-c="${c}"]`)
      await cell(sampleSolution[0][0], sampleSolution[0][1]).trigger('pointerdown')
      for (const [r, c] of sampleSolution.slice(1)) await cell(r, c).trigger('pointerenter')
      window.dispatchEvent(new Event('pointerup'))
      await w.vm.$nextTick()
      w.findComponent(TrainRun).vm.$emit('done')
      await w.vm.$nextTick()
      expect(w.find('.win-zone').classes()).toContain('win-zone--compact') // zone réservée
      expect(w.find('.board [data-test=finish]').exists()).toBe(false) // rien sur la grille
      expect(w.find('.win-zone [data-test=finish]').exists()).toBe(true) // sous la grille
      expect(w.find('[data-test=reopen]').exists()).toBe(false) // inutile : le résultat reste affiché
      expect(w.find('[data-test=replay]').exists()).toBe(true)
      await w.find('[data-test=replay]').trigger('click') // le train repart : le récapitulatif reste
      await w.vm.$nextTick()
      await w.vm.$nextTick()
      expect(w.find('[data-test=train]').exists()).toBe(true)
      expect(w.find('.win-zone [data-test=finish]').exists()).toBe(true)
      w.unmount()
    } finally {
      window.matchMedia = real
    }
  })
})
