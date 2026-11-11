import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BlockedMark from './BlockedMark.vue'

describe('BlockedMark', () => {
  it('rend une marque ✕ (deux diagonales)', () => {
    const wrapper = mount(BlockedMark)
    expect(wrapper.find('[data-test="blocked"]').exists()).toBe(true)
    expect(wrapper.findAll('path')).toHaveLength(2)
  })
})
