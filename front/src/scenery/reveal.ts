// Apparition du décor : le paysage est déjà calculé (pendant l'écran de chargement) ; le sol est là tout de suite, et chaque élément
// (arbre, maison, montagne, animal, voiture, tunnel…) surgit à un moment tiré au hasard, sans ordre précis. Puis le train s'élance.
// Le tirage dépend de la graine du décor et de la case : le même décor apparaît toujours de la même façon (3D, dessin à plat, vie).
export const REVEAL = { start: 300, spread: 1500 } // ms : premier élément, puis tous les autres dans cette fenêtre

/** Délai d'apparition (ms) de la case (r, c). */
export function revealDelay(seed: number, r: number, c: number): number {
  let a = (seed ^ Math.imul(r + 1, 0x9e3779b1) ^ Math.imul(c + 1, 0x85ebca77)) | 0
  a = Math.imul(a ^ (a >>> 16), 0x7feb352d)
  a = Math.imul(a ^ (a >>> 15), 0x846ca68b)
  const u = ((a ^ (a >>> 16)) >>> 0) / 4294967296
  return REVEAL.start + u * REVEAL.spread
}
