// Affiche le plan du Voyage par blocs de 10 niveaux : `make plan` (ou `make plan TO=300`).
import { MECHANICS, SECONDS_PER_LEVEL, SIZES, buildableUpTo, describe, formatDuration, planFor, playSeconds, sizeAt } from '../../shared/curriculum.js'

const to = Number(process.argv[2] ?? buildableUpTo())
console.log('Légende : .  niveau normal · G rails imposés · R rochers · S gares · M chiffres masqués · 2 deux trains · T tunnels')
console.log('          [X!] niveau d\'introduction de la règle X · A+B combinaison · ↑ la grille grossit\n')
console.log('Durée estimée par niveau (hypothèses, à corriger avec les vrais temps : make pace) :', Object.entries(SECONDS_PER_LEVEL).map(([k, v]) => `${k}×${k} ${v}s`).join(', '))
console.log('')
console.log('Tailles de grille :')
for (const z of SIZES) console.log(`  ${z.size}×${z.size} dès le niveau ${String(z.from).padStart(4)}  (atteint après ~${formatDuration(playSeconds(1, z.from - 1))} de jeu)`)
console.log('\nRègles :')
for (const m of MECHANICS) console.log(`  ${m.label.padEnd(14)} introduite au niveau ${String(m.intro).padStart(4)}  (après ~${formatDuration(playSeconds(1, m.intro - 1))} de jeu)${m.implemented ? '' : '   (pas encore jouable)'}`)
console.log(`\nFabricable aujourd'hui : niveaux 1 à ${buildableUpTo()} (jusqu'à ~${formatDuration(playSeconds(1, buildableUpTo()))} de jeu). Ensuite : « de nouveaux niveaux arrivent bientôt ».`)
console.log('')
for (let from = 1; from <= to; from += 10) {
  const end = Math.min(from + 9, to)
  const up = Array.from({ length: end - from + 1 }, (_, i) => planFor(from + i)).some((p) => p.sizeUp) ? '↑' : ' '
  console.log(`${String(from).padStart(4)}-${String(end).padEnd(4)} ${sizeAt(from)}×${sizeAt(end)}${up}  ${describe(from, end)}`)
}
