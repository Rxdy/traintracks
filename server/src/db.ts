// Accès à la base : une interface minimale, deux implémentations.
//   - PostgreSQL (pg) en production ;
//   - PGlite (vrai PostgreSQL, en mémoire) dans les tests : mêmes requêtes SQL, aucun conteneur à lancer.
import { readdirSync, readFileSync } from 'node:fs'
import pg from 'pg'

export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>
  exec(sql: string): Promise<void>
  close(): Promise<void>
}

export function createPgDb(connectionString: string): Db {
  const pool = new pg.Pool({ connectionString })
  const wrap = (q: pg.Pool | pg.PoolClient, client?: pg.PoolClient): Db => ({
    query: async (sql, params) => ({ rows: (await q.query(sql, params as unknown[])).rows }),
    exec: async (sql) => void (await q.query(sql)),
    tx: async (fn) => {
      if (client) return fn(wrap(client, client)) // déjà dans une transaction
      const c = await pool.connect()
      try {
        await c.query('BEGIN')
        const out = await fn(wrap(c, c))
        await c.query('COMMIT')
        return out
      } catch (e) {
        await c.query('ROLLBACK')
        throw e
      } finally {
        c.release()
      }
    },
    close: async () => {
      if (!client) await pool.end()
    },
  })
  return wrap(pool)
}

export async function createMemDb(): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite')
  const mem = new PGlite()
  type Runner = Pick<typeof mem, 'query' | 'exec'> & { transaction?: typeof mem.transaction }
  const wrap = (r: Runner, inTx: boolean): Db => ({
    query: async (sql, params) => ({ rows: (await r.query(sql, params as unknown[])).rows as never[] }),
    exec: async (sql) => void (await r.exec(sql)),
    tx: async (fn) => (inTx ? fn(wrap(r, true)) : mem.transaction((t) => fn(wrap(t as Runner, true)))),
    close: async () => {
      if (!inTx) await mem.close()
    },
  })
  return wrap(mem, false)
}

// Applique les fichiers migrations/*.sql pas encore passés, dans l'ordre alphabétique.
export async function migrate(db: Db, dir = new URL('../migrations/', import.meta.url)): Promise<string[]> {
  await db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY)')
  const done = new Set((await db.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map((r) => r.name))
  const applied: string[] = []
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.sql')).sort()) {
    if (done.has(f)) continue
    await db.tx(async (t) => {
      await t.exec(readFileSync(new URL(f, dir), 'utf8'))
      await t.query('INSERT INTO schema_migrations (name) VALUES ($1)', [f])
    })
    applied.push(f)
  }
  return applied
}
