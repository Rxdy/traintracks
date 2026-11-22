import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick } from 'vue'

describe('vitesse mémorisée', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  it('« normal » par défaut', async () => {
    const { speed } = await import('./speedPref')
    expect(speed.value).toBe('normal')
  })

  it('un choix est retrouvé par la partie suivante', async () => {
    const a = await import('./speedPref')
    a.speed.value = 'fast'
    await nextTick()
    vi.resetModules() // nouvelle partie : le module est rechargé, le navigateur se souvient
    const b = await import('./speedPref')
    expect(b.speed.value).toBe('fast')
  })

  it('une valeur inconnue en stockage est ignorée', async () => {
    localStorage.setItem('traintracks.vitesse', 'turbo')
    const { speed } = await import('./speedPref')
    expect(speed.value).toBe('normal')
  })
})
