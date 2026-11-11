<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { range, railVariant, type Puzzle } from '../puzzle'
import type { CellMark } from '../cell'
import {
  connectedSides,
  isCrossed,
  isRail,
  toggleCross,
  tapCell,
  dragStep,
  type DragMode,
} from '../track'
import TrackCell from './TrackCell.vue'
import ClueNumber from './ClueNumber.vue'

const props = defineProps<{ puzzle: Puzzle }>()

const indices = computed(() => range(props.puzzle.size))

// La voie : liaisons tracées, croix posées, rails marqués (orientation inconnue).
const connections = ref(new Set<string>())
const crosses = ref(new Set<string>())
const rails = ref(new Set<string>())

// Côtés connectés de chaque case (null si aucune liaison).
const sidesGrid = computed(() =>
  indices.value.map((r) =>
    indices.value.map((c) => {
      const s = connectedSides(connections.value, props.puzzle, r, c)
      return s.length ? s : null
    }),
  ),
)

function markOf(r: number, c: number): CellMark {
  if (isRail(connections.value, rails.value, props.puzzle, r, c)) return 'rail'
  return isCrossed(crosses.value, r, c) ? 'cross' : 'empty'
}

// --- Historique (annuler / rétablir) ---
interface Snap {
  conn: string[]
  crs: string[]
  rls: string[]
}
const history: Snap[] = [{ conn: [], crs: [], rls: [] }]
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
}
function restore(snap: Snap): void {
  connections.value = new Set(snap.conn)
  crosses.value = new Set(snap.crs)
  rails.value = new Set(snap.rls)
}
function undo(): void {
  if (hIndex > 0) {
    hIndex--
    restore(history[hIndex])
    updateFlags()
  }
}
function redo(): void {
  if (hIndex < history.length - 1) {
    hIndex++
    restore(history[hIndex])
    updateFlags()
  }
}
function clearAll(): void {
  connections.value = new Set()
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
let longPress = 0

function step(r: number, c: number): void {
  if (!active || !last) return
  const [lr, lc] = last
  if (lr === r && lc === c) return
  cancelLongPress()
  moved = true
  mode = dragStep(connections.value, mode, lr, lc, r, c)
  last = [r, c]
}

function onDown(r: number, c: number): void {
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
      tapCell(rails.value, connections.value, crosses.value, props.puzzle, down[0], down[1])
      commit()
    }
  }
  active = false
  mode = null
  last = null
  down = null
}

function onCross(r: number, c: number): void {
  toggleCross(crosses.value, connections.value, rails.value, props.puzzle, r, c)
  commit()
}

function startLongPress(r: number, c: number): void {
  cancelLongPress()
  longPress = window.setTimeout(() => {
    longFired = true
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
  window.addEventListener('keydown', onKey)
})
onUnmounted(() => {
  window.removeEventListener('pointerup', onUp)
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div class="track">
    <div class="toolbar">
      <button type="button" @click="undo" :disabled="!canUndo" title="Annuler (Ctrl+Z)">
        ↶ Annuler
      </button>
      <button type="button" @click="redo" :disabled="!canRedo" title="Rétablir (Ctrl+Maj+Z)">
        ↷ Rétablir
      </button>
      <button type="button" class="clear" @click="clearAll">Effacer tout</button>
    </div>

    <div
      class="board"
      :style="{ '--size': puzzle.size }"
      role="grid"
      aria-label="Grille Train Tracks"
      @pointermove="onMove"
    >
      <template v-for="r in indices" :key="'row-' + r">
        <TrackCell
          v-for="c in indices"
          :key="'cell-' + r + '-' + c"
          :data-r="r"
          :data-c="c"
          :mark="markOf(r, c)"
          :sides="sidesGrid[r][c]"
          :variant="railVariant(puzzle, r, c)"
          @pointerdown="onDown(r, c)"
          @pointerenter="onEnter(r, c)"
          @contextmenu.prevent="onCross(r, c)"
        />

        <ClueNumber :value="puzzle.rowClues[r]" orientation="row" />
      </template>

      <ClueNumber
        v-for="c in indices"
        :key="'col-' + c"
        :value="puzzle.colClues[c]"
        orientation="col"
      />

      <div class="corner"></div>
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

.toolbar button {
  font: inherit;
  font-size: clamp(0.8rem, 2.6vmin, 0.95rem);
  padding: 0.4em 0.8em;
  border: 1px solid #cbd2dc;
  border-radius: 8px;
  background: #ffffff;
  color: #1f2937;
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease;
}
.toolbar button:hover:not(:disabled) {
  background: #f1f5fb;
  border-color: #94a3b8;
}
.toolbar button:disabled {
  opacity: 0.4;
  cursor: default;
}
.toolbar .clear:hover:not(:disabled) {
  border-color: #dc2626;
  color: #dc2626;
}

.board {
  --track: calc(var(--size) + 1);

  display: grid;
  grid-template-columns: repeat(var(--track), 1fr);
  grid-auto-rows: 1fr;

  width: min(92vmin, 560px);
  aspect-ratio: 1;

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
