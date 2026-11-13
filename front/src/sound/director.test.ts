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
  it('victoire : la révélation joue seule, sans fond de décor', () => {
    const { d, played, started } = setup()
    d.reveal(riverScene())
    expect(played).toEqual(['reveal'])
    expect(started).toEqual([])
    expect(d.phase).toBe('reveal')
  })

  it('train : rails et moteur seulement, et aucun son du décor', () => {
    const { d, played, started, tick } = setup()
    d.reveal(riverScene()); played.length = 0
    d.trainStart()
    expect(started.sort()).toEqual(['chug', 'clack'])
    tick(100)
    d.ambient('bird'); d.ambient('owl'); d.ambient('car')
    expect(played).toEqual([])
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

  it('après le train : le train se tait, UN seul fond continu démarre (eau)', () => {
    const { d, started, stopped } = setup()
    d.reveal(riverScene()); d.trainStart(); started.length = 0
    d.trainEnd()
    expect(stopped).toEqual(expect.arrayContaining(['clack', 'chug']))
    expect(started).toEqual(['water'])
    expect(d.phase).toBe('scene')
  })

  it('hiver : le vent, jamais le ruisseau (l\'eau est gelée)', () => {
    const { d, started } = setup()
    d.reveal(winterScene()); d.trainStart(); started.length = 0
    d.trainEnd()
    expect(started).toEqual(['wind'])
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
})
