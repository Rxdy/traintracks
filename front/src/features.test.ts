import { describe, it, expect, beforeEach, vi } from 'vitest'

// La cabine du conducteur est cachée par défaut ; « ?cabine=1 » l'active pour tester, « ?cabine=0 » la recache.
describe('cabine masquée par défaut', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
    window.history.replaceState(null, '', '/')
  })

  it('cachée sans réglage', async () => {
    const { cabinEnabled } = await import('./features')
    expect(cabinEnabled.value).toBe(false)
  })

  it('« ?cabine=1 » l\'active et le choix est gardé pour les visites suivantes', async () => {
    window.history.replaceState(null, '', '/?cabine=1')
    expect((await import('./features')).cabinEnabled.value).toBe(true)
    window.history.replaceState(null, '', '/')
    vi.resetModules()
    expect((await import('./features')).cabinEnabled.value).toBe(true)
  })

  it('« ?cabine=0 » la recache', async () => {
    localStorage.setItem('traintracks.cabine', '1')
    window.history.replaceState(null, '', '/?cabine=0')
    expect((await import('./features')).cabinEnabled.value).toBe(false)
  })
})
