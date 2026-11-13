// `make dev-player LEVEL=60 COINS=200` : crée un compte d'essai arrivé au niveau demandé.
import { createPgDb } from './db.js'
import { createDevPlayer } from './devPlayer.js'

if (process.env.DEV_TOOLS !== '1') {
  console.error('Refusé : outil de développement. Lance-le avec DEV_TOOLS=1 (make dev-player le fait), jamais en production.')
  process.exit(1)
}
const level = Number(process.argv[2] ?? 1)
const coins = process.argv[3] ? Number(process.argv[3]) : undefined
const db = createPgDb(process.env.DATABASE_URL!)
const p = await createDevPlayer(db, { level, coins })
console.log(`Compte d'essai prêt : niveau ${p.level}, ${p.coins} pièces\n  e-mail       ${p.email}\n  mot de passe ${p.password}`)
await db.close()
