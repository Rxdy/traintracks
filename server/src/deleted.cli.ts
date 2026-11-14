// Registre des suppressions, après une restauration de sauvegarde (voir docs/sauvegardes.md).
//   Avant de restaurer, si l'ancienne base est encore lisible :  tsx src/deleted.cli.ts export > suppressions.json
//   Après la restauration :                                      tsx src/deleted.cli.ts apply [suppressions.json]
import { readFileSync } from 'node:fs'
import { createPgDb } from './db.js'
import { applyRegistry, exportRegistry, type RegistryEntry } from './deleted.js'

const [commande, fichier] = process.argv.slice(2)
if (!process.env.DATABASE_URL || (commande !== 'export' && commande !== 'apply')) {
  console.error('Usage : DATABASE_URL=… tsx src/deleted.cli.ts export | apply [fichier.json]')
  process.exit(1)
}
const db = createPgDb(process.env.DATABASE_URL)
try {
  if (commande === 'export') {
    console.log(JSON.stringify(await exportRegistry(db), null, 2))
  } else {
    const extra: RegistryEntry[] = fichier ? JSON.parse(readFileSync(fichier, 'utf8')) : []
    const n = await applyRegistry(db, extra)
    console.log(`${n} compte(s) supprimé(s) de nouveau après la restauration.`)
  }
} finally {
  await db.close()
}
