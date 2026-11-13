import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import App from './App.vue'

// Simule l'événement du navigateur qui signale « cette appli est installable ».
function installEvent(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const e = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: ReturnType<typeof vi.fn>
    userChoice: Promise<{ outcome: string }>
  }
  e.prompt = vi.fn().mockResolvedValue(undefined)
  e.userChoice = Promise.resolve({ outcome })
  return e
}

describe('bouton Installer (PWA)', () => {
  it('absent tant que le navigateur ne propose pas l\'installation', () => {
    const w = mount(App)
    expect(w.find('[data-test=install]').exists()).toBe(false)
  })

  it('apparaît en haut à droite de l\'accueil quand l\'appli est installable, et lance l\'invite', async () => {
    const w = mount(App)
    const ev = installEvent()
    window.dispatchEvent(ev)
    await w.vm.$nextTick()
    expect(ev.defaultPrevented).toBe(true) // l'invite automatique est retenue pour notre bouton
    const btn = w.find('.header .right [data-test=install-btn]') // coin droit de l'en-tête
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')
    expect(ev.prompt).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => expect(w.find('[data-test=install]').exists()).toBe(false)) // utilisable une seule fois
  })

  it('n\'existe que sur l\'accueil, pas dans les autres pages', async () => {
    const w = mount(App)
    window.dispatchEvent(installEvent())
    await w.vm.$nextTick()
    await w.find('[data-test=nav-tuto]').trigger('click')
    expect(w.find('[data-test=install]').exists()).toBe(false)
  })

  it('disparaît quand l\'appli vient d\'être installée', async () => {
    const w = mount(App)
    window.dispatchEvent(installEvent())
    await w.vm.$nextTick()
    expect(w.find('[data-test=install]').exists()).toBe(true)
    window.dispatchEvent(new Event('appinstalled'))
    await w.vm.$nextTick()
    expect(w.find('[data-test=install]').exists()).toBe(false)
  })
})
