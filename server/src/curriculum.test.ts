import { describe, it, expect } from 'vitest'
import { KNOWN_SIZE_UP_ON_INTRO, MECHANICS, SIZES, SECONDS_PER_LEVEL, buildableUpTo, firstBlockedLevel, playSeconds, planFor, planRange, sizeAt, describe as text } from '../../shared/curriculum.js'
import { LEVELS } from './helpers.test-util.js'
import { auditLevels, lockViolations } from './levelBuilder.js'
import { readFileSync, existsSync } from 'node:fs'

const N = 700
const plans = planRange(1, N)
const introOf = (id: string) => MECHANICS.find((m) => m.id === id)!.intro

describe('plan du Voyage : règles de conception', () => {
  it('les 69 premiers niveaux sont normaux : 4×4 jusqu\'au 60, puis 5×5', () => {
    expect(plans.slice(0, 69).every((p) => p.mechanics.length === 0)).toBe(true)
    expect(plans.slice(0, 60).every((p) => p.size === 4)).toBe(true)
    expect(plans.slice(60, 69).every((p) => p.size === 5)).toBe(true)
  })

  it('une règle n\'apparaît jamais avant son niveau d\'introduction', () => {
    for (const p of plans) for (const m of p.mechanics) expect(p.level, `${m} au niveau ${p.level}`).toBeGreaterThanOrEqual(introOf(m))
  })

  it('le niveau d\'introduction présente la règle SEULE, et il y en a un par règle', () => {
    for (const m of MECHANICS.filter((x) => x.intro <= N)) {
      const p = planFor(m.intro)
      expect(p.mechanics).toEqual([m.id])
      expect(p.intro).toBe(m.id)
    }
    expect(plans.filter((p) => p.intro).length).toBe(MECHANICS.filter((m) => m.intro <= N).length)
  })

  it('la taille ne baisse jamais, et ne monte pas sur un niveau d\'introduction (exceptions connues : aucune)', () => {
    for (let i = 1; i < plans.length; i++) expect(plans[i].size).toBeGreaterThanOrEqual(plans[i - 1].size)
    for (const p of plans.filter((x) => x.sizeUp && x.intro)) expect(KNOWN_SIZE_UP_ON_INTRO, `niveau ${p.level}`).toContain(p.level)
    expect(plans.filter((x) => x.sizeUp && x.intro).map((x) => x.level)).toEqual(KNOWN_SIZE_UP_ON_INTRO) // la liste des exceptions est exacte
    expect(plans.filter((p) => p.sizeUp).map((p) => p.level)).toEqual(SIZES.slice(1).map((s) => s.from).filter((f) => f <= N))
  })

  it('alternance : jamais 3 niveaux à règle d\'affilée, jamais 2 combinaisons de suite', () => {
    for (let i = 2; i < plans.length; i++) {
      if (plans[i].intro || plans[i - 1].intro || plans[i - 2].intro) continue
      const feat = [plans[i - 2], plans[i - 1], plans[i]].map((p) => p.mechanics.length > 0)
      expect(feat.every(Boolean), `niveaux ${i - 1} à ${i + 1}`).toBe(false)
    }
    for (let i = 1; i < plans.length; i++) {
      if (plans[i].intro) continue
      expect(plans[i - 1].mechanics.length >= 2 && plans[i].mechanics.length >= 2, `niveau ${i + 1}`).toBe(false)
    }
  })

  it('les combinaisons n\'existent qu\'avec au moins deux règles connues, et sans doublon', () => {
    for (const p of plans) {
      expect(new Set(p.mechanics).size).toBe(p.mechanics.length)
      if (p.mechanics.length >= 2) expect(MECHANICS.filter((m) => m.intro < p.level).length).toBeGreaterThanOrEqual(2)
    }
    expect(plans.some((p) => p.mechanics.length >= 2)).toBe(true) // elles apparaissent bien
  })

  it('la nouveauté est pratiquée dans les 3 niveaux qui suivent son introduction', () => {
    for (const m of MECHANICS.filter((x) => x.intro + 3 <= N)) {
      const after = planRange(m.intro + 1, m.intro + 3)
      expect(after.some((p) => p.mechanics.includes(m.id)), m.id).toBe(true)
    }
  })

  it('la règle est répétée sans l\'être à chaque niveau : entre 20 % et 70 % de niveaux à règle par bloc de 30', () => {
    for (const from of [180, 230, 280, 400, 480, 600]) {
      const block = planRange(from, from + 29)
      const share = block.filter((p) => p.mechanics.length > 0).length / 30
      expect(share, `niveaux ${from}-${from + 29}`).toBeGreaterThanOrEqual(0.2)
      expect(share, `niveaux ${from}-${from + 29}`).toBeLessThanOrEqual(0.7)
    }
  })

  it('les niveaux normaux ne disparaissent jamais : il y en a toujours au moins 3 sur 10', () => {
    for (let from = 151; from + 9 <= N; from += 10) {
      expect(planRange(from, from + 9).filter((p) => p.mechanics.length === 0).length, `niveaux ${from}-${from + 9}`).toBeGreaterThanOrEqual(3)
    }
  })

  it('déterministe : le même niveau a toujours le même plan, quel que soit l\'ordre de lecture', () => {
    const a = planFor(333)
    expect(planFor(333)).toEqual(a)
    expect(planRange(1, 400)[332]).toEqual(a)
  })

  it('tailles : 4, 5, 6, 7, 8 aux niveaux prévus', () => {
    expect([1, 60, 61, 210, 211, 460, 461, 760, 761, 900].map(sizeAt)).toEqual([4, 4, 5, 5, 6, 6, 7, 7, 8, 8])
  })

  it('refuse un niveau invalide', () => {
    expect(() => planFor(0)).toThrow()
    expect(() => planFor(2.5)).toThrow()
  })

  it('lecture humaine : [G!] pour l\'introduction, . pour un niveau normal', () => {
    expect(text(69, 71).startsWith('. [G!]')).toBe(true)
  })
})

describe('durée de jeu : les paliers sont assez larges', () => {
  it('les niveaux de début de partie durent moins de 30 s : chaque nouveauté arrive après au moins 20 min de jeu', () => {
    expect(SECONDS_PER_LEVEL[4]).toBeLessThanOrEqual(30)
    for (const m of MECHANICS) expect(playSeconds(1, m.intro - 1), m.id).toBeGreaterThanOrEqual(1200)
  })
  it('les nouveautés sont espacées : au moins 20 min de jeu entre deux règles, et entre deux tailles de grille', () => {
    const intros = MECHANICS.map((m) => m.intro)
    for (let i = 1; i < intros.length; i++) expect(playSeconds(intros[i - 1], intros[i] - 1), `règle ${i + 1}`).toBeGreaterThanOrEqual(1200)
    for (let i = 2; i < SIZES.length; i++) expect(playSeconds(SIZES[i - 1].from, SIZES[i].from - 1), `taille ${SIZES[i].size}`).toBeGreaterThanOrEqual(1200)
  })
  it('on ne peut fabriquer que ce qui est jouable : jusqu\'au niveau précédant la première règle pas encore implémentée', () => {
    expect(buildableUpTo()).toBe(firstBlockedLevel() - 1)
    expect(MECHANICS.filter((m) => m.intro <= buildableUpTo()).every((m) => m.implemented)).toBe(true)
  })
})

describe('niveaux fabriqués (server/data/levels.json) conformes au plan', () => {
  it('aucun écart : tailles, rails imposés aux bons niveaux, introduction, solution unique, pas de doublon', () => {
    expect(auditLevels(LEVELS).issues).toEqual([])
  })
  it('on ne fabrique pas au-delà de ce qui est jouable', () => {
    expect(LEVELS.length).toBeLessThanOrEqual(buildableUpTo())
    expect(LEVELS.length).toBe(buildableUpTo()) // tout ce qui est jouable est fabriqué
  })
  it('le niveau d\'introduction des rails imposés porte son message, pas les autres', () => {
    expect(LEVELS.filter((l) => l.intro).map((l) => l.id)).toEqual(MECHANICS.filter((m) => m.implemented && m.intro <= LEVELS.length).map((m) => m.intro))
  })
  it('NIVEAUX GELÉS : ceux déjà publiés (levels.lock.json) n\'ont jamais changé', () => {
    const path = new URL('../data/levels.lock.json', import.meta.url)
    if (!existsSync(path)) return // rien de publié : tout peut encore changer (make freeze avant de publier)
    expect(lockViolations(LEVELS, JSON.parse(readFileSync(path, 'utf8')))).toEqual([])
  })
})
