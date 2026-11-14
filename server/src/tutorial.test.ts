import { describe, it, expect } from 'vitest'
import { completeTutorial } from './tutorial.js'
import { balance } from './wallet.js'
import { makeGame } from './helpers.test-util.js'
import { solve } from '../../shared/solver.js'
import { edgeKey } from '../../shared/track.js'
import { LESSONS, circuitPuzzle, lessonPuzzle, TUTORIAL_REWARD, type Cell } from '../../shared/tutorial.js'

const A = 'a:11111111-1111-1111-1111-111111111111'
const now = () => new Date(1_000_000)
const path = LESSONS[4].steps.at(-1)!.action as { type: 'drag'; path: Cell[] }
const good = path.path.slice(1).map((c, i) => edgeKey(path.path[i][0], path.path[i][1], c[0], c[1])!)

describe('tutoriel : les exercices', () => {
  it('chaque exercice a une solution unique, et le dernier glisser la suit', () => {
    for (const l of LESSONS) {
      const r = solve(lessonPuzzle(l), 3)
      expect(r.count, l.id).toBe(1)
      expect(r.solutions[0], l.id).toEqual(l.solution)
      for (const s of l.steps) if (s.action.type === 'drag') expect(s.action.path, l.id).toEqual(l.solution)
    }
  })
  it('l\'entrée et la sortie sont sur le bord de la grille', () => {
    for (const l of LESSONS) {
      for (const p of [l.entry, l.exit]) {
        const edge = { left: p.col === 0, right: p.col === l.cols - 1, up: p.row === 0, down: p.row === l.rows - 1 }[p.dir]
        expect(edge, `${l.id} ${p.dir}`).toBe(true)
      }
    }
  })
  it('le chiffre de chaque exercice colle à la voie, et les croix visent des cases hors voie', () => {
    for (const l of LESSONS) {
      const drag = l.solution
      const rows = Array(l.rows).fill(0)
      const cols = Array(l.cols).fill(0)
      for (const [r, c] of drag) { rows[r]++; cols[c]++ }
      expect(rows, l.id).toEqual(l.rowClues)
      expect(cols, l.id).toEqual(l.colClues)
      const on = new Set(drag.map(([r, c]) => `${r}:${c}`))
      for (const s of l.steps) {
        if (s.action.type === 'cross') for (const [r, c] of s.action.cells) expect(on.has(`${r}:${c}`)).toBe(false)
        if (s.action.type === 'tap') for (const [r, c] of s.action.cells) expect(on.has(`${r}:${c}`)).toBe(true)
      }
    }
  })
})

describe('tutoriel : la récompense', () => {
  it('circuit résolu : versée une seule fois', async () => {
    const { db } = await makeGame()
    expect(await completeTutorial(db, A, good, now())).toEqual({ ok: true, earned: TUTORIAL_REWARD, coins: TUTORIAL_REWARD })
    expect(await completeTutorial(db, A, good, now())).toEqual({ ok: true, earned: 0, coins: TUTORIAL_REWARD })
    expect(await balance(db, A)).toBe(TUTORIAL_REWARD)
  })
  it('un tracé faux ou mal formé ne rapporte rien', async () => {
    const { db } = await makeGame()
    expect(circuitPuzzle.size).toBe(4)
    expect(await completeTutorial(db, A, good.slice(1), now())).toEqual({ ok: false, code: 'wrong' })
    expect(await completeTutorial(db, A, ['zz'], now())).toEqual({ ok: false, code: 'invalid' })
    expect(await completeTutorial(db, A, 'x', now())).toEqual({ ok: false, code: 'invalid' })
    expect(await balance(db, A)).toBe(0)
  })
})
