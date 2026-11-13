// Pièces. Une récompense n'est versée qu'une fois (clé unique) ; une dépense échoue si le solde manque.
import type { Db } from './db.js'

export async function balance(db: Db, owner: string): Promise<number> {
  const { rows } = await db.query<{ coins: number }>('SELECT coins FROM wallets WHERE owner = $1', [owner])
  return rows[0]?.coins ?? 0
}

// Vrai si la récompense vient d'être versée, faux si elle l'avait déjà été.
export async function credit(db: Db, owner: string, amount: number, kind: string, ref: string, now: Date): Promise<boolean> {
  const r = await db.query('INSERT INTO rewards (owner, kind, ref, amount, created_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING owner', [owner, kind, ref, amount, now])
  if (!r.rows.length) return false
  await db.query(
    'INSERT INTO wallets (owner, coins) VALUES ($1,$2) ON CONFLICT (owner) DO UPDATE SET coins = wallets.coins + $2',
    [owner, amount],
  )
  return true
}

// Vrai si le solde suffisait (et a été débité).
export async function spend(db: Db, owner: string, amount: number): Promise<boolean> {
  const r = await db.query('UPDATE wallets SET coins = coins - $2 WHERE owner = $1 AND coins >= $2 RETURNING owner', [owner, amount])
  return r.rows.length > 0
}
