import type { Scenery } from '../scenery/generate'

// Tous les ponts de la voie. En 3D, les rails des cases (DOM) s'effacent et la voie est peinte sur le sol, sous l'eau et le
// tablier : dans la grille comme hors de la grille, le monde 3D doit reposer rails et traverses sur CHAQUE tablier (world.ts).
export function bridgesWithRails(sc: Scenery): { r: number; c: number; axis: 'h' | 'v' }[] {
  return [...sc.bridges].map(([k, axis]) => {
    const [r, c] = k.split(',').map(Number)
    return { r, c, axis }
  })
}

// Ponts HORS de la grille de jeu (décor classique SVG : dans la grille, les rails de la grille passent par-dessus le décor ;
// hors de la grille, la voie est un prolongement peint sur le sol, que l'eau et le pont cachent).
export function offBoardBridges(sc: Scenery): { r: number; c: number; axis: 'h' | 'v' }[] {
  const board = sc.rows - sc.margin.y - sc.margin.b
  const inBoard = (r: number, c: number) => r >= sc.margin.y && r < sc.margin.y + board && c >= sc.margin.x && c < sc.margin.x + board
  return [...sc.bridges]
    .map(([k, axis]) => {
      const [r, c] = k.split(',').map(Number)
      return { r, c, axis }
    })
    .filter(({ r, c }) => !inBoard(r, c))
}
