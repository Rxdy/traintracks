// Modèle de données d'une grille Train Tracks.
//
// On reste sur la grille STANDARD 8×8. Ce module est volontairement séparé
// du rendu pour pouvoir être réutilisé plus tard par le solveur et le
// générateur de puzzle quotidien.

export const STANDARD_SIZE = 8

// Direction sortante d'un rail sur le bord de la grille.
export type Direction = 'left' | 'right' | 'up' | 'down'

// Point d'entrée / de sortie de la voie sur un bord.
export interface EdgePoint {
  row: number
  col: number
  dir: Direction
}

// Une grille Train Tracks complète.
export interface Puzzle {
  size: number
  rowClues: number[]
  colClues: number[]
  entry: EdgePoint
  exit: EdgePoint
}

// Puzzle d'exemple (grille standard 8×8).
//   - rowClues : nombre de cases contenant un rail sur chaque LIGNE (haut → bas)
//   - colClues : nombre de cases contenant un rail sur chaque COLONNE (gauche → droite)
//   - entry / exit : positions de la voie sur le bord (case + direction sortante)
//
// Les compteurs sont cohérents : somme des lignes = somme des colonnes.
export const samplePuzzle: Puzzle = {
  size: STANDARD_SIZE,
  rowClues: [3, 2, 5, 2, 3, 4, 5, 4], // somme = 28
  colClues: [1, 4, 5, 3, 4, 2, 5, 4], // somme = 28
  entry: { row: 2, col: 0, dir: 'left' }, // la voie entre par la gauche, ligne 2
  exit: { row: 7, col: 3, dir: 'down' }, // la voie sort par le bas, colonne 3
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
export type RailVariant = 'entry' | 'exit' | 'user'

export function isEntry(puzzle: Puzzle, row: number, col: number): boolean {
  return puzzle.entry.row === row && puzzle.entry.col === col
}

export function isExit(puzzle: Puzzle, row: number, col: number): boolean {
  return puzzle.exit.row === row && puzzle.exit.col === col
}

// Les cases d'entrée / sortie sont verrouillées : le joueur ne peut pas les
// changer (ce sont toujours des rails).
export function isLocked(puzzle: Puzzle, row: number, col: number): boolean {
  return isEntry(puzzle, row, col) || isExit(puzzle, row, col)
}

// Couleur / nature du rail d'une case.
export function railVariant(
  puzzle: Puzzle,
  row: number,
  col: number,
): RailVariant {
  if (isEntry(puzzle, row, col)) return 'entry'
  if (isExit(puzzle, row, col)) return 'exit'
  return 'user'
}

// Vrai si un puzzle est cohérent : bonne taille, bons compteurs, sommes égales.
export function isConsistent(puzzle: Puzzle): boolean {
  const { size, rowClues, colClues } = puzzle
  if (rowClues.length !== size || colClues.length !== size) return false
  return sumClues(rowClues) === sumClues(colClues)
}
