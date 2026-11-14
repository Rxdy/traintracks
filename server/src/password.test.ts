import { describe, it, expect } from 'vitest'
import { MIN_BITS, checkPassword, hashPassword, strengthBits } from './password.js'

describe('robustesse en bits', () => {
  it('refuse les mots de passe courants, même « décorés »', () => {
    for (const p of ['123456', 'azerty', 'motdepasse', 'Password123!', 'P@ssw0rd2024', 'qwertyuiop123', 'aaaaaaaaaaaaaaaaaaaa']) {
      expect(strengthBits(p), p).toBeLessThan(MIN_BITS)
    }
  })
  it('accepte « Ruleju42170! » (mot inventé, chiffres, symbole) mais pas sa version sans symbole ni un mot trop court', () => {
    expect(strengthBits('Ruleju42170!')).toBeGreaterThanOrEqual(MIN_BITS)
    expect(strengthBits('Ruleju')).toBeLessThan(MIN_BITS)
    expect(strengthBits('Rudy2024!', ['Rudy'])).toBeLessThan(MIN_BITS)
  })
  it('accepte une phrase de plusieurs mots ou un long mot de passe aléatoire', () => {
    expect(strengthBits('correct horse battery staple')).toBeGreaterThanOrEqual(MIN_BITS)
    expect(strengthBits('bleu-fenetre-cactus-moteur-zebre')).toBeGreaterThanOrEqual(MIN_BITS)
    expect(strengthBits('xK4mQ9pL2vR7wT5nB8cY')).toBeGreaterThanOrEqual(MIN_BITS)
  })
  it('baisse la note quand le mot de passe contient le pseudo ou l\'e-mail', () => {
    const seul = strengthBits('rudyalvs1984')
    expect(strengthBits('rudyalvs1984', ['rudyalvs'])).toBeLessThan(seul)
  })
  it('une chaîne vide vaut 0', () => expect(strengthBits('')).toBe(0))
})

describe('hachage', () => {
  it('vérifie le bon mot de passe et refuse les autres', async () => {
    const h = await hashPassword('phrase de passe très longue')
    expect(h.startsWith('$argon2id$')).toBe(true)
    expect(await checkPassword(h, 'phrase de passe très longue')).toBe(true)
    expect(await checkPassword(h, 'autre chose')).toBe(false)
    expect(await checkPassword('pas-un-hash', 'x')).toBe(false)
  })
})
