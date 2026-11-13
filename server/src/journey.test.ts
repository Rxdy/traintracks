import { describe, it, expect } from 'vitest'
import { isConsistent } from '../../shared/puzzle.js'
import { solve } from '../../shared/solver.js'
import { begin, mergeAnonymous, seedLevels, start, status, submit } from './journey.js'
import { LEVELS, edgesOf, makeGame } from './helpers.test-util.js'
import { planFor } from '../../shared/curriculum.js'

const TOTAL = LEVELS.length

const A = 'a:11111111-1111-1111-1111-111111111111'

describe('les niveaux (données du serveur)', () => {
  it('tailles et rails imposés suivent le plan, tous les niveaux sont distincts, un seul message d\'introduction', () => {
    expect(TOTAL).toBeGreaterThanOrEqual(140)
    for (const l of LEVELS) {
      const plan = planFor(l.id)
      expect(l.puzzle.size, 'niveau ' + l.id).toBe(plan.size)
      expect((l.puzzle.givens?.length ?? 0) > 0, 'rails imposés niveau ' + l.id).toBe(plan.mechanics.includes('given'))
      expect((l.puzzle.rocks?.length ?? 0) > 0, 'rochers niveau ' + l.id).toBe(plan.mechanics.includes('rock'))
    }
    expect(new Set(LEVELS.map((l) => JSON.stringify(l.puzzle))).size).toBe(TOTAL)
    expect(LEVELS.filter((l) => l.intro).map((l) => l.id)).toEqual([70, 150]) // rails imposés, puis rochers
  })
  it.each(LEVELS.map((l) => [l.id, l] as const))('niveau %i : cohérent, une seule solution, et c\'est la stockée', (_id, l) => {
    expect(isConsistent(l.puzzle)).toBe(true)
    const r = solve(l.puzzle, 3)
    expect(r.count).toBe(1)
    expect(r.solutions[0]).toEqual(l.solution)
  })
})

describe('Voyage côté serveur', () => {
  it('le chargement des niveaux est répétable et ne touche pas aux niveaux existants', async () => {
    const { db } = await makeGame()
    expect(await seedLevels(db, LEVELS)).toEqual({ added: [], changed: [] })
    expect((await db.query('SELECT 1 FROM levels')).rows).toHaveLength(TOTAL)
  })
  it('un nouveau joueur est au niveau 1', async () => {
    const { db } = await makeGame()
    expect(await status(db, A)).toEqual({ level: 1, total: TOTAL, allDone: false })
  })
  it('n\'envoie que la grille : jamais la solution', async () => {
    const { db } = await makeGame()
    const r = await start(db, A, new Date())
    expect(r).toMatchObject({ level: { id: 1 } })
    expect(JSON.stringify(r)).not.toMatch(/solution/i)
  })
  it('accepte la bonne solution, passe au niveau suivant, mesure le temps côté serveur', async () => {
    const { db, clock } = await makeGame()
    await start(db, A, new Date(clock.t))
    const r = await submit(db, A, { level: 1, edges: edgesOf(1) }, new Date(clock.t + 12_345))
    expect(r).toMatchObject({ ok: true, timeMs: 12_345, next: { level: 2, total: TOTAL, allDone: false } })
    const stored = await db.query<{ time_ms: number }>('SELECT time_ms FROM progress WHERE owner = $1', [A])
    expect(stored.rows[0].time_ms).toBe(12_345)
  })
  it('reprendre un niveau ne remet pas le chrono à zéro', async () => {
    const { db, clock } = await makeGame()
    await start(db, A, new Date(clock.t))
    await start(db, A, new Date(clock.t + 60_000)) // le joueur quitte et revient
    const r = await submit(db, A, { level: 1, edges: edgesOf(1) }, new Date(clock.t + 90_000))
    expect(r).toMatchObject({ ok: true, timeMs: 90_000 })
  })
  it('refuse un mauvais tracé, sans rien enregistrer', async () => {
    const { db } = await makeGame()
    await start(db, A, new Date())
    expect(await submit(db, A, { level: 1, edges: [] }, new Date())).toEqual({ ok: false, code: 'wrong' })
    expect(await submit(db, A, { level: 1, edges: edgesOf(1).slice(1) }, new Date())).toEqual({ ok: false, code: 'wrong' })
    expect((await db.query('SELECT 1 FROM progress')).rows).toHaveLength(0)
  })
  it('on ne peut pas sauter de niveau, ni rejouer un niveau fini, ni valider sans avoir démarré', async () => {
    const { db } = await makeGame()
    expect(await submit(db, A, { level: 1, edges: edgesOf(1) }, new Date())).toEqual({ ok: false, code: 'not_started' })
    await start(db, A, new Date())
    expect(await submit(db, A, { level: 2, edges: edgesOf(2) }, new Date())).toEqual({ ok: false, code: 'not_current' })
    await submit(db, A, { level: 1, edges: edgesOf(1) }, new Date())
    expect(await submit(db, A, { level: 1, edges: edgesOf(1) }, new Date())).toEqual({ ok: false, code: 'not_current' })
    expect((await db.query('SELECT 1 FROM progress')).rows).toHaveLength(1)
  })
  it('rejette les données mal formées', async () => {
    const { db } = await makeGame()
    await start(db, A, new Date())
    for (const bad of [{ level: '1', edges: [] }, { level: 1, edges: 'x' }, { level: 1, edges: ['zz'] }, { level: 1, edges: Array(300).fill('h:0:0') }, { level: 1, edges: [42] }]) {
      expect(await submit(db, A, bad as never, new Date())).toEqual({ ok: false, code: 'invalid' })
    }
  })
  it('une solution ne vaut que pour son niveau : la solution du niveau 2 ne valide pas le niveau 1', async () => {
    const { db } = await makeGame()
    await start(db, A, new Date())
    expect(await submit(db, A, { level: 1, edges: edgesOf(2) }, new Date())).toEqual({ ok: false, code: 'wrong' })
  })
  it('après le dernier niveau : allDone, plus rien à démarrer', async () => {
    const { db } = await makeGame()
    for (let id = 1; id <= TOTAL; id++) {
      await start(db, A, new Date())
      expect(await submit(db, A, { level: id, edges: edgesOf(id) }, new Date())).toMatchObject({ ok: true })
    }
    expect(await status(db, A)).toEqual({ level: TOTAL, total: TOTAL, allDone: true })
    expect(await start(db, A, new Date())).toEqual({ done: true })
  })
  it('deux joueurs ont chacun leur progression', async () => {
    const { db } = await makeGame()
    const B = 'a:22222222-2222-2222-2222-222222222222'
    await start(db, A, new Date())
    await submit(db, A, { level: 1, edges: edgesOf(1) }, new Date())
    expect((await status(db, A)).level).toBe(2)
    expect((await status(db, B)).level).toBe(1)
  })
})

describe('rattachement de la progression anonyme (processus 07)', () => {
  it('passe les niveaux anonymes au compte sans écraser ceux du compte, puis efface l\'anonyme', async () => {
    const { db } = await makeGame()
    const anon = '33333333-3333-3333-3333-333333333333'
    const user = '44444444-4444-4444-4444-444444444444'
    await db.query("INSERT INTO users (id, pseudo, pseudo_key, email, provider, created_at) VALUES ($1,'U','u','u@x.fr','local',now())", [user])
    for (const id of [1, 2, 3]) {
      await start(db, `a:${anon}`, new Date())
      await submit(db, `a:${anon}`, { level: id, edges: edgesOf(id) }, new Date())
    }
    await start(db, `u:${user}`, new Date(1000))
    await submit(db, `u:${user}`, { level: 1, edges: edgesOf(1) }, new Date(6000)) // le compte a déjà le niveau 1 en 5 s
    await mergeAnonymous(db, anon, user)
    expect((await status(db, `u:${user}`)).level).toBe(4)
    const t = await db.query<{ time_ms: number }>("SELECT time_ms FROM progress WHERE owner = $1 AND level = 1", [`u:${user}`])
    expect(t.rows[0].time_ms).toBe(5000)
    expect((await db.query('SELECT 1 FROM progress WHERE owner = $1', [`a:${anon}`])).rows).toHaveLength(0)
  })
})

describe('ajouter des niveaux après la mise en ligne', () => {
  // Niveaux à ajouter : des copies de niveaux existants sous de nouveaux numéros.
  const more = (from: number, n: number): typeof LEVELS => Array.from({ length: n }, (_, i) => ({ ...LEVELS[60], id: from + i, intro: undefined }))
  const NEXT = TOTAL + 1

  it('un joueur qui avait TOUT terminé reprend au premier niveau ajouté', async () => {
    const { db } = await makeGame()
    for (let id = 1; id <= TOTAL; id++) {
      await start(db, A, new Date())
      await submit(db, A, { level: id, edges: edgesOf(id) }, new Date())
    }
    expect(await status(db, A)).toMatchObject({ level: TOTAL, total: TOTAL, allDone: true })
    const report = await seedLevels(db, [...LEVELS, ...more(NEXT, 20)])
    expect(report.added).toEqual(Array.from({ length: 20 }, (_, i) => NEXT + i))
    expect(await status(db, A)).toEqual({ level: NEXT, total: TOTAL + 20, allDone: false })
    const s = await start(db, A, new Date())
    expect(s).toMatchObject({ level: { id: NEXT } })
    expect(JSON.stringify(s)).not.toMatch(/solution/i)
    // le nouveau niveau se joue et se valide comme les autres (sa solution est celle de sa copie)
    expect(await submit(db, A, { level: NEXT, edges: edgesOf(61) }, new Date())).toMatchObject({ ok: true, next: { level: NEXT + 1, total: TOTAL + 20 } })
  })
  it('un joueur en cours de route ne voit aucun changement', async () => {
    const { db } = await makeGame()
    await start(db, A, new Date())
    await submit(db, A, { level: 1, edges: edgesOf(1) }, new Date())
    await seedLevels(db, [...LEVELS, ...more(NEXT, 50)])
    expect(await status(db, A)).toEqual({ level: 2, total: TOTAL + 50, allDone: false })
    expect((await db.query('SELECT 1 FROM progress WHERE owner = $1', [A])).rows).toHaveLength(1)
  })
  it('on peut ajouter plusieurs fois, et relancer le chargement ne change rien', async () => {
    const { db } = await makeGame()
    await seedLevels(db, [...LEVELS, ...more(NEXT, 5)])
    expect(await seedLevels(db, [...LEVELS, ...more(NEXT, 5)])).toEqual({ added: [], changed: [] })
    expect((await seedLevels(db, [...LEVELS, ...more(NEXT, 8)])).added).toEqual([NEXT + 5, NEXT + 6, NEXT + 7])
  })
  it('un niveau déjà en base n\'est JAMAIS modifié par le fichier, mais le signale', async () => {
    const { db } = await makeGame()
    const modified = LEVELS.map((l) => (l.id === 5 ? { ...l, puzzle: { ...l.puzzle, rowClues: [9, 9, 9, 9] } } : l))
    const report = await seedLevels(db, modified)
    expect(report).toEqual({ added: [], changed: [5] })
    const stored = (await db.query<{ puzzle: { rowClues: number[] } }>('SELECT puzzle FROM levels WHERE id = 5')).rows[0]
    expect(stored.puzzle.rowClues).not.toEqual([9, 9, 9, 9])
  })
  it('refuse des numéros qui ne se suivent pas (un joueur arriverait sur un niveau inexistant)', async () => {
    const { db } = await makeGame()
    await expect(seedLevels(db, [...LEVELS, ...more(NEXT + 4, 3)])).rejects.toThrow(new RegExp(`non contigus.*${NEXT}`))
    await expect(seedLevels(db, [{ ...LEVELS[0], id: 0 }])).rejects.toThrow(/invalide/)
  })
})

describe('temps d\'un niveau : du premier geste à la réponse juste', () => {
  it('le temps de lecture avant le premier geste ne compte pas', async () => {
    const { db, clock } = await makeGame()
    await start(db, A, new Date(clock.t)) // la grille s'affiche
    expect(await begin(db, A, new Date(clock.t + 4_000))).toBe(true) // 1er geste 4 s plus tard
    const r = await submit(db, A, { level: 1, edges: edgesOf(1) }, new Date(clock.t + 9_000))
    expect(r).toMatchObject({ ok: true, timeMs: 5_000 }) // 9 s - 4 s, pas 9 s
  })
  it('seul le PREMIER geste compte : les suivants ne remettent rien à zéro', async () => {
    const { db, clock } = await makeGame()
    await start(db, A, new Date(clock.t))
    expect(await begin(db, A, new Date(clock.t + 2_000))).toBe(true)
    expect(await begin(db, A, new Date(clock.t + 7_000))).toBe(false)
    expect(await submit(db, A, { level: 1, edges: edgesOf(1) }, new Date(clock.t + 10_000))).toMatchObject({ timeMs: 8_000 })
  })
  it('sans signal de premier geste (réseau coupé), on compte depuis l\'ouverture : jamais de temps négatif ni inventé', async () => {
    const { db, clock } = await makeGame()
    await start(db, A, new Date(clock.t))
    expect(await submit(db, A, { level: 1, edges: edgesOf(1) }, new Date(clock.t + 6_000))).toMatchObject({ timeMs: 6_000 })
  })
  it('reprendre le niveau garde le premier geste ; passer à un autre niveau repart de zéro', async () => {
    const { db, clock } = await makeGame()
    await start(db, A, new Date(clock.t))
    await begin(db, A, new Date(clock.t + 1_000))
    await start(db, A, new Date(clock.t + 50_000)) // le joueur revient
    expect(await begin(db, A, new Date(clock.t + 51_000))).toBe(false)
    await submit(db, A, { level: 1, edges: edgesOf(1) }, new Date(clock.t + 60_000))
    await start(db, A, new Date(clock.t + 70_000)) // niveau 2 : aucun geste encore
    expect(await begin(db, A, new Date(clock.t + 72_000))).toBe(true)
    expect(await submit(db, A, { level: 2, edges: edgesOf(2) }, new Date(clock.t + 75_000))).toMatchObject({ timeMs: 3_000 })
  })
  it('sans niveau démarré, le premier geste n\'enregistre rien', async () => {
    const { db } = await makeGame()
    expect(await begin(db, A, new Date())).toBe(false)
  })
})
