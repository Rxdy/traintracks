import { describe, it, expect } from 'vitest'
import { bestStreak, longestRun, beginDaily, dailyStats, dailyStatus, dateKey, previousDay, sizeFor, startDaily, submitDaily, streakUntil } from './daily.js'
import { generate } from '../../shared/generator.js'
import { edgeKey } from '../../shared/track.js'
import { balance } from './wallet.js'
import { makeGame } from './helpers.test-util.js'
import type { Db } from './db.js'

const U = 'u:77777777-7777-7777-7777-777777777777'
const D1 = '2026-11-12' // jeudi
const t0 = Date.UTC(2026, 10, 12, 10, 0, 0)

function solutionEdges(date: string): string[] {
  const sol = generate(`daily:${date}`, sizeFor(date)).solution
  const out: string[] = []
  for (let i = 1; i < sol.length; i++) out.push(edgeKey(sol[i - 1][0], sol[i - 1][1], sol[i][0], sol[i][1])!)
  return out
}
async function play(db: Db, owner: string, date: string, startAt: number, endAt: number) {
  await startDaily(db, owner, date, new Date(startAt))
  return submitDaily(db, owner, date, solutionEdges(date), new Date(endAt))
}

describe('la date du jour', () => {
  it('suit le fuseau horaire du jeu, pas l\'UTC', () => {
    const t = new Date(Date.UTC(2026, 10, 12, 23, 30, 0)) // 23h30 UTC = 00h30 le 13 à Paris
    expect(dateKey(t, 'Europe/Paris')).toBe('2026-11-13')
    expect(dateKey(t, 'UTC')).toBe('2026-11-12')
  })
  it('jour précédent, y compris en changeant de mois et d\'année', () => {
    expect(previousDay('2026-03-01')).toBe('2026-02-28')
    expect(previousDay('2026-01-01')).toBe('2025-12-31')
  })
  it('toujours 6×6, tous les jours de la semaine', () => {
    expect(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15'].map(sizeFor)).toEqual([6, 6, 6, 6, 6, 6, 6])
  })
})

describe('puzzle du jour (serveur)', () => {
  it('la même grille pour tous, conservée en base, sans la solution', async () => {
    const { db } = await makeGame()
    const a = await startDaily(db, U, D1, new Date(t0))
    const b = await startDaily(db, 'u:88888888-8888-8888-8888-888888888888', D1, new Date(t0 + 5000))
    expect(a.puzzle).toEqual(b.puzzle)
    expect(a.puzzle).toEqual(generate(`daily:${D1}`, 6).puzzle) // reproductible depuis la date
    expect(JSON.stringify(a)).not.toMatch(/solution/i)
    expect((await db.query('SELECT 1 FROM daily_puzzles')).rows).toHaveLength(1)
  })
  it('un autre jour, une autre grille', async () => {
    const { db } = await makeGame()
    const a = await startDaily(db, U, '2026-11-12', new Date(t0))
    const b = await startDaily(db, U, '2026-11-13', new Date(t0))
    expect(JSON.stringify(a.puzzle)).not.toBe(JSON.stringify(b.puzzle))
  })
  it('bonne solution : temps mesuré par le serveur, 20 pièces, premier temps enregistré', async () => {
    const { db } = await makeGame()
    const r = await play(db, U, D1, t0, t0 + 83_000)
    expect(r).toEqual({ ok: true, counted: true, timeMs: 83_000, earned: { base: 20, streakBonus: 0 }, streak: 1, coins: 20 })
    expect(await dailyStatus(db, U, D1)).toEqual({ date: D1, done: true, timeMs: 83_000, streak: 1, size: sizeFor(D1) })
  })
  it('rejouer le même jour : accepté mais non compté, rien de plus versé', async () => {
    const { db } = await makeGame()
    await play(db, U, D1, t0, t0 + 83_000)
    const replay = await startDaily(db, U, D1, new Date(t0 + 200_000))
    expect(replay.replay).toBe(true)
    const r = await submitDaily(db, U, D1, solutionEdges(D1), new Date(t0 + 230_000))
    expect(r).toMatchObject({ ok: true, counted: false, timeMs: 30_000, earned: { base: 0, streakBonus: 0 } })
    expect((await dailyStatus(db, U, D1)).timeMs).toBe(83_000) // le 1er temps reste
    expect(await balance(db, U)).toBe(20)
  })
  it('mauvais tracé refusé ; sans démarrage refusé ; données mal formées refusées', async () => {
    const { db } = await makeGame()
    expect(await submitDaily(db, U, D1, solutionEdges(D1), new Date(t0))).toEqual({ ok: false, code: 'not_started' })
    await startDaily(db, U, D1, new Date(t0))
    expect(await submitDaily(db, U, D1, [], new Date(t0))).toEqual({ ok: false, code: 'wrong' })
    expect(await submitDaily(db, U, D1, solutionEdges(D1).slice(1), new Date(t0))).toEqual({ ok: false, code: 'wrong' })
    expect(await submitDaily(db, U, D1, 'x', new Date(t0))).toEqual({ ok: false, code: 'invalid' })
    expect(await submitDaily(db, U, D1, ['zz'], new Date(t0))).toEqual({ ok: false, code: 'invalid' })
    expect(await balance(db, U)).toBe(0)
  })
  it('reprendre une partie commencée garde l\'heure de départ', async () => {
    const { db } = await makeGame()
    await startDaily(db, U, D1, new Date(t0))
    await startDaily(db, U, D1, new Date(t0 + 60_000))
    expect(await submitDaily(db, U, D1, solutionEdges(D1), new Date(t0 + 90_000))).toMatchObject({ timeMs: 90_000 })
  })
  it('une partie du jour d\'hier ne peut pas être validée aujourd\'hui', async () => {
    const { db } = await makeGame()
    await startDaily(db, U, '2026-11-11', new Date(t0))
    expect(await submitDaily(db, U, D1, solutionEdges(D1), new Date(t0))).toEqual({ ok: false, code: 'not_started' })
  })
})

describe('meilleure série', () => {
  it('la plus longue suite de jours consécutifs, doublons et désordre compris', () => {
    expect(longestRun([])).toBe(0)
    expect(longestRun(['2026-11-05', '2026-11-03', '2026-11-04', '2026-11-04', '2026-11-09', '2026-11-10'])).toBe(3)
    expect(longestRun(['2026-02-27', '2026-03-01'])).toBe(1) // le 28 manque
    expect(longestRun(['2026-02-27', '2026-02-28', '2026-03-01'])).toBe(3) // 2026 n'est pas bissextile : le 28 février précède le 1er mars
  })
  it('perdre la série garde le record ; il n\'est remplacé que par une série plus longue', async () => {
    const { db } = await makeGame()
    for (const d of ['2026-11-01', '2026-11-02', '2026-11-03']) await play(db, U, d, t0, t0 + 1)
    expect(await bestStreak(db, U)).toBe(3)
    await play(db, U, '2026-11-10', t0, t0 + 1) // jours manqués : la série en cours repart à 1
    expect(await dailyStats(db, U, '2026-11-10')).toMatchObject({ streak: 1, bestStreak: 3 })
    for (const d of ['2026-11-11', '2026-11-12']) await play(db, U, d, t0, t0 + 1)
    expect(await bestStreak(db, U)).toBe(3) // 3 = 3 : pas de remplacement
    await play(db, U, '2026-11-13', t0, t0 + 1)
    expect(await bestStreak(db, U)).toBe(4)
  })
})

describe('série de jours et statistiques', () => {
  it('jours consécutifs : bonus de +2 par jour de série (max +10)', async () => {
    const { db } = await makeGame()
    const days = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13']
    const earned: number[] = []
    for (const d of days) {
      const r = await play(db, U, d, Date.UTC(2026, 10, 12), Date.UTC(2026, 10, 12) + 1000)
      if (r.ok) earned.push(r.earned.base + r.earned.streakBonus)
    }
    expect(earned).toEqual([20, 22, 24, 26, 28])
    expect(await streakUntil(db, U, '2026-11-13')).toBe(5)
  })
  it('un jour manqué remet la série à 1 ; le bonus plafonne à +10', async () => {
    const { db } = await makeGame()
    await play(db, U, '2026-11-09', t0, t0 + 1)
    const r = await play(db, U, '2026-11-11', t0, t0 + 1) // le 10 manqué
    expect(r).toMatchObject({ ok: true, streak: 1, earned: { base: 20, streakBonus: 0 } })
    let last = 0
    for (let d = 1; d <= 9; d++) {
      const date = `2026-12-${String(d).padStart(2, '0')}`
      const x = await play(db, U, date, t0, t0 + 1)
      if (x.ok) last = x.earned.streakBonus
    }
    expect(last).toBe(10)
  })
  it('statistiques : nombre, moyenne, plus rapide, plus lent, série', async () => {
    const { db } = await makeGame()
    await play(db, U, '2026-11-11', t0, t0 + 60_000)
    await play(db, U, '2026-11-12', t0, t0 + 120_000)
    expect(await dailyStats(db, U, '2026-11-12')).toEqual({ count: 2, avgMs: 90_000, bestMs: 60_000, worstMs: 120_000, streak: 2, bestStreak: 2 })
  })
  it('aucune partie : tout à vide ; la série d\'hier reste visible tant qu\'aujourd\'hui n\'est pas joué', async () => {
    const { db } = await makeGame()
    expect(await dailyStats(db, U, D1)).toEqual({ count: 0, avgMs: null, bestMs: null, worstMs: null, streak: 0, bestStreak: 0 })
    await play(db, U, '2026-11-11', t0, t0 + 1)
    expect((await dailyStats(db, U, D1)).streak).toBe(1)
    expect((await dailyStats(db, U, '2026-11-14')).streak).toBe(0)
  })
  it('chaque joueur a ses propres résultats', async () => {
    const { db } = await makeGame()
    const V = 'u:99999999-9999-9999-9999-999999999999'
    await play(db, U, D1, t0, t0 + 1000)
    expect((await dailyStatus(db, V, D1)).done).toBe(false)
  })
})

describe('puzzle du jour : temps du premier geste à la réponse juste', () => {
  it('le temps de lecture ne compte pas, et seul le premier geste est retenu', async () => {
    const { db } = await makeGame()
    await startDaily(db, U, D1, new Date(t0))
    expect(await beginDaily(db, U, D1, new Date(t0 + 5_000))).toBe(true)
    expect(await beginDaily(db, U, D1, new Date(t0 + 9_000))).toBe(false)
    const r = await submitDaily(db, U, D1, solutionEdges(D1), new Date(t0 + 35_000))
    expect(r).toMatchObject({ ok: true, timeMs: 30_000 })
  })
  it('sans signal : compté depuis l\'ouverture', async () => {
    const { db } = await makeGame()
    expect(await play(db, U, D1, t0, t0 + 12_000)).toMatchObject({ timeMs: 12_000 })
  })
})
