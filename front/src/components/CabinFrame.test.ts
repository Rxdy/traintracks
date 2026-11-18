import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CabinFrame from './CabinFrame.vue'
import FinishDialog from './FinishDialog.vue'

const props = { shown: true, scene: null, land: null, progress: 0, running: false }

describe('CabinFrame : fenêtre rangeable', () => {
  beforeEach(() => localStorage.clear())

  it('est ouverte par défaut et la languette la range, puis la rouvre', async () => {
    const w = mount(CabinFrame, { props })
    expect(w.classes()).not.toContain('shut')
    await w.get('[data-test=cabin-tab]').trigger('click')
    expect(w.classes()).toContain('shut')
    expect(w.get('[data-test=cabin-tab]').attributes('aria-label')).toBe('Rouvrir la cabine')
    await w.get('[data-test=cabin-tab]').trigger('click')
    expect(w.classes()).not.toContain('shut')
  })

  it('mémorise le choix du joueur pour le prochain trajet', async () => {
    const a = mount(CabinFrame, { props })
    await a.get('[data-test=cabin-tab]').trigger('click')
    const b = mount(CabinFrame, { props })
    expect(b.classes()).toContain('shut')
  })

  it('reste hors de l’écran tant que le niveau n’est pas gagné', () => {
    const w = mount(CabinFrame, { props: { ...props, shown: false } })
    expect(w.classes()).not.toContain('shown')
    expect(w.attributes('aria-hidden')).toBe('true')
  })
})

describe('FinishDialog', () => {
  it('ouverte : propose de revoir le trajet ou de continuer', async () => {
    const w = mount(FinishDialog, { props: { open: true, canNext: true }, slots: { default: '<p data-test="body">corps</p>' } })
    expect(w.classes()).toContain('open')
    expect(w.get('[data-test=body]').text()).toBe('corps')
    await w.get('[data-test=replay-trip]').trigger('click')
    await w.get('[data-test=next]').trigger('click')
    expect(w.emitted('replay')).toHaveLength(1)
    expect(w.emitted('next')).toHaveLength(1)
  })

  it('sans suite : le message remplace « Niveau suivant »', () => {
    const w = mount(FinishDialog, { props: { open: true, canNext: false, endMessage: 'Bientôt de nouveaux niveaux' } })
    expect(w.find('[data-test=next]').exists()).toBe(false)
    expect(w.get('[data-test=coming-soon]').text()).toContain('Bientôt')
  })
})
