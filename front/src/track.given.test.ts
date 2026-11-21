import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TrainRun from './components/TrainRun.vue'
import TrackGrid from './components/TrackGrid.vue'
import { levels } from './testLevels'
import { lockedEdges, dragStep, tapCell, clearCell, isSolved, edgeKey, edgesInGrid } from './track'
import { isLocked, isGiven, railVariant, isConsistent } from './puzzle'

const lvl = levels.find((l) => l.id === 70)! // premier niveau à rails imposés
const puzzle = lvl.puzzle
const g = puzzle.givens![0]

describe('rails imposés : règles', () => {
  it('le niveau est cohérent et la case est verrouillée', () => {
    expect(isConsistent(puzzle)).toBe(true)
    expect(isGiven(puzzle, g.row, g.col)).toBe(true)
    expect(isLocked(puzzle, g.row, g.col)).toBe(true)
    expect(railVariant(puzzle, g.row, g.col)).toBe('given')
  })

  it('produit des arêtes verrouillées : 2 par rail imposé', () => {
    const locked = lockedEdges(puzzle)
    expect(locked.size).toBeGreaterThanOrEqual(puzzle.givens!.length) // les arêtes partagées comptent une fois
    expect(locked.size).toBeLessThanOrEqual(puzzle.givens!.length * 2)
  })

  it('on ne peut ni effacer un rail imposé, ni lui raccorder autre chose', () => {
    const conn = new Set(lockedEdges(puzzle))
    const before = [...conn].sort().join()
    // effacer la case : rien ne change
    tapCell(new Set(), conn, new Set(), puzzle, g.row, g.col)
    clearCell(conn, puzzle, g.row, g.col)
    expect([...conn].sort().join()).toBe(before)
    // un glisser sur une arête verrouillée ne l'efface pas
    const [e] = [...lockedEdges(puzzle)]
    const [kind, r, c] = e.split(':')
    const r2 = kind === 'v' ? Number(r) + 1 : Number(r)
    const c2 = kind === 'h' ? Number(c) + 1 : Number(c)
    dragStep(conn, 'erase', Number(r), Number(c), r2, c2, puzzle)
    expect(conn.has(e)).toBe(true)
    // raccorder une 3e liaison sur la case imposée est refusé
    const sides = new Set(g.sides)
    for (const [side, dr, dc] of [['top', -1, 0], ['bottom', 1, 0], ['left', 0, -1], ['right', 0, 1]] as const) {
      if (sides.has(side)) continue
      const nr = g.row + dr, nc = g.col + dc
      if (nr < 0 || nc < 0 || nr >= puzzle.size || nc >= puzzle.size) continue
      dragStep(conn, 'draw', g.row, g.col, nr, nc, puzzle)
      expect(conn.has(edgeKey(g.row, g.col, nr, nc)!), side).toBe(false)
    }
  })

  it('isSolved : la solution passe, et une voie qui évite un rail imposé est refusée', () => {
    const conn = new Set<string>()
    for (let i = 1; i < lvl.solution.length; i++) {
      const [a, b] = lvl.solution[i - 1]
      const [c, d] = lvl.solution[i]
      conn.add(edgeKey(a, b, c, d)!)
    }
    expect(isSolved(conn, puzzle)).toBe(true)
    // même voie mais le puzzle exige un rail imposé ailleurs (hors voie) → pas résolu
    const other = { ...puzzle, givens: [{ row: 0, col: 0, sides: ['right', 'bottom'] as ['right', 'bottom'] }] }
    const onPath = lvl.solution.some(([r, c]) => r === 0 && c === 0)
    if (!onPath) expect(isSolved(conn, other)).toBe(false)
  })
})

describe('rails imposés : jeu', () => {
  it('au départ : rails gris visibles, « Effacer tout » les garde', async () => {
    const w = mount(TrackGrid, { props: { puzzle } })
    const cell = () => w.find(`[data-r="${g.row}"][data-c="${g.col}"]`)
    expect(cell().classes()).toContain('cell--rail')
    expect(cell().classes()).toContain('cell--given')
    expect(w.findAll('[data-variant=given]').length).toBeGreaterThan(0)
    await w.find('.clear').trigger('click')
    await w.find('.clear').trigger('click') // effacer tout se confirme d'un second toucher
    expect(cell().classes()).toContain('cell--rail')
    expect(cell().classes()).toContain('cell--given')
  })

  it('effacer tout se confirme : le premier toucher arme le bouton, le second efface', async () => {
    const w = mount(TrackGrid, { props: { puzzle } })
    const btn = () => w.find('[data-test=clear]')
    expect(btn().classes()).not.toContain('armed')
    await btn().trigger('click')
    expect(btn().classes()).toContain('armed')
    expect(btn().attributes('aria-label')).toBe('Toucher encore pour tout effacer')
    await btn().trigger('click')
    expect(btn().classes()).not.toContain('armed')
  })

  it('un clic sur un rail imposé ne l\'efface pas', async () => {
    const w = mount(TrackGrid, { props: { puzzle } })
    const c = w.find(`[data-r="${g.row}"][data-c="${g.col}"]`)
    await c.trigger('pointerdown')
    window.dispatchEvent(new Event('pointerup'))
    await w.vm.$nextTick()
    expect(w.find(`[data-r="${g.row}"][data-c="${g.col}"]`).classes()).toContain('cell--rail')
  })

  it('trace la solution à la main (rails imposés compris) : victoire', async () => {
    const w = mount(TrackGrid, { props: { puzzle }, attachTo: document.body })
    const cell = (r: number, c: number) => w.find(`[data-r="${r}"][data-c="${c}"]`)
    const sol = lvl.solution
    await cell(sol[0][0], sol[0][1]).trigger('pointerdown')
    for (const [r, c] of sol.slice(1)) await cell(r, c).trigger('pointerenter')
    window.dispatchEvent(new Event('pointerup'))
    await w.vm.$nextTick()
    expect(w.find('[data-test=train]').exists()).toBe(true) // victoire : le train part
    w.findComponent(TrainRun).vm.$emit('done')
    await w.vm.$nextTick()
    expect(w.find('[data-test=win]').exists()).toBe(true)
    w.unmount()
  })
})

describe('rails imposés : aucun indice au départ', () => {
  it('aucun compteur n\'est coloré au départ du niveau 70', () => {
    const w = mount(TrackGrid, { props: { puzzle } })
    for (const c of w.findAll('[data-test=clue]')) expect(c.classes(), c.text()).toContain('clue--open')
  })

  it('les cases imposées à côté des rails gris sont grises, puis bleues dès qu\'on les prolonge', async () => {
    const w = mount(TrackGrid, { props: { puzzle } })
    // tous les rails du départ sont gris / vert / rouge — aucun bleu
    const variants = w.findAll('[data-variant]').map((e) => e.attributes('data-variant'))
    expect(variants.filter((v) => v === 'user')).toHaveLength(0)
    expect(variants.filter((v) => v === 'given').length).toBeGreaterThan(puzzle.givens!.length) // + voisines
    // le joueur pose un rail à la main : il est bleu
    const free = lvl.solution.find(([r, c]) => !isLocked(puzzle, r, c) && !w.find(`[data-r="${r}"][data-c="${c}"] [data-variant]`).exists())!
    await w.find(`[data-r="${free[0]}"][data-c="${free[1]}"]`).trigger('pointerdown')
    window.dispatchEvent(new Event('pointerup'))
    await w.vm.$nextTick()
    expect(w.find(`[data-r="${free[0]}"][data-c="${free[1]}"] [data-variant]`).attributes('data-variant')).toBe('user')
  })
})

describe('liaisons envoyées au serveur', () => {
  it('un rail révélé sur la case d\'entrée ou de sortie ne produit jamais de liaison hors grille (niveau 102 bloqué en prod)', () => {
    // le Canon avait révélé la case d'entrée (3,0) côté gauche et la sortie (1,4) côté droit : « h:3:-1 » et « h:1:4 »
    const keys = ['h:3:-1', 'h:1:4', 'v:4:0', 'h:3:0', 'v:2:1', 'h:0:3']
    expect(edgesInGrid(keys, 5)).toEqual(['h:3:0', 'v:2:1', 'h:0:3'])
    expect(edgeKey(3, 0, 3, -1)).toBe('h:3:-1') // c'est bien edgeKey qui fabrique la liaison hors grille
  })
})
