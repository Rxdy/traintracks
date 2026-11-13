import { createMemDb, migrate, type Db } from './db.js'
import type { Ctx } from './auth.js'
import type { Mailer } from './mailer.js'
import { readFileSync } from 'node:fs'
import { seedLevels, type LevelSeed } from './journey.js'
import { edgeKey } from '../../shared/track.js'

export interface Mail { to: string; subject: string; text: string }

const opened: Db[] = []
// Ferme toutes les bases ouvertes par le test (sinon la mémoire monte à chaque test).
export async function closeAll(): Promise<void> {
  await Promise.all(opened.splice(0).map((d) => d.close().catch(() => undefined)))
}

export async function makeCtx(): Promise<{ ctx: Ctx; db: Db; mails: Mail[]; clock: { t: number }; tokenOf: (i?: number) => string }> {
  const db = await createMemDb()
  opened.push(db)
  await migrate(db)
  const mails: Mail[] = []
  const mailer: Mailer = { send: async (to, subject, text) => void mails.push({ to, subject, text }) }
  const clock = { t: Date.UTC(2026, 0, 1, 12, 0, 0) }
  const ctx: Ctx = { db, mailer, appUrl: 'http://site.test', now: () => new Date(clock.t) }
  const tokenOf = (i = -1) => /\?confirm=([\w-]+)/.exec(mails.at(i)!.text)![1]
  return { ctx, db, mails, clock, tokenOf }
}

export const STRONG = 'bleu-fenetre-cactus-moteur-zebre'

export const LEVELS: LevelSeed[] = JSON.parse(readFileSync(new URL('../data/levels.json', import.meta.url), 'utf8'))

// Base prête à jouer : comptes + niveaux.
export async function makeGame() {
  const c = await makeCtx()
  await seedLevels(c.db, LEVELS)
  return c
}

// Les arêtes que le navigateur enverrait pour la solution d'un niveau.
export function edgesOf(id: number): string[] {
  const sol = LEVELS.find((l) => l.id === id)!.solution
  const out: string[] = []
  for (let i = 1; i < sol.length; i++) out.push(edgeKey(sol[i - 1][0], sol[i - 1][1], sol[i][0], sol[i][1])!)
  return out
}
