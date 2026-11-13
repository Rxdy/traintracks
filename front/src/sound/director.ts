// Le chef d'orchestre : décide QUAND chaque son joue, pour que le mélange reste lisible.
//
// Règles (les sons eux-mêmes sont dans engine.ts) :
//  - une seule « scène » sonore à la fois :
//      jeu (grille nue) : seulement les petits sons d'action ;
//      victoire         : le son de révélation, seul ;
//      train            : rails + moteur (+ cloche au passage à niveau), RIEN du décor ;
//      décor            : un seul fond continu (eau, sinon moulin, sinon vent), plus de rares sons d'animaux ;
//  - le décor se tait sous les sons importants (révélation, pièces) puis revient ;
//  - un son d'animal ne joue pas plus souvent que son délai propre, et jamais deux à moins de 3 s ;
//  - tout peut être coupé (réglage conservé), et tout s'arrête en quittant le niveau.
import { ref } from 'vue'
import type { Scenery } from '../scenery'
import * as real from './engine'
import { setBus, BUS_LEVEL, type LoopName, type SfxName } from './engine'

export interface Engine {
  play(name: SfxName): void
  startLoop(name: LoopName): () => void
  setBus(name: 'sfx' | 'train' | 'amb', level: number, seconds?: number): void
}

const KEY = 'tt-sound'
function read(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}
export const soundOn = ref(read())

export type Phase = 'idle' | 'reveal' | 'train' | 'scene'
type Ambient = 'boat' | 'duck' | 'bird' | 'owl' | 'squirrel' | 'car'
const COOLDOWN: Record<Ambient, number> = { boat: 25, duck: 12, bird: 10, owl: 14, squirrel: 8, car: 8 }
const GLOBAL_GAP = 3

export function createDirector(engine: Engine, now: () => number = () => performance.now() / 1000) {
  let phase: Phase = 'idle'
  let scenery: Scenery | null = null
  const loops = new Map<LoopName, () => void>()
  const last = new Map<string, number>()
  let lastAny = -Infinity
  let duckTimer = 0
  let bellOn = false
  let barrierClosed = false

  const stopLoop = (n: LoopName) => { loops.get(n)?.(); loops.delete(n) }
  const startLoop = (n: LoopName) => { if (!loops.has(n)) loops.set(n, engine.startLoop(n)) }
  const stopTrain = () => { stopLoop('clack'); stopLoop('chug'); stopLoop('bell'); bellOn = false; barrierClosed = false }
  const stopAmbience = () => { stopLoop('water'); stopLoop('wind'); stopLoop('windmill') }
  // le décor s'efface un instant sous un son important
  function duck(seconds: number) {
    engine.setBus('amb', BUS_LEVEL.amb * 0.25, 0.1)
    clearTimeout(duckTimer)
    duckTimer = window.setTimeout(() => engine.setBus('amb', BUS_LEVEL.amb, 0.8), seconds * 1000)
  }
  function bedFor(sc: Scenery): LoopName | null {
    if (sc.theme === 'hiver') return 'wind' // eau gelée : pas de ruisseau
    if (sc.river || sc.pond.length) return 'water'
    if (sc.tiles.some((row) => row.some((t) => t.kind === 'windmill'))) return 'windmill'
    if (sc.theme === 'montagne') return 'wind'
    return null
  }

  return {
    get phase() { return phase },
    get loopsRunning() { return [...loops.keys()] },
    // petit son d'action pendant la partie
    sfx(name: 'clear' | 'error') {
      if (!soundOn.value) return
      engine.play(name)
    },
    // victoire : la révélation joue SEULE, le décor ne dit rien
    reveal(sc: Scenery) {
      scenery = sc
      phase = 'reveal'
      stopAmbience()
      if (soundOn.value) engine.play('reveal')
    },
    trainStart() {
      phase = 'train'
      stopAmbience()
      if (!soundOn.value) return
      startLoop('clack')
      startLoop('chug')
    },
    // la barrière se baisse (cloche + cliquet) ou se relève (cliquet seul)
    crossing(closed: boolean) {
      if (phase !== 'train' || !soundOn.value || closed === barrierClosed) return
      barrierClosed = closed
      engine.play('barrier')
      if (closed) { startLoop('bell'); bellOn = true } else { stopLoop('bell'); bellOn = false }
    },
    trainEnd() {
      stopTrain()
      if (!scenery) { phase = 'idle'; return }
      phase = 'scene'
      if (!soundOn.value) return
      const b = bedFor(scenery)
      if (b) startLoop(b)
    },
    coin() {
      if (!soundOn.value) return
      duck(1.2)
      engine.play('coin')
    },
    // un son d'animal ou de véhicule : seulement quand le décor est seul à l'écran, et rarement
    ambient(name: Ambient) {
      if (!soundOn.value || phase !== 'scene') return
      const t = now()
      if (t - lastAny < GLOBAL_GAP) return
      if (t - (last.get(name) ?? -Infinity) < COOLDOWN[name]) return
      if (name === 'car' && bellOn) return
      last.set(name, t)
      lastAny = t
      engine.play(name)
    },
    setOn(v: boolean) {
      soundOn.value = v
      try { localStorage.setItem(KEY, v ? 'on' : 'off') } catch { /* stockage indisponible */ }
      if (!v) { stopTrain(); stopAmbience() } else if (phase === 'scene' && scenery) { const b = bedFor(scenery); if (b) startLoop(b) }
    },
    // quitter le niveau, ou rejouer le train
    reset() {
      stopTrain(); stopAmbience()
      phase = 'idle'; scenery = null
      clearTimeout(duckTimer)
      engine.setBus('amb', BUS_LEVEL.amb, 0.05)
    },
  }
}

export const sound = createDirector({ play: real.play, startLoop: real.startLoop, setBus })
export { unlock, suspend, available } from './engine'
