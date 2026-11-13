// Modèle de données d'une grille Train Tracks.
//
// On reste sur la grille STANDARD 8×8. Ce module est volontairement séparé
// du rendu pour pouvoir être réutilisé plus tard par le solveur et le
// générateur de puzzle quotidien.

import type { Side } from './cell.js'

export const STANDARD_SIZE = 8

// Direction sortante d'un rail sur le bord de la grille.
export type Direction = 'left' | 'right' | 'up' | 'down'

// Point d'entrée / de sortie de la voie sur un bord.
export interface EdgePoint {
  row: number
  col: number
  dir: Direction
}

// Rail imposé : une case dont le rail est déjà posé au départ (forme visible,
// non modifiable). La voie DOIT passer par cette case, par ces deux côtés.
export interface Given {
  row: number
  col: number
  sides: [Side, Side]
}

// Rocher : case où la voie ne passe jamais. Le joueur ne peut rien y poser.
export interface Rock {
  row: number
  col: number
}

// Une grille Train Tracks complète.
export interface Puzzle {
  size: number
  rowClues: number[]
  colClues: number[]
  entry: EdgePoint
  exit: EdgePoint
  givens?: Given[] // rails imposés
  rocks?: Rock[] // rochers : cases interdites à la voie
}

// Puzzle d'exemple (grille standard 8×8), à solution UNIQUE (vérifiée par
// recherche exhaustive).
//   - rowClues : nombre de cases contenant un rail sur chaque LIGNE (haut → bas)
//   - colClues : nombre de cases contenant un rail sur chaque COLONNE (gauche → droite)
//   - entry / exit : positions de la voie sur le bord (case + direction sortante)
export const samplePuzzle: Puzzle = {
  size: STANDARD_SIZE,
  rowClues: [2, 2, 6, 2, 1, 4, 4, 2], // somme = 23
  colClues: [3, 3, 1, 2, 4, 4, 4, 2], // somme = 23
  entry: { row: 2, col: 0, dir: 'left' }, // la voie entre par la gauche, ligne 2
  exit: { row: 7, col: 3, dir: 'down' }, // la voie sort par le bas, colonne 3
}

// Solution de samplePuzzle : cases dans l'ordre, de l'entrée à la sortie.
export const sampleSolution: [number, number][] = [
  [2, 0], [1, 0], [0, 0], [0, 1], [1, 1], [2, 1], [2, 2], [2, 3], [2, 4],
  [2, 5], [3, 5], [3, 6], [4, 6], [5, 6], [5, 7], [6, 7], [6, 6], [6, 5],
  [5, 5], [5, 4], [6, 4], [7, 4], [7, 3],
]

// Explications affichées pendant la démonstration : clé = nombre de cases
// posées à partir duquel le message s'affiche.
export const sampleCaptions: Record<number, string> = {
  0: 'Voici le puzzle. La voie doit relier le départ (vert) à la sortie (rouge).',
  1: 'Le départ est posé. La colonne de gauche dit 3 : il reste 2 rails à y mettre. On monte.',
  3: 'La 1re colonne a ses 3 rails : son chiffre passe au VERT et on bloque ses autres cases avec une croix ✕ (clic droit). Plus aucun rail ne pourra y aller.',
  4: 'On redescend par la 2e colonne (indice 3).',
  6: 'La 2e colonne a ses 3 rails aussi : on tourne vers la droite, sur la ligne du départ (qui en demande 6).',
  7: 'ATTENTION : la 3e colonne n’a qu’UN rail. La voie la traverse donc tout droit. Dès son rail posé, le chiffre passe au vert et on croise le reste de la colonne.',
  10: 'La ligne du départ demande 6 rails : on en a 6, on tourne vers le bas.',
  13: 'La 5e ligne n’a qu’UN rail : une fois posé, toutes ses autres cases sont bloquées ✕. Les croix t’indiquent où la voie ne peut PAS passer.',
  14: 'On contourne par la droite, puis on revient vers la gauche…',
  22: 'Dernière ligne : on rejoint la sortie par le bas.',
  23: 'Gagné ! Tous les chiffres sont verts. Dans le vrai jeu, un train traverse alors ta voie 🚂',
}

// Retourne [0, 1, ..., n-1]. Utilitaire d'itération.
export function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i)
}

// Somme des compteurs (nombre total de cases avec rail attendu).
export function sumClues(clues: number[]): number {
  return clues.reduce((acc, n) => acc + n, 0)
}

// Nature d'un rail, pour la couleur :
//   - entry : rail de départ (vert), imposé, verrouillé
//   - exit  : rail de sortie (rouge), imposé, verrouillé
//   - user  : rail posé par le joueur (bleu)
//   - given : rail imposé (gris), verrouillé
export type RailVariant = 'entry' | 'exit' | 'user' | 'given'

export function isEntry(puzzle: Puzzle, row: number, col: number): boolean {
  return puzzle.entry.row === row && puzzle.entry.col === col
}

export function isExit(puzzle: Puzzle, row: number, col: number): boolean {
  return puzzle.exit.row === row && puzzle.exit.col === col
}

// Les cases d'entrée / sortie sont verrouillées : le joueur ne peut pas les
// changer (ce sont toujours des rails).
export function givenAt(puzzle: Puzzle, row: number, col: number): Given | undefined {
  return puzzle.givens?.find((g) => g.row === row && g.col === col)
}

export function isGiven(puzzle: Puzzle, row: number, col: number): boolean {
  return givenAt(puzzle, row, col) !== undefined
}

export function isRock(puzzle: Puzzle, row: number, col: number): boolean {
  return puzzle.rocks?.some((r) => r.row === row && r.col === col) ?? false
}

// Verrouillées : départ, sortie, rails imposés et rochers ne se modifient pas.
export function isLocked(puzzle: Puzzle, row: number, col: number): boolean {
  return isEntry(puzzle, row, col) || isExit(puzzle, row, col) || isGiven(puzzle, row, col) || isRock(puzzle, row, col)
}

// Couleur / nature du rail d'une case.
export function railVariant(
  puzzle: Puzzle,
  row: number,
  col: number,
): RailVariant {
  if (isEntry(puzzle, row, col)) return 'entry'
  if (isExit(puzzle, row, col)) return 'exit'
  if (isGiven(puzzle, row, col)) return 'given'
  return 'user'
}

// Vrai si un puzzle est cohérent : bonne taille, bons compteurs, sommes égales.
export function isConsistent(puzzle: Puzzle): boolean {
  const { size, rowClues, colClues } = puzzle
  if (rowClues.length !== size || colClues.length !== size) return false
  for (const g of puzzle.givens ?? []) {
    if (g.row < 0 || g.col < 0 || g.row >= size || g.col >= size) return false
    if (g.sides[0] === g.sides[1]) return false
    if (isEntry(puzzle, g.row, g.col) || isExit(puzzle, g.row, g.col)) return false
    // chaque côté doit mener à une case de la grille
    for (const side of g.sides) {
      const r = g.row + (side === 'top' ? -1 : side === 'bottom' ? 1 : 0)
      const c = g.col + (side === 'left' ? -1 : side === 'right' ? 1 : 0)
      if (r < 0 || c < 0 || r >= size || c >= size) return false
    }
  }
  for (const k of puzzle.rocks ?? []) {
    if (k.row < 0 || k.col < 0 || k.row >= size || k.col >= size) return false
    if (isEntry(puzzle, k.row, k.col) || isExit(puzzle, k.row, k.col) || isGiven(puzzle, k.row, k.col)) return false
  }
  return sumClues(rowClues) === sumClues(colClues)
}
