import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import DemoPlayer from './DemoPlayer.vue'
import { samplePuzzle, sampleSolution, sampleCaptions } from '../puzzle'

describe('DemoPlayer', () => {
  it('pose les rails un à un jusqu\'à la fin de la solution', async () => {
    vi.useFakeTimers()
    const w = mount(DemoPlayer, {
      props: { puzzle: samplePuzzle, path: sampleSolution, captions: sampleCaptions },
    })
    const rails = () => w.findAll('.cell--rail').length
    expect(rails()).toBe(2) // départ + sortie, verrouillés
    await w.find('[data-test=play]').trigger('click')
    await vi.advanceTimersByTimeAsync(800 * 5)
    expect(rails()).toBeGreaterThan(5)
    await vi.advanceTimersByTimeAsync(800 * 40)
    expect(rails()).toBe(sampleSolution.length)
    expect(w.find('[data-test=caption]').text()).toContain('Gagné')
    vi.useRealTimers()
  })
})
