<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
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
  cellKey,
  type DragMode,
} from '../track'
import { lineStatuses } from '../lines'
import { buildRoute, leadCells, type Route } from '../trainRoute'
import { buildScenery, PAL, timing, type Scenery, type Theme } from '../scenery'
import TrainRun from './TrainRun.vue'
import SceneryLayer from './SceneryLayer.vue'
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
}>()
const emit = defineEmits<{ (e: 'solved', ms: number): void; (e: 'pick', row: number, col: number): void; (e: 'begin'): void }>()

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
const sceneryRoute = ref<Route | null>(null)
let trainTimer = 0
// Vrai quand l'animation du train est finie : c'est alors seulement qu'on propose la suite.
const trainDone = ref(false)
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
function revealScenery(): void {
  const path = tracePath(connections.value, puz.value)
  if (!path) {
    trainDone.value = true
    return
  }
  scenery.value = buildScenery(puz.value, path, props.theme)
  sceneryRoute.value = buildRoute(path, puz.value, 1)
  if (timing.revealMs > 0) trainTimer = window.setTimeout(runTrain, timing.revealMs)
  else runTrain()
}
function runTrain(): void {
  const path = tracePath(connections.value, puz.value)
  if (!path) {
    trainDone.value = true
    return
  }
  // La voie est prolongée jusqu'au bord de l'ÉCRAN, des deux côtés.
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
  if (!solved.value && hIndex > 0) {
    hIndex--
    restore(history[hIndex])
    updateFlags()
  }
}
function redo(): void {
  if (!solved.value && hIndex < history.length - 1) {
    hIndex++
    restore(history[hIndex])
    updateFlags()
  }
}
function clearAll(): void {
  if (solved.value) return
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
  mode = dragStep(connections.value, mode, lr, lc, r, c, puz.value)
  last = [r, c]
}

function onDown(ev: PointerEvent, r: number, c: number): void {
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
      tapCell(rails.value, connections.value, crosses.value, puz.value, down[0], down[1])
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
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onCancel)
  window.addEventListener('keydown', onKey)
})
onUnmounted(() => {
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
      <button type="button" class="btn btn--ghost btn--small" data-test="undo" @click="undo" :disabled="!canUndo" title="Annuler (Ctrl+Z)">
        ↶ Annuler
      </button>
      <button type="button" class="btn btn--ghost btn--small" @click="redo" :disabled="!canRedo" title="Rétablir (Ctrl+Maj+Z)">
        ↷ Rétablir
      </button>
      <button type="button" class="btn btn--ghost btn--small clear" @click="clearAll">Effacer tout</button>
      <span class="timer" data-test="timer">⏱ {{ fmt(elapsed) }}</span>
    </div>

    <div
      ref="boardEl"
      class="board"
      :class="{ picking, 'board--won': scenery }"
      :style="{ '--size': puzzle.size, ...railStyle }"
      role="grid"
      aria-label="Grille de jeu"
      @pointermove="onMove"
    >
      <SceneryLayer v-if="scenery" :scenery="scenery" :route="sceneryRoute" />

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

      <TrainRun v-if="route" :route="route" :size="puzzle.size" @done="trainDone = true" />

      <!-- Victoire : le train passe d'abord ; une fois arrivé, le résultat s'affiche AU CENTRE de la grille
           (temps, gain, « Suivant »), ce qui laisse le bas de l'écran libre pour les aides. -->
      <div v-if="solved && trainDone" class="finish" data-test="finish">
        <p class="win" data-test="win">Niveau terminé</p>
        <p class="time" data-test="result-time"><span>Temps</span> {{ fmt(officialMs ?? elapsed) }}</p>
        <slot name="win" :ready="true" />
      </div>
    </div>

    <!-- Zone réservée dès le début : la victoire s'y affiche sans pousser la page. -->
    <div class="win-zone" :class="{ on: solved }">
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

.toolbar .clear:hover:not(:disabled) {
  color: #dc2626;
}

.timer {
  align-self: center;
  font-variant-numeric: tabular-nums;
  color: #6b7280;
}
.win-zone {
  min-height: 2.6rem; /* message de vérification : place réservée pour ne pas faire sauter la page */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 0.6rem;
}
@keyframes win-in {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
}
.finish {
  position: absolute;
  left: 50%;
  top: 100%;
  margin-top: 0.7rem;
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.45rem;
  max-width: 92%;
  padding: 0.9rem 1.3rem;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
  text-align: center;
  animation: finish-in 0.4s ease both;
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
@keyframes finish-in {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(10px) scale(0.96);
  }
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
}
.board--won :deep(.clue) {
  opacity: 0;
  transition: opacity 0.6s ease;
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

  /* Taille : limitée par la largeur ET la hauteur de l'écran. */
  --w: min(80vw, 60vh, 560px);
  width: var(--w);
  aspect-ratio: 1;
  /* La colonne des compteurs est à droite : on décale VERS LA DROITE d'une demi-colonne pour
     que les CASES (pas la grille + compteurs) soient centrées sur la page. */
  transform: translateX(calc(100% / (var(--size) + 1) / 2));

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
