// Wagons : la collection, le tirage de la machine « Wagon surprise » et l'ordre du train. Le serveur fait foi
// (prix, hasard, possession) : le navigateur ne fait qu'afficher et demander.
import { randomInt } from 'node:crypto'
import { DRAW_PRICE, drawPool, leftToWin, STARTER_TRAIN, validTrain } from '../../shared/wagons.js'
import type { Db } from './db.js'
import { balance, spend } from './wallet.js'

export const PRESETS = 3 // trains enregistrés par joueur

export interface TrainState {
  owned: Record<string, number> // wagon → exemplaires
  train: string[] // ordre derrière la locomotive (le train qui roule : presets[active])
  presets: string[][] // les 3 trains enregistrés
  active: number
  left: number // wagons encore à gagner dans la machine
  price: number
  coins: number
}

/** Le hasard du tirage (remplaçable dans les tests). Rend un entier dans [0, n[. */
export type Rng = (n: number) => number
const cryptoRng: Rng = (n) => randomInt(n)

async function ownedOf(db: Db, owner: string): Promise<Record<string, number>> {
  const { rows } = await db.query<{ wagon: string; qty: number }>('SELECT wagon, qty FROM wagons_owned WHERE owner = $1', [owner])
  return Object.fromEntries(rows.filter((r) => r.qty > 0).map((r) => [r.wagon, r.qty]))
}

/** Inscrit le train de départ la première fois (rien n'est écrit pour un invité qui n'a encore rien fait). */
async function ensureStarter(db: Db, owner: string, now: Date): Promise<void> {
  const has = await db.query('SELECT 1 FROM train_layout WHERE owner = $1', [owner])
  if (has.rows.length) return
  for (const id of STARTER_TRAIN) await db.query('INSERT INTO wagons_owned (owner, wagon, qty) VALUES ($1,$2,1) ON CONFLICT (owner, wagon) DO NOTHING', [owner, id])
  const presets = Array.from({ length: PRESETS }, () => STARTER_TRAIN)
  await db.query('INSERT INTO train_layout (owner, cars, presets, active, updated_at) VALUES ($1,$2,$3,0,$4) ON CONFLICT (owner) DO NOTHING', [owner, JSON.stringify(STARTER_TRAIN), JSON.stringify(presets), now])
}

/** L'état sans rien écrire : un joueur jamais vu a le train de départ. */
export async function trainState(db: Db, owner: string | null): Promise<TrainState> {
  const starterPresets = () => Array.from({ length: PRESETS }, () => [...STARTER_TRAIN])
  if (!owner) {
    const owned = Object.fromEntries(STARTER_TRAIN.map((id) => [id, 1]))
    return { owned, train: [...STARTER_TRAIN], presets: starterPresets(), active: 0, left: leftToWin(owned), price: DRAW_PRICE, coins: 0 }
  }
  const layout = await db.query<{ cars: string[]; presets: string[][]; active: number }>('SELECT cars, presets, active FROM train_layout WHERE owner = $1', [owner])
  const row = layout.rows[0]
  const owned = row ? await ownedOf(db, owner) : Object.fromEntries(STARTER_TRAIN.map((id) => [id, 1]))
  const train = row ? row.cars : [...STARTER_TRAIN]
  const presets = row && row.presets.length === PRESETS ? row.presets : starterPresets()
  return { owned, train, presets, active: row?.active ?? 0, left: leftToWin(owned), price: DRAW_PRICE, coins: await balance(db, owner) }
}

export type DrawResult = { ok: true; wagon: string; added: boolean; state: TrainState } | { ok: false; code: 'poor' | 'complete' }

/**
 * Un tirage : 50 pièces, un wagon au hasard parmi ceux qu'on a moins de 6 fois. On gagne toujours.
 * Le wagon gagné prend la première place libre du train s'il en reste une (`added`).
 */
export async function drawWagon(db: Db, owner: string, now: Date, rng: Rng = cryptoRng): Promise<DrawResult> {
  return db.tx(async (t) => {
    // un seul tirage à la fois par joueur : deux touchers rapides ne débitent jamais deux fois
    await t.query('INSERT INTO wallets (owner, coins) VALUES ($1, 0) ON CONFLICT (owner) DO NOTHING', [owner])
    await t.query('SELECT 1 FROM wallets WHERE owner = $1 FOR UPDATE', [owner])
    await ensureStarter(t, owner, now)
    const owned = await ownedOf(t, owner)
    const pool = drawPool(owned)
    if (!pool.length) return { ok: false, code: 'complete' } as const
    if (!(await spend(t, owner, DRAW_PRICE))) return { ok: false, code: 'poor' } as const
    const wagon = pool[rng(pool.length)]!
    await t.query(
      'INSERT INTO wagons_owned (owner, wagon, qty) VALUES ($1,$2,1) ON CONFLICT (owner, wagon) DO UPDATE SET qty = wagons_owned.qty + 1',
      [owner, wagon],
    )
    const cars = (await t.query<{ cars: string[] }>('SELECT cars FROM train_layout WHERE owner = $1', [owner])).rows[0]!.cars
    const added = cars.length < 6
    if (added) await writeActive(t, owner, [...cars, wagon], now)
    return { ok: true, wagon, added, state: await trainState(t, owner) } as const
  })
}

export type SetTrainResult = { ok: true; state: TrainState } | { ok: false; code: 'invalid' }

/** Le train qui roule change : on l'écrit aussi dans son emplacement enregistré. */
async function writeActive(t: Db, owner: string, cars: string[], now: Date): Promise<void> {
  await t.query(
    `UPDATE train_layout SET cars = $2, presets = jsonb_set(presets, ARRAY[active::text], $2::jsonb), updated_at = $3 WHERE owner = $1`,
    [owner, JSON.stringify(cars), now],
  )
}

const validSlot = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < PRESETS

/**
 * Range un train dans l'ordre demandé (wagons possédés seulement, 6 au plus). `slot` : lequel des 3 trains enregistrés
 * (par défaut, celui qui roule). Si c'est celui qui roule, il change tout de suite dans le Trajet.
 */
export async function setTrain(db: Db, owner: string, cars: unknown, now: Date, slot?: unknown): Promise<SetTrainResult> {
  return db.tx(async (t) => {
    await ensureStarter(t, owner, now)
    if (!validTrain(cars, await ownedOf(t, owner))) return { ok: false, code: 'invalid' } as const
    if (slot !== undefined && !validSlot(slot)) return { ok: false, code: 'invalid' } as const
    const active = (await t.query<{ active: number }>('SELECT active FROM train_layout WHERE owner = $1', [owner])).rows[0]!.active
    if (slot === undefined || slot === active) await writeActive(t, owner, cars, now)
    else await t.query('UPDATE train_layout SET presets = jsonb_set(presets, ARRAY[$2::text], $3::jsonb), updated_at = $4 WHERE owner = $1', [owner, slot, JSON.stringify(cars), now])
    return { ok: true, state: await trainState(t, owner) } as const
  })
}

/** Choisit lequel des 3 trains enregistrés roule. */
export async function selectPreset(db: Db, owner: string, slot: unknown, now: Date): Promise<SetTrainResult> {
  if (!validSlot(slot)) return { ok: false, code: 'invalid' }
  return db.tx(async (t) => {
    await ensureStarter(t, owner, now)
    await t.query('UPDATE train_layout SET active = $2, cars = presets -> $2::int, updated_at = $3 WHERE owner = $1', [owner, slot, now])
    return { ok: true, state: await trainState(t, owner) } as const
  })
}

/**
 * Un invité qui se connecte : ses wagons rejoignent ceux du compte (additionnés, 6 au plus de chaque).
 * L'ordre du train du compte est gardé ; s'il n'en avait pas, il prend celui de l'invité.
 */
export async function mergeWagons(t: Db, from: string, to: string): Promise<void> {
  await t.query(
    `INSERT INTO wagons_owned (owner, wagon, qty) SELECT $2, wagon, qty FROM wagons_owned WHERE owner = $1
     ON CONFLICT (owner, wagon) DO UPDATE SET qty = LEAST(wagons_owned.qty + EXCLUDED.qty, 6)`,
    [from, to],
  )
  await t.query(
    'INSERT INTO train_layout (owner, cars, presets, active, updated_at) SELECT $2, cars, presets, active, updated_at FROM train_layout WHERE owner = $1 ON CONFLICT (owner) DO NOTHING',
    [from, to],
  )
  for (const table of ['wagons_owned', 'train_layout']) await t.query(`DELETE FROM ${table} WHERE owner = $1`, [from])
}
