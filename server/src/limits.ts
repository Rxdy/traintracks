// Blocage des essais de connexion (par e-mail et par adresse IP).
//   - 5 échecs consécutifs sur un e-mail : blocage 15 min, puis 30, 60... jusqu'à 24 h ;
//   - 20 échecs depuis une même adresse IP : même mécanique ;
//   - un succès remet le compteur de l'e-mail à zéro ;
//   - sans nouvel échec pendant 1 h, le compteur d'échecs repart de zéro (le niveau de blocage reste).
// Le blocage s'applique aussi aux e-mails inconnus : il ne révèle pas quels comptes existent.
import type { Db } from './db.js'

export const EMAIL_MAX_FAILS = 5
export const IP_MAX_FAILS = 20
const BASE_LOCK_MS = 15 * 60_000
const MAX_LOCK_MS = 24 * 3600_000
const FORGET_AFTER_MS = 3600_000

export const emailKey = (email: string) => `email:${email}`
export const ipKey = (ip: string) => `ip:${ip}`

// Secondes restantes avant la fin du blocage le plus long, ou 0 si libre.
export async function lockedFor(db: Db, keys: string[], now: Date): Promise<number> {
  const { rows } = await db.query<{ locked_until: Date | null }>(
    'SELECT locked_until FROM login_limits WHERE key = ANY($1::text[])',
    [keys],
  )
  let max = 0
  for (const r of rows) if (r.locked_until) max = Math.max(max, new Date(r.locked_until).getTime() - now.getTime())
  return max > 0 ? Math.ceil(max / 1000) : 0
}

export async function recordFailure(db: Db, key: string, threshold: number, now: Date): Promise<void> {
  await db.tx(async (t) => {
    const { rows } = await t.query<{ failures: number; level: number; locked_until: Date | null; updated_at: Date }>(
      'SELECT failures, level, locked_until, updated_at FROM login_limits WHERE key = $1 FOR UPDATE',
      [key],
    )
    let failures = 0
    let level = 0
    if (rows[0]) {
      level = rows[0].level
      const stale = now.getTime() - new Date(rows[0].updated_at).getTime() > FORGET_AFTER_MS
      failures = stale ? 0 : rows[0].failures
    }
    failures += 1
    let lockedUntil: Date | null = null
    if (failures >= threshold) {
      lockedUntil = new Date(now.getTime() + Math.min(BASE_LOCK_MS * 2 ** level, MAX_LOCK_MS))
      level += 1
      failures = 0
    }
    await t.query(
      `INSERT INTO login_limits (key, failures, level, locked_until, updated_at) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (key) DO UPDATE SET failures = $2, level = $3, locked_until = $4, updated_at = $5`,
      [key, failures, level, lockedUntil, now],
    )
  })
}

export async function recordSuccess(db: Db, key: string): Promise<void> {
  await db.query('DELETE FROM login_limits WHERE key = $1', [key])
}
