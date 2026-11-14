<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import TrackCell from './TrackCell.vue'
import ClueNumber from './ClueNumber.vue'
import type { CellMark } from '../cell'
import type { Side } from '../cell'
import { edgeKey } from '../track'
import { isTouch } from '../platform'
import type { Action, Cell, Lesson } from '../../../shared/tutorial.js'

// Grille du tutoriel : sans décor, ni train, ni chrono. Elle peut être rectangulaire (1×4…) et n'accepte QUE
// l'action de l'étape en cours, sur les cases indiquées : tout le reste est refusé avec un petit message.
// availHeight : hauteur (px) laissée à la grille par l'écran, pour qu'elle n'oblige jamais à défiler.
const props = defineProps<{ lesson: Lesson; action: Action | null; availHeight?: number }>()
const emit = defineEmits<{
  (e: 'advance', edges: string[]): void // l'action demandée est faite
  (e: 'refuse', message: string): void // une autre action a été tentée
}>()

const LONG_PRESS_MS = 450
const rails = ref(new Set<string>()) // « l:c » : repères posés
const crosses = ref(new Set<string>())
const edges = ref(new Set<string>()) // « h:l:c » / « v:l:c » : voie tracée
const k = (r: number, c: number) => `${r}:${c}`

const rowsIdx = computed(() => Array.from({ length: props.lesson.rows }, (_, i) => i))
const colsIdx = computed(() => Array.from({ length: props.lesson.cols }, (_, i) => i))

const isEntry = (r: number, c: number) => props.lesson.entry.row === r && props.lesson.entry.col === c
const isExit = (r: number, c: number) => props.lesson.exit.row === r && props.lesson.exit.col === c
const sideOf = (d: string): Side => (d === 'up' ? 'top' : d === 'down' ? 'bottom' : (d as Side))
const ORDER: Side[] = ['top', 'right', 'bottom', 'left']

function sides(r: number, c: number): Side[] | null {
  const s = new Set<Side>()
  if (edges.value.has(`v:${r - 1}:${c}`)) s.add('top')
  if (edges.value.has(`v:${r}:${c}`)) s.add('bottom')
  if (edges.value.has(`h:${r}:${c - 1}`)) s.add('left')
  if (edges.value.has(`h:${r}:${c}`)) s.add('right')
  if (isEntry(r, c)) s.add(sideOf(props.lesson.entry.dir))
  if (isExit(r, c)) s.add(sideOf(props.lesson.exit.dir))
  const out = ORDER.filter((x) => s.has(x))
  return out.length ? out : null
}
function markOf(r: number, c: number): CellMark {
  if (isEntry(r, c) || isExit(r, c) || rails.value.has(k(r, c)) || sides(r, c)) return 'rail'
  return crosses.value.has(k(r, c)) ? 'cross' : 'empty'
}
const variantOf = (r: number, c: number) => (isEntry(r, c) ? 'entry' : isExit(r, c) ? 'exit' : 'user')

// Cases encore à jouer pour l'action en cours (mises en surbrillance).
const remaining = computed<Set<string>>(() => {
  const a = props.action
  if (!a) return new Set()
  if (a.type === 'tap') return new Set(a.cells.filter(([r, c]) => !rails.value.has(k(r, c))).map(([r, c]) => k(r, c)))
  if (a.type === 'cross') return new Set(a.cells.filter(([r, c]) => !crosses.value.has(k(r, c))).map(([r, c]) => k(r, c)))
  if (a.type === 'drag') return new Set(a.path.slice(Math.max(dragAt.value + 1, 0)).map(([r, c]) => k(r, c)))
  return new Set()
})
// Ordre d'allumage : sur un tracé, les cases s'allument l'une après l'autre dans le sens de la marche.
const order = computed(() => {
  const a = props.action
  const m = new Map<string, number>()
  if (a?.type === 'drag') a.path.slice(Math.max(dragAt.value + 1, 0)).forEach(([r, c], i) => m.set(k(r, c), i))
  return m
})
const isStart = (r: number, c: number) => props.action?.type === 'drag' && props.action.path[0][0] === r && props.action.path[0][1] === c && dragAt.value < 0
const focusRow = computed(() => (props.action?.type === 'info' ? props.action.focus?.row : undefined))
const focusCol = computed(() => (props.action?.type === 'info' ? props.action.focus?.col : undefined))

// --- gestes ---------------------------------------------------------------------------------------------------
const dragAt = ref(-1) // index de la dernière case du glisser en cours ; -1 : pas de glisser
let down: Cell | null = null
let moved = false
let longFired = false
let longTimer = 0
const shake = ref(false)
const pressing = ref('') // case dont l'appui long est en cours (anneau qui se remplit)

function refuse(msg: string): void {
  emit('refuse', msg)
  shake.value = true
  setTimeout(() => (shake.value = false), 350)
}
function finish(): void {
  emit('advance', [...edges.value])
}
function cancelLong(): void {
  pressing.value = ''
  clearTimeout(longTimer)
  longTimer = 0
}

function onDown(ev: PointerEvent, r: number, c: number): void {
  const a = props.action
  if (ev.button > 0 || !a || a.type === 'info') return
  down = [r, c]
  moved = false
  longFired = false
  if (a.type === 'drag') {
    if (a.path[0][0] !== r || a.path[0][1] !== c) {
      down = null
      return refuse('Commence par le départ vert.')
    }
    dragAt.value = 0
    return
  }
  if (a.type === 'cross' && remaining.value.has(k(r, c))) pressing.value = k(r, c)
  longTimer = window.setTimeout(() => {
    longFired = true
    pressing.value = ''
    cross(r, c)
  }, LONG_PRESS_MS)
}

function step(r: number, c: number): void {
  const a = props.action
  if (dragAt.value < 0 || a?.type !== 'drag') return
  const next = a.path[dragAt.value + 1]
  if (!next || next[0] !== r || next[1] !== c) return
  const prev = a.path[dragAt.value]
  edges.value = new Set([...edges.value, edgeKey(prev[0], prev[1], r, c)!])
  dragAt.value++
  moved = true
}
function onMove(ev: PointerEvent): void {
  if (dragAt.value < 0) return
  const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('[data-r]')
  if (el) step(Number(el.dataset.r), Number(el.dataset.c))
}

function tap(r: number, c: number): void {
  const a = props.action
  if (a?.type === 'tap' && remaining.value.has(k(r, c))) {
    rails.value = new Set([...rails.value, k(r, c)])
    if (a.cells.every(([rr, cc]) => rails.value.has(k(rr, cc)))) finish()
    return
  }
  if (a?.type === 'cross') return refuse(isTouch() ? 'Pour une croix, garde le doigt appuyé sur la case.' : 'Pour une croix, fais un clic droit sur la case.')
  if (a?.type === 'drag') return refuse('Ici, il faut tracer le chemin.')
  refuse('Touche une case en surbrillance.')
}
function cross(r: number, c: number): void {
  const a = props.action
  if (a?.type === 'cross' && remaining.value.has(k(r, c))) {
    crosses.value = new Set([...crosses.value, k(r, c)])
    if (a.cells.every(([rr, cc]) => crosses.value.has(k(rr, cc)))) finish()
    return
  }
  if (a?.type === 'tap') return refuse('Ici, une simple touche suffit.')
  if (a?.type === 'drag') return refuse('Ici, il faut tracer le chemin.')
  refuse('Barre une case en surbrillance.')
}

function onUp(): void {
  cancelLong()
  const a = props.action
  if (a?.type === 'drag' && dragAt.value >= 0) {
    if (dragAt.value === a.path.length - 1) {
      dragAt.value = -1
      finish()
    } else {
      // lâché avant la sortie : on recommence le glisser
      edges.value = new Set()
      dragAt.value = -1
      refuse('Va jusqu\'à la sortie rouge sans t\'arrêter : recommence depuis le départ.')
    }
  } else if (down && !moved && !longFired && a && a.type !== 'info') {
    tap(down[0], down[1])
  }
  down = null
  moved = false
}
function onContext(r: number, c: number): void {
  if (longFired) return // déjà traité par l'appui long
  if (!props.action || props.action.type === 'info') return
  cross(r, c)
}

window.addEventListener('pointerup', onUp)
window.addEventListener('pointercancel', onUp)
onUnmounted(() => {
  cancelLong()
  window.removeEventListener('pointerup', onUp)
  window.removeEventListener('pointercancel', onUp)
})
// Quand l'étape change, un glisser à moitié fait n'a plus de sens.
watch(() => props.action, () => (dragAt.value = -1))
</script>

<template>
  <div class="tgrid" :class="{ shake }" :style="{ '--cols': lesson.cols + 1, '--rows': lesson.rows + 1, '--avail': availHeight ? availHeight + 'px' : '100vh' }" data-test="tgrid" role="grid" aria-label="Exercice" @pointermove="onMove">
    <template v-for="r in rowsIdx" :key="'row-' + r">
      <TrackCell
        v-for="c in colsIdx"
        :key="'cell-' + r + '-' + c"
        :data-r="r"
        :data-c="c"
        :mark="markOf(r, c)"
        :sides="sides(r, c)"
        :variant="variantOf(r, c)"
        :class="{ target: remaining.has(k(r, c)), seq: order.has(k(r, c)), start: isStart(r, c), pressing: pressing === k(r, c) }"
        :style="order.has(k(r, c)) ? { '--i': order.get(k(r, c)) } : undefined"
        @pointerdown="onDown($event, r, c)"
        @pointerenter="step(r, c)"
        @contextmenu.prevent="onContext(r, c)"
      />
      <ClueNumber :value="lesson.rowClues[r]" orientation="row" :class="{ focus: focusRow === r }" />
    </template>
    <ClueNumber v-for="c in colsIdx" :key="'col-' + c" :value="lesson.colClues[c]" orientation="col" :class="{ focus: focusCol === c }" />
    <div></div>
  </div>
</template>

<style scoped>
/* Grande grille : toute la largeur disponible, jusqu'à 6 rem par case. */
.tgrid {
  /* Limitée par la largeur ET par la hauteur que la page laisse à la grille (mesurée par l'écran du tutoriel). */
  --cell: min(calc((100vw - 4.5rem) / var(--cols)), 6rem, max(2.4rem, calc((var(--avail) - 2.2rem - 6px) / var(--rows))));
  display: grid;
  grid-template-columns: repeat(var(--cols), var(--cell));
  grid-auto-rows: var(--cell);
  width: max-content;
  max-width: 100%;
  margin: 0 auto;
  padding: 0.9rem;
  border: 3px solid #fff;
  border-radius: 24px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(30, 64, 175, 0.3);
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  touch-action: none;
}
.tgrid > * {
  aspect-ratio: 1;
}
.tgrid :deep(.clue) {
  font-size: calc(var(--cell) * 0.42);
}
.tgrid.shake {
  animation: shake 0.3s;
}
@keyframes shake {
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}
/* Cases à jouer : liseré intérieur (jamais coupé par la case voisine). */
.target {
  position: relative;
  z-index: 1;
  box-shadow: inset 0 0 0 3px #93c5fd;
  border-radius: 10px;
}
.target.start {
  box-shadow: inset 0 0 0 4px #16a34a;
}
/* Tracé : les cases s'allument l'une après l'autre, dans le sens de la marche, puis ça recommence. */
.target.seq {
  animation: chase 4s linear infinite;
  animation-delay: calc(var(--i) * 0.5s);
}
@keyframes chase {
  0%, 22%, 100% { background: transparent; box-shadow: inset 0 0 0 3px #93c5fd; }
  3%, 15% { background: #bfdbfe; box-shadow: inset 0 0 0 4px #2563eb; }
}
.target.start.seq {
  animation-name: chase-start;
}
@keyframes chase-start {
  0%, 22%, 100% { background: transparent; box-shadow: inset 0 0 0 4px #16a34a; }
  3%, 15% { background: #bbf7d0; box-shadow: inset 0 0 0 5px #16a34a; }
}
.target:not(.seq):not(.start) {
  animation: glow 1.4s ease-in-out infinite;
}
@keyframes glow {
  50% { background: #dbeafe; }
}
/* Appui long : un anneau se remplit en 450 ms, puis la croix apparaît. */
.pressing {
  animation: press 0.45s linear forwards !important;
}
@keyframes press {
  from { background: transparent; box-shadow: inset 0 0 0 3px #93c5fd; }
  to { background: #bfdbfe; box-shadow: inset 0 0 0 calc(var(--cell) * 0.2) #2563eb; }
}
/* Chiffre dont on parle : fond orange plein, liseré intérieur. */
.focus {
  position: relative;
  z-index: 2;
  border-radius: 12px;
  background: #fde68a;
  box-shadow: inset 0 0 0 3px #f59e0b;
  animation: glow2 1.2s ease-in-out infinite;
}
@keyframes glow2 {
  50% { background: #fef3c7; }
}
@media (prefers-reduced-motion: reduce) {
  .target, .target.seq, .focus, .tgrid.shake { animation: none; }
  .target.seq { background: #dbeafe; }
}
</style>
