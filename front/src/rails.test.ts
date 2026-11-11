import { describe, it, expect } from 'vitest'
import { railShapeForSides } from './rails'
import type { Side } from './cell'

const ALL_SETS: Side[][] = [
  ['left', 'right'], // droit horizontal
  ['top', 'bottom'], // droit vertical
  ['top', 'right'], // virage
  ['top', 'left'],
  ['bottom', 'right'],
  ['bottom', 'left'],
  ['top', 'right', 'bottom'], // jonction en T
  ['top', 'right', 'bottom', 'left'], // croisement +
]

describe('railShapeForSides', () => {
  it('produit toujours des rails et des traverses', () => {
    for (const sides of ALL_SETS) {
      const shape = railShapeForSides(sides)
      expect(shape.rails.length).toBeGreaterThan(0)
      expect(shape.sleepers.length).toBeGreaterThan(0)
    }
  })

  it('un virage (2 côtés adjacents) est un arc (2 rails)', () => {
    const shape = railShapeForSides(['top', 'right'])
    expect(shape.rails).toHaveLength(2)
    for (const d of shape.rails) expect(d).toContain('A')
  })

  it('un droit (2 côtés opposés) est fait de segments de ligne', () => {
    const shape = railShapeForSides(['left', 'right'])
    for (const d of shape.rails) expect(d).not.toContain('A')
    // demi-rails gauche + droite formant les lignes y = 38 et y = 62
    expect(shape.rails).toContain('M 0 38 L 50 38')
    expect(shape.rails).toContain('M 50 38 L 100 38')
  })

  it('une jonction en T (3 côtés) a plus de rails qu\'un droit', () => {
    const straight = railShapeForSides(['left', 'right']).rails.length
    const tee = railShapeForSides(['top', 'right', 'bottom']).rails.length
    expect(tee).toBeGreaterThan(straight)
  })

  it('un croisement + (4 côtés) raccorde les 4 bras', () => {
    const cross = railShapeForSides(['top', 'right', 'bottom', 'left'])
    // 4 bras × 2 rails
    expect(cross.rails).toHaveLength(8)
  })

  it('ne produit jamais de NaN', () => {
    for (const sides of ALL_SETS) {
      const shape = railShapeForSides(sides)
      for (const d of [...shape.rails, ...shape.sleepers]) {
        expect(d).not.toContain('NaN')
      }
    }
  })
})
