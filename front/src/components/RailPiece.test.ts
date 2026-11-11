import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RailPiece from './RailPiece.vue'

describe('RailPiece', () => {
  it('rend un SVG marqué avec les côtés', () => {
    const wrapper = mount(RailPiece, { props: { sides: ['left', 'right'] } })
    const svg = wrapper.find('[data-test="rail"]')
    expect(svg.exists()).toBe(true)
    expect(svg.attributes('data-sides')).toBe('left-right')
  })

  it('dessine 2 rails pour un droit / virage', () => {
    const wrapper = mount(RailPiece, { props: { sides: ['top', 'right'] } })
    expect(wrapper.findAll('.rail-line')).toHaveLength(2)
  })

  it('dessine plus de rails pour une jonction à 3 côtés', () => {
    const wrapper = mount(RailPiece, {
      props: { sides: ['top', 'right', 'bottom'] },
    })
    expect(wrapper.findAll('.rail-line').length).toBeGreaterThan(2)
  })

  it('est bleu (joueur) par défaut', () => {
    const wrapper = mount(RailPiece, { props: { sides: ['left', 'right'] } })
    expect(wrapper.find('[data-test="rail"]').attributes('data-variant')).toBe(
      'user',
    )
    expect(wrapper.classes()).toContain('rail--user')
  })

  it('applique la variante départ (vert) / sortie (rouge)', () => {
    const entry = mount(RailPiece, {
      props: { sides: ['left', 'right'], variant: 'entry' },
    })
    expect(entry.classes()).toContain('rail--entry')

    const exit = mount(RailPiece, {
      props: { sides: ['left', 'right'], variant: 'exit' },
    })
    expect(exit.classes()).toContain('rail--exit')
  })
})
