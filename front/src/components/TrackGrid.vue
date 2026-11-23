<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { range, railVariant, isLocked, isRock, type Given, type Puzzle } from '../puzzle'
import type { CellMark } from '../cell'
import {
  connectedSides,
  isCrossed,
  isRail,
  toggleCross,
  tapCell,
  dragStep,
  isSolved,
  tracePath,
  lockedEdges,
  edgesInGrid,
  incidentEdges,
  edgeKey,
  cellKey,
  type DragMode,
} from '../track'
import { lineStatuses } from '../lines'
import { buildRoute, leadCells, type Route } from '../trainRoute'
import { buildScenery, distanceNear, PAL, sceneryMargin, seedOf, timing, type Scenery, type Theme } from '../scenery'
import TrainRun from './TrainRun.vue'
import SceneryLayer from './SceneryLayer.vue'
import Scenery3D from './Scenery3D.vue'
import type { LandFrame } from '../scenery/motion'
import { webglAvailable } from '../decor'
import { solve } from '../solver'
import SceneryLife from './SceneryLife.vue'
import { sound, soundOn } from '../sound/director'
import { setWheelGuard } from '../noZoom'
import TrackCell from './TrackCell.vue'
import ClueNumber from './ClueNumber.vue'
import SpeedControl, { type Speed } from './SpeedControl.vue'

const props = defineProps<{
  puzzle: Puzzle
  // Indicateurs de couleur des compteurs : DÉSACTIVÉS par défaut (ils aident beaucoup trop). Une aide les active sur un niveau.
  colorHints?: boolean
  // Aides : le joueur choisit une case ; un toucher envoie `pick` au lieu de tracer.
  picking?: boolean
  // Cases déjà révélées sur ce niveau (reprise après avoir quitté puis être revenu).
  initial?: { givens: Given[]; crosses: { row: number; col: number }[] }
  // Temps officiel (mesuré par le serveur), affiché à la victoire à la place du chrono local.
  officialMs?: number | null
  // Environnement du décor révélé à la victoire (saison / paysage) ; tiré du puzzle si absent.
  theme?: Theme
  // Si fournie, la victoire n'est acquise que quand elle répond vrai (le serveur a vérifié le tracé).
  // Réponse : vrai, ou le message d'erreur à afficher (faux : message générique).
  validate?: (ms: number, edges: string[]) => Promise<boolean | string>
  // Vrai : le récapitulatif de victoire n'est pas dessiné ici, l'écran de jeu l'affiche ailleurs (store de la cabine).
  externalRecap?: boolean
  // Barre du haut de la page : où poser le minuteur et le bouton du son (sélecteurs CSS). Absente : ils restent à côté des outils.
  hud?: { timer: string; sound: string }
  // Vrai : la grille refuse tout tracé (le joueur doit d'abord essayer le pouvoir qu'il vient de recevoir) ; les aides qui
  // attendent une case (picking) marchent toujours.
  locked?: boolean
  // Pouvoir « Une ligne » en attente : les compteurs se touchent pour choisir la ligne ou la colonne (événement pickLine).
  pickingLine?: boolean
  // Vrai : la grille est montée sous l'écran de chargement ; le décor du Trajet se prépare tout de suite (événement `prepared`).
  eager?: boolean
}>()
const emit = defineEmits<{ (e: 'solved', ms: number): void; (e: 'pick', row: number, col: number): void; (e: 'begin'): void; (e: 'finish'): void; (e: 'train', running: boolean): void; (e: 'pickLine', axis: 'row' | 'col', index: number): void; (e: 'prepared'): void }>()

// Puzzle « effectif » : le puzzle + les rails révélés par les aides, qui se comportent comme des rails imposés
// (verrouillés, dans le bon sens).
const revealed = ref<Given[]>([])
const puz = computed<Puzzle>(() =>
  revealed.value.length ? { ...props.puzzle, givens: [...(props.puzzle.givens ?? []), ...revealed.value] } : props.puzzle,
)

const indices = computed(() => range(puz.value.size))

// La voie : liaisons tracées, croix posées, rails marqués (orientation inconnue).
// Les rails imposés sont des liaisons présentes dès le départ (verrouillées).
const connections = ref(new Set<string>(lockedEdges(puz.value)))
const crosses = ref(new Set<string>())
const rails = ref(new Set<string>())

// Côtés connectés de chaque case (null si aucune liaison).
const sidesGrid = computed(() =>
  indices.value.map((r) =>
    indices.value.map((c) => {
      const s = connectedSides(connections.value, puz.value, r, c)
      return s.length ? s : null
    }),
  ),
)

function markOf(r: number, c: number): CellMark {
  if (isRock(puz.value, r, c)) return 'rock'
  if (isRail(connections.value, rails.value, puz.value, r, c)) return 'rail'
  return isCrossed(crosses.value, r, c) ? 'cross' : 'empty'
}

// La case porte-t-elle une marque posée PAR LE JOUEUR ? (rail, liaison ou croix
// qui ne vient pas des rails imposés)
function playerTouched(r: number, c: number): boolean {
  if (isLocked(puz.value, r, c)) return false
  const key = cellKey(r, c)
  if (rails.value.has(key) || crosses.value.has(key)) return true
  const locked = lockedEdges(puz.value)
  return incidentEdges(puz.value.size, r, c).some(
    (e) => connections.value.has(e) && !locked.has(e),
  )
}

// Une case voisine d'un rail imposé, que le joueur n'a pas encore touchée, est
// imposée elle aussi : on la dessine en gris. Elle passe en bleu dès que le
// joueur la prolonge.
function variantOf(r: number, c: number) {
  const v = railVariant(puz.value, r, c)
  if (v === 'user' && markOf(r, c) === 'rail' && !playerTouched(r, c)) return 'given'
  return v
}

// Aide : état de chaque compteur (vert = fait / forcé, rouge = impossible). Neutre tant que l'aide n'est pas activée.
const statuses = computed(() => {
  if (!props.colorHints) return { rows: Array(puz.value.size).fill('open'), cols: Array(puz.value.size).fill('open') } as ReturnType<typeof lineStatuses>
  const grid = indices.value.map((r) => indices.value.map((c) => markOf(r, c)))
  // seules les marques du joueur allument l'aide (pas le départ, la sortie,
  // les rails imposés ni les cases qu'ils imposent à côté d'eux)
  const played = grid.map((row, r) => row.map((_m, c) => playerTouched(r, c)))
  return lineStatuses(grid, puz.value.rowClues, puz.value.colClues, played)
})

// --- Chrono, victoire et train ---
const solved = ref(false)
const elapsed = ref(0)
const route = ref<Route | null>(null)
// Décor : d'abord il se dévoile (voie posée), PUIS le train démarre.
const scenery = ref<Scenery | null>(null)
// Numéro du décor : il change à chaque décor refait (écran tourné puis « Revoir le trajet »). Les couches qui calculent à leur création
// (3D, voitures et barrières, animaux) sont recréées, sinon elles gardent l'ancien décor (barrières décalées de la voie, par exemple).
const decorId = ref(0)
const decorReady = ref(false) // le décor 3D est prêt : la vague d'apparition part de là, pour tout ce qui vit dessus
const glideY = ref(0) // de combien la grille glisse (px) vers le milieu de l'écran quand le paysage apparaît
const failed3d = ref(false) // le décor 3D n'a pas pu s'afficher : décor classique jusqu'à la fin de la visite
// la vie du décor (voitures, passage à niveau) : les voitures et la barrière du fond sont dessinées par la scène 3D, sous le train qui passe
const life = shallowRef<LandFrame | null>(null)
const use3d = computed(() => !failed3d.value && webglAvailable())
// Le décor 3D est prêt : le train roule dans la scène 3D (caché par les arbres devant la voie) et la voie de la grille y est peinte.
const train3d = computed(() => use3d.value && decorReady.value)
// Les rails des cases restent visibles pendant que le décor 3D apparaît en fondu (1,2 s), puis s'effacent : la voie peinte dans la
// scène a pris le relais. Sans ça, ils disparaissaient d'un coup alors que le décor était encore invisible.
const railsGone = ref(false)
let railsTimer = 0
watch(train3d, (v) => {
  clearTimeout(railsTimer)
  if (!v) return void (railsGone.value = false)
  railsTimer = window.setTimeout(() => (railsGone.value = true), 1300)
})
onUnmounted(() => clearTimeout(railsTimer))
const sceneryRoute = ref<Route | null>(null)
let trainTimer = 0
// Vrai quand l'animation du train est finie : c'est alors seulement qu'on propose la suite.
const trainDone = ref(false)
// Vitesse du train (cases/s) : deux crans en haut à droite (lent, normal). Normal par défaut ; le choix reste d'un trajet à l'autre.
import { speed } from '../speedPref' // le choix est gardé d'un niveau à l'autre
const SPEEDS: Record<Speed, number> = { slow: 1.9, normal: 4.5 } // cases par seconde en ligne droite
// Sons : la fin du trajet laisse la place au décor ; la barrière du passage à niveau a ses propres sons.
watch(trainDone, (v) => v && sound.trainEnd())
// Trajet : plus d'écouteur de molette, sinon Firefox fige l'animation quand on défile au pavé tactile (voir noZoom.ts)
watch(solved, (v) => setWheelGuard(!v))
onUnmounted(() => setWheelGuard(true))
function onTrainProgress(s: number): void {
  trainS.value = s
}

// Zone où le train est visible : exactement celle du décor (en cases de la grille de jeu).
const trainClip = computed(() => {
  const sc = scenery.value
  if (!sc) return undefined
  const r = { x: -sc.margin.x, y: -sc.margin.y, w: sc.cols, h: sc.frame.visibleRows }
  return r
})

// Position de la locomotive sur son trajet : les barrières du passage à niveau se baissent quand elle approche.
const trainS = ref(-1)
const TRAIN_LENGTH = 2.4
const exitLead = computed(() => (scenery.value ? TRAIN_LENGTH + 1 : 0)) // longueur de voie au-delà du bord du décor
// Vrai quand la locomotive a quitté le décor : le trajet vu de la cabine est fini (les wagons finissent de sortir de la carte).
const locoOut = computed(() => !!route.value && trainS.value >= route.value.length - exitLead.value)
watch([route, trainDone, locoOut], () => emit('train', !!route.value && !trainDone.value && !locoOut.value))
const trainNear = computed(() => {
  const x = scenery.value?.road?.crossing
  const rt = route.value
  if (!x || !rt || trainDone.value) return false
  const mg = scenery.value?.margin ?? { x: 0, y: 0 }
  const cross = distanceNear(rt, x[1] - mg.x + 0.5, x[0] - mg.y + 0.5) // le passage à niveau est donné dans le repère du grand décor
  return trainS.value > cross - 3.2 && trainS.value < cross + TRAIN_LENGTH + 0.6
})
watch(trainNear, (v) => sound.crossing(v))
// Le résultat peut être réduit pour regarder le décor ; le train se relance à la demande.
// Téléphone : pas de fenêtre posée sur la grille ; le résultat s'affiche sous la grille, dans une zone dont la
// place est RÉSERVÉE dès le début (rien ne bouge à la victoire), entre la grille et les aides.
// Vrai dès que le train est passé une première fois : sur téléphone le récapitulatif reste affiché quand on le relance.
const finished = ref(false)
watch([trainDone, locoOut], ([done, out]) => {
  if ((done || out) && !finished.value) {
    finished.value = true
    emit('finish')
  }
})
const boardEl = ref<HTMLElement | null>(null)
let startedAt = 0
let clock = 0

function startClock(): void {
  if (startedAt) return
  startedAt = Date.now()
  emit('begin') // premier geste : le serveur démarre son chrono ici
  clock = window.setInterval(() => (elapsed.value = Date.now() - startedAt), 250)
}
function fmt(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
const verifying = ref(false)
const verifyError = ref('')
async function checkWin(): Promise<void> {
  if (solved.value || verifying.value || !isSolved(connections.value, puz.value)) return
  const ms = Date.now() - startedAt
  if (props.validate) {
    verifying.value = true
    verifyError.value = ''
    let ok: boolean | string = false
    try {
      ok = await props.validate(ms, edgesInGrid(connections.value, puz.value.size)) // jamais de liaison hors grille (voir edgesInGrid)
    } catch {
      ok = false
    }
    verifying.value = false
    if (ok !== true) {
      verifyError.value = typeof ok === 'string' ? ok : "Le serveur n'a pas validé ce tracé. Réessaie."
      sound.sfx('error')
      return
    }
    if (solved.value) return
  }
  solved.value = true
  elapsed.value = Date.now() - startedAt
  clearInterval(clock)
  revealScenery()
  emit('solved', elapsed.value)
}
// La voie prend l'allure de l'environnement : traverses grises sous la neige, acier plus sombre en forêt…
const railStyle = computed(() => (scenery.value ? { '--won-rail': PAL[scenery.value.theme].rail.rail, '--won-tie': PAL[scenery.value.theme].rail.tie } : {}))
// Marges de paysage autour de la grille : le décor couvre TOUT l'écran (toute la largeur, du haut au bas de l'écran), sur tous les appareils.
// La grille telle qu'elle est posée au Plateau : à la victoire elle rétrécit et glisse (transform), ce qui fausserait la mesure
// si le décor devait être refait pendant le Trajet (rotation de l'écran). On coupe donc le transform le temps de mesurer.
function boardRect(): DOMRect | undefined {
  const el = boardEl.value
  if (!el) return undefined
  const { transform, transition } = el.style
  el.style.transition = 'none'
  el.style.transform = 'none'
  const r = el.getBoundingClientRect()
  el.style.transform = transform
  void el.offsetWidth // applique la mesure avant de rendre la transition
  el.style.transition = transition
  return r
}
const isLandscape = (): boolean => window.innerWidth >= window.innerHeight
let sceneLandscape = isLandscape() // forme d'écran pour laquelle le décor a été généré
function sceneryMargins(): { x: number; y: number; top?: number; below?: number; dy?: number } {
  const n = puz.value.size
  const y = sceneryMargin(n)
  const rect = boardRect()
  if (!rect || !(rect.width > 0)) return { x: y, y }
  const k = n / (n + 2 * y) // échelle de la grille à la victoire (voir buildScenery)
  const cell = rect.width / (n + 1) // taille d'une case à l'écran avant le rétrécissement (px)
  const unit = cell * k // une case du décor à l'écran, après le rétrécissement (px)
  // La grille n'est pas toujours au milieu de l'écran (en paysage, les bonus sont à sa droite) : le décor doit couvrir le côté le plus éloigné.
  const cx = rect.left + cell + (n / 2) * cell // les indices sont à gauche et en haut : les cases commencent une case plus loin
  const farthest = Math.max(cx, window.innerWidth - cx) // distance du centre des cases au bord de l'écran le plus loin (px)
  const x = Math.min(40, Math.max(y, Math.ceil(farthest / unit - n / 2) + 1))
  // La grille rétrécit autour du centre de sa zone de jeu (sans la rangée des indices) : on situe à l'écran le haut et le bas
  // du décor qu'on aurait sans complément. Le bas tombe pile sur le bas d'origine de la grille (rangée des indices comprise).
  // À la victoire la grille glisse aussi vers le milieu de l'écran (dy) : le paysage se calcule depuis sa place d'arrivée.
  const dy = Math.round(window.innerHeight / 2 - (rect.top + cell + (n / 2) * cell))
  const oy = rect.top + cell + dy + (n / 2) * cell
  const decorTop = oy - (y + n / 2) * unit
  const decorBottom = rect.bottom + dy
  // Le Trajet est un paysage plein écran : le décor monte jusqu'en haut de l'écran (la barre du haut, le bouton Quitter et les
  // réglages flottent par-dessus) et descend jusqu'en bas (la cabine, en fenêtre, se pose par-dessus).
  const top = Math.max(0, decorTop / unit + 0.05)
  const below = Math.max(0, (window.innerHeight - decorBottom) / unit + 0.05)
  return { x, y, top, below, dy }
}
function makeDecor(path: [number, number][], mg: ReturnType<typeof sceneryMargins>): { scenery: Scenery; route: Route } {
  const sc = buildScenery(puz.value, path, props.theme, seedOf(puz.value), mg)
  const horiz = (d: string) => d === 'left' || d === 'right'
  const sm = sc.margin // marges réelles (avec le complément du haut) : la voie va jusqu'au bord du décor
  const route = buildRoute(path, puz.value, { entry: horiz(puz.value.entry.dir) ? sm.x : puz.value.entry.dir === 'up' ? sm.y : sm.b, exit: horiz(puz.value.exit.dir) ? sm.x : puz.value.exit.dir === 'up' ? sm.y : sm.b })
  return { scenery: sc, route }
}
function buildDecor(path: [number, number][]): void {
  decorReady.value = false
  sceneLandscape = isLandscape()
  const mg = sceneryMargins()
  glideY.value = mg.dy ?? 0
  const p = prepared.value
  prepared.value = null
  clearPrepare()
  if (p && p.path === JSON.stringify(path) && p.landscape === sceneLandscape && covers(p.mg, mg)) {
    // le décor préparé pendant le Plateau : déjà construit et déjà dessiné une fois, il n'a plus qu'à apparaître (même composant)
    scenery.value = p.scenery
    sceneryRoute.value = p.route
    return
  }
  const d = makeDecor(path, mg)
  scenery.value = d.scenery
  decorId.value++
  sceneryRoute.value = d.route
}

// Décor préparé PENDANT le Plateau : la solution est unique, on connaît donc la voie avant que le joueur la trace. Le décor 3D est construit
// et dessiné une fois en cachette dès que le navigateur a un moment libre ; à la victoire, si la voie et la forme de l'écran sont les mêmes,
// il apparaît tout de suite : le premier passage du train ne paie plus la construction ni la compilation des shaders (sinon ça saccade).
type Margins = ReturnType<typeof sceneryMargins>
const prepared = ref<{ path: string; mg: Margins; landscape: boolean; scenery: Scenery; route: Route } | null>(null)
// Le décor préparé convient s'il couvre au moins l'écran voulu à la victoire. La grille peut bouger de quelques pixels entre la
// préparation et la victoire (un message, un bonus) : la marge sur les côtés change alors d'une case. On prépare donc une case de plus
// sur les côtés, et on accepte un décor un peu plus grand que nécessaire.
function covers(a: Margins, b: Margins): boolean {
  const near = (u = 0, v = 0) => u >= v - 0.05
  return a.y === b.y && a.x >= b.x && near(a.top, b.top) && near(a.below, b.below) && Math.abs((a.dy ?? 0) - (b.dy ?? 0)) <= 1
}
let prepTimer = 0
let prepIdle = 0
function clearPrepare(): void {
  clearTimeout(prepTimer)
  const cic = (window as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback
  if (prepIdle && cic) cic(prepIdle)
  prepTimer = prepIdle = 0
}
// `prepared` est émis quand le décor est prêt (dessiné une fois en cachette), ou tout de suite s'il ne peut pas l'être : l'écran
// de chargement l'attend (voir JourneyView), il ne doit jamais attendre pour rien.
function prepareDecor(): void {
  if (solved.value || scenery.value || prepared.value) return
  if (!use3d.value || !boardEl.value) return emit('prepared')
  const sol = solve(puz.value, 1).solutions[0]
  if (!sol) return emit('prepared')
  const need = sceneryMargins()
  const mg = { ...need, x: Math.min(40, need.x + 1) } // une case de plus sur les côtés (voir covers)
  const d = makeDecor(sol, mg)
  prepared.value = { path: JSON.stringify(sol), mg, landscape: isLandscape(), scenery: d.scenery, route: d.route }
}
function schedulePrepare(delay = 900): void {
  clearPrepare()
  if (solved.value || !use3d.value) return
  // un peu après l'arrivée du Plateau, au premier moment libre du navigateur (pas au milieu d'un geste)
  prepTimer = window.setTimeout(() => {
    const ric = (window as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback
    if (ric) prepIdle = ric(prepareDecor, { timeout: 2500 })
    else prepareDecor()
  }, delay)
}
// Rail révélé par une aide : la préparation est refaite. Écran tourné ou redimensionné : seulement si le décor attendu a changé
// (sur iPhone, Safari redimensionne la page quand ses barres se replient ; on ne reconstruit pas tout pour rien).
function redoPrepare(): void {
  if (solved.value) return
  prepared.value = null
  schedulePrepare(600)
}
let resizeTimer = 0
function onResizePrepare(): void {
  clearTimeout(resizeTimer)
  resizeTimer = window.setTimeout(() => {
    const p = prepared.value
    if (solved.value || (p && p.landscape === isLandscape() && covers(p.mg, sceneryMargins()))) return
    redoPrepare()
  }, 900)
}
watch(revealed, redoPrepare)
onMounted(() => {
  // sous l'écran de chargement (eager) : tout de suite, le joueur ne voit pas encore la grille ; sinon au premier moment libre
  if (props.eager) void nextTick(prepareDecor)
  else schedulePrepare()
  window.addEventListener('resize', onResizePrepare)
})
onUnmounted(() => {
  clearPrepare()
  clearTimeout(resizeTimer)
  window.removeEventListener('resize', onResizePrepare)
})
function revealScenery(): void {
  const path = tracePath(connections.value, puz.value)
  if (!path) {
    trainDone.value = true
    return
  }
  // Une victoire ne garde que la voie : les rails ou liaisons posés à côté (marques d'essai) disparaissent, sinon
  // ils resteraient visibles sur le décor.
  const keep = new Set<string>(lockedEdges(puz.value))
  for (let i = 1; i < path.length; i++) {
    const k = edgeKey(path[i - 1][0], path[i - 1][1], path[i][0], path[i][1])
    if (k) keep.add(k)
  }
  connections.value = keep
  rails.value = new Set()
  crosses.value = new Set()
  buildDecor(path)
  if (scenery.value) sound.reveal(scenery.value)
  if (timing.revealMs > 0) trainTimer = window.setTimeout(runTrain, timing.revealMs)
  else runTrain()
}
function replayTrain(): void {
  trainDone.value = false
  route.value = null
  // Écran tourné depuis la victoire : le décor est refait pour la nouvelle forme (pendant un trajet on garde celle de départ).
  if (scenery.value && sceneLandscape !== isLandscape()) {
    const path = tracePath(connections.value, puz.value)
    if (path) buildDecor(path)
  }
  void nextTick(runTrain)
}
function runTrain(): void {
  const path = tracePath(connections.value, puz.value)
  if (!path) {
    trainDone.value = true
    return
  }
  trainS.value = -1
  sound.trainStart()
  const sc = scenery.value
  if (sc) {
    // Le train vit DANS le décor : il y entre et en sort par ses bords, où il disparaît (voir `trainClip`). Il ne roule
    // donc jamais sur le récapitulatif, les pouvoirs ni le bouton Suivant. La voie dépasse le bord de la longueur du train.
    const below = sc.frame.visibleRows - sc.margin.y - puz.value.size // cases de décor visibles sous la grille
    const lead = (dir: string) => (dir === 'left' || dir === 'right' ? sc.margin.x : dir === 'up' ? sc.margin.y : below) + TRAIN_LENGTH + 1
    route.value = buildRoute(path, puz.value, { entry: lead(puz.value.entry.dir), exit: lead(puz.value.exit.dir) })
    return
  }
  // Pas de décor (cas limite) : la voie est prolongée jusqu'au bord de l'ÉCRAN.
  const rect = boardEl.value?.getBoundingClientRect() ?? { left: 0, top: 0, width: 0 }
  const vp = { width: window.innerWidth, height: window.innerHeight }
  route.value = buildRoute(path, puz.value, {
    entry: leadCells(puz.value.entry.dir, rect, puz.value.size, vp),
    exit: leadCells(puz.value.exit.dir, rect, puz.value.size, vp),
  })
}

// --- Historique (annuler / rétablir) ---
interface Snap {
  conn: string[]
  crs: string[]
  rls: string[]
}
const history: Snap[] = [{ conn: [...connections.value].sort(), crs: [], rls: [] }]
let hIndex = 0
const canUndo = ref(false)
const canRedo = ref(false)

function snapshot(): Snap {
  return {
    conn: [...connections.value].sort(),
    crs: [...crosses.value].sort(),
    rls: [...rails.value].sort(),
  }
}
function sameSnap(a: Snap, b: Snap): boolean {
  return (
    a.conn.join(',') === b.conn.join(',') &&
    a.crs.join(',') === b.crs.join(',') &&
    a.rls.join(',') === b.rls.join(',')
  )
}
function updateFlags(): void {
  canUndo.value = hIndex > 0
  canRedo.value = hIndex < history.length - 1
}
function commit(): void {
  const snap = snapshot()
  if (sameSnap(snap, history[hIndex])) return
  history.splice(hIndex + 1)
  history.push(snap)
  hIndex = history.length - 1
  updateFlags()
  checkWin()
}
function restore(snap: Snap): void {
  connections.value = new Set([...snap.conn, ...lockedEdges(puz.value)]) // les rails révélés ne s'annulent pas
  crosses.value = new Set(snap.crs)
  rails.value = new Set(snap.rls)
}
function undo(): void {
  touch()
  if (!solved.value && hIndex > 0) {
    hIndex--
    restore(history[hIndex])
    updateFlags()
  }
}
function redo(): void {
  touch()
  if (!solved.value && hIndex < history.length - 1) {
    hIndex++
    restore(history[hIndex])
    updateFlags()
  }
}
// Effacer tout se confirme : le premier toucher arme le bouton (rouge, « Toucher encore »), le second efface. Sans second
// toucher dans les 3 s, rien ne se passe.
const clearArmed = ref(false)
let clearTimer = 0
function askClear(): void {
  if (solved.value) return
  if (clearArmed.value) {
    clearTimeout(clearTimer)
    clearArmed.value = false
    clearAll()
    return
  }
  clearArmed.value = true
  clearTimer = window.setTimeout(() => (clearArmed.value = false), 3000)
}
function clearAll(): void {
  if (solved.value) return
  touch()
  sound.sfx('clear')
  connections.value = new Set(lockedEdges(puz.value)) // les rails imposés restent
  crosses.value = new Set()
  rails.value = new Set()
  commit()
}

// --- Glisser pour tracer / effacer, tap pour effacer une case ---
const LONG_PRESS_MS = 450
let mode: DragMode | null = null
let last: [number, number] | null = null
let down: [number, number] | null = null
let active = false
let moved = false
let longFired = false
let longFiredAt = 0 // sur mobile, l'appui long envoie AUSSI `contextmenu` : à ignorer
let longPress = 0

function step(r: number, c: number): void {
  if (!active || !last) return
  const [lr, lc] = last
  if (lr === r && lc === c) return
  cancelLongPress()
  moved = true
  const before = connections.value.size
  mode = dragStep(connections.value, mode, lr, lc, r, c, puz.value)
  if (connections.value.size > before) sound.pose() // un rail s'emboîte
  last = [r, c]
}

// Réflexion : si rien ne bouge sur la grille pendant 20 s, une note douce accompagne le joueur (director.think).
let lastActivity = Date.now()
let thinkTimer = 0
const touch = () => { lastActivity = Date.now(); sound.activity() }
function onDown(ev: PointerEvent, r: number, c: number): void {
  touch()
  if (props.picking) {
    // Une aide attend une case : on la renvoie, sans rien tracer.
    if (!(ev.button > 0) && !solved.value && !verifying.value) emit('pick', r, c)
    return
  }
  // Seul le bouton principal trace. Le clic droit / tap à deux doigts ne fait
  // que poser une croix (via contextmenu), sans passer pour un clic normal.
  if (ev.button > 0) return
  if (solved.value || verifying.value) return
  if (props.locked) return sound.sfx('error')
  startClock()
  active = true
  moved = false
  longFired = false
  mode = null
  last = [r, c]
  down = [r, c]
  startLongPress(r, c)
}

function onEnter(r: number, c: number): void {
  touch()
  step(r, c)
}

function onMove(ev: PointerEvent): void {
  if (!active) return
  const el = document.elementFromPoint(ev.clientX, ev.clientY)
  const cell = el?.closest<HTMLElement>('[data-r]')
  if (!cell) return
  step(Number(cell.dataset.r), Number(cell.dataset.c))
}

function onUp(): void {
  cancelLongPress()
  if (!longFired) {
    if (moved) {
      commit() // fin d'un glisser
    } else if (down) {
      // Tap sans glisser : bascule rail ⇄ vide (marquer / effacer une case).
      const marks = rails.value.size + connections.value.size
      tapCell(rails.value, connections.value, crosses.value, puz.value, down[0], down[1])
      if (rails.value.size + connections.value.size > marks) sound.pose()
      commit()
    }
  }
  active = false
  mode = null
  last = null
  down = null
}

function onContext(r: number, c: number): void {
  if (props.locked) return
  if (Date.now() - longFiredAt < 1500) return // déjà traité par l'appui long
  onCross(r, c)
}

function onCancel(): void {
  // Geste interrompu par le système (balayage de bord, appel...) : rien ne doit rester « en cours ».
  cancelLongPress()
  if (moved && !longFired) commit()
  active = false
  mode = null
  last = null
  down = null
}

function onCross(r: number, c: number): void {
  if (solved.value || verifying.value) return
  startClock()
  toggleCross(crosses.value, connections.value, rails.value, puz.value, r, c)
  commit()
}

function startLongPress(r: number, c: number): void {
  cancelLongPress()
  longPress = window.setTimeout(() => {
    longFired = true
    longFiredAt = Date.now()
    active = false
    onCross(r, c)
  }, LONG_PRESS_MS)
}
function cancelLongPress(): void {
  if (longPress) {
    clearTimeout(longPress)
    longPress = 0
  }
}

function onKey(ev: KeyboardEvent): void {
  if (!(ev.ctrlKey || ev.metaKey)) return
  const k = ev.key.toLowerCase()
  if (k === 'z' && !ev.shiftKey) {
    ev.preventDefault()
    undo()
  } else if ((k === 'z' && ev.shiftKey) || k === 'y') {
    ev.preventDefault()
    redo()
  }
}

onMounted(() => {
  thinkTimer = window.setInterval(() => { if (!solved.value && !verifying.value && Date.now() - lastActivity > 20000) sound.think() }, 1000)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onCancel)
  window.addEventListener('keydown', onKey)
})
onUnmounted(() => {
  clearInterval(thinkTimer)
  sound.reset()
  clearTimeout(trainTimer)
  clearInterval(clock)
  window.removeEventListener('pointerup', onUp)
  window.removeEventListener('pointercancel', onCancel)
  window.removeEventListener('keydown', onKey)
})

// --- Aides : rails et croix révélés par le serveur ---
function reveal(givens: Given[], crossCells: { row: number; col: number }[]): void {
  for (const g of givens) {
    if (revealed.value.some((x) => x.row === g.row && x.col === g.col)) continue
    revealed.value = [...revealed.value, g]
    const key = cellKey(g.row, g.col)
    rails.value.delete(key)
    crosses.value.delete(key)
    // aucune autre liaison ne peut toucher une case imposée
    const locked = lockedEdges(puz.value)
    for (const e of incidentEdges(puz.value.size, g.row, g.col)) if (!locked.has(e)) connections.value.delete(e)
    for (const e of locked) connections.value.add(e)
  }
  for (const c of crossCells) {
    const key = cellKey(c.row, c.col)
    if (isRail(connections.value, rails.value, puz.value, c.row, c.col)) {
      rails.value.delete(key)
      for (const e of incidentEdges(puz.value.size, c.row, c.col)) if (!lockedEdges(puz.value).has(e)) connections.value.delete(e)
    }
    crosses.value.add(key)
  }
  connections.value = new Set(connections.value) // déclenche l'affichage
  rails.value = new Set(rails.value)
  crosses.value = new Set(crosses.value)
  commit()
}
// Ce que le serveur doit connaître pour le canon : liaisons tracées et croix posées.
function snapshotForAid(): { edges: string[]; crosses: string[]; marks: number } {
  const edges = edgesInGrid(connections.value, puz.value.size)
  const fixed = lockedEdges(puz.value)
  // marks : ce que le joueur a posé lui-même (ni rails imposés, ni rails révélés).
  return { edges, crosses: [...crosses.value], marks: edges.filter((e) => !fixed.has(e)).length + crosses.value.size }
}
defineExpose({ reveal, snapshotForAid, replayTrain })
onMounted(() => {
  if (props.initial && (props.initial.givens.length || props.initial.crosses.length)) reveal(props.initial.givens, props.initial.crosses)
})
</script>

<template>
  <div class="track">
    <div class="toolbar" :class="{ gone: solved }" :aria-hidden="solved">
      <template v-if="!solved">
        <button type="button" class="btn btn--ghost tool" data-test="undo" @click="undo" :disabled="!canUndo" aria-label="Annuler" title="Annuler (Ctrl+Z)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" /></svg>
        </button>
        <button type="button" class="btn btn--ghost tool" data-test="redo" @click="redo" :disabled="!canRedo" aria-label="Rétablir" title="Rétablir (Ctrl+Maj+Z)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3" /></svg>
        </button>
        <button type="button" class="btn btn--ghost tool clear" :class="{ armed: clearArmed }" data-test="clear" @click="askClear" :aria-label="clearArmed ? 'Toucher encore pour tout effacer' : 'Effacer tout'" :title="clearArmed ? 'Toucher encore pour tout effacer' : 'Effacer tout'">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
        </button>
      </template>
      <!-- Minuteur et son : dans la barre du haut de l'écran quand la page en prévoit une (`hud`), séparés des outils de tracé ;
           sinon ici, à la suite des outils. Fin de partie : la vitesse et le son passent en haut à droite (voir plus bas). -->
      <Teleport :to="hud?.timer" :disabled="!hud" defer>
        <span v-if="!solved" class="timer" data-test="timer">⏱ {{ fmt(elapsed) }}</span>
      </Teleport>
      <Teleport :to="hud?.sound" :disabled="!hud" defer>
        <button v-if="!solved || !hud" type="button" class="btn btn--ghost tool sound" data-test="sound" :aria-pressed="soundOn" :aria-label="soundOn ? 'Couper le son' : 'Activer le son'" :title="soundOn ? 'Couper le son' : 'Activer le son'" @click="sound.setOn(!soundOn)">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 9v6h4l5 4V5L8 9z" />
            <path v-if="soundOn" d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />
            <path v-else d="m17 9 4 6M21 9l-4 6" />
          </svg>
        </button>
      </Teleport>
    </div>

    <SpeedControl v-if="solved" v-model="speed" />
    <!-- Trajet : la barre d'outils part, mais le son reste réglable (à gauche de la vitesse, en haut à droite) -->
    <button v-if="solved" type="button" class="trip-sound" data-test="trip-sound" :aria-pressed="soundOn" :aria-label="soundOn ? 'Couper le son' : 'Activer le son'" :title="soundOn ? 'Couper le son' : 'Activer le son'" @click="sound.setOn(!soundOn)">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 9v6h4l5 4V5L8 9z" />
        <path v-if="soundOn" d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />
        <path v-else d="m17 9 4 6M21 9l-4 6" />
      </svg>
    </button>

    <!-- Bande « partie » (entre les outils et la grille en paysage, au-dessus de la grille en portrait) : la nouveauté du niveau
         en haut, la vérification et l'erreur du serveur en bas. Elle ne recouvre jamais la grille. -->
    <div class="side" :class="{ gone: solved }" data-test="side">
      <slot name="intro" />
      <div v-if="verifying || verifyError" class="side-msg" :class="{ err: !!verifyError }" role="status">
        <p v-if="verifying" class="wait" data-test="verifying">Vérification par le serveur…</p>
        <template v-else>
          <p class="wait err" data-test="verify-error">{{ verifyError }}</p>
          <span class="kept">Ton tracé est gardé.</span>
          <button type="button" class="btn btn--small retry" data-test="retry" @click="checkWin">Réessayer</button>
        </template>
      </div>
    </div>

    <div
      ref="boardEl"
      class="board"
      :class="{ picking, 'board--won': scenery, 'rails-3d': railsGone }"
      :style="{ '--size': puzzle.size, '--k': scenery ? scenery.frame.k : 1, '--dy': glideY + 'px', ...railStyle }"
      role="grid"
      aria-label="Grille de jeu"
      @pointermove="onMove"
    >
      <!-- Décor : en 3D si le joueur le veut et que l'appareil sait le faire ; sinon (ou en cas d'échec) le décor classique en SVG. -->
      <Transition name="decor">
        <Scenery3D
          v-if="(scenery || prepared) && use3d"
          :key="'3d-' + decorId"
          :scenery="scenery ?? prepared!.scenery"
          :route="scenery ? sceneryRoute : prepared!.route"
          :held="!scenery"
          :train="route && trainS >= 0 ? { route, s: trainS } : null"
          :life="life"
          @fail="(failed3d = true), emit('prepared')"
          @ready="decorReady = true"
          @warm="emit('prepared')"
        />
        <SceneryLayer v-else-if="scenery" :scenery="scenery" :route="sceneryRoute" />
      </Transition>

      <template v-for="r in indices" :key="'row-' + r">
        <TrackCell
          v-for="c in indices"
          :key="'cell-' + r + '-' + c"
          :data-r="r"
          :data-c="c"
          :style="{ gridRow: r + 2, gridColumn: c + 2 }"
          :mark="markOf(r, c)"
          :sides="sidesGrid[r][c]"
          :variant="variantOf(r, c)"
          @pointerdown="onDown($event, r, c)"
          @pointerenter="onEnter(r, c)"
          @contextmenu.prevent="onContext(r, c)"
        />

        <ClueNumber
          :style="{ gridRow: r + 2, gridColumn: 1 }"
          :value="puzzle.rowClues[r]"
          :status="statuses.rows[r]"
          :pickable="pickingLine && !solved"
          @pick="emit('pickLine', 'row', r)"
          orientation="row"
        />
      </template>

      <ClueNumber
        v-for="c in indices"
        :key="'col-' + c"
        :style="{ gridRow: 1, gridColumn: c + 2 }"
        :value="puzzle.colClues[c]"
        :status="statuses.cols[c]"
        :pickable="pickingLine && !solved"
        @pick="emit('pickLine', 'col', c)"
        orientation="col"
      />

      <div class="corner" style="grid-row: 1; grid-column: 1"></div>

      <SceneryLife v-if="scenery" :key="'life-' + decorId" :scenery="scenery" :train-near="trainNear" :start="!use3d || decorReady" :in3d="use3d" @frame="(f) => (life = f)" />

      <TrainRun v-if="route" :ghost="train3d" :route="route" :size="puzzle.size" :clip="trainClip" :speed="SPEEDS[speed]" @progress="onTrainProgress" @done="trainDone = true" />
    </div>


    <!-- La victoire s'affiche par-dessus le décor (position absolue) : elle ne pousse rien. -->
    <div class="win-zone win-zone--compact" :class="{ on: solved }">
      <div v-if="solved && finished && !props.externalRecap" class="finish finish--inline" data-test="finish">
        <div class="head">
          <p class="win" data-test="win">Niveau terminé</p>
          <p class="time" data-test="result-time"><span>Temps</span> {{ fmt(officialMs ?? elapsed) }}</p>
        </div>
        <slot name="win" :ready="true" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.track {
  position: relative; /* le récapitulatif de victoire se pose sur le décor, en bas */
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(0.5rem, 2vmin, 0.9rem);
}

.toolbar {
  position: relative;
  z-index: 6; /* au-dessus du décor, qui monte jusqu'en haut de l'écran sur téléphone et tablette */
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: center;
}

/* Trajet : bouton son flottant, même allure que la vitesse (pastille blanche), juste à sa gauche */
.trip-sound {
  position: fixed;
  top: max(0.75rem, env(safe-area-inset-top));
  right: calc(max(0.75rem, env(safe-area-inset-right)) + 6.5rem);
  z-index: 9;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.7rem;
  height: 2.7rem;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  color: #1f2937;
  cursor: pointer;
}
.trip-sound svg {
  width: 1.3rem;
  height: 1.3rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.trip-sound[aria-pressed='false'] {
  color: #9ca3af;
}
/* Trajet en 3D : la voie de la grille est peinte dans la scène (sous le train), celle des cases s'efface */
.board.rails-3d :deep(.rail) {
  visibility: hidden;
}
.toolbar.gone {
  visibility: hidden; /* Trajet : plus d'outils sur le paysage (la place reste réservée, rien ne saute) */
}
.tool {
  width: 2.6rem;
  height: 2.6rem;
  padding: 0;
}
.tool svg {
  width: 1.3rem;
  height: 1.3rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.ghost {
  visibility: hidden; /* garde la place : les boutons de la barre ne se décalent pas quand le jeu passe en fin de partie */
}
.tool.on {
  background: #dbeafe;
}
.toolbar .clear:hover:not(:disabled) {
  color: #dc2626;
}
.toolbar .clear.armed {
  background: #dc2626;
  border-color: #dc2626;
  color: #fff;
}

.tool.on {
  border-color: #2563eb;
  color: #1d4ed8;
}
.timer {
  align-self: center;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  padding: 0.25rem 0.7rem;
  border: 2px solid #fff;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92); /* lisible sur le décor */
  box-shadow: var(--shadow);
  font-variant-numeric: tabular-nums;
  color: #4b5563;
}
.win-zone.win-zone--compact {
  /* Le récapitulatif se pose SUR l'écran du train (le décor), en bas : plus de place réservée sous la grille, la cabine remonte. */
  position: absolute;
  left: 50%;
  bottom: 0.6rem;
  transform: translateX(-50%);
  z-index: 6; /* au-dessus du décor (.board : 5) ; il n'apparaît qu'une fois le train arrivé */
  display: grid;
  place-items: end center;
  width: 100%;
  min-height: 0;
  pointer-events: none; /* le décor reste visible et cliquable tout autour de la carte */
}
.win-zone.win-zone--compact > * {
  pointer-events: auto;
}
.win-zone.win-zone--compact > * {
  grid-area: 1 / 1;
}
.win-zone {
  min-height: 2.6rem; /* message de vérification : place réservée pour ne pas faire sauter la page */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 0.6rem;
}
/* « Réduire les animations » : pas de glissement ni de rétrécissement, le paysage apparaît en fondu. */
@media (prefers-reduced-motion: reduce) {
  .board {
    transition: none;
  }
  .decor-enter-active {
    transition: opacity 0.6s ease;
  }
  .decor-enter-from {
    opacity: 0;
  }
}
@keyframes win-in {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
}
.finish {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  background: rgba(255, 255, 255, 0.94);
}
.finish--inline {
  position: static;
  transform: none;
  z-index: auto;
  max-width: 100%;
  width: min(92vw, 420px);
  gap: 0.2rem;
  padding: 0.5rem 0.8rem 0.6rem;
  border-radius: 16px;
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.16);
  animation: win-in 0.4s ease both;
}
.finish--inline .head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.8rem;
  width: 100%;
}
.finish--inline .win {
  font-size: 0.95rem;
}
.finish--inline .time {
  font-size: 1rem;
}
.finish--inline :deep(.receipt) {
  display: flex;
  justify-content: space-between;
  gap: 0.6rem;
  width: 100%;
  padding-top: 0;
}
.finish--inline :deep(.receipt .row) {
  flex: none;
  gap: 0.3rem;
  font-size: 0.8rem;
}
.finish--inline :deep(.receipt .total) {
  font-size: 0.85rem;
}
.finish--inline :deep(.receipt .fill),
.finish--inline :deep(.receipt .rule) {
  display: none;
}
.finish--inline :deep(.btn--big) {
  font-size: 1rem;
  padding: 0.45em 1.8em;
  margin-top: 0.15rem;
}
.finish .time span {
  font-size: 0.85rem;
  font-weight: 600;
  color: #6b7280;
  margin-right: 0.25rem;
}
.finish .time {
  font-size: 1.4rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: #1f2937;
}
.wait {
  font-weight: 700;
  color: #374151;
  padding: 0.2rem 0.8rem;
  border-radius: 12px;
  background: #fff;
  text-align: center;
}
.wait.err {
  color: #b91c1c;
}
.win {
  font-weight: 800;
  color: #15803d;
  text-shadow: 0 0 6px #fff, 0 0 12px #fff;
}

/* Victoire : la grille se dénude, le paysage apparaît dessous, les rails prennent leur look de vraie voie. */
.board--won :deep(.cell) {
  background: transparent;
  border-color: transparent;
  cursor: default;
  transition: background 1.6s ease, border-color 1.6s ease;
}
.board--won :deep(.clue) {
  opacity: 0;
  transition: opacity 1.4s ease;
}
.board--won :deep(.cell--cross > *),
.board--won :deep(.rock) {
  opacity: 0;
}
.board--won :deep(.rail) {
  --rail-color: var(--won-rail, #475569);
  --tie-color: var(--won-tie, #7a4e2d);
}
.board.picking {
  cursor: crosshair;
}
.board {
  position: relative;
  z-index: 5; /* le train passe AU-DESSUS du bravo et du bouton */
  --track: calc(var(--size) + 1);

  display: grid;
  grid-template-columns: repeat(var(--track), 1fr);
  grid-auto-rows: 1fr;

  /* Taille du Plateau : la grille (compteurs compris) prend presque tout l'écran, ni cabine ni paysage autour. Portrait : limitée par la
     largeur, et par la hauteur moins la barre du haut, les outils et les bonus. Paysage : limitée par la hauteur, les bonus sont à droite. */
  --shift: calc(-100% / (var(--size) + 1) / 2);
  --w: min(calc((100vw - 1rem) * (var(--size) + 1) / (var(--size) + 2)), calc(100dvh - 18.5rem), 780px);
  width: var(--w);
  aspect-ratio: 1;
  /* Les compteurs sont à gauche et en haut : on décale VERS LA GAUCHE d'une demi-colonne pour
     que les CASES (pas la grille + compteurs) soient centrées sur la page. */
  /* À la victoire, la grille rétrécit au centre d'un paysage plus grand (--k < 1) : le décor déborde autour. */
  transform: translate(var(--shift), var(--dy, 0px)) scale(var(--k, 1));
  transform-origin: calc(100% * (1 + var(--size) / 2) / (var(--size) + 1)) calc(100% * (1 + var(--size) / 2) / (var(--size) + 1));
  transition: transform 1.8s ease-in-out;

  /* Le glisser doit dessiner, pas faire défiler / sélectionner. */
  touch-action: none;
  user-select: none;
}

.board > * {
  aspect-ratio: 1;
}

.corner {
  background: transparent;
}

/* Bande « partie » : portrait, au-dessus de la grille ; paysage, une colonne entre les outils et la grille (voir plus bas). */
.side {
  position: relative;
  z-index: 6;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  width: min(92vw, 30rem);
}
.side:empty {
  display: none;
}
.side.gone {
  visibility: hidden;
}
.side-msg {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.4rem;
  width: 100%;
  box-sizing: border-box;
  padding: 0.6rem 0.75rem;
  border-radius: 14px;
  background: #fff;
  box-shadow: var(--shadow);
  font-size: 0.88rem;
  line-height: 1.3;
}
.side-msg.err {
  background: #fef2f2;
  border: 2px solid #fca5a5;
  color: #7f1d1d;
}
.side-msg .wait {
  margin: 0;
  font-weight: 700;
}
.side-msg .kept {
  font-size: 0.82rem;
}
.side-msg .retry {
  background: #dc2626;
  border-color: #dc2626;
  color: #fff;
}
/* Paysage (option A) : les outils forment une colonne à gauche de la grille, en miroir des pouvoirs à droite ; annuler et
   rétablir en haut, effacer en bas, à l'écart. */
@media (min-aspect-ratio: 1/1) {
  .track {
    flex-direction: row;
    align-items: flex-start;
    gap: 1.25rem;
  }
  .toolbar {
    flex-direction: column;
    flex-wrap: nowrap;
    justify-content: flex-start;
    align-self: stretch;
    padding: 0.6rem 0.45rem;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.75);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
  }
  .toolbar .clear {
    margin-top: auto;
  }
  /* bande « partie » : aussi haute que la grille, la nouveauté en haut, les messages du serveur en bas */
  .side {
    width: var(--band, 12rem);
    align-self: stretch;
    justify-content: space-between;
  }
  .side:not(:empty) {
    display: flex;
  }
  .tool {
    width: 2.9rem;
    height: 2.9rem;
  }
}
@media (min-aspect-ratio: 1/1) {
  .board {
    --shift: 0px; /* les bonus sont à droite : la grille et ses compteurs restent groupés */
    --w: min(calc(100dvh - 11rem), 62vw, 820px);
  }
}

/* Téléphone couché (peu de hauteur) : la grille prend toute la hauteur, les outils passent en colonne sur le bord gauche. */
@media (min-aspect-ratio: 1/1) and (max-height: 560px) {
  .board {
    --w: calc(100dvh - 4.1rem - env(safe-area-inset-top) - env(safe-area-inset-bottom)); /* sous la barre du haut, qui flotte (JourneyView) */
  }
  .toolbar {
    position: fixed;
    left: max(0.75rem, env(safe-area-inset-left)); /* hors de l'encoche */
    top: calc(4.25rem + env(safe-area-inset-top)); /* sous Quitter */
    bottom: max(0.75rem, env(safe-area-inset-bottom));
    flex-direction: column;
    flex-wrap: nowrap;
    align-items: center;
  }
  .win-zone {
    min-height: 0;
  }
}
</style>
