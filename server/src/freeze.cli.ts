// Gèle les niveaux actuels : `make freeze`. À lancer AVANT de publier. Ensuite aucun de ces niveaux ne peut plus changer
// (les tests échouent et `make build-levels` refuse) : des joueurs auront joué dessus, on ne peut que AJOUTER à la suite.
import { readFileSync, writeFileSync } from 'node:fs'
import { makeLock } from './levelBuilder.js'
import type { LevelSeed } from './journey.js'

const dataDir = new URL('../data/', import.meta.url)
const levels: LevelSeed[] = JSON.parse(readFileSync(new URL('levels.json', dataDir), 'utf8'))
const lock = makeLock(levels)
writeFileSync(new URL('levels.lock.json', dataDir), JSON.stringify(lock) + '\n')
console.log(`${lock.released} niveaux gelés (1 à ${lock.released}). Ils ne pourront plus être modifiés.`)
