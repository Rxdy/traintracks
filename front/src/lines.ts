// Aide « démineur » : état de chaque compteur de ligne / colonne.
//   - done   : le compte est atteint (vert) — le reste de la ligne est sans rail
//   - forced : il ne reste que juste assez de cases libres (rails + vides =
//              compteur) : toutes doivent être des rails (vert)
//   - over   : impossible (trop de rails, ou pas assez de cases libres) (rouge)
//   - open   : rien à signaler
//
// L'aide ne s'allume que si le JOUEUR a posé au moins une marque (rail ou croix)
// sur la ligne : sinon un « 0 » ou un « 4 » sur 4 cases serait coloré dès le
// début du niveau et donnerait un indice avant même de jouer.
import type { CellMark } from './cell'

export type ClueStatus = 'open' | 'done' | 'forced' | 'over'

export function lineStatus(marks: CellMark[], clue: number, touched = true): ClueStatus {
  if (!touched) return 'open'
  const rails = marks.filter((m) => m === 'rail').length
  const free = marks.filter((m) => m !== 'cross' && m !== 'rock').length // rails + vides
  if (rails > clue || free < clue) return 'over'
  if (rails === clue) return 'done'
  if (free === clue) return 'forced'
  return 'open'
}

export interface LineStatuses {
  rows: ClueStatus[]
  cols: ClueStatus[]
}

// `played[r][c]` : la case porte une marque posée par le joueur (pas le
// départ / la sortie, qui sont imposés).
export function lineStatuses(
  grid: CellMark[][],
  rowClues: number[],
  colClues: number[],
  played: boolean[][] = grid.map((row) => row.map(() => true)),
): LineStatuses {
  return {
    rows: grid.map((row, r) => lineStatus(row, rowClues[r], played[r].some(Boolean))),
    cols: colClues.map((clue, c) =>
      lineStatus(
        grid.map((row) => row[c]),
        clue,
        played.some((row) => row[c]),
      ),
    ),
  }
}
