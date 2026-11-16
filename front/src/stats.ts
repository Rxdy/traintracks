// Statistiques : calculées et conservées par le serveur (voyage et puzzle du jour). Le navigateur n'en garde rien.
import { api } from './api'

export interface DailyStats {
  count: number
  avgMs: number | null
  bestMs: number | null
  worstMs: number | null
  streak: number // jours consécutifs
  bestStreak: number // la plus longue série jamais faite
}

export interface JourneyStats {
  level: number
  total: number
  allDone: boolean
  solved: number
  totalTimeMs: number
  avgMs: number | null
  fastest: { level: number; timeMs: number } | null
  slowest: { level: number; timeMs: number } | null
  bySize: { size: number; count: number; avgMs: number; bestMs: number }[]
  coinsEarned: number
  coins: number
  firstSolvedAt: string | null
}
export interface StatsData {
  journey: JourneyStats
  daily: DailyStats
}

export type BoardId = 'voyage' | 'jour' | 'serie'
export interface BoardEntry {
  rank: number
  pseudo: string
  avatar?: string // identifiant de la liste fixe (avatars/)
  value: number
  me: boolean
}
export interface BoardData {
  board: BoardId
  date?: string
  entries: BoardEntry[]
  me: { rank: number; value: number; pseudo: string; avatar: string } | null // ma ligne, montrée sous les 10 premiers si je n'y suis pas
  total: number
}
export async function fetchBoard(board: BoardId): Promise<BoardData | null> {
  const r = await api('GET', `/api/leaderboard?board=${board}`)
  return r?.status === 200 ? (r.data as unknown as BoardData) : null
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

// Durée longue : « 3 h 05 » ou « 12 min » (temps de jeu cumulé).
export function formatLong(ms: number): string {
  const m = Math.round(ms / 60000)
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`
}
