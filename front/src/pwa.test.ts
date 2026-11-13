import { describe, it, expect, vi } from 'vitest'
import manifestRaw from '../public/manifest.webmanifest?raw'
import swRaw from '../public/sw.js?raw'
import indexHtml from '../index.html?raw'

// Liste des fichiers du dossier public (clés relatives, ex. « ../public/icon.svg »).
const publicFiles = Object.keys(import.meta.glob('../public/**/*', { query: '?url', import: 'default' }))
const exists = (src: string) => publicFiles.includes('../public/' + src.replace(/^\//, ''))

describe('PWA', () => {
  const manifest = JSON.parse(manifestRaw)

  it('manifeste installable : nom, démarrage, mode standalone, icônes 192 et 512', () => {
    expect(manifest.name).toBe('Train Tracks')
    expect(manifest.start_url).toBe('/')
    expect(manifest.display).toBe('standalone')
    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes)
    expect(sizes).toContain('192x192')
    expect(sizes).toContain('512x512')
  })

  it('icônes : « any » et « maskable » déclarées séparément (pas « any maskable »)', () => {
    const purposes = manifest.icons.map((i: { purpose: string }) => i.purpose)
    expect(purposes).toContain('maskable')
    expect(purposes).toContain('any')
    expect(purposes).not.toContain('any maskable')
  })

  it('captures d\'écran déclarées pour la fenêtre d\'installation, toutes présentes', () => {
    expect(manifest.screenshots.length).toBeGreaterThanOrEqual(2)
    for (const sh of manifest.screenshots) expect(exists(sh.src), sh.src).toBe(true)
  })

  it('chaque icône déclarée existe', () => {
    for (const i of manifest.icons) expect(exists(i.src), i.src).toBe(true)
    expect(exists('apple-touch-icon.png')).toBe(true)
  })

  it('index.html lie le manifeste et définit theme-color', () => {
    expect(indexHtml).toContain('rel="manifest"')
    expect(indexHtml).toContain('name="theme-color"')
  })

  it('le service worker pré-cache uniquement des fichiers qui existent', () => {
    const list = /PRECACHE = \[(.*?)\]/s.exec(swRaw)![1].match(/'([^']+)'/g)!.map((s) => s.slice(1, -1))
    expect(list.length).toBeGreaterThan(2)
    for (const f of list) if (f !== '/') expect(exists(f), f).toBe(true)
  })
})

describe('service worker : l\'API ne passe jamais par le cache', () => {
  // Exécute sw.js avec un faux `self` pour observer ce qu'il intercepte.
  function load() {
    const handlers: Record<string, (e: unknown) => void> = {}
    const self = { location: { origin: 'http://site.test' }, addEventListener: (t: string, h: (e: unknown) => void) => (handlers[t] = h), skipWaiting: vi.fn(), clients: { claim: vi.fn() } }
    new Function('self', 'caches', 'fetch', swRaw)(self, { match: vi.fn(async () => undefined), open: vi.fn(async () => ({ put: vi.fn() })), keys: vi.fn(async () => []) }, vi.fn(async () => ({ ok: true, clone: () => ({}) })))
    const intercepts = (url: string, mode = 'cors') => {
      const respondWith = vi.fn()
      handlers.fetch({ request: { method: 'GET', url, mode }, respondWith })
      return respondWith.mock.calls.length > 0
    }
    return intercepts
  }
  it('ignore /api/* (session et progression privées), intercepte le reste', () => {
    const intercepts = load()
    expect(intercepts('http://site.test/api/me')).toBe(false)
    expect(intercepts('http://site.test/api/level/next')).toBe(false)
    expect(intercepts('http://site.test/assets/app.js')).toBe(true)
    expect(intercepts('http://site.test/', 'navigate')).toBe(true)
  })
  it('ignore aussi les autres origines', () => {
    expect(load()('http://autre.test/x.js')).toBe(false)
  })
})
