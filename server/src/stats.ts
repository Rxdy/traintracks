// Statistiques personnelles et classements. Seul le serveur les calcule ; le navigateur n'en garde rien.
import type { Db } from './db.js'
import { previousDay, streakUntil } from './daily.js'

export interface JourneyStats {
  solved: number // niveaux terminés
  totalTimeMs: number // temps de jeu cumulé sur les niveaux terminés
  avgMs: number | null
  fastest: { level: number; timeMs: number } | null
  slowest: { level: number; timeMs: number } | null
  bySize: { size: number; count: number; avgMs: number; bestMs: number }[] // par taille de grille
  coinsEarned: number // total gagné (victoires, bonus, jour, inscription)
  coins: number // solde actuel
  firstSolvedAt: string | null
}

export async function journeyStats(db: Db, owner: string): Promise<JourneyStats> {
  const agg = (await db.query<{ n: number; total: number | null; avg: number | null; first: Date | null }>(
    'SELECT count(*)::int AS n, sum(time_ms)::bigint::float8 AS total, round(avg(time_ms))::int AS avg, min(solved_at) AS first FROM progress WHERE owner = $1', [owner])).rows[0]
  const best = (await db.query<{ level: number; time_ms: number }>('SELECT level, time_ms FROM progress WHERE owner = $1 ORDER BY time_ms ASC, level ASC LIMIT 1', [owner])).rows[0]
  const worst = (await db.query<{ level: number; time_ms: number }>('SELECT level, time_ms FROM progress WHERE owner = $1 ORDER BY time_ms DESC, level ASC LIMIT 1', [owner])).rows[0]
  const sizes = await db.query<{ size: number; n: number; avg: number; best: number }>(
    `SELECT (l.puzzle->>'size')::int AS size, count(*)::int AS n, round(avg(p.time_ms))::int AS avg, min(p.time_ms)::int AS best
     FROM progress p JOIN levels l ON l.id = p.level WHERE p.owner = $1 GROUP BY 1 ORDER BY 1`, [owner])
  const earned = (await db.query<{ s: number | null }>('SELECT sum(amount)::int AS s FROM rewards WHERE owner = $1', [owner])).rows[0].s ?? 0
  const coins = (await db.query<{ coins: number }>('SELECT coins FROM wallets WHERE owner = $1', [owner])).rows[0]?.coins ?? 0
  return {
    solved: agg.n,
    totalTimeMs: Math.round(agg.total ?? 0),
    avgMs: agg.avg,
    fastest: best ? { level: best.level, timeMs: best.time_ms } : null,
    slowest: worst ? { level: worst.level, timeMs: worst.time_ms } : null,
    bySize: sizes.rows.map((r) => ({ size: r.size, count: r.n, avgMs: r.avg, bestMs: r.best })),
    coinsEarned: earned,
    coins,
    firstSolvedAt: agg.first ? new Date(agg.first).toISOString() : null,
  }
}

// --- Classements -------------------------------------------------------------------------------------------------
export type Board = 'voyage' | 'jour' | 'serie'
export interface Entry {
  rank: number
  pseudo: string
  value: number // voyage : niveau atteint ; jour : temps (ms) ; serie : jours de suite
  me: boolean
}
export interface Leaderboard {
  board: Board
  date?: string
  entries: Entry[] // les 50 premiers
  me: { rank: number; value: number } | null // ma place, même hors du top 50 (null : pas classé ou masqué)
  total: number // nombre de joueurs classés
}
const TOP = 50

// Seuls les comptes qui ont choisi d'apparaître (par défaut oui) sont classés ; on ne montre que le pseudo.
export async function leaderboard(db: Db, board: Board, today: string, viewer: string | null): Promise<Leaderboard> {
  let rows: { id: string; pseudo: string; value: number }[]
  if (board === 'voyage') {
    // le plus haut niveau ; à égalité, celui qui l'a atteint en premier passe devant
    rows = (await db.query<{ id: string; pseudo: string; value: number }>(
      `WITH m AS (SELECT owner, max(level) AS lvl FROM progress WHERE owner LIKE 'u:%' GROUP BY owner)
       SELECT u.id, u.pseudo, m.lvl::int AS value
       FROM m JOIN progress p ON p.owner = m.owner AND p.level = m.lvl
       JOIN users u ON 'u:' || u.id::text = m.owner
       WHERE u.leaderboard ORDER BY m.lvl DESC, p.solved_at ASC, u.pseudo_key ASC`)).rows
  } else if (board === 'jour') {
    rows = (await db.query<{ id: string; pseudo: string; value: number }>(
      `SELECT u.id, u.pseudo, r.time_ms AS value FROM daily_results r JOIN users u ON 'u:' || u.id::text = r.owner
       WHERE r.date = $1 AND u.leaderboard ORDER BY r.time_ms ASC, r.solved_at ASC`, [today])).rows
  } else {
    // série en cours : jours consécutifs jusqu'à aujourd'hui (ou hier si pas encore joué aujourd'hui)
    const cands = (await db.query<{ id: string; pseudo: string; owner: string }>(
      `SELECT DISTINCT u.id, u.pseudo, r.owner FROM daily_results r JOIN users u ON 'u:' || u.id::text = r.owner
       WHERE r.date IN ($1, $2) AND u.leaderboard`, [today, previousDay(today)])).rows
    const withStreak: { id: string; pseudo: string; value: number }[] = []
    for (const c of cands) {
      const doneToday = (await db.query('SELECT 1 FROM daily_results WHERE owner = $1 AND date = $2', [c.owner, today])).rows.length > 0
      withStreak.push({ id: c.id, pseudo: c.pseudo, value: await streakUntil(db, c.owner, doneToday ? today : previousDay(today)) })
    }
    rows = withStreak.sort((a, b) => b.value - a.value || a.pseudo.localeCompare(b.pseudo))
  }
  // rang « à la compétition » : deux joueurs à égalité ont le même rang (sauf voyage : départagé par l'heure d'arrivée)
  const ranked = rows.map((r, i) => ({ ...r, rank: board === 'voyage' ? i + 1 : (rows.findIndex((x) => x.value === r.value) + 1) }))
  const mine = viewer ? ranked.find((r) => r.id === viewer) : undefined
  return {
    board,
    date: board === 'jour' || board === 'serie' ? today : undefined,
    entries: ranked.slice(0, TOP).map((r) => ({ rank: r.rank, pseudo: r.pseudo, value: r.value, me: r.id === viewer })),
    me: mine ? { rank: mine.rank, value: mine.value } : null,
    total: ranked.length,
  }
}
