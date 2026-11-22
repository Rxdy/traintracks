<script setup lang="ts">
import { computed, inject, onMounted, ref, watch } from 'vue'
import { user } from '../auth'
import Avatar from '../components/Avatar.vue'
import { boardGoal, fetchBoard, formatTime, type BoardData, type BoardEntry, type BoardId } from '../stats'

// Classements : ouverts à tous en lecture (seuls le pseudo et l'avatar sont montrés).
// Les 3 premiers sur un podium, puis jusqu'au 10e ; hors du top 10, les joueurs autour de moi.
// Ma place reste en bas de l'écran, avec ce qu'il me manque pour en gagner une ; sans compte, une invitation à se connecter.
const go = inject<(view: string) => void>('go', () => undefined)
const BOARDS: { id: BoardId; label: string }[] = [
  { id: 'voyage', label: 'Voyage' },
  { id: 'jour', label: 'Du jour' },
  { id: 'serie', label: 'Séries' },
]
const board = ref<BoardId>('voyage')
const data = ref<BoardData | null>(null)
const failed = ref(false)

async function load(): Promise<void> {
  failed.value = false
  data.value = null
  const d = await fetchBoard(board.value)
  if (d) data.value = d
  else failed.value = true
}
onMounted(load)
watch(board, load)
watch(user, load) // connexion / déconnexion : « ma place » change

const value = (v: number): string => (board.value === 'voyage' ? `Niveau ${v}` : board.value === 'jour' ? formatTime(v) : `${v} jour${v > 1 ? 's' : ''}`)
const DAY = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
const sub = computed(() => {
  if (board.value === 'voyage') return 'Le niveau le plus loin atteint'
  if (board.value === 'jour') return data.value?.date ? `Puzzle du ${DAY.format(new Date(data.value.date + 'T00:00:00Z'))} · meilleur temps` : 'Puzzle du jour · meilleur temps'
  return 'Puzzles du jour réussis sans manquer un jour'
})
// le podium, dans l'ordre 1-2-3 (lecteurs d'écran) ; à l'écran : 2e à gauche, 1er au milieu, 3e à droite
const podium = computed<{ e: BoardEntry; place: number }[]>(() => (data.value?.entries ?? []).slice(0, 3).map((e, i) => ({ e, place: i + 1 })))
const rest = computed(() => data.value?.entries.slice(3) ?? [])
const around = computed(() => data.value?.around ?? [])
const goal = computed(() => (data.value ? boardGoal(data.value) : null))
</script>

<template>
  <section data-test="ranking">
    <div class="tabs" role="tablist">
      <button v-for="b in BOARDS" :key="b.id" type="button" role="tab" class="tab" :class="{ on: board === b.id }" :aria-selected="board === b.id" :data-test="'tab-' + b.id" @click="board = b.id">{{ b.label }}</button>
    </div>
    <p class="sub" data-test="ranking-sub">{{ sub }}</p>

    <p v-if="failed" class="note" data-test="ranking-error">Classement indisponible : vérifie ta connexion.</p>
    <p v-else-if="!data" class="note">…</p>
    <template v-else>
      <p v-if="!data.entries.length" class="note" data-test="ranking-empty">Personne n'est encore classé. Sois le premier !</p>
      <template v-else>
        <div class="podium" data-test="ranking-podium">
          <div v-for="p in podium" :key="p.place" class="step" :class="['p' + p.place, { me: p.e.me }]" data-test="ranking-row">
            <svg v-if="p.place === 1" class="crown" viewBox="0 0 26 16" aria-hidden="true"><path d="M2 14 L4 4 L9 9 L13 2 L17 9 L22 4 L24 14 Z" /></svg>
            <Avatar :id="p.e.avatar" class="pic" />
            <span class="who pseudo">{{ p.e.pseudo }}</span>
            <span class="v">{{ value(p.e.value) }}</span>
            <span class="block">{{ p.e.rank }}</span>
          </div>
        </div>
        <ol v-if="rest.length" class="list">
          <li v-for="e in rest" :key="e.rank + e.pseudo" :class="{ me: e.me }" data-test="ranking-row">
            <span class="rank">{{ e.rank }}</span>
            <span class="name"><Avatar :id="e.avatar" class="pic" /><span class="pseudo">{{ e.pseudo }}</span></span>
            <span class="val">{{ value(e.value) }}</span>
          </li>
        </ol>
        <template v-if="around.length">
          <p class="sep">Autour de toi</p>
          <ol class="list" data-test="ranking-around">
            <li v-for="e in around" :key="e.rank + e.pseudo" :class="{ me: e.me }">
              <span class="rank">{{ e.rank }}</span>
              <span class="name"><Avatar :id="e.avatar" class="pic" /><span class="pseudo">{{ e.pseudo }}</span></span>
              <span class="val">{{ value(e.value) }}</span>
            </li>
          </ol>
        </template>
      </template>

      <!-- ma place : toujours en bas de l'écran -->
      <div v-if="user && data.me" class="mine" data-test="ranking-mine">
        <p v-if="goal" class="goal" data-test="ranking-goal">{{ goal }}</p>
        <ol class="list" data-test="ranking-me">
          <li class="me">
            <span class="rank">{{ data.me.rank }}</span>
            <span class="name"><Avatar :id="data.me.avatar" class="pic" /><span class="pseudo">{{ data.me.pseudo }}</span></span>
            <span class="val">{{ value(data.me.value) }}</span>
          </li>
        </ol>
      </div>
      <p v-else-if="user && data.entries.length" class="mine note" data-test="ranking-hidden">
        Tu n'es pas classé ici{{ user.leaderboard === false ? " (tu as choisi de ne pas apparaître : réglage dans l'écran Compte)" : '' }}.
      </p>
      <div v-else-if="!user" class="mine">
        <button type="button" class="btn btn--small" data-test="ranking-login" @click="go('account')">Connecte-toi pour voir ta place</button>
      </div>
    </template>
  </section>
</template>

<style scoped>
section {
  width: min(26rem, 100%);
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  color: #374151;
  text-align: center;
}
.tabs {
  display: flex;
  justify-content: center;
  gap: 0.4rem;
}
.tab {
  padding: 0.4rem 0.9rem;
  border: 2px solid #fff;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.75);
  font: inherit;
  font-weight: 700;
  color: #374151;
  cursor: pointer;
}
.tab.on {
  background: #2563eb;
  color: #fff;
}
.sub {
  align-self: center;
  margin: 0;
  padding: 0.2rem 0.8rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.85);
  font-size: 0.82rem;
  font-weight: 700;
  color: #1e3a5f;
}
.note {
  margin: 0;
  padding: 0.4rem 0.9rem;
  border-radius: 0.9rem;
  background: rgba(255, 255, 255, 0.9);
  font-size: 0.85rem;
}

/* le podium : des marches or, argent, bronze */
.podium {
  display: grid;
  grid-template-columns: 1fr 1.15fr 1fr;
  align-items: end;
  gap: 0.4rem;
}
.step {
  display: grid;
  justify-items: center;
  gap: 0.2rem;
  min-width: 0;
}
.step.p1 {
  grid-column: 2;
}
.step.p2 {
  grid-column: 1;
  grid-row: 1;
}
.step.p3 {
  grid-column: 3;
  grid-row: 1;
}
.step .pic {
  --avatar: 3.3rem;
  box-shadow: 0 0 0 3px #fff, 0 2px 6px rgba(0, 0, 0, 0.2);
}
.step.p1 .pic {
  --avatar: 4.2rem;
}
.step.me .pic {
  box-shadow: 0 0 0 3px #2563eb, 0 2px 6px rgba(0, 0, 0, 0.2);
}
.crown {
  width: 1.6rem;
  height: 1rem;
  margin-bottom: -0.15rem;
  fill: #facc15;
  stroke: #b45309;
  stroke-width: 1.4;
  stroke-linejoin: round;
}
.who {
  max-width: 100%;
  padding: 0 0.4rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.85);
  font-weight: 800;
  font-size: 0.85rem;
  color: #0f172a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.v {
  padding: 0 0.4rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.7);
  font-size: 0.78rem;
  font-weight: 700;
  color: #1f2937;
  font-variant-numeric: tabular-nums;
}
.block {
  display: grid;
  place-items: center;
  width: 100%;
  border-radius: 0.8rem 0.8rem 0.25rem 0.25rem;
  font-size: 1.4rem;
  font-weight: 900;
  color: #fff;
  box-shadow: inset 0 -5px 0 rgba(0, 0, 0, 0.18);
}
.p1 .block {
  height: 4.6rem;
  background: #e2a92b;
}
.p2 .block {
  height: 3.4rem;
  background: #94a3b8;
}
.p3 .block {
  height: 2.6rem;
  background: #c0773a;
}

.sep {
  margin: 0.2rem 0 0;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #1e3a5f;
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.3rem;
}
.list li {
  display: grid;
  grid-template-columns: 2rem 1fr auto;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.7rem 0.35rem 0.35rem;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.93);
  text-align: left;
}
.rank {
  display: grid;
  place-items: center;
  width: 1.9rem;
  height: 1.9rem;
  border-radius: 0.55rem;
  background: #1e3a5f;
  color: #fff;
  font-weight: 800;
  font-size: 0.9rem;
  font-variant-numeric: tabular-nums;
}
.list li.me {
  background: #dbeafe;
  box-shadow: inset 0 0 0 3px #2563eb;
}
.list li.me .rank {
  background: #2563eb;
}
.name {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  font-weight: 700;
  color: #1f2937;
}
.pic {
  --avatar: 1.9rem;
}
.pseudo {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.val {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  color: #4b5563;
}

/* ma place : collée en bas de l'écran pendant qu'on fait défiler */
.mine {
  position: sticky;
  bottom: max(0.5rem, env(safe-area-inset-bottom));
  z-index: 2;
  display: grid;
  gap: 0.35rem;
  margin-top: 0.3rem;
  padding: 0.6rem 0.7rem;
  border-radius: 1.2rem;
  background: #fff;
  box-shadow: 0 -2px 14px rgba(15, 23, 42, 0.18);
}
.mine.note {
  font-size: 0.85rem;
}
.mine .btn {
  justify-self: center;
}
.goal {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 700;
  color: #1e3a5f;
}
</style>
