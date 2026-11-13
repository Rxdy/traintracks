import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createDirector, soundOn } from './director'
import { levels } from '../testLevels'
import { buildScenery } from '../scenery'

function setup() {
  const played: string[] = []
  const started: string[] = []
  const stopped: string[] = []
  const engine = {
    play: (n: string) => void played.push(n),
    startLoop: (n: string) => { started.push(n); return () => void stopped.push(n) },
    setBus: vi.fn(),
  }
  let clock = 0
  const d = createDirector(engine as never, () => clock)
  return { d, played, started, stopped, tick: (s: number) => (clock += s) }
}
// un niveau avec rivière, un avec moulin
const riverScene = () => { for (const lv of levels) { const s = buildScenery(lv.puzzle, lv.solution, 'plaine'); if (s.river) return s } throw new Error('pas de rivière') }
const winterScene = () => buildScenery(levels[0].puzzle, levels[0].solution, 'hiver')

beforeEach(() => { soundOn.value = true })

describe('chef d\'orchestre des sons', () => {
  it('victoire : la révélation joue seule d\'abord ; le fond du décor n\'arrive que 1,5 s plus tard', () => {
    vi.useFakeTimers()
    const { d, played, started } = setup()
    d.reveal(riverScene())
    expect(played).toEqual(['reveal'])
    expect(started).toEqual([])
    vi.advanceTimersByTime(1600)
    expect(started).toEqual(['water'])
    expect(d.phase).toBe('reveal')
    vi.useRealTimers()
  })

  it('train : il se mêle au décor au lieu de le couper (fond conservé, animaux permis)', () => {
    vi.useFakeTimers()
    const { d, played, started, stopped, tick } = setup()
    d.reveal(riverScene()); vi.advanceTimersByTime(1600); played.length = 0; started.length = 0
    d.trainStart()
    expect(started.sort()).toEqual(['chug', 'clack'])
    expect(stopped).not.toContain('water') // le ruisseau continue
    tick(100)
    d.ambient('bird')
    expect(played).toEqual(['bird'])
    vi.useRealTimers()
  })

  it('passage à niveau : cloche tant que la barrière est baissée, un cliquet à chaque mouvement', () => {
    const { d, played, started, stopped } = setup()
    d.reveal(riverScene()); d.trainStart(); played.length = 0
    d.crossing(true); d.crossing(true)
    expect(played).toEqual(['barrier'])
    expect(started).toContain('bell')
    d.crossing(false)
    expect(played).toEqual(['barrier', 'barrier'])
    expect(stopped).toContain('bell')
  })

  it('après le train : le train se tait, il ne reste qu\'UN fond continu (eau)', () => {
    vi.useFakeTimers()
    const { d, started, stopped } = setup()
    d.reveal(riverScene()); vi.advanceTimersByTime(1600); d.trainStart()
    d.trainEnd()
    expect(stopped).toEqual(expect.arrayContaining(['clack', 'chug']))
    expect(started.filter((n) => n === 'water')).toHaveLength(1)
    expect(d.phase).toBe('scene')
    vi.useRealTimers()
  })

  it('hiver : le vent, jamais le ruisseau (l\'eau est gelée)', () => {
    const { d, started } = setup()
    d.reveal(winterScene()); d.trainStart(); started.length = 0
    d.trainEnd()
    expect(started).toEqual(['wind'])
    expect(started).not.toContain('water')
  })

  it('animaux : jamais deux à moins de 3 s, et chacun respecte son délai', () => {
    const { d, played, tick } = setup()
    d.reveal(riverScene()); d.trainEnd(); played.length = 0
    d.ambient('bird'); d.ambient('owl')
    expect(played).toEqual(['bird']) // le hibou attend
    tick(3.5); d.ambient('owl')
    expect(played).toEqual(['bird', 'owl'])
    tick(3.5); d.ambient('bird') // l'oiseau a encore 10 s de délai
    expect(played).toEqual(['bird', 'owl'])
    tick(10); d.ambient('bird')
    expect(played).toEqual(['bird', 'owl', 'bird'])
  })

  it('voiture : elle ne se fait entendre qu\'une fois le train et sa cloche arrêtés', () => {
    const { d, played } = setup()
    d.reveal(riverScene()); d.trainStart(); d.crossing(true); d.trainEnd(); played.length = 0
    d.ambient('car')
    expect(played).toEqual(['car']) // la cloche s'arrête avec le train
  })

  it('son coupé : plus rien ne joue, et tout s\'arrête', () => {
    const { d, played, started, stopped } = setup()
    d.reveal(riverScene()); d.trainStart(); d.trainEnd()
    d.setOn(false)
    expect(stopped).toContain('water')
    played.length = 0; started.length = 0
    d.sfx('error'); d.coin(); d.ambient('bird'); d.reveal(riverScene()); d.trainStart()
    expect(played).toEqual([])
    expect(started).toEqual([])
    d.setOn(true)
  })

  it('reset (quitter le niveau) : tout s\'arrête', () => {
    const { d, stopped } = setup()
    d.reveal(riverScene()); d.trainStart(); d.reset()
    expect(stopped).toEqual(expect.arrayContaining(['clack', 'chug']))
    expect(d.phase).toBe('idle')
  })

  it('pose d\'un rail : jamais plus d\'un son toutes les 70 ms, pitch qui monte dans un glissé, seulement en partie', () => {
    const pitches: number[] = []
    const engine = { play: (n: string, k?: number) => { if (n === 'pose') pitches.push(k ?? 1) }, startLoop: () => () => {}, setBus: vi.fn() }
    let clock = 0
    const d = createDirector(engine as never, () => clock)
    d.pose(); clock += 0.03; d.pose() // trop proche : ignoré
    expect(pitches).toHaveLength(1)
    for (let i = 0; i < 12; i++) { clock += 0.15; d.pose() }
    expect(pitches).toHaveLength(13)
    expect(pitches[9]).toBeGreaterThan(pitches[1] * 1.1) // monte le long du glissé…
    expect(Math.max(...pitches)).toBeLessThan(1.5) // …mais reste sage
    clock += 1; d.pose() // pause : repart de zéro
    expect(pitches.at(-1)!).toBeLessThan(1.1)
    d.reveal(buildScenery(levels[0].puzzle, levels[0].solution, 'plaine')) // victoire : plus de bruit de pose
    clock += 1; d.pose()
    expect(pitches).toHaveLength(14)
  })
})
