// Le Voyage vu du navigateur : le serveur donne le niveau en cours, vérifie le tracé et dit si c'est juste.
import { ref } from 'vue'
import { api } from './api'
import { themeForLevel, type Theme } from './scenery'
import type { Given, Puzzle } from './puzzle'

export interface JourneyStatus {
  level: number // niveau en cours (le dernier si tout est fini)
  total: number
  allDone: boolean
}

export interface PlayLevel {
  id: number
  puzzle: Puzzle
  intro?: string
}

export async function fetchStatus(): Promise<JourneyStatus | null> {
  const r = await api('GET', '/api/journey')
  return r?.status === 200 ? (r.data as unknown as JourneyStatus) : null
}

// Démarre (ou reprend) le niveau en cours : le chrono officiel part du serveur.
export interface StartedLevel {
  level: PlayLevel
  reveals: Given[] // cases déjà révélées sur ce niveau (reprise)
  crosses: { row: number; col: number }[]
  usedAids: string[]
}
export async function startLevel(): Promise<StartedLevel | { done: true } | null> {
  const r = await api('POST', '/api/journey/start', {})
  return r?.status === 200 ? (r.data as unknown as StartedLevel | { done: true }) : null
}

export type SubmitOutcome =
  | { ok: true; timeMs: number; next: JourneyStatus; earned: { base: number; bonus: number }; coins: number }
  | { ok: false; reason: 'wrong' | 'stale' | 'network' }

// Envoie le tracé ; seule la réponse « juste » du serveur débloque la suite.
export async function submitLevel(level: number, edges: string[]): Promise<SubmitOutcome> {
  const r = await api('POST', '/api/journey/submit', { level, edges })
  if (!r) return { ok: false, reason: 'network' }
  if (r.status === 200) return r.data as unknown as SubmitOutcome
  if (r.status === 422) return { ok: false, reason: 'wrong' }
  if (r.status === 409) return { ok: false, reason: 'stale' }
  return { ok: false, reason: 'network' }
}

// Prévient le serveur du premier geste du joueur : le temps compte à partir de là (pas du temps de lecture de la grille).
export function beginLevel(): void {
  void api('POST', '/api/journey/begin', {})
}

// Biome du niveau en cours : le paysage de l'accueil et des menus s'y accorde.
export const homeTheme = ref<Theme>('plaine')
export const setHomeLevel = (level: number): void => {
  homeTheme.value = themeForLevel(level)
}
