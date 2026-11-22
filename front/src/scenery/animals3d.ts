import type { AnimalKind } from './motion'

// Les animaux dessinés dans la scène 3D (scenery3d/animals.ts), au sol, sous le train et derrière les arbres comme lui.
// Les autres restent en SVG (SceneryLife) tant que leur modèle 3D n'est pas fait. Ce fichier ne charge pas three.js : le SVG
// s'en sert pour savoir lesquels ne pas dessiner.
// Agrandissement des petites scènes (feu de camp, skieur, cabine de téléphérique…) pour qu'elles se voient à côté des arbres.
export const ANIMAL_BIG: Record<string, number> = { campfire: 1.8, gondola: 1.7, skater: 1.5, skier: 1.5, sled: 1.5, goat: 1.3, tractor: 1.3, sheep: 1.3, cow: 1.3 }
export const animalScale = (kind: string): number => 1.45 * (ANIMAL_BIG[kind] ?? 1)
export const ANIMALS_3D: ReadonlySet<AnimalKind> = new Set<AnimalKind>(['sheep', 'cow', 'tractor', 'cat', 'rabbit', 'squirrel', 'deer'])
