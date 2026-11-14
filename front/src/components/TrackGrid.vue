<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
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
import { decorMode, webglAvailable } from '../decor'
import SceneryLife from './SceneryLife.vue'
import type { LandFrame } from '../scenery/motion'
import { sound, soundOn } from '../sound/director'
import TrackCell from './TrackCell.vue'
import ClueNumber from './ClueNumber.vue'

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
  validate?: (ms: number, edges: string[]) => Promise<boolean>
  // Vrai : le récapitulatif de victoire n'est pas dessiné ici, l'écran de jeu l'affiche ailleurs (store de la cabine).
  externalRecap?: boolean
}>()
const emit = defineEmits<{ (e: 'solved', ms: number): void; (e: 'pick', row: number, col: number): void; (e: 'begin'): void; (e: 'finish'): void; (e: 'train', running: boolean): void; (e: 'progress', s: number): void; (e: 'scene', v: { route: Route; scenery: Scenery; rails: Route | null } | null): void; (e: 'land', f: LandFrame): void }>()

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
const failed3d = ref(false) // le décor 3D n'a pas pu s'afficher : décor classique jusqu'à la fin de la visite
const use3d = computed(() => decorMode.value === '3d' && !failed3d.value && webglAvailable())
// Plateau incliné (décor 3D, après la victoire) : on fait glisser le décor pour le basculer (haut/bas) et le tourner (gauche/droite).
// Incliné, la grille (rails, indices, train, animaux) est cachée : ce sont les rails et le train 3D qu'on voit.
const tilt = ref(0) // degrés depuis la verticale
const yaw = ref(0)
const tilted = computed(() => use3d.value && !!scenery.value && tilt.value >= 1)
watch(scenery, () => {
  tilt.value = 0
  yaw.value = 0
})
let drag: { x: number; y: number; t: number; w: number } | null = null
let tween = 0
function tiltDown(ev: PointerEvent): void {
  cancelAnimationFrame(tween)
  drag = { x: ev.clientX, y: ev.clientY, t: tilt.value, w: yaw.value }
  ;(ev.currentTarget as Element).setPointerCapture?.(ev.pointerId)
}
function tiltMove(ev: PointerEvent): void {
  if (!drag) return
  tilt.value = Math.max(0, Math.min(65, drag.t + (ev.clientY - drag.y) * 0.35))
  yaw.value = Math.max(-80, Math.min(80, drag.w - (ev.clientX - drag.x) * 0.35))
}
function tiltUp(): void {
  drag = null
  if (tilt.value < 4) tiltTo(0) // presque à plat : on revient pile sur la grille
}
function tiltTo(t: number): void {
  cancelAnimationFrame(tween)
  const t0 = performance.now()
  const from = { t: tilt.value, w: yaw.value }
  const to = { t, w: t === 0 ? 0 : yaw.value }
  const step = (now: number) => {
    const k = Math.min(1, (now - t0) / 600)
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
    tilt.value = from.t + (to.t - from.t) * e
    yaw.value = from.w + (to.w - from.w) * e
    if (k < 1) tween = requestAnimationFrame(step)
  }
  tween = requestAnimationFrame(step)
}
const sceneryRoute = ref<Route | null>(null)
let trainTimer = 0
// Vrai quand l'animation du train est finie : c'est alors seulement qu'on propose la suite.
const trainDone = ref(false)
// Vitesse du train (cases/s) : tranquille pour apprécier le décor, et un bouton à côté de « Relancer » pour passer la cinématique.
const CRUISE_SPEED = 1.9
const FAST_SPEED = 7.6
const fast = ref(false)
watch(trainDone, (v) => v && (fast.value = false)) // la prochaine fois, on repart tranquillement
// Sons : la fin du trajet laisse la place au décor ; la barrière du passage à niveau a ses propres sons.
watch(trainDone, (v) => v && sound.trainEnd())
// L'écran de jeu suit le train (vue de la cabine) : il roule dès que sa route existe, jusqu'à son arrivée.
watch([route, trainDone], () => emit('train', !!route.value && !trainDone.value))
// ... et la cabine montre la VRAIE carte vue du train : elle reçoit le trajet, le décor et la position de la locomotive.
watch([route, scenery], () => emit('scene', route.value && scenery.value ? { route: route.value, scenery: scenery.value, rails: sceneryRoute.value } : null))
function onTrainProgress(s: number): void {
  trainS.value = s
  emit('progress', s)
}

// Zone où le train est visible : exactement celle du décor (en cases de la grille de jeu).
const trainClip = computed(() => {
  const sc = scenery.value
  return sc ? { x: -sc.margin.x, y: -sc.margin.y, w: sc.cols, h: sc.frame.visibleRows } : undefined
})

// Position de la locomotive sur son trajet : les barrières du passage à niveau se baissent quand elle approche.
const trainS = ref(-1)
const TRAIN_LENGTH = 2.4
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
watch(trainDone, (v) => {
  if (v && !finished.value) {
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
    let ok = false
    try {
      ok = await props.validate(ms, [...connections.value])
    } catch {
      ok = false
    }
    verifying.value = false
    if (!ok) {
      verifyError.value = "Le serveur n'a pas validé ce tracé. Vérifie ta connexion, puis réessaie."
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
// Marges de paysage autour de la grille : en hauteur, de quoi faire ~10 cases ; en largeur, de quoi couvrir tout l'écran
// (sinon le train roulerait dans du blanc de part et d'autre du décor).
function sceneryMargins(): { x: number; y: number } {
  const n = puz.value.size
  const y = sceneryMargin(n)
  const rect = boardEl.value?.getBoundingClientRect()
  if (!rect || !(rect.width > 0)) return { x: y, y }
  const cell = rect.width / (n + 1) // taille d'une case à l'écran avant le rétrécissement (px)
  const visible = window.innerWidth / (cell * (n / (n + 2 * y))) // cases de décor qu'il faut pour couvrir la largeur
  return { x: Math.min(28, Math.max(y, Math.ceil((visible - n) / 2) + 1)), y }
}
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
  const mg = sceneryMargins()
  scenery.value = buildScenery(puz.value, path, props.theme, seedOf(puz.value), mg)
  sound.reveal(scenery.value)
  const horiz = (d: string) => d === 'left' || d === 'right'
  sceneryRoute.value = buildRoute(path, puz.value, { entry: horiz(puz.value.entry.dir) ? mg.x : mg.y, exit: horiz(puz.value.exit.dir) ? mg.x : mg.y })
  if (timing.revealMs > 0) trainTimer = window.setTimeout(runTrain, timing.revealMs)
  else runTrain()
}
function replayTrain(): void {
  trainDone.value = false
  route.value = null
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
  const edges = [...connections.value].filter((e) => /^[hv]:/.test(e))
  const fixed = lockedEdges(puz.value)
  // marks : ce que le joueur a posé lui-même (ni rails imposés, ni rails révélés).
  return { edges, crosses: [...crosses.value], marks: edges.filter((e) => !fixed.has(e)).length + crosses.value.size }
}
defineExpose({ reveal, snapshotForAid })
onMounted(() => {
  if (props.initial && (props.initial.givens.length || props.initial.crosses.length)) reveal(props.initial.givens, props.initial.crosses)
})
</script>

<template>
  <div class="track">
    <div class="toolbar">
      <template v-if="!solved">
        <button type="button" class="btn btn--ghost tool" data-test="undo" @click="undo" :disabled="!canUndo" aria-label="Annuler" title="Annuler (Ctrl+Z)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" /></svg>
        </button>
        <button type="button" class="btn btn--ghost tool" data-test="redo" @click="redo" :disabled="!canRedo" aria-label="Rétablir" title="Rétablir (Ctrl+Maj+Z)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3" /></svg>
        </button>
        <button type="button" class="btn btn--ghost tool clear" @click="clearAll" aria-label="Effacer tout" title="Effacer tout">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
        </button>
      </template>
      <!-- fin de partie : revoir le train (les deux autres places restent vides : rien ne bouge) -->
      <template v-else>
        <button type="button" class="btn btn--ghost tool" data-test="replay" @click="replayTrain" :disabled="!trainDone" aria-label="Relancer le train" title="Relancer le train">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16l13-8z" /></svg>
        </button>
        <button type="button" class="btn btn--ghost tool" :class="{ on: fast }" data-test="fast" :disabled="trainDone" :aria-pressed="fast" aria-label="Accélérer le train" :title="fast ? 'Vitesse normale' : 'Accélérer le train'" @click="fast = !fast">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5v14l8-7zM12 5v14l8-7z" /></svg>
        </button>
      </template>
      <span v-if="solved" class="tool ghost" aria-hidden="true"></span>
      <button type="button" class="btn btn--ghost tool sound" data-test="sound" :aria-pressed="soundOn" :aria-label="soundOn ? 'Couper le son' : 'Activer le son'" :title="soundOn ? 'Couper le son' : 'Activer le son'" @click="sound.setOn(!soundOn)">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 9v6h4l5 4V5L8 9z" />
          <path v-if="soundOn" d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />
          <path v-else d="m17 9 4 6M21 9l-4 6" />
        </svg>
      </button>
      <span class="timer" data-test="timer">⏱ {{ fmt(elapsed) }}</span>
    </div>

    <div
      ref="boardEl"
      class="board"
      :class="{ picking, 'board--won': scenery, 'board--tilted': tilted }"
      :style="{ '--size': puzzle.size, '--k': scenery ? scenery.frame.k : 1, ...railStyle }"
      role="grid"
      aria-label="Grille de jeu"
      @pointermove="onMove"
    >
      <!-- Décor : en 3D si le joueur le veut et que l'appareil sait le faire ; sinon (ou en cas d'échec) le décor classique en SVG. -->
      <Scenery3D v-if="scenery && use3d" :key="'3d-' + scenery.seed" :scenery="scenery" :route="sceneryRoute" :train-route="route" :train-s="trainS" :tilt="tilt" :yaw="yaw" @fail="failed3d = true" />
      <SceneryLayer v-else-if="scenery" :scenery="scenery" :route="sceneryRoute" />

      <template v-for="r in indices" :key="'row-' + r">
        <TrackCell
          v-for="c in indices"
          :key="'cell-' + r + '-' + c"
          :data-r="r"
          :data-c="c"
          :mark="markOf(r, c)"
          :sides="sidesGrid[r][c]"
          :variant="variantOf(r, c)"
          @pointerdown="onDown($event, r, c)"
          @pointerenter="onEnter(r, c)"
          @contextmenu.prevent="onContext(r, c)"
        />

        <ClueNumber
          :value="puzzle.rowClues[r]"
          :status="statuses.rows[r]"
          orientation="row"
        />
      </template>

      <ClueNumber
        v-for="c in indices"
        :key="'col-' + c"
        :value="puzzle.colClues[c]"
        :status="statuses.cols[c]"
        orientation="col"
      />

      <div class="corner"></div>

      <SceneryLife v-if="scenery" :scenery="scenery" :train-near="trainNear" @frame="emit('land', $event)" />

      <!-- décor 3D gagné : on le fait glisser pour l'incliner ; le bouton le bascule ou le remet à plat -->
      <div v-if="scenery && use3d" class="tilt-pad" data-test="tilt-pad" @pointerdown="tiltDown" @pointermove="tiltMove" @pointerup="tiltUp" @pointercancel="tiltUp" />
      <button v-if="scenery && use3d" type="button" class="tilt-btn" data-test="tilt-btn" @click="tiltTo(tilted ? 0 : 50)">{{ tilted ? 'À plat' : 'Incliner' }}</button>

      <TrainRun v-if="route" :route="route" :size="puzzle.size" :clip="trainClip" :speed="fast ? FAST_SPEED : CRUISE_SPEED" @progress="onTrainProgress" @done="trainDone = true" />
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
      <p v-if="verifying" class="wait" data-test="verifying">Vérification par le serveur…</p>
      <template v-else-if="verifyError">
        <p class="wait err" data-test="verify-error">{{ verifyError }}</p>
        <button type="button" class="btn btn--small" data-test="retry" @click="checkWin">Réessayer</button>
      </template>
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
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: center;
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

.tool.on {
  border-color: #2563eb;
  color: #1d4ed8;
}
.timer {
  align-self: center;
  font-variant-numeric: tabular-nums;
  color: #6b7280;
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
@media (prefers-reduced-motion: reduce) {
  .board {
    transition: none;
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
.tilt-pad {
  position: absolute;
  inset: 0;
  z-index: 6;
  aspect-ratio: auto;
  cursor: grab;
  touch-action: none;
}
.tilt-pad:active {
  cursor: grabbing;
}
.tilt-btn {
  position: absolute;
  top: calc(0.4rem / var(--k, 1));
  right: calc(0.4rem / var(--k, 1));
  z-index: 7;
  aspect-ratio: auto;
  padding: calc(0.3rem / var(--k, 1)) calc(0.7rem / var(--k, 1));
  border: calc(2px / var(--k, 1)) solid #fff;
  border-radius: calc(999px / var(--k, 1));
  background: rgba(255, 255, 255, 0.92);
  box-shadow: var(--shadow);
  font: inherit;
  font-size: calc(0.8rem / var(--k, 1));
  font-weight: 800;
  color: #1f2937;
  cursor: pointer;
}
/* incliné : seule la 3D se voit (la grille, ses rails, son train et ses animaux ne suivraient pas la perspective) */
.board--tilted > :not(.scenery3d):not(.tilt-pad):not(.tilt-btn) {
  visibility: hidden;
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

  /* Taille : limitée par la largeur ET la hauteur de l'écran. */
  --w: min(80vw, 54vh, 560px);
  width: var(--w);
  aspect-ratio: 1;
  /* La colonne des compteurs est à droite : on décale VERS LA DROITE d'une demi-colonne pour
     que les CASES (pas la grille + compteurs) soient centrées sur la page. */
  /* À la victoire, la grille rétrécit au centre d'un paysage plus grand (--k < 1) : le décor déborde autour. */
  transform: translateX(calc(100% / (var(--size) + 1) / 2)) scale(var(--k, 1));
  transform-origin: calc(50% * var(--size) / (var(--size) + 1)) calc(50% * var(--size) / (var(--size) + 1));
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
</style>
