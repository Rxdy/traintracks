import { describe, it, expect } from 'vitest'

// Les niveaux (et leurs solutions) ne doivent jamais être embarqués dans l'application : sinon n'importe qui
// les lirait avant de jouer. Ils ne sont importables que par les tests.
describe('les niveaux restent côté serveur', () => {
  const files = import.meta.glob(['./**/*.ts', './**/*.vue'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>
  const app = Object.entries(files).filter(([f]) => !/\.test\.ts$/.test(f) && !/test(Levels|Server)\.ts$/.test(f))

  it('aucun fichier de l\'application n\'importe les niveaux', () => {
    expect(app.length).toBeGreaterThan(20)
    for (const [f, src] of app) {
      expect(src, f).not.toMatch(/testLevels|server\/data|levels\.json/)
    }
  })
  it('le front n\'a plus de fichier levels.ts', () => {
    expect(Object.keys(files).some((f) => /\/levels\.ts$/.test(f))).toBe(false)
  })
})
