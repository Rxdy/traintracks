import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import WinReceipt from './components/WinReceipt.vue'
import CoinBadge from './components/CoinBadge.vue'
import TrackGrid from './components/TrackGrid.vue'
import { fakeServer } from './testServer'
import { flushPromises } from '@vue/test-utils'
import { samplePuzzle } from './puzzle'

describe('facture des gains', () => {
  it('une ligne par gain (libellé à gauche, montant à droite), un trait, puis le total avec la pièce', () => {
    const w = mount(WinReceipt, { props: { lines: [{ label: 'Victoire', amount: 15 }, { label: 'Sans aide', amount: 5 }] } })
    expect(w.findAll('[data-test=receipt-line]').map((l) => [l.find('.label').text(), l.find('.amount').text()])).toEqual([['Victoire', '+15'], ['Sans aide', '+5']])
    expect(w.find('.rule').exists()).toBe(true)
    expect(w.find('[data-test=receipt-total]').text()).toBe('Total+20')
    expect(w.find('[data-test=receipt-total] [data-test=coin-icon]').exists()).toBe(true) // pièce dessinée, pas un emoji
  })
  it('une ligne à zéro n\'est pas affichée (pas de « Sans aide +0 »), et sans aucun gain rien ne s\'affiche', () => {
    const w = mount(WinReceipt, { props: { lines: [{ label: 'Victoire', amount: 15 }, { label: 'Sans aide', amount: 0 }] } })
    expect(w.findAll('[data-test=receipt-line]')).toHaveLength(1)
    expect(w.find('[data-test=receipt-total]').text()).toBe('Total+15')
    expect(mount(WinReceipt, { props: { lines: [{ label: 'Victoire', amount: 0 }] } }).find('[data-test=receipt]').exists()).toBe(false)
  })
  it('la pastille de pièces utilise la pièce dessinée et garde la taille de son contenu', () => {
    fakeServer()
    const w = mount(CoinBadge)
    expect(w.find('[data-test=coin-icon]').exists()).toBe(true)
    expect(w.text()).not.toContain('🪙')
  })
})

describe('chrono : premier geste', () => {
  it('la grille prévient UNE fois, au premier geste (pas à l\'ouverture, pas aux gestes suivants)', async () => {
    const w = mount(TrackGrid, { props: { puzzle: samplePuzzle }, attachTo: document.body })
    expect(w.emitted('begin')).toBeUndefined() // grille affichée, joueur qui lit : le temps ne court pas
    await w.find('[data-r="4"][data-c="0"]').trigger('pointerdown')
    window.dispatchEvent(new Event('pointerup'))
    expect(w.emitted('begin')).toHaveLength(1)
    await w.find('[data-r="5"][data-c="1"]').trigger('pointerdown')
    window.dispatchEvent(new Event('pointerup'))
    expect(w.emitted('begin')).toHaveLength(1)
    w.unmount()
  })
  it('dans le Voyage, le premier geste est envoyé au serveur', async () => {
    const { default: App } = await import('./App.vue')
    const { levels } = await import('./testLevels')
    const srv = fakeServer()
    const w = mount(App, { attachTo: document.body })
    await flushPromises()
    await w.find('[data-test=play]').trigger('click')
    await flushPromises()
    expect(srv.calls.filter((c) => c.includes('/api/journey/begin'))).toHaveLength(0) // niveau affiché, aucun geste
    const [r, c] = levels[0].solution[0]
    await w.find(`[data-r="${r}"][data-c="${c}"]`).trigger('pointerdown')
    window.dispatchEvent(new Event('pointerup'))
    await flushPromises()
    expect(srv.calls.filter((c) => c.includes('/api/journey/begin'))).toHaveLength(1)
    w.unmount()
  })
})
