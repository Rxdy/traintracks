// Tutoriel : les exercices sont décrits dans shared/tutorial.ts ; ici, l'appel qui verse la récompense
// (le serveur revérifie le circuit final).
import { api } from './api'

export { LESSONS, TUTORIAL_REWARD } from '../../shared/tutorial.js'

export type TutorialReward = { ok: true; earned: number; coins: number } | { ok: false }
export async function claimReward(edges: string[]): Promise<TutorialReward> {
  const r = await api('POST', '/api/tutorial/complete', { edges })
  if (r?.status === 200 && r.data.ok) return { ok: true, earned: r.data.earned as number, coins: r.data.coins as number }
  return { ok: false }
}
