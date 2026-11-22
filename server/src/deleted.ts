// Effacement des données d'un joueur et registre des suppressions (voir migrations/010_deleted_owners.sql).
import type { Db } from './db.js'

// Toutes les tables dont les lignes appartiennent à un joueur (colonne « owner »). Un test vérifie qu'aucune table
// avec une colonne « owner » ne manque ici : sinon une suppression de compte laisserait des données.
export const OWNER_TABLES = ['progress', 'level_runs', 'wallets', 'rewards', 'aid_stock', 'aid_gifts', 'daily_runs', 'daily_results', 'wagons_owned', 'train_layout'] as const

// Durée de conservation des sauvegardes (docs/sauvegardes.md : 35 jours) : le registre n'a pas besoin de remonter plus loin.
export const REGISTRY_TTL_MS = 35 * 24 * 3600_000

export const ownerOf = (userId: string) => `u:${userId}`

/** Efface toutes les données de jeu d'un joueur (pas son compte). */
export async function eraseOwner(db: Db, owner: string): Promise<void> {
  for (const table of OWNER_TABLES) await db.query(`DELETE FROM ${table} WHERE owner = $1`, [owner])
}

/** Note la suppression (identifiant seulement) et retire du registre les entrées plus vieilles que les sauvegardes. */
export async function recordDeletion(db: Db, owner: string, now: Date): Promise<void> {
  await db.query('INSERT INTO deleted_owners (owner, deleted_at) VALUES ($1, $2) ON CONFLICT (owner) DO NOTHING', [owner, now])
  await db.query('DELETE FROM deleted_owners WHERE deleted_at < $1', [new Date(now.getTime() - REGISTRY_TTL_MS)])
}

export interface RegistryEntry { owner: string; deleted_at: string }

export async function exportRegistry(db: Db): Promise<RegistryEntry[]> {
  const { rows } = await db.query<{ owner: string; deleted_at: Date }>('SELECT owner, deleted_at FROM deleted_owners ORDER BY deleted_at')
  return rows.map((r) => ({ owner: r.owner, deleted_at: new Date(r.deleted_at).toISOString() }))
}

/**
 * À lancer juste après une restauration : fusionne le registre éventuellement exporté avant la restauration (`extra`),
 * puis re-supprime chaque compte du registre (données de jeu et compte). Renvoie le nombre de comptes traités.
 */
export async function applyRegistry(db: Db, extra: RegistryEntry[] = []): Promise<number> {
  for (const e of extra) {
    if (!/^u:[0-9a-f-]{36}$/.test(e.owner)) continue // on ne fait confiance à aucun fichier : seulement des identifiants de joueur
    await db.query('INSERT INTO deleted_owners (owner, deleted_at) VALUES ($1, $2) ON CONFLICT (owner) DO NOTHING', [e.owner, new Date(e.deleted_at)])
  }
  const { rows } = await db.query<{ owner: string }>('SELECT owner FROM deleted_owners')
  await db.tx(async (t) => {
    for (const { owner } of rows) {
      await eraseOwner(t, owner)
      await t.query('DELETE FROM users WHERE id = $1', [owner.slice(2)]) // sessions et jetons partent avec (ON DELETE CASCADE)
    }
  })
  return rows.length
}
