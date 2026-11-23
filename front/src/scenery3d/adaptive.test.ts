import { describe, expect, it } from 'vitest'
import { makeGovernor, STEPS } from './adaptive'

// n images de dt ms ; renvoie le nombre de changements de cran
function run(g: ReturnType<typeof makeGovernor>, n: number, dt: number): number {
  let changes = 0
  for (let i = 0; i < n; i++) if (g.frame(dt)) changes++
  return changes
}

describe('résolution adaptative du décor 3D', () => {
  it('un appareil fluide reste à pleine résolution', () => {
    const g = makeGovernor()
    expect(run(g, 2000, 16.7)).toBe(0)
    expect(g.scale).toBe(1)
  })

  it('les premières images (démarrage) ne comptent pas, même très lentes', () => {
    const g = makeGovernor()
    expect(run(g, 90, 120)).toBe(0)
    expect(g.scale).toBe(1)
  })

  it('un appareil à ~25 images par seconde baisse d\'un cran par fenêtre, jusqu\'au plus bas', () => {
    const g = makeGovernor()
    run(g, 90, 40) // démarrage
    expect(run(g, 40, 40)).toBe(1)
    expect(g.scale).toBe(STEPS[1])
    run(g, 400, 40)
    expect(g.scale).toBe(STEPS[STEPS.length - 1])
    expect(run(g, 400, 40)).toBe(0) // plus bas, il n'y a pas
  })

  it('quelques images lentes isolées (un à-coup) ne font pas baisser la résolution', () => {
    const g = makeGovernor()
    run(g, 90, 16)
    for (let i = 0; i < 20; i++) {
      run(g, 38, 16)
      run(g, 2, 60) // 5 % d'images lentes
    }
    expect(g.scale).toBe(1)
  })

  it('remonte d\'un cran après une longue période fluide, une seule fois : si ça ralentit de nouveau, il reste bas', () => {
    const g = makeGovernor()
    run(g, 90, 40)
    run(g, 40, 40) // → cran 1
    expect(g.step).toBe(1)
    run(g, 40 * 5, 16) // cinq fenêtres fluides
    expect(g.step).toBe(0)
    run(g, 40, 40) // la remontée ralentit : on rebaisse…
    expect(g.step).toBe(1)
    run(g, 40 * 20, 16) // … et on ne remonte plus jamais
    expect(g.step).toBe(1)
  })

  it('une reprise d\'onglet (image de plusieurs secondes) n\'est pas une mesure', () => {
    const g = makeGovernor()
    run(g, 90, 16)
    expect(run(g, 100, 5000)).toBe(0)
    expect(g.scale).toBe(1)
  })
})
