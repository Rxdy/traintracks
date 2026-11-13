// Plan du Voyage : pour chaque niveau, quelle taille de grille et quelles règles sont en jeu.
//
// On ne liste pas les niveaux à la main : on décrit des PALIERS (taille de grille, introduction des règles) et le
// plan en déduit chaque niveau avec de l'alternance : niveaux normaux, niveaux avec une règle, niveaux qui en
// combinent deux ou plus. Le plan est déterministe : le même niveau a toujours le même plan.
//
// Ce plan guide la fabrication des niveaux (générateur) ; les niveaux eux-mêmes sont ensuite figés en base.
// Il se règle ici (MECHANICS, SIZES, OVERRIDES), se relit avec `make plan`, et ses invariants sont testés.
import { makeRng } from './generator.js'

export type Mechanic = 'given' | 'rock' | 'station' | 'masked' | 'twotrains' | 'tunnel'

export interface MechanicDef {
  id: Mechanic
  intro: number // niveau d'introduction : la règle y apparaît seule
  implemented: boolean // fonctionne dans le jeu (sinon : prévue, planifiée mais pas encore jouable)
  label: string
  introText?: string // message affiché au niveau d'introduction
}

// Du plus ancien au plus récent. « given » = rails imposés.
// Les paliers sont LARGES : un niveau de début de partie se joue en moins de 30 secondes, il en faut donc beaucoup
// pour qu'une nouveauté reste une nouveauté (voir DURÉE DE JEU ci-dessous et `make plan`).
export const MECHANICS: MechanicDef[] = [
  { id: 'given', intro: 70, implemented: true, label: 'rails imposés', introText: 'Nouveau : les rails gris sont déjà posés. La voie doit passer par eux, exactement comme dessinés.' },
  { id: 'rock', intro: 150, implemented: true, label: 'rochers', introText: 'Nouveau : les rochers. La voie ne passe jamais dessus, et tu ne peux rien y poser.' },
  { id: 'station', intro: 300, implemented: false, label: 'gares' }, // case obligatoire, forme libre
  { id: 'masked', intro: 410, implemented: false, label: 'chiffres masqués' }, // certains chiffres du bord sont cachés
  { id: 'twotrains', intro: 520, implemented: false, label: 'deux trains' },
  { id: 'tunnel', intro: 800, implemented: false, label: 'tunnels' }, // pas encore validé
]

// Taille de grille à partir d'un niveau. Règle de conception : la taille ne monte pas sur un niveau d'introduction.
export const SIZES: { from: number; size: number }[] = [
  { from: 1, size: 4 },
  { from: 61, size: 5 },
  { from: 211, size: 6 },
  { from: 461, size: 7 },
  { from: 761, size: 8 },
]

// Niveaux qui enfreignent la règle ci-dessus, hérités de niveaux déjà publiés : à garder vide tant que possible.
export const KNOWN_SIZE_UP_ON_INTRO: number[] = []

// Niveaux réglés à la main (priment sur le calcul), par exemple pour un niveau « mélange » voulu.
export const OVERRIDES: Record<number, Mechanic[]> = {}

// DURÉE DE JEU : secondes estimées par niveau selon la taille (HYPOTHÈSES à corriger avec les vrais temps :
// le serveur enregistre le temps de chaque niveau, `make pace` en tire la moyenne réelle).
export const SECONDS_PER_LEVEL: Record<number, number> = { 4: 20, 5: 30, 6: 55, 7: 90, 8: 140 }

export interface LevelPlan {
  level: number
  size: number
  mechanics: Mechanic[] // règles en jeu sur ce niveau (vide = niveau normal)
  intro: Mechanic | null // règle présentée par ce niveau (alors seule, facile)
  sizeUp: boolean // la grille grossit à ce niveau
}

// Réglages du rythme (proportion de niveaux avec règle, combinaisons) : monte progressivement après chaque nouveauté.
const FEATURE_START = 0.3 // juste après une nouveauté : environ 3 niveaux sur 10 utilisent une règle
const FEATURE_END = 0.65 // puis jusqu'à 6 sur 10
const PAIR_END = 0.35 // part des niveaux à règle qui en combinent deux
const RAMP = 60 // nombre de niveaux pour passer du début à la fin
const FOCUS = 10 // pendant ces niveaux, la dernière nouveauté est favorisée

export const sizeAt = (level: number): number => [...SIZES].reverse().find((s) => level >= s.from)!.size
const unlockedAt = (level: number): MechanicDef[] => MECHANICS.filter((m) => m.intro < level)

const cache: LevelPlan[] = []

function build(level: number, prev: LevelPlan[]): LevelPlan {
  const size = sizeAt(level)
  const sizeUp = level > 1 && size > sizeAt(level - 1)
  const introduced = MECHANICS.find((m) => m.intro === level)
  if (introduced) return { level, size, mechanics: [introduced.id], intro: introduced.id, sizeUp }
  const forced = OVERRIDES[level]
  if (forced) return { level, size, mechanics: [...forced], intro: null, sizeUp }

  const open = unlockedAt(level)
  if (!open.length) return { level, size, mechanics: [], intro: null, sizeUp }

  const newest = open[open.length - 1]
  const since = level - newest.intro
  const t = Math.min(1, since / RAMP)
  const pFeature = FEATURE_START + (FEATURE_END - FEATURE_START) * t
  const pPair = PAIR_END * t
  const rand = makeRng(`curriculum:${level}`)

  const p1 = prev[level - 2]
  const p2 = prev[level - 3]
  const lastHeavy = !!p1 && p1.mechanics.length >= 2
  const twoInARow = !!p1 && !!p2 && p1.mechanics.length > 0 && p2.mechanics.length > 0
  // Alternance : jamais trois niveaux à règle d'affilée, jamais deux combinaisons de suite.
  let featured = !twoInARow && rand() < pFeature
  // La nouveauté doit être pratiquée tout de suite : si les 2 niveaux après son introduction l'ont ignorée, celui-ci l'emploie.
  const practised = prev.slice(newest.intro, level - 1).some((p) => p.mechanics.includes(newest.id))
  const mustPractise = since === 3 && !practised
  if (mustPractise) featured = true
  if (!featured) return { level, size, mechanics: [], intro: null, sizeUp }

  const count = open.length >= 2 && !lastHeavy && !mustPractise && rand() < pPair ? 2 : 1
  const pool = open.map((m) => m.id)
  const picked: Mechanic[] = []
  if (mustPractise || (since <= FOCUS && rand() < 0.6)) picked.push(newest.id)
  while (picked.length < count) {
    const m = pool[Math.floor(rand() * pool.length)]
    if (!picked.includes(m)) picked.push(m)
  }
  // Même ordre que l'introduction des règles : plus lisible et stable.
  picked.sort((a, b) => MECHANICS.findIndex((m) => m.id === a) - MECHANICS.findIndex((m) => m.id === b))
  return { level, size, mechanics: picked, intro: null, sizeUp }
}

export function planFor(level: number): LevelPlan {
  if (!Number.isInteger(level) || level < 1) throw new Error(`niveau ${level} invalide`)
  while (cache.length < level) cache.push(build(cache.length + 1, cache))
  return cache[level - 1]
}

export const planRange = (from: number, to: number): LevelPlan[] => Array.from({ length: to - from + 1 }, (_, i) => planFor(from + i))

// Lecture humaine d'un palier : « 61-70  6×6  . G . . G . G G . . ».
export function describe(from: number, to: number): string {
  const sym: Record<Mechanic, string> = { given: 'G', rock: 'R', station: 'S', masked: 'M', twotrains: '2', tunnel: 'T' }
  return planRange(from, to)
    .map((p) => (p.intro ? `[${sym[p.intro]}!]` : p.mechanics.length ? p.mechanics.map((m) => sym[m]).join('+') : '.'))
    .join(' ')
}


// --- Durée de jeu et niveaux fabricables ---------------------------------------------------------------------
export const secondsFor = (level: number): number => SECONDS_PER_LEVEL[sizeAt(level)]

// Durée de jeu estimée pour aller du niveau `from` au niveau `to` (inclus), en secondes.
export function playSeconds(from: number, to: number): number {
  let t = 0
  for (let l = from; l <= to; l++) t += secondsFor(l)
  return t
}

// Premier niveau dont une règle n'est pas encore jouable : on ne sait pas encore le fabriquer.
export function firstBlockedLevel(): number {
  const blocked = MECHANICS.filter((m) => !m.implemented).map((m) => m.intro)
  return blocked.length ? Math.min(...blocked) : Infinity
}

// Dernier niveau qu'on peut fabriquer aujourd'hui. Au-delà : « de nouveaux niveaux arrivent bientôt ».
export const buildableUpTo = (): number => firstBlockedLevel() - 1

export function formatDuration(seconds: number): string {
  const m = Math.round(seconds / 60)
  return m < 90 ? `${m} min` : `${(seconds / 3600).toFixed(1)} h`
}
