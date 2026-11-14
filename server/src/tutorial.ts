// Récompense du tutoriel : versée une seule fois par joueur, quand le circuit final est vraiment résolu
// (le tracé est vérifié ici, avec les règles du jeu : pas sur la parole du navigateur).
import type { Db } from './db.js'
import { isSolved } from '../../shared/track.js'
import { circuitPuzzle, TUTORIAL_REWARD } from '../../shared/tutorial.js'
import { balance, credit } from './wallet.js'

const EDGE_RE = /^[hv]:\d{1,2}:\d{1,2}$/

export type TutorialResult = { ok: true; earned: number; coins: number } | { ok: false; code: 'invalid' | 'wrong' }

export async function completeTutorial(db: Db, owner: string, edges: unknown, now: Date): Promise<TutorialResult> {
  if (!Array.isArray(edges) || edges.length > 100 || !edges.every((e) => typeof e === 'string' && EDGE_RE.test(e))) return { ok: false, code: 'invalid' }
  if (!isSolved(new Set<string>(edges as string[]), circuitPuzzle)) return { ok: false, code: 'wrong' }
  const paid = await credit(db, owner, TUTORIAL_REWARD, 'tutorial', '1', now)
  return { ok: true, earned: paid ? TUTORIAL_REWARD : 0, coins: await balance(db, owner) }
}
