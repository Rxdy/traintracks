import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import App from './App.vue'
import TrackGrid from './components/TrackGrid.vue'
import { samplePuzzle } from './puzzle'

describe('App', () => {
  it('affiche le titre et le sous-titre', () => {
    const wrapper = mount(App)
    expect(wrapper.find('h1').text()).toContain('Train Tracks')
    expect(wrapper.text()).toContain('Puzzle du jour')
  })

  it('monte la grille avec le puzzle standard', () => {
    const wrapper = mount(App)
    const grid = wrapper.findComponent(TrackGrid)
    expect(grid.exists()).toBe(true)
    expect(grid.props('puzzle')).toEqual(samplePuzzle)
  })
})
