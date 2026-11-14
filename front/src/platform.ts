// Écran tactile (téléphone, tablette) ou souris : les gestes à expliquer ne sont pas les mêmes (croix : clic droit / appui long).
export function isTouch(): boolean {
  if (typeof window === 'undefined') return false
  if (typeof window.matchMedia === 'function') return window.matchMedia('(pointer: coarse)').matches
  return (navigator.maxTouchPoints ?? 0) > 0
}
