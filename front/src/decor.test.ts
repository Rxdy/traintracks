import { describe, it, expect } from 'vitest'
import { webglAvailable } from './decor'

describe('décor 3D', () => {
  it('sans WebGL (ici : jsdom), la 3D est indisponible : on retombe sur le décor dessiné', () => {
    expect(webglAvailable()).toBe(false)
  })
})
