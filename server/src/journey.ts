// Le Voyage côté serveur : niveaux, progression, validation des tracés.
//   - le serveur seul connaît les solutions ; il n'envoie que la grille du niveau en cours ;
//   - on ne peut jouer que le niveau en cours (progression linéaire) ;
//   - un tracé est vérifié avec les règles du jeu (dossier shared/), pas sur la parole du navigateur ;
//   - le temps est mesuré ici, de la demande du niveau à la réponse juste.
import { mergeWagons } from './wagons.js'
import type { Db } from './db.js'
import type { Puzzle } from '../../shared/puzzle.js'
import { isSolved, lockedEdges } from '../../shared/track.js'
import { balance, credit } from './wallet.js'

export interface LevelSeed {
  id: number
  puzzle: Puzzle
  solution: [number, number][]
  intro?: string
}

export interface PublicLevel {
  id: number
  puzzle: Puzzle
  intro?: string
}

// Pièces gagnées : 10 par niveau quelle que soit la taille, plus 5 si aucune aide payante n'a servi (15 au plus).
// Volontairement fixe : les wagons de la machine (50 pièces) doivent se mériter, même sur les grandes grilles.
export const levelReward = (_size: number): number => 10
export const NO_AID_BONUS = 5

export interface JourneyStatus {
  level: number // niveau en cours (le dernier si tout est fini)
  total: number
  allDone: boolean
}

// JSON à clés triées : PostgreSQL range les clés d'un objet dans un autre ordre que le fichier, ce qui ne change rien au niveau.
export function canon(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`
  if (v && typeof v === 'object') return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${canon((v as Record<string, unknown>)[k])}`).join(',')}}`
  return JSON.stringify(v)
}

export interface SeedReport {
  added: number[] // niveaux nouvellement ajoutés
  changed: number[] // niveaux déjà en base dont le fichier diffère : IGNORÉS (des joueurs les ont peut-être résolus)
}

// Charge les niveaux du fichier. Ajouter des niveaux est sans danger : on ne fait qu'AJOUTER les absents.
//   - un niveau déjà en base n'est jamais modifié (la progression et les récompenses s'y réfèrent) ;
//   - les numéros doivent se suivre (1, 2, 3...) sans trou : sinon un joueur arriverait sur un niveau inexistant.
// Les joueurs qui avaient tout terminé reprennent au premier niveau ajouté ; les autres ne voient aucun changement.
export async function seedLevels(db: Db, levels: LevelSeed[]): Promise<SeedReport> {
  const report: SeedReport = { added: [], changed: [] }
  for (const l of [...levels].sort((a, b) => a.id - b.id)) {
    if (!Number.isInteger(l.id) || l.id < 1) throw new Error(`numéro de niveau invalide : ${l.id}`)
    const r = await db.query(
      'INSERT INTO levels (id, puzzle, solution, intro) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING RETURNING id',
      [l.id, JSON.stringify(l.puzzle), JSON.stringify(l.solution), l.intro ?? null],
    )
    if (r.rows.length) {
      report.added.push(l.id)
      continue
    }
    const old = (await db.query<{ puzzle: unknown; solution: unknown }>('SELECT puzzle, solution FROM levels WHERE id = $1', [l.id])).rows[0]
    if (canon(old.puzzle) !== canon(l.puzzle) || canon(old.solution) !== canon(l.solution)) report.changed.push(l.id)
  }
  const ids = (await db.query<{ id: number }>('SELECT id FROM levels ORDER BY id')).rows.map((r) => r.id)
  const gap = ids.findIndex((id, i) => id !== i + 1)
  if (gap >= 0) throw new Error(`niveaux non contigus : le niveau ${gap + 1} manque (trouvé ${ids[gap]} à la place)`)
  return report
}

export async function status(db: Db, owner: string): Promise<JourneyStatus> {
  const t = await db.query<{ total: number | null }>('SELECT max(id)::int AS total FROM levels')
  const p = await db.query<{ done: number | null }>('SELECT max(level)::int AS done FROM progress WHERE owner = $1', [owner])
  const total = t.rows[0].total ?? 0
  const done = p.rows[0].done ?? 0
  return { level: Math.max(1, Math.min(done + 1, total)), total, allDone: total > 0 && done >= total }
}

async function publicLevel(db: Db, id: number): Promise<PublicLevel | null> {
  const { rows } = await db.query<{ id: number; puzzle: Puzzle; intro: string | null }>('SELECT id, puzzle, intro FROM levels WHERE id = $1', [id])
  const r = rows[0]
  return r ? { id: r.id, puzzle: r.puzzle, ...(r.intro ? { intro: r.intro } : {}) } : null
}

// Démarre (ou reprend) le niveau en cours. Reprendre garde l'heure de départ d'origine.
export interface Resume {
  reveals: unknown[] // cases déjà révélées sur ce niveau (à réappliquer si le joueur revient)
  crosses: unknown[]
  usedAids: string[]
}

export async function start(db: Db, owner: string, now: Date): Promise<({ level: PublicLevel } & Resume) | { done: true }> {
  const st = await status(db, owner)
  if (st.allDone) return { done: true }
  const level = await publicLevel(db, st.level)
  if (!level) return { done: true }
  await db.query(
    `INSERT INTO level_runs (owner, level, started_at) VALUES ($1,$2,$3)
     ON CONFLICT (owner) DO UPDATE SET level = $2, started_at = CASE WHEN level_runs.level = $2 THEN level_runs.started_at ELSE $3 END,
       acted_at = CASE WHEN level_runs.level = $2 THEN level_runs.acted_at ELSE NULL END`,
    [owner, st.level, now],
  )
  const run = (await db.query<{ reveals: unknown[]; crosses: unknown[]; aids: string[] }>('SELECT reveals, crosses, aids FROM level_runs WHERE owner = $1', [owner])).rows[0]
  return { level, reveals: run.reveals, crosses: run.crosses, usedAids: run.aids }
}

// Premier geste du joueur sur le niveau en cours : c'est de là que le temps compte. Une seule fois par niveau.
export async function begin(db: Db, owner: string, now: Date): Promise<boolean> {
  const r = await db.query('UPDATE level_runs SET acted_at = $2 WHERE owner = $1 AND acted_at IS NULL RETURNING owner', [owner, now])
  return r.rows.length > 0
}

const EDGE_RE = /^[hv]:\d{1,2}:\d{1,2}$/

export type SubmitResult =
  | { ok: true; timeMs: number; next: JourneyStatus; earned: { base: number; bonus: number }; coins: number }
  | { ok: false; code: 'invalid' | 'not_current' | 'not_started' | 'wrong' }

export async function submit(db: Db, owner: string, input: { level: unknown; edges: unknown }, now: Date): Promise<SubmitResult> {
  const edges = input.edges
  if (!Number.isInteger(input.level) || !Array.isArray(edges) || edges.length > 200 || !edges.every((e) => typeof e === 'string' && EDGE_RE.test(e))) {
    return { ok: false, code: 'invalid' }
  }
  return db.tx(async (t) => {
    const st = await status(t, owner)
    if (st.allDone || input.level !== st.level) return { ok: false, code: 'not_current' } as const
    const run = (await t.query<{ started_at: Date; acted_at: Date | null; paid_used: boolean }>('SELECT started_at, acted_at, paid_used FROM level_runs WHERE owner = $1 AND level = $2', [owner, st.level])).rows[0]
    if (!run) return { ok: false, code: 'not_started' } as const
    const lvl = (await t.query<{ puzzle: Puzzle }>('SELECT puzzle FROM levels WHERE id = $1', [st.level])).rows[0]
    const connections = new Set<string>([...(edges as string[]), ...lockedEdges(lvl.puzzle)])
    if (!isSolved(connections, lvl.puzzle)) return { ok: false, code: 'wrong' } as const
    // Du premier geste à la réponse juste. Le train, lui, ne compte pas : il part après la réponse. Sans signal de premier geste (réseau), on compte depuis l'ouverture.
    const timeMs = Math.max(0, now.getTime() - new Date(run.acted_at ?? run.started_at).getTime())
    const fresh = await t.query('INSERT INTO progress (owner, level, solved_at, time_ms) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING level', [owner, st.level, now, timeMs])
    await t.query('DELETE FROM level_runs WHERE owner = $1', [owner])
    // Récompense : une seule fois par niveau (clé unique), même si la requête est rejouée.
    const base = levelReward(lvl.puzzle.size)
    const bonus = run.paid_used ? 0 : NO_AID_BONUS
    const paid = fresh.rows.length > 0 && (await credit(t, owner, base + bonus, 'level', String(st.level), now))
    return { ok: true, timeMs, next: await status(t, owner), earned: paid ? { base, bonus } : { base: 0, bonus: 0 }, coins: await balance(t, owner) } as const
  })
}

// Un joueur anonyme s'inscrit puis se connecte : sa progression passe à son compte (processus 07).
export async function mergeAnonymous(db: Db, anonId: string, userId: string): Promise<void> {
  const from = `a:${anonId}`
  const to = `u:${userId}`
  await db.tx(async (t) => {
    await t.query(
      `INSERT INTO progress (owner, level, solved_at, time_ms)
       SELECT $2, level, solved_at, time_ms FROM progress WHERE owner = $1 ON CONFLICT DO NOTHING`,
      [from, to],
    )
    await t.query('DELETE FROM progress WHERE owner = $1', [from])
    await t.query('DELETE FROM level_runs WHERE owner = $1', [from])
    // Pièces : additionnées. Aides : additionnées, plafonnées à 3. Cadeaux : un usage déjà fait reste fait.
    await t.query(
      `INSERT INTO wallets (owner, coins) SELECT $2, coins FROM wallets WHERE owner = $1
       ON CONFLICT (owner) DO UPDATE SET coins = wallets.coins + EXCLUDED.coins`,
      [from, to],
    )
    await t.query(
      `INSERT INTO aid_stock (owner, aid, qty) SELECT $2, aid, qty FROM aid_stock WHERE owner = $1
       ON CONFLICT (owner, aid) DO UPDATE SET qty = LEAST(aid_stock.qty + EXCLUDED.qty, 3)`,
      [from, to],
    )
    await t.query(
      `INSERT INTO aid_gifts (owner, aid, demo_used) SELECT $2, aid, demo_used FROM aid_gifts WHERE owner = $1
       ON CONFLICT (owner, aid) DO UPDATE SET demo_used = aid_gifts.demo_used OR EXCLUDED.demo_used`,
      [from, to],
    )
    await t.query('INSERT INTO rewards (owner, kind, ref, amount, created_at) SELECT $2, kind, ref, amount, created_at FROM rewards WHERE owner = $1 ON CONFLICT DO NOTHING', [from, to])
    await mergeWagons(t, from, to)
    for (const table of ['wallets', 'aid_stock', 'aid_gifts', 'rewards']) await t.query(`DELETE FROM ${table} WHERE owner = $1`, [from])
  })
}
