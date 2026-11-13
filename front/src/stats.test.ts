import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchStats, formatTime } from './stats'

afterEach(() => vi.unstubAllGlobals())

describe('stats', () => {
  it('formate les temps en m:ss', () => {
    expect(formatTime(null)).toBe('—')
    expect(formatTime(75000)).toBe('1:15')
    expect(formatTime(4000)).toBe('0:04')
  })
  it('les statistiques viennent du serveur (et rien n\'est gardé dans le navigateur)', async () => {
    localStorage.clear()
    const data = { journey: { level: 4, total: 90, allDone: false }, daily: { count: 2, avgMs: 90000, bestMs: 60000, worstMs: 120000, streak: 2 } }
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(data), { status: 200 })))
    expect(await fetchStats()).toEqual(data)
    expect(localStorage.length).toBe(0)
  })
  it('sans compte (401) ou serveur injoignable : rien', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })))
    expect(await fetchStats()).toBeNull()
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline') }))
    expect(await fetchStats()).toBeNull()
  })
})
