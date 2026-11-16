// Puzzle du jour vu du navigateur : le serveur génère la grille (la même pour tous), vérifie le tracé,
// mesure le temps et ne compte que le premier du jour.
import { api } from './api'
import type { Puzzle } from './puzzle'

export interface DailyStatus {
  date: string
  done: boolean // déjà réalisé aujourd'hui
  timeMs: number | null
  streak: number
  size: number // toujours 6×6
}

export async function fetchDaily(): Promise<DailyStatus | null> {
  const r = await api('GET', '/api/daily')
  return r?.status === 200 ? (r.data as unknown as DailyStatus) : null
}

export interface StartedDaily {
  date: string
  puzzle: Puzzle
  replay: boolean
}
export async function startDaily(): Promise<StartedDaily | null> {
  const r = await api('POST', '/api/daily/start', {})
  return r?.status === 200 ? (r.data as unknown as StartedDaily) : null
}

export interface DailyResult {
  counted: boolean // false : ce n'est pas le premier temps du jour
  timeMs: number
  earned: { base: number; streakBonus: number }
  streak: number
  coins: number
}
export async function submitDaily(edges: string[]): Promise<DailyResult | null> {
  const r = await api('POST', '/api/daily/submit', { edges })
  return r?.status === 200 ? (r.data as unknown as DailyResult) : null
}

export function beginDaily(): void {
  void api('POST', '/api/daily/begin', {})
}
