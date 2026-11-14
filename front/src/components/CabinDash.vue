<script setup lang="ts">
// Pupitre de conduite : un décor, rien de plus (aucun clic, aucun son, aucune animation). Inspiré d'une cabine de train à grande
// vitesse : à gauche l'afficheur orange, deux cadrans, le gros bouton rouge d'arrêt d'urgence et une manette ; au centre le bloc
// de commande avec ses deux poignées ; à droite un petit écran, un clavier, une matrice de voyants, une grille de haut-parleur et
// deux boutons. L'écran central (les pouvoirs) et le bouton « Niveau suivant » se posent par-dessus, depuis JourneyView.
const rad = (d: number) => (d * Math.PI) / 180
const at = (cx: number, cy: number, r: number, deg: number): [number, number] => [cx + r * Math.cos(rad(deg)), cy + r * Math.sin(rad(deg))]
// cadran : de -210° (en bas à gauche) à +30° (en bas à droite)
const ticks = (cx: number, cy: number, r: number, n: number) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const d = -210 + (240 * i) / n
    const [x1, y1] = at(cx, cy, r, d)
    const [x2, y2] = at(cx, cy, r - (i % 2 === 0 ? 4 : 2.5), d)
    return { x1, y1, x2, y2 }
  })
const needle = (cx: number, cy: number, r: number, frac: number) => at(cx, cy, r, -210 + 240 * frac)
const dialA = { cx: 24, cy: 48, r: 17 }
const dialB = { cx: 63, cy: 44, r: 14 }
const nA = needle(dialA.cx, dialA.cy, 12, 0.55)
const nB = needle(dialB.cx, dialB.cy, 10, 0.3)
// clavier (4 × 3), matrice de voyants (11 × 4, quelques-uns verts), grille du haut-parleur
const keys = Array.from({ length: 12 }, (_, i) => ({ x: 303 + (i % 4) * 8, y: 8 + Math.floor(i / 4) * 8 }))
const leds = Array.from({ length: 40 }, (_, i) => ({ x: 262.5 + (i % 10) * 4.5, y: 47.5 + Math.floor(i / 10) * 5, green: i % 10 === 3 || i % 10 === 7 }))
const grille = [-6, 0, 6].flatMap((dy) => [-6, 0, 6].map((dx) => ({ x: 323 + dx, y: 56 + dy })))
</script>

<template>
  <svg class="pupitre" viewBox="0 0 340 116" aria-hidden="true" data-test="cabin-dash">
    <!-- ======== CENTRE (commun) : écran de contrôle décoratif et bloc de commande avec ses poignées ======== -->
    <rect x="88" y="4" width="164" height="52" rx="9" fill="#0b1220" stroke="#475569" stroke-width="3" />
    <g stroke="#1e293b" stroke-width="1"><line x1="96" y1="20" x2="244" y2="20" /><line x1="96" y1="32" x2="244" y2="32" /><line x1="96" y1="44" x2="244" y2="44" /></g>
    <polyline points="96,46 112,36 128,41 146,22 164,31 184,18 204,27 224,14 244,26" fill="none" stroke="#22d3ee" stroke-width="2" stroke-linejoin="round" />
    <rect x="100" y="62" width="140" height="50" rx="9" fill="#0b0f14" stroke="#334155" stroke-width="2" />
    <rect x="108" y="68" width="124" height="5" rx="2.5" fill="#1f2937" />
    <rect x="89" y="66" width="12" height="32" rx="5" fill="#111827" stroke="#475569" stroke-width="1.2" /><line x1="92.5" y1="70" x2="92.5" y2="94" stroke="#d9f99d" stroke-width="1.8" stroke-linecap="round" />
    <rect x="239" y="66" width="12" height="32" rx="5" fill="#111827" stroke="#475569" stroke-width="1.2" /><line x1="247.5" y1="70" x2="247.5" y2="94" stroke="#d9f99d" stroke-width="1.8" stroke-linecap="round" />
    <g fill="#e5e7eb"><rect x="110" y="102" width="10" height="5" rx="1.2" /><rect x="160" y="102" width="20" height="5" rx="1.2" /><rect x="220" y="102" width="10" height="5" rx="1.2" /></g>
    <g fill="#475569"><rect x="112" y="80" width="50" height="3" rx="1.5" /><rect x="112" y="87" width="36" height="3" rx="1.5" /><rect x="176" y="80" width="50" height="3" rx="1.5" /><rect x="190" y="87" width="36" height="3" rx="1.5" /></g>

    <!-- ======== commandes de chaque côté (les pouvoirs sont dans la colonne à droite, voir JourneyView) ======== -->
    <g>
      <rect x="4" y="8" width="40" height="15" rx="2.5" fill="#0b0f14" stroke="#4b5563" stroke-width="1.5" />
      <text x="9" y="19.5" font-family="ui-monospace, monospace" font-size="11" font-weight="700" fill="#fb923c">2300</text>
      <rect x="48" y="9" width="9" height="6" rx="1" fill="#facc15" /><rect x="60" y="9" width="9" height="6" rx="1" fill="#22c55e" /><rect x="72" y="9" width="9" height="6" rx="1" fill="#e5e7eb" />
      <circle :cx="dialA.cx" :cy="dialA.cy" :r="dialA.r" fill="#0b0f14" stroke="#94a3b8" stroke-width="2" />
      <circle :cx="dialA.cx" :cy="dialA.cy" :r="dialA.r - 3.5" fill="#e5e7eb" />
      <line v-for="(t, i) in ticks(dialA.cx, dialA.cy, dialA.r - 4, 10)" :key="'a' + i" :x1="t.x1" :y1="t.y1" :x2="t.x2" :y2="t.y2" stroke="#374151" stroke-width="1.2" stroke-linecap="round" />
      <line :x1="dialA.cx" :y1="dialA.cy" :x2="nA[0]" :y2="nA[1]" stroke="#dc2626" stroke-width="2" stroke-linecap="round" />
      <circle :cx="dialA.cx" :cy="dialA.cy" r="2.6" fill="#0b0f14" />
      <circle :cx="dialB.cx" :cy="dialB.cy" :r="dialB.r" fill="#0b0f14" stroke="#94a3b8" stroke-width="2" />
      <circle :cx="dialB.cx" :cy="dialB.cy" :r="dialB.r - 3.2" fill="#e5e7eb" />
      <line v-for="(t, i) in ticks(dialB.cx, dialB.cy, dialB.r - 3.5, 8)" :key="'b' + i" :x1="t.x1" :y1="t.y1" :x2="t.x2" :y2="t.y2" stroke="#374151" stroke-width="1.1" stroke-linecap="round" />
      <line :x1="dialB.cx" :y1="dialB.cy" :x2="nB[0]" :y2="nB[1]" stroke="#1f2937" stroke-width="1.8" stroke-linecap="round" />
      <circle :cx="dialB.cx" :cy="dialB.cy" r="2.2" fill="#0b0f14" />
      <rect x="48" y="64" width="30" height="9" rx="1.5" fill="#1f2937" stroke="#6b7280" stroke-width="1" />
      <circle cx="55" cy="68.5" r="2.2" fill="#f59e0b" /><circle cx="64" cy="68.5" r="2.2" fill="#22c55e" /><circle cx="72" cy="68.5" r="2.2" fill="#ef4444" />
      <rect x="4" y="78" width="34" height="34" rx="4" fill="#1f2937" />
      <circle cx="21" cy="95" r="11.5" fill="#0b0f14" /><circle cx="21" cy="95" r="8" fill="#dc2626" stroke="#7f1d1d" stroke-width="1.8" /><circle cx="18.5" cy="92.5" r="2.4" fill="#fff" opacity=".6" />
      <rect x="44" y="78" width="40" height="34" rx="4" fill="#1f2937" />
      <circle cx="64" cy="87" r="6.5" fill="#0b0f14" stroke="#6b7280" stroke-width="1.5" />
      <line x1="64" y1="92" x2="64" y2="104" stroke="#6b7280" stroke-width="3.5" stroke-linecap="round" />

      <rect x="258" y="8" width="40" height="29" rx="3" fill="#0f172a" stroke="#475569" stroke-width="1.5" />
      <rect x="261" y="11" width="34" height="23" rx="1.5" fill="#1e3a8a" />
      <polyline points="263,30 269,22 275,27 282,18 291,23" fill="none" stroke="#22d3ee" stroke-width="1.5" stroke-linejoin="round" />
      <rect v-for="(k, i) in keys" :key="'k' + i" :x="k.x" :y="k.y" width="6.5" height="6" rx="1" fill="#64748b" />
      <rect x="258" y="42" width="50" height="26" rx="3" fill="#0b0f14" stroke="#334155" stroke-width="1.5" />
      <circle v-for="(l, i) in leds" :key="'l' + i" :cx="l.x" :cy="l.y" r="1.5" :fill="l.green ? '#4ade80' : '#facc15'" />
      <circle cx="323" cy="56" r="13.5" fill="#0b0f14" stroke="#4b5563" stroke-width="1.8" />
      <circle v-for="(g, i) in grille" :key="'g' + i" :cx="g.x" :cy="g.y" r="1.6" fill="#6b7280" />
      <rect x="258" y="74" width="14" height="8" rx="1.5" fill="#1f2937" stroke="#6b7280" stroke-width="1" /><rect x="276" y="74" width="14" height="8" rx="1.5" fill="#1f2937" stroke="#6b7280" stroke-width="1" />
      <circle cx="265" cy="78" r="2" fill="#22c55e" /><circle cx="283" cy="78" r="2" fill="#ef4444" />
      <circle cx="270" cy="99" r="9" fill="#0b0f14" /><circle cx="270" cy="99" r="6.2" fill="#dc2626" stroke="#7f1d1d" stroke-width="1.4" />
      <circle cx="299" cy="99" r="9" fill="#0b0f14" /><circle cx="299" cy="99" r="6.2" fill="#f59e0b" stroke="#92400e" stroke-width="1.4" />
      <rect x="316" y="90" width="18" height="18" rx="3" fill="#1f2937" /><circle cx="325" cy="99" r="4.5" fill="#0b0f14" stroke="#6b7280" stroke-width="1.2" />
    </g>

  </svg>
</template>

<style scoped>
.pupitre {
  display: block;
  width: 100%;
  height: auto;
  pointer-events: none;
}
</style>
