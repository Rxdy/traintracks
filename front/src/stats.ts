// Statistiques : calculées et conservées par le serveur (voyage et puzzle du jour). Le navigateur n'en garde rien.
import { api } from './api'

export interface DailyStats {
  count: number
  avgMs: number | null
  bestMs: number | null
  worstMs: number | null
  streak: number // jours consécutifs
}

export interface StatsData {
  journey: { level: number; total: number; allDone: boolean }
  daily: DailyStats
}

export async function fetchStats(): Promise<StatsData | null> {
  const r = await api('GET', '/api/stats')
  return r?.status === 200 ? (r.data as unknown as StatsData) : null
}

export function formatTime(ms: number | null): string {
  if (ms === null) return '—'
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
