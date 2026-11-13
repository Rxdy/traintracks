// Fabrication des niveaux à partir du plan (shared/curriculum.ts) et du générateur (shared/generator.ts).
//
// Pour chaque niveau : le plan donne la taille et les règles ; on fabrique plusieurs grilles candidates et on garde
// celle dont la difficulté colle le mieux à la courbe voulue (facile en début de palier de taille, plus dure à la fin).
// Déterministe : relancer donne exactement les mêmes niveaux. Les niveaux « gelés » (déjà publiés) ne sont jamais refaits.
import { createHash } from 'node:crypto'
import { MECHANICS, SIZES, buildableUpTo, planFor } from '../../shared/curriculum.js'
import { generate, rulesAreUseful, type Generated } from '../../shared/generator.js'
import { isConsistent } from '../../shared/puzzle.js'
import { solve } from '../../shared/solver.js'
import { canon, type LevelSeed } from './journey.js'

export const logDifficulty = (nodes: number): number => Math.log10(Math.max(1, nodes))

// Fourchette de difficulté habituelle d'une taille de grille (déciles 10 % et 90 % de grilles tirées au hasard).
export function calibrate(size: number, samples = 60): { lo: number; hi: number } {
  const d: number[] = []
  for (let i = 0; i < samples; i++) d.push(logDifficulty(generate(`calibration:${size}:${i}`, size, 0, 0).difficulty))
  d.sort((a, b) => a - b)
  return { lo: d[Math.floor(samples * 0.1)], hi: d[Math.floor(samples * 0.9)] }
}

// Position du niveau dans son palier de TAILLE, de 0 (début) à 1 (fin du palier, même si on ne fabrique pas tout).
export function progressInSize(level: number): number {
  const i = SIZES.findIndex((s, k) => level >= s.from && (k === SIZES.length - 1 || level < SIZES[k + 1].from))
  const from = SIZES[i].from
  const next = SIZES[i + 1]?.from ?? from + 300 // dernier palier : « infini », on étale sur 300 niveaux
  return (level - from) / (next - from - 1)
}

export interface BuildOptions {
  to?: number // dernier niveau à fabriquer (défaut : tout ce qui est jouable aujourd'hui)
  keep?: LevelSeed[] // niveaux déjà publiés, conservés tels quels (numéros 1 à k)
  candidates?: number // grilles essayées par niveau
  onLevel?: (id: number) => void
}

export function buildLevels(opts: BuildOptions = {}): LevelSeed[] {
  const to = opts.to ?? buildableUpTo()
  const K = opts.candidates ?? 10
  const levels: LevelSeed[] = [...(opts.keep ?? [])].sort((a, b) => a.id - b.id)
  levels.forEach((l, i) => {
    if (l.id !== i + 1) throw new Error(`niveaux conservés non contigus au niveau ${i + 1}`)
  })
  const used = new Set(levels.map((l) => canon(l.puzzle)))
  const range = new Map<number, { lo: number; hi: number }>()

  for (let id = levels.length + 1; id <= to; id++) {
    const plan = planFor(id)
    if (plan.mechanics.some((m) => !MECHANICS.find((x) => x.id === m)!.implemented)) throw new Error(`niveau ${id} : règle pas encore jouable`)
    if (!range.has(plan.size)) range.set(plan.size, calibrate(plan.size))
    const { lo, hi } = range.get(plan.size)!
    // Niveau d'introduction : toujours facile. Sinon la difficulté suit la progression dans le palier de taille.
    const target = plan.intro ? lo : lo + (hi - lo) * progressInSize(id)

    const withGivens = plan.mechanics.includes('given')
    const minGivens = withGivens ? (plan.intro ? 3 : 2 + (id % 3)) : 0
    // Rochers : 2 à 4 au niveau d'introduction (bien visibles), sinon 1 à 3 (4 sur les grandes grilles).
    const rockOpts = plan.mechanics.includes('rock') ? { min: plan.intro ? 2 : 1, max: plan.intro ? 4 : plan.size >= 6 ? 4 : 3 } : undefined
    let best: Generated | null = null
    let bestGap = Infinity
    for (let i = 0; i < K * 3 && (i < K || !best); i++) {
      const g = generate(`level:${id}:${i}`, plan.size, withGivens ? minGivens + 2 : 0, minGivens, withGivens, rockOpts)
      if (used.has(canon(g.puzzle))) continue
      const gap = Math.abs(logDifficulty(g.difficulty) - target)
      if (gap < bestGap) {
        best = g
        bestGap = gap
      }
    }
    if (!best) throw new Error(`niveau ${id} : aucune grille nouvelle trouvée`)
    used.add(canon(best.puzzle))
    const intro = plan.intro ? MECHANICS.find((m) => m.id === plan.intro)!.introText : undefined
    levels.push({ id, puzzle: best.puzzle, solution: best.solution, ...(intro ? { intro } : {}) })
    opts.onLevel?.(id)
  }
  return levels
}

// --- Verrou : empreinte des niveaux publiés -----------------------------------------------------------------------
export const hashLevel = (l: Pick<LevelSeed, 'puzzle' | 'solution'>): string =>
  createHash('sha256').update(canon({ puzzle: l.puzzle, solution: l.solution })).digest('hex')

export interface Lock {
  released: number // nombre de niveaux publiés (numéros 1 à released), à ne JAMAIS modifier
  hashes: string[]
}
export const makeLock = (levels: LevelSeed[]): Lock => ({ released: levels.length, hashes: levels.map(hashLevel) })

// Liste les niveaux publiés qui ont changé ou disparu : doit toujours être vide.
export function lockViolations(levels: LevelSeed[], lock: Lock): number[] {
  const bad: number[] = []
  for (let i = 0; i < lock.released; i++) {
    const l = levels.find((x) => x.id === i + 1)
    if (!l || hashLevel(l) !== lock.hashes[i]) bad.push(i + 1)
  }
  return bad
}

// --- Audit ---------------------------------------------------------------------------------------------------------
function rank(v: number[]): number[] {
  const order = v.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0])
  const r = Array(v.length).fill(0)
  order.forEach(([, i], k) => (r[i] = k))
  return r
}
// Corrélation de rang (Spearman) : 1 = la difficulté monte toujours, 0 = au hasard.
export function spearman(x: number[], y: number[]): number {
  const a = rank(x)
  const b = rank(y)
  const n = x.length
  const ma = a.reduce((s, v) => s + v, 0) / n
  const mb = b.reduce((s, v) => s + v, 0) / n
  let num = 0
  let da = 0
  let db = 0
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb)
    da += (a[i] - ma) ** 2
    db += (b[i] - mb) ** 2
  }
  return da && db ? num / Math.sqrt(da * db) : 0
}

export interface AuditBlock {
  from: number
  to: number
  size: number
  withGivens: number
  difficulty: number // moyenne du log10 des cases explorées
}
export interface Audit {
  issues: string[]
  blocks: AuditBlock[]
  trend: { size: number; levels: number; spearman: number }[]
}

export function auditLevels(levels: LevelSeed[]): Audit {
  const issues: string[] = []
  const seen = new Map<string, number>()
  const diff: number[] = []
  levels.forEach((l, i) => {
    if (l.id !== i + 1) issues.push(`numéros non contigus : ${i + 1} attendu, ${l.id} trouvé`)
    const plan = planFor(l.id)
    if (l.puzzle.size !== plan.size) issues.push(`niveau ${l.id} : taille ${l.puzzle.size}×${l.puzzle.size}, le plan veut ${plan.size}×${plan.size}`)
    const has = (l.puzzle.givens?.length ?? 0) > 0
    if (has !== plan.mechanics.includes('given')) issues.push(`niveau ${l.id} : ${has ? 'a' : 'n\'a pas'} de rails imposés, le plan ${has ? 'n\'en veut pas' : 'en veut'}`)
    const rocky = (l.puzzle.rocks?.length ?? 0) > 0
    if (rocky !== plan.mechanics.includes('rock')) issues.push(`niveau ${l.id} : ${rocky ? 'a' : 'n\'a pas'} de rochers, le plan ${rocky ? 'n\'en veut pas' : 'en veut'}`)
    if (!!l.intro !== !!plan.intro) issues.push(`niveau ${l.id} : message d'introduction ${l.intro ? 'inattendu' : 'manquant'}`)
    if (!isConsistent(l.puzzle)) issues.push(`niveau ${l.id} : grille incohérente`)
    if (!rulesAreUseful(l.puzzle)) issues.push(`niveau ${l.id} : résoluble même sans ses règles (rails imposés, rochers) : elles ne servent à rien`)
    const r = solve(l.puzzle, 3)
    if (r.count !== 1) issues.push(`niveau ${l.id} : ${r.count} solutions (une seule attendue)`)
    else if (canon(r.solutions[0]) !== canon(l.solution)) issues.push(`niveau ${l.id} : la solution stockée n'est pas celle du solveur`)
    const key = canon(l.puzzle)
    if (seen.has(key)) issues.push(`niveau ${l.id} : identique au niveau ${seen.get(key)}`)
    seen.set(key, l.id)
    diff.push(logDifficulty(r.nodes))
  })
  const blocks: AuditBlock[] = []
  for (let from = 1; from <= levels.length; from += 10) {
    const to = Math.min(from + 9, levels.length)
    const slice = levels.slice(from - 1, to)
    blocks.push({
      from,
      to,
      size: slice[0].puzzle.size,
      withGivens: slice.filter((l) => l.puzzle.givens?.length).length,
      difficulty: diff.slice(from - 1, to).reduce((s, v) => s + v, 0) / slice.length,
    })
  }
  const trend = [...new Set(levels.map((l) => l.puzzle.size))].map((size) => {
    const idx = levels.map((l, i) => (l.puzzle.size === size ? i : -1)).filter((i) => i >= 0)
    return { size, levels: idx.length, spearman: idx.length >= 8 ? spearman(idx, idx.map((i) => diff[i])) : NaN }
  })
  return { issues, blocks, trend }
}
