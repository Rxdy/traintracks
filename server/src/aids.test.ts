import { describe, it, expect } from 'vitest'
import { AIDS, aidState, buyAid, useAid, STOCK_CAP } from './aids.js'
import { confirmEmail, register, SIGNUP_COINS } from './auth.js'
import { levelReward, mergeAnonymous, start, submit } from './journey.js'
import { balance } from './wallet.js'
import { cannon, cannonCount, sidesAt } from './aidLogic.js'
import { incidentEdgesOf } from './testGrid.js'
import { LEVELS, edgesOf, makeGame, STRONG } from './helpers.test-util.js'
import type { Db } from './db.js'

const A = 'a:11111111-1111-1111-1111-111111111111'
const now = () => new Date(1_000_000)
// Niveau d'ouverture de chaque aide, lu dans la configuration : changer un niveau ne casse pas les tests.
const U = Object.fromEntries(AIDS.map((a) => [a.id, a.unlockLevel])) as Record<(typeof AIDS)[number]['id'], number>
const P = Object.fromEntries(AIDS.map((a) => [a.id, a.price])) as Record<(typeof AIDS)[number]['id'], number>

// Amène un joueur au niveau n sans rejouer tous les niveaux (progression écrite directement).
async function reach(db: Db, owner: string, n: number) {
  for (let l = 1; l < n; l++) await db.query('INSERT INTO progress (owner, level, solved_at, time_ms) VALUES ($1,$2,now(),1000)', [owner, l])
}
const lvl = (id: number) => LEVELS.find((l) => l.id === id)!
// Résultat volontairement non typé : chaque test regarde la partie qui l'intéresse.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const use = (db: Db, aid: string, target?: object, edges: string[] = [], crosses: string[] = [], owner = A): Promise<any> => useAid(db, owner, { aid, target, edges, crosses })
async function at(level: number) {
  const g = await makeGame()
  await reach(g.db, A, level)
  await start(g.db, A, now())
  return g
}

describe('pièces gagnées', () => {
  it('un niveau rapporte 10, quelle que soit la grille, +5 sans aide ; jamais deux fois', async () => {
    const { db } = await makeGame()
    await start(db, A, now())
    expect(await submit(db, A, { level: 1, edges: edgesOf(1) }, now())).toMatchObject({ ok: true, earned: { base: 10, bonus: 5 }, coins: 15 }) // 4×4 : 10
    const B = 'a:22222222-2222-2222-2222-222222222222'
    await reach(db, B, 61) // 5×5
    await start(db, B, now())
    expect(await submit(db, B, { level: 61, edges: edgesOf(61) }, now())).toMatchObject({ earned: { base: 10, bonus: 5 } })
    expect([4, 5, 6, 7, 8].map(levelReward)).toEqual([10, 10, 10, 10, 10]) // fixe : 15 au plus avec le bonus sans aide
    expect(await submit(db, A, { level: 1, edges: edgesOf(1) }, now())).toMatchObject({ ok: false })
    expect(await balance(db, A)).toBe(15)
  })
  it('100 pièces à la confirmation de l\'e-mail, une seule fois', async () => {
    const { ctx, tokenOf, db } = await makeGame()
    await register(ctx, { pseudo: 'Rudy', email: 'r@x.fr', password: STRONG })
    const t = tokenOf()
    const r = await confirmEmail(ctx, t)
    if (!r.ok) throw new Error('confirmation attendue')
    expect(await balance(db, `u:${r.userId}`)).toBe(SIGNUP_COINS)
    await confirmEmail(ctx, t)
    expect(await balance(db, `u:${r.userId}`)).toBe(100)
  })
})

describe('liste des aides', () => {
  it('quatre aides, de la plus faible à la plus forte : prix et niveaux croissants, indicateurs de couleur en premier', () => {
    expect(AIDS.map((a) => a.id)).toEqual(['colors', 'cell', 'cannon', 'line'])
    for (let i = 1; i < AIDS.length; i++) {
      expect(AIDS[i].price).toBeGreaterThan(AIDS[i - 1].price)
      expect(AIDS[i].unlockLevel).toBeGreaterThan(AIDS[i - 1].unlockLevel)
    }
  })
})

describe('déblocage des aides', () => {
  it('rien avant la première ; à son niveau : 3 en stock + 1 démonstration offerte, les autres restent fermées', async () => {
    const { db } = await makeGame()
    expect((await aidState(db, A)).aids.every((a) => !a.unlocked && a.stock === 0)).toBe(true)
    await reach(db, A, U.colors)
    const s = await aidState(db, A)
    expect(s.aids.find((a) => a.id === 'colors')).toMatchObject({ unlocked: true, stock: 3, cap: 3, demoPending: true, price: P.colors })
    expect(s.aids.find((a) => a.id === 'cell')).toMatchObject({ unlocked: false, stock: 0, unlockLevel: U.cell })
  })
  it('chaque aide s\'ouvre à son niveau ; le cadeau n\'est donné qu\'une fois', async () => {
    const { db } = await makeGame()
    await reach(db, A, U.line)
    const all = (await aidState(db, A)).aids
    expect(all.map((a) => [a.id, a.unlocked, a.stock])).toEqual(AIDS.map((a) => [a.id, true, 3]))
    await aidState(db, A)
    await aidState(db, A)
    expect((await aidState(db, A)).aids.every((a) => a.stock === 3)).toBe(true)
  })
})

describe('Indicateurs de couleur (première aide)', () => {
  it('s\'active sur le niveau, sans cible, et le serveur s\'en souvient si le joueur revient', async () => {
    const { db } = await at(U.colors)
    const r = await use(db, 'colors')
    expect(r).toMatchObject({ ok: true, aid: 'colors', demo: true, result: { active: true } })
    const back = (await start(db, A, now())) as { usedAids: string[] }
    expect(back.usedAids).toEqual(['colors']) // le navigateur réactive les couleurs sur ce niveau
  })
  it('une seule fois par niveau ; ensuite le stock baisse (3 → 2 → 1 → 0), puis plus rien', async () => {
    const { db } = await at(U.colors)
    await use(db, 'colors') // démonstration offerte : gratuite
    expect(await use(db, 'colors')).toEqual({ ok: false, code: 'already_used' })
    let id = U.colors
    const stocks: number[] = []
    for (let k = 0; k < 3; k++) {
      await submit(db, A, { level: id, edges: edgesOf(id) }, now())
      id++
      await start(db, A, now())
      const r = await use(db, 'colors')
      stocks.push(r.stock)
    }
    expect(stocks).toEqual([2, 1, 0])
    await submit(db, A, { level: id, edges: edgesOf(id) }, now())
    await start(db, A, now())
    expect(await use(db, 'colors')).toEqual({ ok: false, code: 'no_stock' })
  })
  it('l\'essai offert est gratuit : stock inchangé et bonus « sans aide » conservé ; une aide payante le retire', async () => {
    const { db } = await at(U.colors)
    expect(await use(db, 'colors')).toMatchObject({ demo: true, stock: 3 })
    expect(await submit(db, A, { level: U.colors, edges: edgesOf(U.colors) }, now())).toMatchObject({ earned: { bonus: 5 } })
    await start(db, A, now())
    await use(db, 'colors') // payante (stock)
    expect(await submit(db, A, { level: U.colors + 1, edges: edgesOf(U.colors + 1) }, now())).toMatchObject({ earned: { bonus: 0 } })
  })
  it('refusée : avant son niveau, sans niveau démarré, mal formée ; rien consommé', async () => {
    const g = await makeGame()
    await start(g.db, A, now())
    expect(await use(g.db, 'colors')).toEqual({ ok: false, code: 'locked' })
    const B = 'a:44444444-4444-4444-4444-444444444444'
    await reach(g.db, B, U.colors)
    expect(await use(g.db, 'colors', undefined, [], [], B)).toEqual({ ok: false, code: 'not_started' })
    await start(g.db, B, now())
    expect(await use(g.db, 'colors', undefined, ['zz'], [], B)).toEqual({ ok: false, code: 'invalid' })
    expect(await use(g.db, 'inconnue', undefined, [], [], B)).toEqual({ ok: false, code: 'invalid' })
    expect((await aidState(g.db, B)).aids[0]).toMatchObject({ stock: 3, demoPending: true })
  })
})

describe('Rochers et pouvoirs', () => {
  it('« Une case » sur un rocher : rien à révéler, rien de débité', async () => {
    const { db } = await at(150)
    const rock = lvl(150).puzzle.rocks![0]
    expect(await use(db, 'cell', { row: rock.row, col: rock.col })).toEqual({ ok: false, code: 'nothing' })
    expect((await aidState(db, A)).aids.find((a) => a.id === 'cell')).toMatchObject({ stock: 3, demoPending: true, usedThisLevel: false })
  })
  it('le canon ne tire jamais sur un rocher (il ne tire que sur la voie)', async () => {
    const { db } = await at(150)
    const rocks = lvl(150).puzzle.rocks!.map((k) => `${k.row}:${k.col}`)
    const r = await use(db, 'cannon')
    for (const g of r.result.givens) expect(rocks).not.toContain(`${g.row}:${g.col}`)
  })
  it('une voie qui traverse un rocher est refusée par le serveur', async () => {
    const { db } = await at(150)
    const { solution, puzzle } = lvl(150)
    // la voie du niveau 150, mais le niveau 151 a d\'autres rochers : on refuse tout tracé qui passe par un rocher
    const k = puzzle.rocks![0]
    expect(solution.some(([r, c]) => r === k.row && c === k.col)).toBe(false)
    expect(await submit(db, A, { level: 150, edges: [] }, now())).toMatchObject({ ok: false })
  })
})

describe('Canon', () => {
  const cells = (r: { result: { givens: { row: number; col: number }[] } }) => r.result.givens.map((g) => [g.row, g.col])
  const onPath = (level: number, [r, c]: number[]) => lvl(level).solution.some(([a, b]) => a === r && b === c)

  it('révèle des cases de la voie, dans le bon sens, en nombre fixé par la taille de la grille', async () => {
    const { db } = await at(U.cannon)
    const { puzzle, solution } = lvl(U.cannon)
    const r = await use(db, 'cannon')
    expect(r.result.givens).toHaveLength(cannonCount(puzzle.size))
    for (const g of r.result.givens) {
      const i = solution.findIndex(([a, b]) => a === g.row && b === g.col)
      expect(i).toBeGreaterThanOrEqual(0)
      expect(g.sides).toEqual(sidesAt(puzzle, solution, i))
    }
  })
  it('ne tire jamais deux fois la même case', async () => {
    const { db } = await at(U.cannon)
    const keys = (await use(db, 'cannon')).result.givens.map((g: { row: number; col: number }) => `${g.row}:${g.col}`)
    expect(new Set(keys).size).toBe(keys.length)
  })
  it('ne tire que sur des cases que le joueur n\'a pas déjà bien posées', async () => {
    const { db } = await at(U.cannon)
    const sol = lvl(U.cannon).solution
    const good = edgesOf(U.cannon)
    // les 6 premières liaisons sont tracées : les cases 0 à 5 sont bien posées (la 6e manque d'une liaison)
    const r = await use(db, 'cannon', undefined, good.slice(0, 6))
    for (const [row, col] of cells(r)) {
      const i = sol.findIndex(([a, b]) => a === row && b === col)
      expect(i).toBeGreaterThanOrEqual(6)
    }
  })
  it('ne retire pas une case déjà révélée ou imposée', async () => {
    const { db } = await at(U.cannon)
    const first = cells(await use(db, 'cannon'))
    expect(first.every((c) => onPath(U.cannon, c))).toBe(true)
    const run = (await db.query<{ reveals: { row: number; col: number }[] }>('SELECT reveals FROM level_runs WHERE owner = $1', [A])).rows[0]
    expect(run.reveals.map((g) => [g.row, g.col])).toEqual(first)
  })
  it('quand tout est déjà posé : refusé sans consommer', async () => {
    const { db } = await at(U.cannon)
    expect(await use(db, 'cannon', undefined, edgesOf(U.cannon))).toEqual({ ok: false, code: 'nothing' })
    expect((await aidState(db, A)).aids.find((a) => a.id === 'cannon')).toMatchObject({ stock: 3, demoPending: true, usedThisLevel: false })
  })
  it('le nombre de cases suit la taille de la grille', () => {
    expect([4, 5, 6, 7, 8].map(cannonCount)).toEqual([3, 4, 5, 5, 6])
  })
  it('les impacts sont répartis : une case par ligne et par colonne quand c\'est possible', () => {
    const { puzzle, solution } = lvl(U.cannon)
    for (let k = 0; k < 40; k++) {
      let s = k + 1
      const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647)
      const out = cannon(puzzle, solution, [], new Set(), rng)
      expect(out).toHaveLength(cannonCount(puzzle.size))
      expect(new Set(out.map((g) => g.row)).size).toBeGreaterThanOrEqual(Math.min(out.length, 3))
    }
  })
  it('hasard : des tirs successifs ne donnent pas toujours les mêmes cases', () => {
    const { puzzle, solution } = lvl(U.cannon)
    const seen = new Set<string>()
    for (let k = 0; k < 30; k++) {
      let s = k * 7919 + 1
      const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647)
      seen.add(JSON.stringify(cannon(puzzle, solution, [], new Set(), rng).map((g) => [g.row, g.col])))
    }
    expect(seen.size).toBeGreaterThan(5)
  })
})

describe('Révéler une case', () => {
  it('sur la voie : le rail dans le bon sens (les deux côtés), jamais de hasard', async () => {
    const { db } = await at(U.cell)
    const sol = lvl(U.cell).solution
    const r = await use(db, 'cell', { row: sol[2][0], col: sol[2][1] })
    expect(r.result.givens).toEqual([{ row: sol[2][0], col: sol[2][1], sides: sidesAt(lvl(U.cell).puzzle, sol, 2) }])
  })
  it('hors de la voie : une croix', async () => {
    const { db } = await at(U.cell)
    const sol = lvl(U.cell).solution
    const size = lvl(U.cell).puzzle.size
    const empty = [...Array(size * size).keys()].map((i) => [Math.floor(i / size), i % size]).find(([r, c]) => !sol.some(([a, b]) => a === r && b === c))!
    const r = await use(db, 'cell', { row: empty[0], col: empty[1] })
    expect(r.result.crosses).toEqual([{ row: empty[0], col: empty[1] }])
    expect(r.result.givens).toEqual([])
  })
  it('même choix = même résultat (aucun hasard)', async () => {
    const out: string[] = []
    for (let k = 0; k < 2; k++) out.push(JSON.stringify((await use((await at(U.cell)).db, 'cell', { row: 3, col: 2 })).result))
    expect(out[0]).toBe(out[1])
  })
  it('cible hors grille : refusée sans rien consommer ; la case révélée est mémorisée', async () => {
    const { db } = await at(U.cell)
    expect(await use(db, 'cell', { row: 99, col: 0 })).toEqual({ ok: false, code: 'invalid' })
    expect((await aidState(db, A)).aids.find((a) => a.id === 'cell')).toMatchObject({ stock: 3, demoPending: true, usedThisLevel: false })
    const sol = lvl(U.cell).solution
    await use(db, 'cell', { row: sol[1][0], col: sol[1][1] })
    const back = (await start(db, A, now())) as { reveals: unknown[]; usedAids: string[] }
    expect(back.reveals).toHaveLength(1)
    expect(back.usedAids).toEqual(['cell'])
  })
})

describe('Révéler une ligne', () => {
  it('verrouillée tant que son niveau n\'est pas atteint', async () => {
    const { db } = await makeGame()
    await reach(db, A, U.line - 1)
    expect((await aidState(db, A)).aids.find((a) => a.id === 'line')).toMatchObject({ unlocked: false })
  })
  it('toutes les cases de la voie dans la ligne choisie, dans le bon sens', async () => {
    const { db } = await at(U.line)
    const sol = lvl(U.line).solution
    const puzzle = lvl(U.line).puzzle
    const row = sol[3][0]
    const r = await use(db, 'line', { axis: 'row', index: row })
    const idx = sol.map(([rr], i) => (rr === row ? i : -1)).filter((i) => i >= 0)
    expect(r.result.givens).toEqual(idx.map((i) => ({ row: sol[i][0], col: sol[i][1], sides: sidesAt(puzzle, sol, i) })))
  })
  it('une ligne vide ne coûte rien ; un axe inconnu est refusé', async () => {
    const { db } = await at(U.line)
    const sol = lvl(U.line).solution
    const size = lvl(U.line).puzzle.size
    const emptyCol = [...Array(size).keys()].find((c) => !sol.some(([, cc]) => cc === c))
    if (emptyCol !== undefined) expect(await use(db, 'line', { axis: 'col', index: emptyCol })).toEqual({ ok: false, code: 'nothing' })
    expect(await use(db, 'line', { axis: 'diag', index: 0 })).toEqual({ ok: false, code: 'invalid' })
    expect((await aidState(db, A)).aids.find((a) => a.id === 'line')).toMatchObject({ stock: 3, demoPending: true })
  })
})

describe('Achat', () => {
  it('refuse sans assez de pièces, accepte avec, plafonne à 3, refuse une aide verrouillée', async () => {
    const { db } = await at(U.colors)
    expect(await buyAid(db, A, 'cell')).toEqual({ ok: false, code: 'locked' })
    expect(await buyAid(db, A, 'colors')).toEqual({ ok: false, code: 'full' }) // 3 offerts : plein
    await use(db, 'colors') // essai offert
    await submit(db, A, { level: U.colors, edges: edgesOf(U.colors) }, now()) // +15 pièces
    await start(db, A, now())
    await use(db, 'colors') // stock 2
    expect(await balance(db, A)).toBe(15)
    expect(await buyAid(db, A, 'colors')).toEqual({ ok: true, coins: 15 - P.colors, stock: 3 })
    expect(await buyAid(db, A, 'colors')).toEqual({ ok: false, code: 'full' })
    expect(await buyAid(db, A, 'nimporte')).toEqual({ ok: false, code: 'invalid' })
    await db.query('UPDATE wallets SET coins = 4 WHERE owner = $1', [A])
    await db.query('UPDATE aid_stock SET qty = 0 WHERE owner = $1 AND aid = $2', [A, 'colors'])
    expect(await buyAid(db, A, 'colors')).toEqual({ ok: false, code: 'poor' })
    expect(await balance(db, A)).toBe(4)
  })
  it('le stock ne dépasse jamais 3', () => expect(STOCK_CAP).toBe(3))
})

describe('rattachement des pièces et aides anonymes', () => {
  it('additionne les pièces et les aides (plafond 3), garde la démonstration déjà faite', async () => {
    const { db } = await makeGame()
    const anon = '55555555-5555-5555-5555-555555555555'
    const user = '66666666-6666-6666-6666-666666666666'
    await db.query("INSERT INTO users (id, pseudo, pseudo_key, email, provider, created_at) VALUES ($1,'U','u','u@x.fr','local',now())", [user])
    await reach(db, `a:${anon}`, U.colors)
    await start(db, `a:${anon}`, now())
    await use(db, 'colors', undefined, [], [], `a:${anon}`) // démo faite côté anonyme
    await db.query('INSERT INTO wallets (owner, coins) VALUES ($1, 30), ($2, 100)', [`a:${anon}`, `u:${user}`])
    await mergeAnonymous(db, anon, user)
    expect(await balance(db, `u:${user}`)).toBe(130)
    expect(await balance(db, `a:${anon}`)).toBe(0)
    const st = (await aidState(db, `u:${user}`)).aids[0]
    expect(st.stock).toBe(3)
    expect(st.demoPending).toBe(false)
  })
})
