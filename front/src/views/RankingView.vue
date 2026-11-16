<script setup lang="ts">
import { inject, onMounted, ref, watch } from 'vue'
import { user } from '../auth'
import Avatar from '../components/Avatar.vue'
import { fetchBoard, formatTime, type BoardData, type BoardId } from '../stats'

// Classements : ouverts à tous en lecture (seuls le pseudo et l'avatar sont montrés) ; « ma place » si on est connecté.
const go = inject<(view: string) => void>('go', () => undefined)
// Les 10 premiers ; si je n'y suis pas, ma ligne s'ajoute juste dessous, avec ma place.
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
</script>

<template>
  <section data-test="ranking">
    <div class="tabs" role="tablist">
      <button v-for="b in BOARDS" :key="b.id" type="button" role="tab" class="tab" :class="{ on: board === b.id }" :aria-selected="board === b.id" :data-test="'tab-' + b.id" @click="board = b.id">{{ b.label }}</button>
    </div>

    <p v-if="failed" class="note halo" data-test="ranking-error">Classement indisponible : vérifie ta connexion.</p>
    <p v-else-if="!data" class="note halo">…</p>
    <template v-else>
      <p v-if="!data.entries.length" class="note halo" data-test="ranking-empty">Personne n'est encore classé. Sois le premier !</p>
      <ol v-else class="list" data-test="ranking-list">
        <li v-for="e in data.entries" :key="e.rank + e.pseudo" :class="{ me: e.me, top: e.rank <= 3 }" data-test="ranking-row">
          <span class="rank">{{ e.rank }}</span>
          <span class="name"><Avatar :id="e.avatar" class="pic" /><span class="pseudo">{{ e.pseudo }}</span></span>
          <span class="val">{{ value(e.value) }}</span>
        </li>
      </ol>
      <template v-if="user && data.me && !data.entries.some((e) => e.me)">
        <p class="gap" aria-hidden="true">⋮</p>
        <ol class="list" data-test="ranking-me">
          <li class="me">
            <span class="rank">{{ data.me.rank }}</span>
            <span class="name"><Avatar :id="data.me.avatar" class="pic" /><span class="pseudo">{{ data.me.pseudo }}</span></span>
            <span class="val">{{ value(data.me.value) }}</span>
          </li>
        </ol>
      </template>
      <p v-else-if="user && !data.me && data.entries.length" class="note halo" data-test="ranking-hidden">
        Tu n'es pas classé ici{{ user.leaderboard === false ? " (tu as choisi de ne pas apparaître : réglage dans l'écran Compte)" : '' }}.
      </p>
      <p v-else-if="!user" class="note halo">
        <button type="button" class="link" data-test="ranking-login" @click="go('account')">Connecte-toi</button> pour voir ta place.
      </p>
    </template>
  </section>
</template>

<style scoped>
section {
  width: min(26rem, 100%);
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
  background: rgba(255, 255, 255, 0.7);
  font: inherit;
  font-weight: 700;
  color: #374151;
  cursor: pointer;
}
.tab.on {
  background: #2563eb;
  color: #fff;
}
.note {
  font-size: 0.85rem;
  margin: 0.6rem 0;
}
.gap {
  margin: 0.15rem 0;
  font-size: 1.2rem;
  font-weight: 800;
  line-height: 1;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
}
.list {
  list-style: none;
  margin: 0.4rem 0 0;
  padding: 0;
  display: grid;
  gap: 0.35rem;
}
.list li {
  display: grid;
  grid-template-columns: 2.2rem 1fr auto;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.7rem;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.92);
  text-align: left;
}
.list li.top .rank {
  color: #b45309;
}
.list li.me {
  outline: 3px solid #2563eb;
}
.rank {
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.name {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  font-weight: 700;
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
  color: #4b5563;
}
.link {
  border: 0;
  background: none;
  font: inherit;
  font-weight: 700;
  color: #1d4ed8;
  text-decoration: underline;
  cursor: pointer;
}
</style>
