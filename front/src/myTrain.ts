// Le train du joueur vu du navigateur : sa collection de wagons, l'ordre de son train et la machine « Wagon surprise ».
// Le serveur fait foi (prix, hasard, possession) : ici on affiche ce qu'il répond et on lui demande.
// Ce train ne sert qu'au Trajet (et à l'accueil, à l'écran de chargement) : les autres modes de jeu ont leurs propres wagons.
import { computed, ref } from 'vue'
import { api } from './api'
import { setCoins } from './wallet'
import { COLLECTION_TOTAL, DRAW_PRICE, leftToWin, STARTER_TRAIN } from '../../shared/wagons.js'
import { styleOf, type WagonStyle } from './trainStyle'

export interface TrainState {
  owned: Record<string, number>
  train: string[] // le train qui roule (presets[active])
  presets: string[][] // les 3 trains enregistrés
  active: number
  left: number
  price: number
}

const starter = (): TrainState => {
  const owned = Object.fromEntries(STARTER_TRAIN.map((id) => [id, 1]))
  return { owned, train: [...STARTER_TRAIN], presets: [0, 1, 2].map(() => [...STARTER_TRAIN]), active: 0, left: leftToWin(owned), price: DRAW_PRICE }
}

export const myTrain = ref<TrainState>(starter())
/** Les wagons du train, dans l'ordre, prêts à dessiner. */
export const trainWagons = computed<WagonStyle[]>(() => myTrain.value.train.map(styleOf))
export const collectionTotal = COLLECTION_TOTAL

function take(data: Record<string, unknown>): void {
  const owned = (data.owned as Record<string, number>) ?? {}
  const train = Array.isArray(data.train) ? (data.train as string[]) : []
  const presets = Array.isArray(data.presets) && data.presets.length === 3 ? (data.presets as string[][]) : [train, train, train]
  myTrain.value = {
    owned,
    train,
    presets,
    active: typeof data.active === 'number' ? data.active : 0,
    left: typeof data.left === 'number' ? data.left : leftToWin(owned),
    price: typeof data.price === 'number' ? data.price : DRAW_PRICE,
  }
  if (typeof data.coins === 'number') setCoins(data.coins)
}

export async function loadTrain(): Promise<void> {
  const r = await api('GET', '/api/train')
  if (r?.status === 200) take(r.data)
}

export type DrawOutcome = { ok: true; wagon: string; added: boolean } | { ok: false; error: string; code?: 'poor' | 'complete' }

/** Un tirage de la machine : on gagne toujours un wagon (le serveur choisit). */
export async function drawWagon(): Promise<DrawOutcome> {
  const r = await api('POST', '/api/train/draw', {})
  if (!r) return { ok: false, error: 'Serveur injoignable : vérifie ta connexion.' }
  if (r.status === 200) {
    take(r.data.state as Record<string, unknown>)
    return { ok: true, wagon: String(r.data.wagon), added: !!r.data.added }
  }
  if (r.data.error === 'complete') return { ok: false, code: 'complete', error: 'Tu as déjà tous les wagons !' }
  if (r.data.error === 'poor') return { ok: false, code: 'poor', error: `Il faut ${myTrain.value.price} pièces pour un tirage.` }
  return { ok: false, error: 'Le tirage n\'a pas marché. Réessaie.' }
}

/** Range un des 3 trains (par défaut celui qui roule) dans cet ordre. En cas d'échec, l'ordre d'avant revient. */
export async function setTrain(cars: string[], slot: number = myTrain.value.active): Promise<boolean> {
  const before = myTrain.value
  const presets = before.presets.map((p, k) => (k === slot ? [...cars] : p))
  myTrain.value = { ...before, presets, train: slot === before.active ? [...cars] : before.train } // tout de suite à l'écran
  const r = await api('POST', '/api/train/layout', { cars, slot })
  if (r?.status === 200) {
    take(r.data.state as Record<string, unknown>)
    return true
  }
  myTrain.value = before
  return false
}

/** Fait rouler un des 3 trains enregistrés. */
export async function selectPreset(slot: number): Promise<boolean> {
  const before = myTrain.value
  myTrain.value = { ...before, active: slot, train: [...(before.presets[slot] ?? [])] }
  const r = await api('POST', '/api/train/active', { slot })
  if (r?.status === 200) {
    take(r.data.state as Record<string, unknown>)
    return true
  }
  myTrain.value = before
  return false
}

/** Combien d'exemplaires d'un wagon sont libres pour ce train (possédés mais pas déjà dedans). */
export function freeCount(id: string, cars: readonly string[] = myTrain.value.train, st: TrainState = myTrain.value): number {
  return (st.owned[id] ?? 0) - cars.filter((x) => x === id).length
}
