// Aperçu du décor d'un niveau gagné, en 3D et en classique côte à côte (outil de développement, jamais publié).
// /apercu-decor.html?theme=hiver&level=12 ; sans paramètre : plaine, niveau 8.
import { createApp, defineComponent, h, type VNode } from 'vue'
import SceneryLayer from '../src/components/SceneryLayer.vue'
import Scenery3D from '../src/components/Scenery3D.vue'
import { levels } from '../src/testLevels'
import { buildScenery, PAL, sceneryMargin, seedOf, THEMES, THEME_NAMES, type Theme } from '../src/scenery'
import { buildRoute } from '../src/trainRoute'

const q = new URLSearchParams(location.search)
const theme = (THEMES as string[]).includes(q.get('theme') ?? '') ? (q.get('theme') as Theme) : 'plaine'
const lv = levels[Math.min(levels.length, Math.max(1, Number(q.get('level') ?? 8))) - 1]
const n = lv.puzzle.size
const my = sceneryMargin(n)
const mg = { x: my, y: my }
const sc = buildScenery(lv.puzzle, lv.solution, theme, seedOf(lv.puzzle), mg)
const horiz = (d: string) => d === 'left' || d === 'right'
const route = buildRoute(lv.solution, lv.puzzle, { entry: horiz(lv.puzzle.entry.dir) ? mg.x : mg.y, exit: horiz(lv.puzzle.exit.dir) ? mg.x : mg.y })
const pal = PAL[theme]

// Les rails de la voie, comme la grille les dessine par-dessus le décor (deux rails, traverses tous les quarts de case).
const Rails = defineComponent(() => () => {
  const board = sc.rows - sc.margin.y - sc.margin.b
  const u = 100 / (board + 1)
  const pts = route.points.map((p) => ({ x: p.x + sc.margin.x, y: p.y + sc.margin.y }))
  const d = 'M' + pts.map((p) => `${p.x} ${p.y}`).join(' L')
  return h('svg', { viewBox: `0 0 ${sc.cols} ${sc.rows}`, preserveAspectRatio: 'xMidYMin slice', style: { position: 'absolute', width: `${sc.cols * u}%`, height: `${sc.frame.visibleRows * u}%`, left: `${(1 - sc.margin.x) * u}%`, top: `${(1 - sc.margin.y) * u}%`, pointerEvents: 'none' } }, [
    // comme dans le jeu, cette voie n'est dessinée que dans la grille ; hors de la grille, c'est celle peinte dans le décor (sous les tunnels)
    h('defs', [h('clipPath', { id: 'grid-only' }, [h('rect', { x: sc.margin.x, y: sc.margin.y, width: n, height: n })])]),
    h('g', { 'clip-path': 'url(#grid-only)' }, [
      h('path', { d, fill: 'none', stroke: pal.rail.tie, 'stroke-width': 0.4, 'stroke-dasharray': '0.07 0.18' }),
      h('path', { d, fill: 'none', stroke: pal.rail.rail, 'stroke-width': 0.3, 'stroke-linejoin': 'round' }),
      h('path', { d, fill: 'none', stroke: pal.bed, 'stroke-width': 0.18, 'stroke-linejoin': 'round' }),
      h('path', { d, fill: 'none', stroke: pal.rail.tie, 'stroke-width': 0.18, 'stroke-dasharray': '0.07 0.18', opacity: 0.9 }),
    ]),
  ])
})

const BOARD = 200 // px
const cell = BOARD / (n + 1)
const panel = (title: string, layer: VNode, rails = true) =>
  h('section', { style: { display: 'inline-block', verticalAlign: 'top', margin: '12px' } }, [
    h('h2', { style: { font: '600 15px system-ui', margin: '0 0 8px' } }, title),
    h('div', { style: { position: 'relative', overflow: 'hidden', width: `${sc.cols * cell}px`, height: `${sc.frame.visibleRows * cell}px`, borderRadius: '10px' } }, [
      h('div', { style: { position: 'absolute', left: `${(sc.margin.x - 1) * cell}px`, top: `${(sc.margin.y - 1) * cell}px`, width: `${BOARD}px`, height: `${BOARD}px` } }, rails ? [layer, h(Rails)] : [layer]),
    ]),
  ])

createApp({
  render: () =>
    h('main', { style: { font: '14px system-ui', padding: '8px', background: '#f4f1ea', minHeight: '100vh' } }, [
      h('p', { style: { margin: '4px 12px' } }, [
        `${THEME_NAMES[theme]}, niveau ${lv.id} (${n}×${n}). Autres : `,
        ...THEMES.map((t) => h('a', { href: `?theme=${t}&level=${lv.id}`, style: { marginRight: '8px' } }, THEME_NAMES[t])),
      ]),
      panel('Décor 3D', h(Scenery3D, { scenery: sc, route })),
      panel('Décor classique', h(SceneryLayer, { scenery: sc, route })),
    ]),
}).mount('#app')

// ?still : sans animations (captures d'écran automatiques : le navigateur sans écran n'avance pas les fondus)
if (q.has('still')) document.head.insertAdjacentHTML('beforeend', '<style>*{animation:none!important;transition:none!important}</style>')
