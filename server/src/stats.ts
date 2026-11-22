// Statistiques personnelles et classements. Seul le serveur les calcule ; le navigateur n'en garde rien.
import type { Db } from './db.js'
import { DEFAULT_AVATAR } from '../../shared/avatars.js'
import { longestRun } from './daily.js'

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
  avatar: string // identifiant de la liste fixe (shared/avatars.ts)
  value: number // voyage : niveau atteint ; jour : temps (ms) ; serie : plus longue série de jours de suite
  me: boolean
}
export interface Leaderboard {
  board: Board
  date?: string
  entries: Entry[] // les 10 premiers
  me: { rank: number; value: number; pseudo: string; avatar: string } | null // ma place, même hors du top 10 (null : pas classé ou masqué)
  around: Entry[] // hors du top 10 : les 2 joueurs juste devant moi, moi, les 2 juste derrière (vide sinon)
  total: number // nombre de joueurs classés
}
const TOP = 10 // les 10 premiers
const AROUND = 2 // autour de ma place, quand je ne suis pas dans les 10 premiers

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
    // meilleure série de chaque joueur, tous jours confondus : perdre sa série ne retire rien du classement,
    // et le score n'est remplacé que lorsqu'une série plus longue le dépasse.
    const all = (await db.query<{ id: string; pseudo: string; date: string }>(
      `SELECT u.id, u.pseudo, r.date FROM daily_results r JOIN users u ON 'u:' || u.id::text = r.owner WHERE u.leaderboard`)).rows
    const byUser = new Map<string, { pseudo: string; dates: string[] }>()
    for (const r of all) (byUser.get(r.id) ?? byUser.set(r.id, { pseudo: r.pseudo, dates: [] }).get(r.id)!).dates.push(r.date)
    rows = [...byUser].map(([id, v]) => ({ id, pseudo: v.pseudo, value: longestRun(v.dates) })).sort((a, b) => b.value - a.value || a.pseudo.localeCompare(b.pseudo))
  }
  // rang « à la compétition » : deux joueurs à égalité ont le même rang (sauf voyage : départagé par l'heure d'arrivée)
  const ranked = rows.map((r, i) => ({ ...r, rank: board === 'voyage' ? i + 1 : (rows.findIndex((x) => x.value === r.value) + 1) }))
  const at = viewer ? ranked.findIndex((r) => r.id === viewer) : -1
  const mine = at >= 0 ? ranked[at] : undefined
  const top = ranked.slice(0, TOP)
  const near = at >= TOP ? ranked.slice(Math.max(TOP, at - AROUND), at + AROUND + 1) : []
  const ids = [...new Set([...top, ...near, ...(mine ? [mine] : [])].map((r) => r.id))]
  const avatars = new Map((await db.query<{ id: string; avatar: string }>('SELECT id, avatar FROM users WHERE id = ANY($1::uuid[])', [ids])).rows.map((r) => [r.id, r.avatar]))
  const entry = (r: (typeof ranked)[number]): Entry => ({ rank: r.rank, pseudo: r.pseudo, avatar: avatars.get(r.id) ?? DEFAULT_AVATAR, value: r.value, me: r.id === viewer })
  return {
    board,
    date: board === 'jour' || board === 'serie' ? today : undefined,
    entries: top.map(entry),
    me: mine ? { rank: mine.rank, value: mine.value, pseudo: mine.pseudo, avatar: avatars.get(mine.id) ?? DEFAULT_AVATAR } : null,
    around: near.map(entry),
    total: ranked.length,
  }
}
