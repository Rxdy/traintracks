import { buildApp } from './app.js'
import { loadConfig } from './config.js'
import { createPgDb, migrate } from './db.js'
import { createMailer } from './mailer.js'
import { seedLevels } from './journey.js'
import { readFileSync } from 'node:fs'

const cfg = loadConfig()
const db = createPgDb(cfg.databaseUrl)
const applied = await migrate(db)
if (applied.length) console.log('migrations appliquées :', applied.join(', '))

const seeded = await seedLevels(db, JSON.parse(readFileSync(new URL('../data/levels.json', import.meta.url), 'utf8')))
if (seeded.added.length) console.log(`${seeded.added.length} niveaux ajoutés (${seeded.added[0]} à ${seeded.added.at(-1)})`)
if (seeded.changed.length) console.warn(`ATTENTION : niveaux déjà en base mais modifiés dans le fichier, ignorés : ${seeded.changed.join(', ')}`)

const app = buildApp({
  db,
  mailer: createMailer(cfg.smtpUrl, cfg.mailFrom),
  appUrl: cfg.appUrl,
  now: () => new Date(),
  secureCookies: cfg.secureCookies,
  trustProxy: cfg.trustProxy,
  dailyTz: cfg.dailyTz,
})
await app.listen({ port: cfg.port, host: '0.0.0.0' })
