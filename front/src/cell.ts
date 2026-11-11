// Marque d'une case, du point de vue du joueur. Le minimum d'états :
//   - empty : rien (case blanche)
//   - rail  : le joueur pense qu'il y a un rail
//   - cross : le joueur pense qu'il n'y a PAS de rail (marque ✕)
//
// La FORME du rail (droit / virage) n'est pas stockée : elle est recalculée
// à partir des voisins (voir board.ts).

// Les 4 côtés d'une case.
export type Side = 'top' | 'bottom' | 'left' | 'right'

// Les 6 formes de rail possibles : 2 droites + 4 virages.
export type TrackPiece =
  | 'horizontal'
  | 'vertical'
  | 'curve-tl' // relie haut + gauche
  | 'curve-tr' // relie haut + droite
  | 'curve-bl' // relie bas + gauche
  | 'curve-br' // relie bas + droite

export const TRACK_PIECES: TrackPiece[] = [
  'horizontal',
  'vertical',
  'curve-tr',
  'curve-br',
  'curve-bl',
  'curve-tl',
]

// Les deux côtés reliés par chaque forme de rail.
export const PIECE_CONNECTIONS: Record<TrackPiece, [Side, Side]> = {
  horizontal: ['left', 'right'],
  vertical: ['top', 'bottom'],
  'curve-tl': ['top', 'left'],
  'curve-tr': ['top', 'right'],
  'curve-bl': ['bottom', 'left'],
  'curve-br': ['bottom', 'right'],
}

export type CellMark = 'empty' | 'rail' | 'cross'

// Côté opposé.
export function oppositeSide(side: Side): Side {
  switch (side) {
    case 'top':
      return 'bottom'
    case 'bottom':
      return 'top'
    case 'left':
      return 'right'
    case 'right':
      return 'left'
  }
}

// Forme de rail reliant deux côtés distincts.
export function pieceForSides(a: Side, b: Side): TrackPiece {
  const key = [a, b].sort().join('-')
  const map: Record<string, TrackPiece> = {
    'left-right': 'horizontal',
    'bottom-top': 'vertical',
    'left-top': 'curve-tl',
    'right-top': 'curve-tr',
    'bottom-left': 'curve-bl',
    'bottom-right': 'curve-br',
  }
  const piece = map[key]
  if (!piece) throw new Error(`Côtés de rail invalides : ${a}, ${b}`)
  return piece
}
