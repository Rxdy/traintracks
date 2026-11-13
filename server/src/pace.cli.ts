// `make pace` : temps de jeu RÉELS par niveau (joueurs de la base), comparés aux durées estimées du plan.
import { SECONDS_PER_LEVEL } from '../../shared/curriculum.js'
import { createPgDb } from './db.js'

const db = createPgDb(process.env.DATABASE_URL!)
const { rows } = await db.query<{ size: number; n: number; avg: number; med: number }>(
  `SELECT (l.puzzle->>'size')::int AS size, count(*)::int AS n, round(avg(p.time_ms) / 1000.0)::int AS avg,
          round((percentile_cont(0.5) WITHIN GROUP (ORDER BY p.time_ms)) / 1000.0)::int AS med
   FROM progress p JOIN levels l ON l.id = p.level
   WHERE p.time_ms > 0 AND p.time_ms < 1800000 GROUP BY 1 ORDER BY 1`,
)
console.log('Taille   niveaux joués   médiane   moyenne   estimé dans le plan')
for (const r of rows) {
  const est = SECONDS_PER_LEVEL[r.size]
  console.log(`${r.size}×${r.size}      ${String(r.n).padStart(6)}          ${String(r.med).padStart(4)} s    ${String(r.avg).padStart(4)} s    ${est} s  ${r.med > est * 1.3 ? '(plus long que prévu : paliers peut-être trop larges)' : r.med < est * 0.7 ? '(plus court que prévu : élargir les paliers)' : ''}`)
}
if (!rows.length) console.log('Aucun temps enregistré pour l\'instant.')
await db.close()
