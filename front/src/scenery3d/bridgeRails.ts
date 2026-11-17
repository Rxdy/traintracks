import type { Scenery } from '../scenery/generate'

// Ponts HORS de la grille de jeu. Dans la grille, les rails sont ceux de la grille (DOM), dessinés par-dessus le décor.
// Hors de la grille, la voie est un prolongement peint sur le sol : l'eau et le tablier 3D, posés au-dessus, la cachent.
// Le monde 3D doit donc reposer rails et traverses sur le tablier de ces ponts-là (world.ts).
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
