// Les 4 aides (de la plus faible à la plus forte), le stock, l'achat et l'usage.
//   - le joueur choisit la cible, jamais le hasard ; le serveur calcule le résultat avec la solution ;
//   - 3 exemplaires au maximum par aide ; une seule aide de chaque type par niveau ;
//   - une aide s'ouvre à un niveau précis : cadeau de 3 en stock + 1 usage de démonstration gratuit ;
//   - on ne rachète qu'avec les pièces gagnées en jouant.
import type { Db } from './db.js'
import type { Given, Puzzle } from '../../shared/puzzle.js'
import { cannon, revealCell, revealLine, type Cell } from './aidLogic.js'
import { randomInt } from 'node:crypto'
import { isRock } from '../../shared/puzzle.js'
import { spend, balance } from './wallet.js'
import { status } from './journey.js'

export const STOCK_CAP = 3

// Du plus faible au plus fort. Les niveaux d'ouverture suivent la durée de jeu (un niveau de début de partie dure
// moins de 30 secondes) : une aide s'ouvre quand le joueur commence à en avoir besoin.
export const AIDS = [
  { id: 'colors', price: 10, unlockLevel: 20 }, // active les indicateurs de couleur des compteurs, sur le niveau en cours
  { id: 'cell', price: 20, unlockLevel: 50 }, // révèle le rail d'une case choisie
  { id: 'cannon', price: 30, unlockLevel: 80 }, // révèle quelques cases au hasard parmi celles pas encore bien posées
  { id: 'line', price: 50, unlockLevel: 110 }, // révèle tous les rails d'une ligne ou colonne
] as const
export type AidId = (typeof AIDS)[number]['id']
const aidOf = (id: unknown) => AIDS.find((a) => a.id === id)

export interface AidState {
  id: AidId
  price: number
  unlockLevel: number
  unlocked: boolean
  stock: number
  cap: number
  demoPending: boolean // le cadeau de déblocage : un usage gratuit à essayer
  usedThisLevel: boolean
}

// Donne leur cadeau aux aides dont le niveau est atteint (une seule fois par aide).
export async function grantGifts(db: Db, owner: string, level: number): Promise<void> {
  for (const a of AIDS) {
    if (level < a.unlockLevel) continue
    const r = await db.query('INSERT INTO aid_gifts (owner, aid) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING aid', [owner, a.id])
    if (r.rows.length) {
      await db.query(
        'INSERT INTO aid_stock (owner, aid, qty) VALUES ($1,$2,$3) ON CONFLICT (owner, aid) DO UPDATE SET qty = LEAST($3 + aid_stock.qty, $4)',
        [owner, a.id, STOCK_CAP, STOCK_CAP],
      )
    }
  }
}

export async function aidState(db: Db, owner: string): Promise<{ coins: number; aids: AidState[] }> {
  const st = await status(db, owner)
  const level = st.allDone ? st.total : st.level
  await grantGifts(db, owner, level)
  const stock = new Map((await db.query<{ aid: string; qty: number }>('SELECT aid, qty FROM aid_stock WHERE owner = $1', [owner])).rows.map((r) => [r.aid, r.qty]))
  const demo = new Map((await db.query<{ aid: string; demo_used: boolean }>('SELECT aid, demo_used FROM aid_gifts WHERE owner = $1', [owner])).rows.map((r) => [r.aid, r.demo_used]))
  const run = (await db.query<{ level: number; aids: string[] }>('SELECT level, aids FROM level_runs WHERE owner = $1', [owner])).rows[0]
  return {
    coins: await balance(db, owner),
    aids: AIDS.map((a) => ({
      id: a.id,
      price: a.price,
      unlockLevel: a.unlockLevel,
      unlocked: level >= a.unlockLevel,
      stock: stock.get(a.id) ?? 0,
      cap: STOCK_CAP,
      demoPending: demo.get(a.id) === false,
      usedThisLevel: !!run && run.level === st.level && run.aids.includes(a.id),
    })),
  }
}

export type BuyResult = { ok: true; coins: number; stock: number } | { ok: false; code: 'invalid' | 'locked' | 'full' | 'poor' }

export async function buyAid(db: Db, owner: string, aid: unknown): Promise<BuyResult> {
  const def = aidOf(aid)
  if (!def) return { ok: false, code: 'invalid' }
  return db.tx(async (t) => {
    const st = await status(t, owner)
    if ((st.allDone ? st.total : st.level) < def.unlockLevel) return { ok: false, code: 'locked' } as const
    await grantGifts(t, owner, st.allDone ? st.total : st.level)
    const qty = (await t.query<{ qty: number }>('SELECT qty FROM aid_stock WHERE owner = $1 AND aid = $2 FOR UPDATE', [owner, def.id])).rows[0]?.qty ?? 0
    if (qty >= STOCK_CAP) return { ok: false, code: 'full' } as const
    if (!(await spend(t, owner, def.price))) return { ok: false, code: 'poor' } as const
    await t.query('INSERT INTO aid_stock (owner, aid, qty) VALUES ($1,$2,1) ON CONFLICT (owner, aid) DO UPDATE SET qty = aid_stock.qty + 1', [owner, def.id])
    return { ok: true, coins: await balance(t, owner), stock: qty + 1 } as const
  })
}

export interface UseInput {
  aid: unknown
  target: unknown
  edges: unknown
  crosses: unknown
}

export type UseResult =
  | { ok: true; aid: AidId; demo: boolean; stock: number; coins: number; result: Record<string, unknown> }
  | { ok: false; code: 'invalid' | 'not_started' | 'locked' | 'already_used' | 'no_stock' | 'nothing' }

const EDGE_RE = /^[hv]:\d{1,2}:\d{1,2}$/
const CELL_RE = /^\d{1,2}:\d{1,2}$/
const isInt = (v: unknown): v is number => Number.isInteger(v)

export async function useAid(db: Db, owner: string, input: UseInput): Promise<UseResult> {
  const def = aidOf(input.aid)
  const edges = input.edges ?? []
  const crosses = input.crosses ?? []
  if (!def || !Array.isArray(edges) || edges.length > 200 || !edges.every((e) => typeof e === 'string' && EDGE_RE.test(e)) ||
      !Array.isArray(crosses) || crosses.length > 200 || !crosses.every((c) => typeof c === 'string' && CELL_RE.test(c))) {
    return { ok: false, code: 'invalid' }
  }
  return db.tx(async (t) => {
    const st = await status(t, owner)
    const level = st.allDone ? st.total : st.level
    if (level < def.unlockLevel) return { ok: false, code: 'locked' } as const
    await grantGifts(t, owner, level)
    const run = (await t.query<{ level: number; aids: string[]; reveals: Given[]; crosses: { row: number; col: number }[] }>(
      'SELECT level, aids, reveals, crosses FROM level_runs WHERE owner = $1 FOR UPDATE', [owner])).rows[0]
    if (!run || run.level !== st.level) return { ok: false, code: 'not_started' } as const
    if (run.aids.includes(def.id)) return { ok: false, code: 'already_used' } as const

    const lvl = (await t.query<{ puzzle: Puzzle; solution: Cell[] }>('SELECT puzzle, solution FROM levels WHERE id = $1', [st.level])).rows[0]
    const target = (input.target ?? {}) as Record<string, unknown>
    const have = new Set(run.reveals.map((g) => `${g.row}:${g.col}`))
    let result: Record<string, unknown>
    let newGivens: Given[] = []
    let newCrosses: { row: number; col: number }[] = []

    if (def.id === 'colors') {
      result = { active: true } // le serveur note seulement l'usage ; le navigateur affiche les couleurs sur ce niveau
    } else if (def.id === 'cannon') {
      const taken = new Set([...(lvl.puzzle.givens ?? []), ...run.reveals].map((g) => `${g.row}:${g.col}`))
      newGivens = cannon(lvl.puzzle, lvl.solution, edges as string[], taken, () => randomInt(0, 2 ** 30) / 2 ** 30)
      if (!newGivens.length) return { ok: false, code: 'nothing' } as const
      result = { givens: newGivens, crosses: [] }
    } else if (def.id === 'cell') {
      if (!isInt(target.row) || !isInt(target.col) || target.row < 0 || target.col < 0 || target.row >= lvl.puzzle.size || target.col >= lvl.puzzle.size) return { ok: false, code: 'invalid' } as const
      if (isRock(lvl.puzzle, target.row, target.col)) return { ok: false, code: 'nothing' } as const // un rocher : rien à révéler, rien de débité
      const r = revealCell(lvl.puzzle, lvl.solution, target.row, target.col)
      if ('given' in r) newGivens = have.has(`${r.given.row}:${r.given.col}`) ? [] : [r.given]
      else newCrosses = [r.cross]
      if (!newGivens.length && !newCrosses.length) return { ok: false, code: 'nothing' } as const
      result = { givens: newGivens, crosses: newCrosses }
    } else {
      if ((target.axis !== 'row' && target.axis !== 'col') || !isInt(target.index) || target.index < 0 || target.index >= lvl.puzzle.size) return { ok: false, code: 'invalid' } as const
      newGivens = revealLine(lvl.puzzle, lvl.solution, target.axis, target.index).filter((g) => !have.has(`${g.row}:${g.col}`))
      if (!newGivens.length) return { ok: false, code: 'nothing' } as const
      result = { givens: newGivens, crosses: [] }
    }

    // Le résultat existe : on consomme. Le cadeau de démonstration passe en premier (gratuit, sans pénalité).
    const gift = (await t.query<{ demo_used: boolean }>('SELECT demo_used FROM aid_gifts WHERE owner = $1 AND aid = $2 FOR UPDATE', [owner, def.id])).rows[0]
    const qty = (await t.query<{ qty: number }>('SELECT qty FROM aid_stock WHERE owner = $1 AND aid = $2 FOR UPDATE', [owner, def.id])).rows[0]?.qty ?? 0
    const demo = !!gift && !gift.demo_used
    if (!demo && qty < 1) return { ok: false, code: 'no_stock' } as const
    if (demo) await t.query('UPDATE aid_gifts SET demo_used = true WHERE owner = $1 AND aid = $2', [owner, def.id])
    else await t.query('UPDATE aid_stock SET qty = qty - 1 WHERE owner = $1 AND aid = $2', [owner, def.id])
    await t.query(
      `UPDATE level_runs SET aids = $2::jsonb, paid_used = paid_used OR $3, reveals = $4::jsonb, crosses = $5::jsonb WHERE owner = $1`,
      [owner, JSON.stringify([...run.aids, def.id]), !demo, JSON.stringify([...run.reveals, ...newGivens]), JSON.stringify([...run.crosses, ...newCrosses])],
    )
    return { ok: true, aid: def.id, demo, stock: demo ? qty : qty - 1, coins: await balance(t, owner), result } as const
  })
}
