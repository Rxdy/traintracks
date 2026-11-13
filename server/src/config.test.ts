import { describe, it, expect } from 'vitest'
import { loadConfig } from './config.js'

describe('config', () => {
  it('exige DATABASE_URL', () => expect(() => loadConfig({})).toThrow(/DATABASE_URL/))
  it('cookie Secure seulement en https', () => {
    expect(loadConfig({ DATABASE_URL: 'x', APP_URL: 'http://pi.local:8090' }).secureCookies).toBe(false)
    expect(loadConfig({ DATABASE_URL: 'x', APP_URL: 'https://thetrain.fr/' })).toMatchObject({ secureCookies: true, appUrl: 'https://thetrain.fr' })
  })
})
