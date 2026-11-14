import { describe, it, expect, vi, afterEach } from 'vitest'
import { nextTick } from 'vue'

// Le style du décor : 3D par défaut, forçable par l'adresse, gardé sur l'appareil ; sans WebGL, toujours le classique.
async function load(search = '', stored?: string) {
  vi.resetModules()
  window.history.replaceState(null, '', '/' + search)
  window.localStorage.clear()
  if (stored) window.localStorage.setItem('decor', stored)
  return import('./decor')
}

describe('style du décor', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/')
    window.localStorage.clear()
  })

  it('3D par défaut', async () => {
    expect((await load()).decorMode.value).toBe('3d')
  })

  it('le choix est gardé sur l\'appareil', async () => {
    const m = await load()
    m.decorMode.value = 'svg'
    await nextTick()
    expect(window.localStorage.getItem('decor')).toBe('svg')
    expect((await load('', 'svg')).decorMode.value).toBe('svg')
  })

  it('?decor=svg ou ?decor=3d force le style, une valeur inconnue est ignorée', async () => {
    expect((await load('?decor=svg', '3d')).decorMode.value).toBe('svg')
    expect((await load('?decor=3d', 'svg')).decorMode.value).toBe('3d')
    expect((await load('?decor=xyz')).decorMode.value).toBe('3d')
  })

  it('sans WebGL (ici : jsdom), le décor 3D est indisponible', async () => {
    expect((await load()).webglAvailable()).toBe(false)
  })
})
