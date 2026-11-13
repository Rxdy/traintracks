import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TrackGrid from './components/TrackGrid.vue'
import TrackCell from './components/TrackCell.vue'
import RockMark from './components/RockMark.vue'
import { levels } from './testLevels'
import { solve } from './solver'
import { dragStep, tapCell, toggleCross, isSolved, edgeKey } from './track'
import { isConsistent, isLocked, isRock } from './puzzle'
import { lineStatus } from './lines'

const intro = levels.find((l) => l.id === 150)! // premier niveau à rochers
const withRocks = levels.filter((l) => l.puzzle.rocks?.length)
const rock = intro.puzzle.rocks![0]
const puzzle = intro.puzzle

describe('rochers : règles', () => {
  it('le niveau d\'introduction a des rochers, cohérents et verrouillés', () => {
    expect(puzzle.rocks!.length).toBeGreaterThanOrEqual(2)
    expect(isConsistent(puzzle)).toBe(true)
    expect(isRock(puzzle, rock.row, rock.col)).toBe(true)
    expect(isLocked(puzzle, rock.row, rock.col)).toBe(true)
  })
  it('un rocher sur l\'entrée, la sortie ou hors de la grille rend la grille incohérente', () => {
    expect(isConsistent({ ...puzzle, rocks: [{ row: puzzle.entry.row, col: puzzle.entry.col }] })).toBe(false)
    expect(isConsistent({ ...puzzle, rocks: [{ row: puzzle.exit.row, col: puzzle.exit.col }] })).toBe(false)
    expect(isConsistent({ ...puzzle, rocks: [{ row: -1, col: 0 }] })).toBe(false)
    expect(isConsistent({ ...puzzle, rocks: [{ row: puzzle.size, col: 0 }] })).toBe(false)
  })
  it('la solution ne passe jamais par un rocher, et elle est unique', () => {
    for (const l of withRocks) {
      for (const k of l.puzzle.rocks!) expect(l.solution.some(([r, c]) => r === k.row && c === k.col), `niveau ${l.id}`).toBe(false)
      expect(solve(l.puzzle, 3).count, `niveau ${l.id}`).toBe(1)
    }
  })
  it('les rochers servent : sans eux (et sans rails imposés), la grille a plusieurs solutions', () => {
    for (const l of withRocks) expect(solve({ ...l.puzzle, rocks: undefined, givens: undefined }, 2).count, `niveau ${l.id}`).toBeGreaterThan(1)
  })
  it('le solveur évite les rochers : un rocher posé sur la voie rend la grille différente', () => {
    const [r, c] = intro.solution[3]
    expect(solve({ ...puzzle, rocks: [{ row: r, col: c }] }, 2).solutions.every((s) => !s.some(([a, b]) => a === r && b === c))).toBe(true)
  })
  it('rien ne se pose sur un rocher : ni rail, ni croix, ni liaison', () => {
    const rails = new Set<string>()
    const crosses = new Set<string>()
    const conn = new Set<string>()
    tapCell(rails, conn, crosses, puzzle, rock.row, rock.col)
    toggleCross(crosses, conn, rails, puzzle, rock.row, rock.col)
    expect(rails.size + crosses.size).toBe(0)
    const nb = [rock.row, rock.col + 1]
    if (nb[1] < puzzle.size) {
      dragStep(conn, null, rock.row, rock.col, nb[0], nb[1], puzzle)
      expect(conn.size).toBe(0)
    }
  })
  it('une voie qui traverse un rocher n\'est jamais acceptée', () => {
    const good = new Set<string>()
    for (let i = 1; i < intro.solution.length; i++) good.add(edgeKey(...intro.solution[i - 1], ...intro.solution[i])!)
    expect(isSolved(good, puzzle)).toBe(true)
    // même tracé, mais avec un rocher posé sur lui : refusé
    const [r, c] = intro.solution[2]
    expect(isSolved(good, { ...puzzle, rocks: [{ row: r, col: c }] })).toBe(false)
  })
  it('un compteur ne compte pas un rocher comme case libre', () => {
    expect(lineStatus(['rock', 'empty', 'empty'], 3)).toBe('over') // 2 cases libres pour 3 rails : impossible
    expect(lineStatus(['rock', 'empty', 'empty'], 2)).toBe('forced')
  })
})

describe('rochers : affichage', () => {
  it('chaque rocher est dessiné, et un tap dessus ne change rien', async () => {
    const w = mount(TrackGrid, { props: { puzzle } })
    expect(w.findAllComponents(RockMark)).toHaveLength(puzzle.rocks!.length)
    const cell = w.findAllComponents(TrackCell)[rock.row * puzzle.size + rock.col]
    await cell.trigger('pointerdown')
    window.dispatchEvent(new Event('pointerup'))
    await cell.trigger('contextmenu')
    expect(w.findAllComponents(RockMark)).toHaveLength(puzzle.rocks!.length)
    expect(cell.find('[data-test=blocked]').exists()).toBe(false)
    expect(cell.classes()).toContain('cell--rock')
  })
})
