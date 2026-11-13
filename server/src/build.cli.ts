// Fabrique les niveaux du plan : `make build-levels`. Réécrit server/data/levels.json en gardant tels quels les niveaux gelés
// (voir levels.lock.json). Sans effet sur la base tant que le serveur n'est pas relancé ; les niveaux déjà en base ne changent jamais.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { auditLevels, buildLevels, lockViolations, type Lock } from './levelBuilder.js'
import type { LevelSeed } from './journey.js'

const dataDir = new URL('../data/', import.meta.url)
const lockPath = new URL('levels.lock.json', dataDir)
const lock: Lock = existsSync(lockPath) ? JSON.parse(readFileSync(lockPath, 'utf8')) : { released: 0, hashes: [] }
const current: LevelSeed[] = existsSync(new URL('levels.json', dataDir)) ? JSON.parse(readFileSync(new URL('levels.json', dataDir), 'utf8')) : []

const bad = lockViolations(current, lock)
if (bad.length) {
  console.error(`REFUSÉ : des niveaux gelés ont été modifiés (${bad.slice(0, 10).join(', ')}). Restaure-les (git checkout server/data/levels.json).`)
  process.exit(1)
}
const to = process.argv[2] ? Number(process.argv[2]) : undefined
const t = Date.now()
const levels = buildLevels({ to, keep: current.filter((l) => l.id <= lock.released) })
writeFileSync(new URL('levels.json', dataDir), JSON.stringify(levels) + '\n')
const audit = auditLevels(levels)
console.log(`${levels.length} niveaux fabriqués en ${((Date.now() - t) / 1000).toFixed(1)} s (${lock.released} gelés conservés) → server/data/levels.json`)
console.log(audit.issues.length ? `\n${audit.issues.length} PROBLÈME(S) :\n- ${audit.issues.slice(0, 20).join('\n- ')}` : 'Audit : aucun problème.')
