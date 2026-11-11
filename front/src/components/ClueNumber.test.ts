import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ClueNumber from './ClueNumber.vue'

describe('ClueNumber', () => {
  it('affiche la valeur', () => {
    const wrapper = mount(ClueNumber, {
      props: { value: 5, orientation: 'row' },
    })
    expect(wrapper.text()).toBe('5')
  })

  it('affiche 0 correctement', () => {
    const wrapper = mount(ClueNumber, {
      props: { value: 0, orientation: 'col' },
    })
    expect(wrapper.text()).toBe('0')
  })

  it('applique la classe et le libellé selon orientation ligne', () => {
    const wrapper = mount(ClueNumber, {
      props: { value: 3, orientation: 'row' },
    })
    expect(wrapper.classes()).toContain('clue--row')
    expect(wrapper.attributes('aria-label')).toBe('Compteur ligne')
  })

  it('applique la classe et le libellé selon orientation colonne', () => {
    const wrapper = mount(ClueNumber, {
      props: { value: 3, orientation: 'col' },
    })
    expect(wrapper.classes()).toContain('clue--col')
    expect(wrapper.attributes('aria-label')).toBe('Compteur colonne')
  })
})
