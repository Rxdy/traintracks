import { describe, it, expect } from 'vitest'
import { PAL, PARAMS, THEMES } from './themes'

const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

describe('palettes des environnements', () => {
  it('chaque environnement a une palette et des réglages', () => {
    for (const t of THEMES) {
      expect(PAL[t], t).toBeTruthy()
      expect(PARAMS[t], t).toBeTruthy()
    }
  })
  it('la voie se lit : rails contrastés sur leur lit, et lit distinct du sol (fusion : sur les deux côtés)', () => {
    for (const t of THEMES) {
      const p = PAL[t]
      expect(contrast(p.rail.rail, p.bed), `${t} : rails / lit`).toBeGreaterThanOrEqual(2.5)
      const grounds = t === 'fusion' ? [PAL.hiver.a, PAL.hiver.b, PAL.volcan.a, PAL.volcan.b] : [p.a, p.b]
      for (const g of grounds) expect(contrast(p.bed, g) + contrast(p.bedEdge, g), `${t} : lit / sol ${g}`).toBeGreaterThanOrEqual(2.2)
    }
  })
})
