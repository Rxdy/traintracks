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
  me: { rank: number; value: number; pseudo: string; avatar: string } | null // ma ligne, toujours en bas de l'écran
  around?: BoardEntry[] // hors du top 10 : 2 joueurs devant moi, moi, 2 derrière
  total: number
}

const plural = (n: number, one: string, many = one + 's') => `${n} ${n > 1 ? many : one}`
/** Ce qu'il me manque pour gagner une place (null : pas classé). Premier : on le dit. */
export function boardGoal(d: BoardData): string | null {
  const me = d.me
  if (!me) return null
  if (me.rank === 1) return d.board === 'voyage' ? 'Tu es premier du Voyage !' : d.board === 'jour' ? 'Meilleur temps du jour !' : 'Meilleure série de tous !'
  // le plus proche devant moi (rang strictement meilleur)
  const ahead = [...d.entries, ...(d.around ?? [])].filter((e) => e.rank < me.rank).sort((a, b) => b.rank - a.rank)[0]
  if (!ahead) return null
  if (d.board === 'voyage') return `Encore ${plural(ahead.value - me.value + 1, 'niveau', 'niveaux')} pour passer ${ahead.pseudo}`
  if (d.board === 'jour') return `Il te manquait ${plural(Math.max(1, Math.ceil((me.value - ahead.value) / 1000)), 'seconde')} pour passer ${ahead.pseudo}`
  return `Encore ${plural(ahead.value - me.value + 1, 'jour')} de suite pour passer ${ahead.pseudo}`
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
