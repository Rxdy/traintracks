// Le chef d'orchestre : décide QUAND chaque son joue, pour que le mélange reste lisible.
//
// Règles (les sons eux-mêmes sont dans engine.ts) :
//  - une seule « scène » sonore à la fois :
//      jeu (grille nue) : seulement les petits sons d'action ;
//      victoire         : le son de révélation d'abord, seul ; le fond du décor n'arrive qu'après, en fondu lent ;
//      train            : rails + moteur, JOUÉS BAS pour se fondre dans le décor qui continue (+ cloche au passage à niveau) ;
//      décor            : un seul fond continu (eau, sinon moulin, sinon vent), plus de rares sons d'animaux ;
//  - le décor se tait sous les sons importants (révélation, pièces) puis revient ;
//  - un son d'animal ne joue pas plus souvent que son délai propre, et jamais deux à moins de 3 s ;
//  - tout peut être coupé (réglage conservé), et tout s'arrête en quittant le niveau.
import { ref } from 'vue'
import type { Scenery } from '../scenery'
import * as real from './engine'
import { setBus, BUS_LEVEL, type LoopName, type SfxName } from './engine'

export interface Engine {
  play(name: SfxName, k?: number): void
  startLoop(name: LoopName): () => void
  setBus(name: 'sfx' | 'train' | 'amb' | 'music' | 'lobby', level: number, seconds?: number): void
  startMusic?(): () => void // musique des menus
  lobbyTrain?(dir: 1 | -1): void // le train qui passe derrière, sur l'accueil
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
  let bedTimer = 0
  let bellOn = false
  let barrierClosed = false
  let lastPose = -Infinity
  let thinks = 0
  let lastThink = -Infinity
  let chain = 0
  // menus (lobby) : musique de fond tant qu'un écran de menu est affiché ; le train de l'accueil sonne un passage sur deux
  let lobbyOn = false
  let stopMusic: (() => void) | null = null
  let passes = 0
  const lobbyTimers: number[] = []
  const musicOn = () => { if (!stopMusic && lobbyOn && soundOn.value && engine.startMusic) stopMusic = engine.startMusic() }
  const musicOff = () => {
    stopMusic?.(); stopMusic = null
    lobbyTimers.splice(0).forEach((t) => clearTimeout(t))
    engine.setBus('music', BUS_LEVEL.music, 0.05)
  }

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
    // Règle : on n'entend que ce qu'on voit. Vent seulement là où la neige tombe ; rien sur un décor sans source.
    if (sc.theme === 'hiver' || sc.theme === 'fusion') return 'wind' // eau gelée : pas de ruisseau
    if (sc.river || sc.pond.length) return 'water'
    if (sc.tiles.some((row) => row.some((t) => t.kind === 'windmill'))) return 'windmill'
    return null
  }

  return {
    get phase() { return phase },
    get loopsRunning() { return [...loops.keys()] },
    // pose d'un rail : s'enchaîne sans agacer. Jamais plus d'un son toutes les 70 ms ; dans un même glissé la hauteur
    // monte un peu (9 degrés au plus), puis repart de zéro après une pause. Seulement pendant la partie.
    pose() {
      if (!soundOn.value || phase !== 'idle') return
      const t = now()
      if (t - lastPose < 0.07) return
      chain = t - lastPose > 0.45 ? 0 : Math.min(chain + 1, 8)
      lastPose = t
      engine.play('pose', (1 + chain * 0.035) * (0.97 + Math.random() * 0.06))
    },
    // réflexion : une note longue et douce quand le joueur reste immobile. Au plus 3 fois par niveau, 45 s d'écart,
    // jamais hors partie ; elle s'éteint dès qu'on touche la grille (activity).
    think() {
      if (!soundOn.value || phase !== 'idle' || thinks >= 3) return
      const t = now()
      if (t - lastThink < 45) return
      thinks++
      lastThink = t
      stopLoop('think')
      loops.set('think', engine.startLoop('think'))
    },
    activity() { stopLoop('think') },
    // petit son d'action pendant la partie
    sfx(name: 'clear' | 'error') {
      if (!soundOn.value) return
      engine.play(name)
    },
    // victoire : la révélation joue d'abord SEULE ; le fond du décor monte ensuite, doucement, sans la couvrir
    reveal(sc: Scenery) {
      scenery = sc
      phase = 'reveal'
      stopAmbience()
      clearTimeout(bedTimer)
      if (!soundOn.value) return
      engine.play('reveal')
      bedTimer = window.setTimeout(() => { const b = bedFor(sc); if (b && phase !== 'idle') startLoop(b) }, 1500)
    },
    // le train se mêle au décor (qui continue) : ses sons sont joués bas, voir le bus « train »
    trainStart() {
      phase = 'train'
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
      if (b) startLoop(b) // déjà lancé en général : sans effet
    },
    coin() {
      if (!soundOn.value) return
      duck(1.2)
      engine.play('coin')
    },
    // un son d'animal ou de véhicule : seulement quand le décor est seul à l'écran, et rarement
    ambient(name: Ambient) {
      if (!soundOn.value || (phase !== 'scene' && phase !== 'train')) return
      const t = now()
      if (t - lastAny < GLOBAL_GAP) return
      if (t - (last.get(name) ?? -Infinity) < COOLDOWN[name]) return
      if (name === 'car' && bellOn) return // la cloche sonne : pas de moteur par-dessus
      last.set(name, t)
      lastAny = t
      engine.play(name)
    },
    // un écran de menu s'affiche (true) ou on entre dans un niveau (false)
    lobby(on: boolean) {
      lobbyOn = on
      if (on) musicOn()
      else musicOff()
    },
    // le train de l'accueil commence un passage (9 s) : un sur deux est sonore, et la musique baisse un peu pendant qu'il passe
    lobbyPass(dir: 1 | -1) {
      if (!lobbyOn || !soundOn.value || !engine.lobbyTrain) return
      if (passes++ % 2) return
      engine.lobbyTrain(dir)
      lobbyTimers.push(window.setTimeout(() => engine.setBus('music', BUS_LEVEL.music * 0.55, 1.5), 1500))
      lobbyTimers.push(window.setTimeout(() => engine.setBus('music', BUS_LEVEL.music, 2.5), 6000))
    },
    setOn(v: boolean) {
      soundOn.value = v
      try { localStorage.setItem(KEY, v ? 'on' : 'off') } catch { /* stockage indisponible */ }
      if (v) musicOn()
      else musicOff()
      if (!v) { stopTrain(); stopAmbience() } else if ((phase === 'scene' || phase === 'train') && scenery) { const b = bedFor(scenery); if (b) startLoop(b) }
    },
    // quitter le niveau, ou rejouer le train
    reset() {
      stopLoop('think'); thinks = 0; lastThink = -Infinity
      stopTrain(); stopAmbience()
      phase = 'idle'; scenery = null
      clearTimeout(duckTimer); clearTimeout(bedTimer)
      engine.setBus('amb', BUS_LEVEL.amb, 0.05)
    },
  }
}

export const sound = createDirector({ play: real.play, startLoop: real.startLoop, setBus, startMusic: real.startMusic, lobbyTrain: real.lobbyTrain })
export { unlock, suspend, available } from './engine'
