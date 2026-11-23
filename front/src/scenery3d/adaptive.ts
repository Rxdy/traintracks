// Résolution adaptative du décor 3D : si l'appareil n'arrive pas à tenir ses images, on dessine un cran moins fin ; s'il s'ennuie, on remonte.
//
// On ne peut pas savoir à l'avance ce que vaut le processeur graphique d'un téléphone : on le mesure. Le décor est dessiné par fenêtres de
// `WINDOW` images ; si plus de 60 % d'entre elles ont duré plus de 24 ms (moins de ~40 images par seconde), on baisse d'un cran. On ne remonte
// qu'après plusieurs fenêtres entièrement fluides, et une seule fois : si la remontée ralentit de nouveau, on garde le cran bas (pas de va-et-vient).
export const STEPS = [1, 0.8, 0.65, 0.5] as const // multiplicateur de la résolution de dessin
const SLOW_MS = 24
const WINDOW = 40
const WARM_UP = 90 // les premières images (compilation des shaders, arrivée du décor) ne comptent pas
const CALM_WINDOWS = 5

export function makeGovernor() {
  let step = 0
  let warm = WARM_UP
  let n = 0
  let slow = 0
  let calm = 0
  let raised = false
  let locked = false
  return {
    get scale(): number {
      return STEPS[step]!
    },
    get step(): number {
      return step
    },
    /** `dt` : durée de la dernière image en ms. Renvoie vrai quand le cran change (il faut alors redimensionner). */
    frame(dt: number): boolean {
      if (!(dt > 0) || dt > 1000) return false // onglet caché, reprise : ce n'est pas une mesure
      if (warm > 0) {
        warm--
        return false
      }
      n++
      if (dt > SLOW_MS) slow++
      if (n < WINDOW) return false
      const bad = slow / n
      n = 0
      slow = 0
      if (bad > 0.6 && step < STEPS.length - 1) {
        step++
        if (raised) locked = true
        calm = 0
        return true
      }
      if (bad === 0 && step > 0 && !locked) {
        if (++calm >= CALM_WINDOWS) {
          step--
          raised = true
          calm = 0
          return true
        }
      } else calm = 0
      return false
    },
  }
}
