<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { range, railVariant, isLocked, type Puzzle } from '../puzzle'
import { connectedSides, edgeKey, isRail } from '../track'
import { lineStatuses } from '../lines'
import type { CellMark } from '../cell'
import TrackCell from './TrackCell.vue'
import ClueNumber from './ClueNumber.vue'

// Rejoue une solution case par case, avec une légende : la « vidéo ».
const props = withDefaults(
  defineProps<{
    puzzle: Puzzle
    path: [number, number][]
    captions?: Record<number, string>
    intervalMs?: number
  }>(),
  { captions: () => ({}), intervalMs: 800 },
)

const step = ref(0) // nombre de cases posées
const playing = ref(false)
let timer = 0

const indices = computed(() => range(props.puzzle.size))

const connections = computed(() => {
  const set = new Set<string>()
  const n = Math.max(step.value, 1)
  for (let i = 1; i < n; i++) {
    const [r1, c1] = props.path[i - 1]
    const [r2, c2] = props.path[i]
    const k = edgeKey(r1, c1, r2, c2)
    if (k) set.add(k)
  }
  return set
})
const none = new Set<string>()

function baseMark(r: number, c: number): CellMark {
  return isRail(connections.value, none, props.puzzle, r, c) ? 'rail' : 'empty'
}

// Comme un joueur avisé : dès qu'une ligne ou colonne est complète, on pose
// une croix ✕ sur toutes ses cases encore vides.
const statuses = computed(() =>
  lineStatuses(
    indices.value.map((r) => indices.value.map((c) => baseMark(r, c))),
    props.puzzle.rowClues,
    props.puzzle.colClues,
    indices.value.map((r) =>
      indices.value.map((c) => baseMark(r, c) === 'rail' && !isLocked(props.puzzle, r, c)),
    ),
  ),
)

function cell(r: number, c: number) {
  const s = connectedSides(connections.value, props.puzzle, r, c)
  let mark = baseMark(r, c)
  if (
    mark === 'empty' &&
    (statuses.value.rows[r] === 'done' || statuses.value.cols[c] === 'done')
  ) {
    mark = 'cross'
  }
  return { mark, sides: s.length ? s : null }
}

const caption = computed(() => {
  let text = ''
  for (const k of Object.keys(props.captions).map(Number).sort((a, b) => a - b)) {
    if (k <= step.value) text = props.captions[k]
  }
  return text
})
const finished = computed(() => step.value >= props.path.length)

function stop(): void {
  playing.value = false
  clearInterval(timer)
}
function tick(): void {
  if (step.value < props.path.length) step.value++
  if (finished.value) stop()
}
function play(): void {
  if (finished.value) step.value = 0
  playing.value = true
  clearInterval(timer)
  timer = window.setInterval(tick, props.intervalMs)
  if (step.value === 0) step.value = 1
}
function restart(): void {
  stop()
  step.value = 0
}
onUnmounted(stop)
</script>

<template>
  <div class="demo" data-test="demo">
    <div class="controls">
      <button type="button" class="btn btn--small" data-test="play" @click="playing ? stop() : play()">
        {{ playing ? '⏸ Pause' : finished ? '↻ Revoir' : step > 0 ? '▶ Reprendre' : '▶ Lancer la démo' }}
      </button>
      <button type="button" class="btn btn--ghost btn--small" :disabled="step === 0" @click="restart">⏮ Début</button>
    </div>

    <p class="caption halo" data-test="caption" aria-live="polite">{{ caption || ' ' }}</p>

    <div class="stage">
    <div class="board" :style="{ '--size': puzzle.size }">
      <template v-for="r in indices" :key="'row-' + r">
        <TrackCell
          v-for="c in indices"
          :key="'cell-' + r + '-' + c"
          :mark="cell(r, c).mark"
          :sides="cell(r, c).sides"
          :variant="railVariant(puzzle, r, c)"
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
      <div></div>
    </div>
    </div>
  </div>
</template>

<style scoped>
.demo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}
.controls {
  display: flex;
  gap: 0.5rem;
}
.caption {
  min-height: 3.2em;
  max-width: 30rem;
  text-align: center;
  font-weight: 600;
  line-height: 1.5;
}
.stage {
  width: min(92%, 55vh, 460px);
  padding: 0.7rem;
  border: 3px solid #fff;
  border-radius: 24px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(30, 64, 175, 0.3);
}
.board {
  display: grid;
  grid-template-columns: repeat(calc(var(--size) + 1), 1fr);
  grid-auto-rows: 1fr;
  width: 100%;
  aspect-ratio: 1;
  pointer-events: none;
  user-select: none;
}
.board > * {
  aspect-ratio: 1;
}
</style>
