// POUR LES TESTS SEULEMENT (jamais importé par l'application) : les niveaux vivent côté serveur
// (server/data/levels.json). Les tests du front les relisent pour vérifier le rendu et les règles.
import raw from '../../server/data/levels.json'
import type { Puzzle } from './puzzle'

export interface Level {
  id: number
  puzzle: Puzzle
  solution: [number, number][]
  intro?: string
}
export const levels = raw as unknown as Level[]
