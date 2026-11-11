import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TrackCell from './TrackCell.vue'
import RailPiece from './RailPiece.vue'
import BlockedMark from './BlockedMark.vue'

describe('TrackCell', () => {
  it('rend une case jouable', () => {
    const wrapper = mount(TrackCell)
    expect(wrapper.find('[data-test="cell"]').exists()).toBe(true)
    expect(wrapper.attributes('role')).toBe('gridcell')
  })

  it('est vide par défaut (aucun rail, aucune marque)', () => {
    const wrapper = mount(TrackCell)
    expect(wrapper.findComponent(RailPiece).exists()).toBe(false)
    expect(wrapper.findComponent(BlockedMark).exists()).toBe(false)
    expect(wrapper.classes()).toContain('cell--empty')
  })

  it('affiche la marque ✕ pour la marque cross', () => {
    const wrapper = mount(TrackCell, { props: { mark: 'cross' } })
    expect(wrapper.findComponent(BlockedMark).exists()).toBe(true)
    expect(wrapper.findComponent(RailPiece).exists()).toBe(false)
    expect(wrapper.classes()).toContain('cell--cross')
  })

  it('affiche le rail avec les côtés et la variante fournis', () => {
    const wrapper = mount(TrackCell, {
      props: { mark: 'rail', sides: ['bottom', 'left'], variant: 'entry' },
    })
    const rail = wrapper.findComponent(RailPiece)
    expect(rail.exists()).toBe(true)
    expect(rail.props('sides')).toEqual(['bottom', 'left'])
    expect(rail.props('variant')).toBe('entry')
    expect(wrapper.classes()).toContain('cell--rail')
    expect(wrapper.classes()).toContain('cell--entry')
  })

  it("n'affiche pas de rail si la marque est rail sans côtés", () => {
    const wrapper = mount(TrackCell, { props: { mark: 'rail', sides: null } })
    expect(wrapper.findComponent(RailPiece).exists()).toBe(false)
  })

  it('émet clic gauche et clic droit', async () => {
    const wrapper = mount(TrackCell)
    await wrapper.trigger('click')
    await wrapper.trigger('contextmenu')
    expect(wrapper.emitted('click')).toBeTruthy()
    expect(wrapper.emitted('contextmenu')).toBeTruthy()
  })
})
