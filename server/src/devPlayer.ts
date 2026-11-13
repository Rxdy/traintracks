// Comptes d'ESSAI pour tester le jeu à un niveau donné sans rejouer tout le début. Réservé au développement :
// la ligne de commande refuse de tourner sans DEV_TOOLS=1 (voir `make dev-player`).
import { randomUUID } from 'node:crypto'
import type { Db } from './db.js'
import { aidState } from './aids.js'
import { hashPassword } from './password.js'

export const DEV_PASSWORD = 'bleu-fenetre-cactus-moteur-zebre'

export interface DevPlayer {
  pseudo: string
  email: string
  password: string
  level: number
  coins: number
}

// Crée (ou remet à zéro) le joueur d'essai « test<niveau> », e-mail déjà confirmé, qui arrive au niveau demandé.
export async function createDevPlayer(db: Db, opts: { level: number; coins?: number; now?: Date }): Promise<DevPlayer> {
  const { level } = opts
  if (!Number.isInteger(level) || level < 1) throw new Error(`niveau invalide : ${level}`)
  const max = ((await db.query<{ m: number | null }>('SELECT max(id)::int AS m FROM levels')).rows[0].m ?? 0) + 1
  if (level > max) throw new Error(`le niveau ${level} n'existe pas (il y a ${max - 1} niveaux)`)
  const coins = opts.coins ?? 100
  const now = opts.now ?? new Date()
  const pseudo = `test${level}`
  const email = `${pseudo}@local.test`

  let id = (await db.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [email])).rows[0]?.id
  if (!id) {
    id = randomUUID()
    await db.query(
      'INSERT INTO users (id, pseudo, pseudo_key, email, password_hash, provider, email_confirmed_at, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$7)',
      [id, pseudo, pseudo, email, await hashPassword(DEV_PASSWORD), 'local', now],
    )
  }
  const owner = `u:${id}`
  await db.tx(async (t) => {
    for (const table of ['progress', 'level_runs', 'wallets', 'rewards', 'aid_stock', 'aid_gifts', 'daily_runs', 'daily_results']) {
      await t.query(`DELETE FROM ${table} WHERE owner = $1`, [owner])
    }
    await t.query('INSERT INTO progress (owner, level, solved_at, time_ms) SELECT $1, g, $2, 20000 FROM generate_series(1, $3::int) g', [owner, now, level - 1])
    await t.query('INSERT INTO wallets (owner, coins) VALUES ($1,$2)', [owner, coins])
  })
  await aidState(db, owner) // donne leur cadeau aux aides déjà débloquées à ce niveau
  return { pseudo, email, password: DEV_PASSWORD, level, coins }
}
