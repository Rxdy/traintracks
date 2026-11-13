// Audit du Voyage : `make audit`. Compare les niveaux au plan, vérifie l'unicité des solutions et la montée de difficulté.
import { readFileSync, existsSync } from 'node:fs'
import { formatDuration, playSeconds, planFor, describe } from '../../shared/curriculum.js'
import { auditLevels, lockViolations, type Lock } from './levelBuilder.js'
import type { LevelSeed } from './journey.js'

const dataDir = new URL('../data/', import.meta.url)
const levels: LevelSeed[] = JSON.parse(readFileSync(new URL('levels.json', dataDir), 'utf8'))
const lock: Lock = existsSync(new URL('levels.lock.json', dataDir)) ? JSON.parse(readFileSync(new URL('levels.lock.json', dataDir), 'utf8')) : { released: 0, hashes: [] }
const a = auditLevels(levels)

console.log(`${levels.length} niveaux, jeu estimé à ~${formatDuration(playSeconds(1, levels.length))}. Gelés : ${lock.released}.\n`)
console.log('Blocs de 10   taille  rails imposés  difficulté*  plan (. normal, G rails imposés)')
for (const b of a.blocks) console.log(`${String(b.from).padStart(4)}-${String(b.to).padEnd(4)}     ${b.size}×${b.size}      ${String(b.withGivens).padStart(2)}/10        ${b.difficulty.toFixed(2)}        ${describe(b.from, b.to)}`)
console.log('\n* log10 du nombre de cases explorées par le solveur : mesure grossière, pas le ressenti d\'un humain.')
console.log('\nMontée de difficulté par taille (corrélation de rang : 1 = monte toujours, 0 = au hasard) :')
for (const t of a.trend) console.log(`  ${t.size}×${t.size} : ${t.levels} niveaux, ${Number.isNaN(t.spearman) ? 'trop peu pour mesurer' : t.spearman.toFixed(2)}`)
const bad = lockViolations(levels, lock)
console.log(bad.length ? `\nGELÉS MODIFIÉS : ${bad.join(', ')}` : '\nNiveaux gelés : intacts.')
console.log(a.issues.length ? `\n${a.issues.length} PROBLÈME(S) :\n- ${a.issues.slice(0, 30).join('\n- ')}` : '\nAucun écart avec le plan.')
process.exit(a.issues.length || bad.length ? 1 : 0)
