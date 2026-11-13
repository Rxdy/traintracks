// Pièces et aides vues du navigateur. Le serveur est propriétaire du solde et du stock : ici on ne fait
// qu'afficher ce qu'il répond et lui demander d'acheter ou d'utiliser une aide.
import { ref } from 'vue'
import { api } from './api'
import type { Given } from './puzzle'

export type AidId = 'colors' | 'cell' | 'cannon' | 'line'

export interface AidInfo {
  id: AidId
  price: number
  unlockLevel: number
  unlocked: boolean
  stock: number
  cap: number
  demoPending: boolean // cadeau de déblocage : un usage gratuit à essayer
  usedThisLevel: boolean
}

export const coins = ref<number | null>(null)
export const aids = ref<AidInfo[]>([])

export async function refreshWallet(): Promise<void> {
  const r = await api('GET', '/api/aids')
  if (r?.status !== 200) return
  coins.value = r.data.coins as number
  aids.value = r.data.aids as AidInfo[]
}

export function setCoins(n: number): void {
  coins.value = n
}

export type BuyOutcome = { ok: true } | { ok: false; error: string }

export async function buyAid(id: AidId): Promise<BuyOutcome> {
  const r = await api('POST', '/api/aids/buy', { aid: id })
  if (!r) return { ok: false, error: 'Serveur injoignable.' }
  if (r.status === 200) {
    await refreshWallet()
    return { ok: true }
  }
  const msg: Record<string, string> = { poor: 'Pas assez de pièces.', full: 'Stock plein (3 maximum).', locked: 'Pas encore débloquée.' }
  return { ok: false, error: msg[String(r.data.error)] ?? 'Achat impossible.' }
}

export type AidTarget = { row: number; col: number } | { axis: 'row' | 'col'; index: number } | undefined

export interface AidResult {
  givens?: Given[]
  crosses?: { row: number; col: number }[]
  active?: boolean // indicateurs de couleur activés
}

export type UseOutcome = { ok: true; demo: boolean; result: AidResult } | { ok: false; error: string }

export async function useAid(id: AidId, target: AidTarget, edges: string[], crosses: string[]): Promise<UseOutcome> {
  const r = await api('POST', '/api/journey/aid', { aid: id, target, edges, crosses })
  if (!r) return { ok: false, error: 'Serveur injoignable.' }
  if (r.status === 200) {
    await refreshWallet()
    return { ok: true, demo: r.data.demo as boolean, result: r.data.result as AidResult }
  }
  const msg: Record<string, string> = {
    no_stock: 'Plus d\'exemplaire : rachète-la avec tes pièces.',
    already_used: 'Déjà utilisée sur ce niveau.',
    nothing: id === 'cannon' ? 'Tout est déjà bien posé : rien à tirer.' : 'Rien à révéler ici.',
    locked: 'Pas encore débloquée.',
    not_started: 'Niveau pas démarré.',
  }
  return { ok: false, error: msg[String(r.data.error)] ?? 'Aide impossible.' }
}
