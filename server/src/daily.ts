// Puzzle du jour : la même grille pour tous les joueurs, générée par le serveur, sans solution envoyée.
//   - la graine est la date : la grille est reproductible, puis conservée en base ;
//   - réservé aux joueurs inscrits ; aucune aide ; seul le premier temps du jour compte ;
//   - le temps est mesuré par le serveur ; la récompense est versée une seule fois par jour.
import type { Db } from './db.js'
import { generate } from '../../shared/generator.js'
import type { Puzzle } from '../../shared/puzzle.js'
import { isSolved, lockedEdges } from '../../shared/track.js'
import { balance, credit } from './wallet.js'

export const DAILY_REWARD = 20
export const STREAK_BONUS_PER_DAY = 2
export const STREAK_BONUS_MAX = 10

// Date du jour (AAAA-MM-JJ) dans le fuseau horaire du jeu : le jour change à minuit chez les joueurs, pas à minuit UTC.
export function dateKey(now: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

const DAY = 86_400_000
const toMs = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)))
export const previousDay = (d: string): string => new Date(toMs(d) - DAY).toISOString().slice(0, 10)

// Toujours 6×6, tous les jours (la grille est générée par le serveur, une fois par jour, puis gardée en base).
export const DAILY_SIZE = 6
export function sizeFor(_date: string): number {
  return DAILY_SIZE
}

export interface PublicDaily {
  date: string
  puzzle: Puzzle
}

async function puzzleOf(db: Db, date: string, now: Date): Promise<{ puzzle: Puzzle }> {
  const read = async () => (await db.query<{ puzzle: Puzzle }>('SELECT puzzle FROM daily_puzzles WHERE date = $1', [date])).rows[0]
  const found = await read()
  if (found) return found
  const g = generate(`daily:${date}`, sizeFor(date))
  await db.query('INSERT INTO daily_puzzles (date, puzzle, solution, created_at) VALUES ($1,$2,$3,$4) ON CONFLICT (date) DO NOTHING', [
    date,
    JSON.stringify(g.puzzle),
    JSON.stringify(g.solution),
    now,
  ])
  return (await read())!
}

// Série de jours consécutifs jouée, comptée jusqu'à `from` (inclus).
export async function streakUntil(db: Db, owner: string, from: string): Promise<number> {
  const { rows } = await db.query<{ date: string }>('SELECT date FROM daily_results WHERE owner = $1 AND date <= $2 ORDER BY date DESC', [owner, from])
  const played = new Set(rows.map((r) => r.date))
  let n = 0
  for (let d = from; played.has(d); d = previousDay(d)) n++
  return n
}

// Plus longue série de jours consécutifs jamais réalisée : elle reste même quand la série en cours est perdue,
// et n'est remplacée que lorsqu'une nouvelle série la dépasse.
export function longestRun(dates: Iterable<string>): number {
  const sorted = [...new Set(dates)].sort()
  let best = 0
  let run = 0
  let prev = ''
  for (const d of sorted) {
    run = prev && previousDay(d) === prev ? run + 1 : 1
    best = Math.max(best, run)
    prev = d
  }
  return best
}
export async function bestStreak(db: Db, owner: string): Promise<number> {
  const { rows } = await db.query<{ date: string }>('SELECT date FROM daily_results WHERE owner = $1', [owner])
  return longestRun(rows.map((r) => r.date))
}

export interface DailyStatus {
  date: string
  done: boolean
  timeMs: number | null
  streak: number
  size: number // taille de la grille du jour (toujours 6×6)
}

export async function dailyStatus(db: Db, owner: string, date: string): Promise<DailyStatus> {
  const r = (await db.query<{ time_ms: number }>('SELECT time_ms FROM daily_results WHERE owner = $1 AND date = $2', [owner, date])).rows[0]
  return { date, done: !!r, timeMs: r?.time_ms ?? null, size: sizeFor(date), streak: await streakUntil(db, owner, r ? date : previousDay(date)) }
}

export async function startDaily(db: Db, owner: string, date: string, now: Date): Promise<PublicDaily & { replay: boolean }> {
  const { puzzle } = await puzzleOf(db, date, now)
  const done = (await db.query('SELECT 1 FROM daily_results WHERE owner = $1 AND date = $2', [owner, date])).rows.length > 0
  // Reprendre une partie commencée aujourd'hui garde l'heure de départ ; un autre jour repart de zéro.
  await db.query(
    `INSERT INTO daily_runs (owner, date, started_at) VALUES ($1,$2,$3)
     ON CONFLICT (owner) DO UPDATE SET date = $2, started_at = CASE WHEN daily_runs.date = $2 THEN daily_runs.started_at ELSE $3 END,
       acted_at = CASE WHEN daily_runs.date = $2 THEN daily_runs.acted_at ELSE NULL END`,
    [owner, date, now],
  )
  return { date, puzzle, replay: done }
}

export async function beginDaily(db: Db, owner: string, date: string, now: Date): Promise<boolean> {
  const r = await db.query('UPDATE daily_runs SET acted_at = $3 WHERE owner = $1 AND date = $2 AND acted_at IS NULL RETURNING owner', [owner, date, now])
  return r.rows.length > 0
}

const EDGE_RE = /^[hv]:\d{1,2}:\d{1,2}$/

export type DailySubmit =
  | { ok: true; counted: boolean; timeMs: number; earned: { base: number; streakBonus: number }; streak: number; coins: number }
  | { ok: false; code: 'invalid' | 'not_started' | 'wrong' }

export async function submitDaily(db: Db, owner: string, date: string, edges: unknown, now: Date): Promise<DailySubmit> {
  if (!Array.isArray(edges) || edges.length > 200 || !edges.every((e) => typeof e === 'string' && EDGE_RE.test(e))) return { ok: false, code: 'invalid' }
  return db.tx(async (t) => {
    const run = (await t.query<{ started_at: Date; acted_at: Date | null }>('SELECT started_at, acted_at FROM daily_runs WHERE owner = $1 AND date = $2 FOR UPDATE', [owner, date])).rows[0]
    if (!run) return { ok: false, code: 'not_started' } as const
    const { puzzle } = (await t.query<{ puzzle: Puzzle }>('SELECT puzzle FROM daily_puzzles WHERE date = $1', [date])).rows[0]
    if (!isSolved(new Set<string>([...(edges as string[]), ...lockedEdges(puzzle)]), puzzle)) return { ok: false, code: 'wrong' } as const
    const timeMs = Math.max(0, now.getTime() - new Date(run.acted_at ?? run.started_at).getTime()) // du premier geste à la réponse juste
    await t.query('DELETE FROM daily_runs WHERE owner = $1', [owner])
    const first = await t.query('INSERT INTO daily_results (owner, date, time_ms, solved_at) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING date', [owner, date, timeMs, now])
    const counted = first.rows.length > 0
    const streak = await streakUntil(t, owner, date)
    const base = counted ? DAILY_REWARD : 0
    const streakBonus = counted ? Math.min(STREAK_BONUS_MAX, STREAK_BONUS_PER_DAY * (streak - 1)) : 0
    if (counted) await credit(t, owner, base + streakBonus, 'daily', date, now)
    return { ok: true, counted, timeMs, earned: { base, streakBonus }, streak, coins: await balance(t, owner) } as const
  })
}

export interface DailyStats {
  count: number
  avgMs: number | null
  bestMs: number | null
  worstMs: number | null
  streak: number
  bestStreak: number // la plus longue série jamais faite
}

export async function dailyStats(db: Db, owner: string, today: string): Promise<DailyStats> {
  const r = (await db.query<{ n: number; avg: number | null; best: number | null; worst: number | null }>(
    'SELECT count(*)::int AS n, round(avg(time_ms))::int AS avg, min(time_ms) AS best, max(time_ms) AS worst FROM daily_results WHERE owner = $1', [owner])).rows[0]
  const doneToday = (await db.query('SELECT 1 FROM daily_results WHERE owner = $1 AND date = $2', [owner, today])).rows.length > 0
  return { count: r.n, avgMs: r.avg, bestMs: r.best, worstMs: r.worst, streak: await streakUntil(db, owner, doneToday ? today : previousDay(today)), bestStreak: await bestStreak(db, owner) }
}
