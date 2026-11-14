// Robustesse et hachage des mots de passe.
//
// La robustesse est une ESTIMATION du nombre d'essais qu'un attaquant intelligent (dictionnaires, suites de
// touches, dates, variantes « P@ssw0rd »...) devrait faire, pas un simple compte de caractères.
// bits = log2(nombre d'essais estimé). Le seuil est le même pour le navigateur (indicateur) et le serveur
// (qui recalcule : il ne fait jamais confiance au navigateur).
import zxcvbn from 'zxcvbn'
import { hash, verify } from '@node-rs/argon2'

export const MIN_BITS = 36
const MAX_ANALYSED = 100 // zxcvbn devient lent sur de très longues chaînes

// Estimation PRUDENTE : zxcvbn compte 10 possibilités par caractère qu'il ne reconnaît pas, quelle que soit sa
// nature. Un mot de passe vraiment aléatoire est donc sous-noté (12 caractères au hasard valent 71 bits, il en
// compte 40). C'est voulu : on ne peut pas distinguer un mot français inconnu de lui d'un tirage aléatoire, et
// sur-noter un mot faible est pire que sous-noter un bon mot de passe. Le seuil (36 bits) laisse passer un mot
// inventé suivi de chiffres et d'un symbole (« Ruleju42170! » : 38 bits) mais pas les mots de passe courants, même
// décorés (« Password123! » : 19 bits). Quatre mots ou une phrase font plus de 65 bits.
export function strengthBits(password: string, userInputs: string[] = []): number {
  if (!password) return 0
  const r = zxcvbn(password.slice(0, MAX_ANALYSED), userInputs.filter(Boolean))
  return Math.round(r.guesses_log10 * Math.log2(10) * 10) / 10
}

// argon2id, paramètres OWASP (19 Mio, 2 passes) : lent exprès, résiste aux GPU.
const OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1 }
export const hashPassword = (password: string): Promise<string> => hash(password, OPTS)
export const checkPassword = (hashed: string, password: string): Promise<boolean> =>
  verify(hashed, password).catch(() => false)

// Empreinte jetable : vérifier un mot de passe contre elle prend le même temps qu'un vrai compte, pour que le
// temps de réponse ne révèle pas si l'e-mail existe.
let dummy: Promise<string> | undefined
export const dummyHash = (): Promise<string> => (dummy ??= hashPassword('mot-de-passe-factice-' + Math.random()))
