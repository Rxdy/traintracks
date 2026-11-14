// POUR LES TESTS SEULEMENT : faux serveur du Voyage, qui applique les vraies règles (shared/) comme le vrai.
import { vi } from 'vitest'
import { levels } from './testLevels'
import { isSolved, lockedEdges } from './track'

export function fakeServer(solvedAtStart = 0) {
  let done = solvedAtStart
  let coins = 0
  let dailyTime: number | null = null // premier temps du jour, une fois réalisé
  let dailyCount = 0
  const total = levels.length
  const status = () => ({ level: Math.max(1, Math.min(done + 1, total)), total, allDone: done >= total })
  const json = (status: number, body: object) => new Response(JSON.stringify(body), { status })
  const calls: string[] = []
  const f = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    calls.push(`${method} ${url}`)
    if (url === '/api/journey') return json(200, status())
    if (url === '/api/journey/start') {
      if (done >= total) return json(200, { done: true })
      const l = levels[done]
      return json(200, { level: { id: l.id, puzzle: l.puzzle, ...(l.intro ? { intro: l.intro } : {}) } }) // jamais la solution
    }
    if (url === '/api/journey/submit') {
      const b = JSON.parse(String(init?.body))
      const l = levels[done]
      if (!l || b.level !== l.id) return json(409, { ok: false })
      const conn = new Set<string>([...b.edges, ...lockedEdges(l.puzzle)])
      if (!isSolved(conn, l.puzzle)) return json(422, { ok: false })
      done++
      coins += 15
      return json(200, { ok: true, timeMs: 1000, next: status(), earned: { base: 10, bonus: 5 }, coins })
    }
    // Puzzle du jour : la grille du niveau 1 sert de « grille du jour » (le serveur réel la génère).
    if (url === '/api/daily') return json(200, { date: '2026-01-01', done: dailyTime !== null, timeMs: dailyTime, streak: dailyCount ? 1 : 0, size: 5 })
    if (url === '/api/daily/start') return json(200, { date: '2026-01-01', puzzle: levels[0].puzzle, replay: dailyTime !== null })
    if (url === '/api/daily/submit') {
      const b = JSON.parse(String(init?.body))
      const conn = new Set<string>([...b.edges, ...lockedEdges(levels[0].puzzle)])
      if (!isSolved(conn, levels[0].puzzle)) return json(422, { ok: false })
      const counted = dailyTime === null
      if (counted) {
        dailyTime = 83_000
        dailyCount++
        coins += 20
      }
      return json(200, { ok: true, counted, timeMs: 83_000, earned: { base: counted ? 20 : 0, streakBonus: 0 }, streak: 1, coins })
    }
    if (url === '/api/stats') return json(200, { journey: { ...status(), solved: 0, totalTimeMs: 0, avgMs: null, fastest: null, slowest: null, bySize: [], coinsEarned: 0, coins: 0, firstSolvedAt: null }, daily: { count: dailyCount, avgMs: dailyTime, bestMs: dailyTime, worstMs: dailyTime, streak: dailyCount ? 1 : 0, bestStreak: dailyCount ? 1 : 0 } })
    if (url === '/api/aids') return json(200, { coins, aids: [] })
    if (url === '/api/me' || url === '/api/auth/login') return json(401, {})
    return json(200, {})
  })
  vi.stubGlobal('fetch', f)
  return { calls, solved: () => done }
}
