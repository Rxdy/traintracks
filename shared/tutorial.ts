// Tutoriel : cinq petits exercices, chacun fait de pas à pas où le joueur n'a le droit de faire QU'UNE action
// (glisser, toucher, barrer d'une croix), sur les cases indiquées. Les grilles sont fixes et à solution unique.
// Le serveur ne connaît que le circuit final (circuitPuzzle), qui donne la récompense.
import type { Puzzle } from './puzzle.js'

export const TUTORIAL_REWARD = 50

export type Cell = [number, number]
export type Dir = 'left' | 'right' | 'up' | 'down'
export type Action =
  | { type: 'info'; focus?: { row?: number; col?: number } } // lire : le chiffre mis en avant, bouton « Compris »
  | { type: 'drag'; path: Cell[] } // glisser d'une case à l'autre, dans cet ordre
  | { type: 'tap'; cells: Cell[] } // toucher chacune de ces cases (rail)
  | { type: 'cross'; cells: Cell[] } // barrer chacune de ces cases (croix)
export interface Step {
  text: string
  textTouch?: string // même consigne sur écran tactile, quand le geste n'est pas le même
  action: Action
}
export interface Lesson {
  id: string
  title: string
  rows: number
  cols: number
  rowClues: number[]
  colClues: number[]
  entry: { row: number; col: number; dir: Dir }
  exit: { row: number; col: number; dir: Dir }
  solution: Cell[] // la voie, de l'entrée à la sortie
  steps: Step[]
  done: string
}

const DRAG = 'Trace le chemin du départ à la sortie, case après case.'

export const LESSONS: Lesson[] = [
  {
    id: 'trace',
    title: '1. Tracer une voie',
    rows: 1,
    cols: 4,
    rowClues: [4],
    colClues: [1, 1, 1, 1],
    entry: { row: 0, col: 0, dir: 'left' },
    exit: { row: 0, col: 3, dir: 'right' },
    solution: [[0, 0], [0, 1], [0, 2], [0, 3]],
    steps: [{ text: DRAG, action: { type: 'drag', path: [[0, 0], [0, 1], [0, 2], [0, 3]] } }],
    done: 'Bravo, tu as tracé ta première voie !',
  },
  {
    id: 'clues',
    title: '2. Lire les chiffres',
    rows: 3,
    cols: 3,
    rowClues: [1, 1, 3],
    colClues: [3, 1, 1],
    entry: { row: 0, col: 0, dir: 'left' },
    exit: { row: 2, col: 2, dir: 'right' },
    solution: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]],
    steps: [
      { text: 'Ce chiffre dit combien de cases la voie traverse dans sa ligne : ici 3, donc toute la ligne du bas.', action: { type: 'info', focus: { row: 2 } } },
      { text: 'Pareil pour une colonne : ce 3 dit que la voie descend toute la colonne de gauche.', action: { type: 'info', focus: { col: 0 } } },
      { text: DRAG, action: { type: 'drag', path: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]] } },
    ],
    done: 'Tu sais lire les chiffres !',
  },
  {
    id: 'mark',
    title: '3. Poser des repères',
    rows: 3,
    cols: 4,
    rowClues: [0, 4, 1],
    colClues: [2, 1, 1, 1],
    entry: { row: 2, col: 0, dir: 'left' },
    exit: { row: 1, col: 3, dir: 'right' },
    solution: [[2, 0], [1, 0], [1, 1], [1, 2], [1, 3]],
    steps: [
      { text: 'Cette ligne dit 4 : ses 4 cases ont toutes un rail. On peut déjà le noter.', action: { type: 'info', focus: { row: 1 } } },
      { text: 'Touche chaque case en surbrillance : un point bleu veut dire « il y a un rail ici ».', action: { type: 'tap', cells: [[1, 0], [1, 1], [1, 2]] } },
    ],
    done: 'Les repères te servent à noter ce dont tu es sûr.',
  },
  {
    id: 'cross',
    title: '4. Barrer avec des croix',
    rows: 4,
    cols: 3,
    rowClues: [2, 1, 1, 1],
    colClues: [0, 4, 1],
    entry: { row: 0, col: 2, dir: 'up' },
    exit: { row: 3, col: 1, dir: 'down' },
    solution: [[0, 2], [0, 1], [1, 1], [2, 1], [3, 1]],
    steps: [
      { text: "Ce 0 dit qu'aucune voie ne passe dans la colonne de gauche.", action: { type: 'info', focus: { col: 0 } } },
      { text: 'Barre chaque case en surbrillance d\'une croix : clic droit sur la case.', textTouch: 'Barre chaque case en surbrillance d\'une croix : garde le doigt appuyé sur la case jusqu\'à ce que la croix apparaisse.', action: { type: 'cross', cells: [[0, 0], [1, 0], [2, 0], [3, 0]] } },
    ],
    done: 'Les croix disent où la voie ne passe pas.',
  },
  {
    id: 'circuit',
    title: '5. Ton premier circuit',
    rows: 4,
    cols: 4,
    rowClues: [1, 1, 4, 0],
    colClues: [3, 1, 1, 1],
    entry: { row: 0, col: 0, dir: 'left' },
    exit: { row: 2, col: 3, dir: 'right' },
    solution: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [2, 3]],
    steps: [
      { text: 'Tout ensemble. La ligne du bas est à 0 : aucune voie.', action: { type: 'info', focus: { row: 3 } } },
      { text: 'Barre ses 4 cases d\'une croix : clic droit sur la case.', textTouch: 'Barre ses 4 cases d\'une croix : garde le doigt appuyé sur la case.', action: { type: 'cross', cells: [[3, 0], [3, 1], [3, 2], [3, 3]] } },
      { text: 'La ligne du dessus est à 4 : un rail dans chaque case.', action: { type: 'info', focus: { row: 2 } } },
      { text: 'Pose un repère sur les cases en surbrillance.', action: { type: 'tap', cells: [[2, 0], [2, 1], [2, 2]] } },
      { text: 'Il ne reste qu\'à tracer la voie, du départ à la sortie.', action: { type: 'drag', path: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [2, 3]] } },
    ],
    done: 'Circuit terminé !',
  },
]

// Le circuit final sous forme de puzzle ordinaire : le serveur le vérifie avec les règles du jeu.
const last = LESSONS[LESSONS.length - 1]
export const circuitPuzzle: Puzzle = { size: last.rows, rowClues: last.rowClues, colClues: last.colClues, entry: last.entry, exit: last.exit }

// Un exercice sous forme de puzzle, pour les tests (le solveur ne connaît que les grilles carrées : rempli en carré).
export function lessonPuzzle(l: Lesson): Puzzle {
  const size = Math.max(l.rows, l.cols)
  const pad = (a: number[]) => [...a, ...Array(size - a.length).fill(0)]
  return { size, rowClues: pad(l.rowClues), colClues: pad(l.colClues), entry: l.entry, exit: l.exit }
}
