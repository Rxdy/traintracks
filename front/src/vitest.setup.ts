import { loadingTiming } from './preload'
import { timing } from './scenery/index'

// Les tests n'attendent pas la révélation du décor : le train part tout de suite (sauf test dédié).
timing.revealMs = 0

// Pas d'attente minimale sur l'écran de chargement.
loadingTiming.minMs = 0
