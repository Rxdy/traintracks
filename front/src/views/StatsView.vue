<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import AuthPanel from '../components/AuthPanel.vue'
import { user } from '../auth'
import { fetchStats, formatTime, type StatsData } from '../stats'

// Tout vient du serveur : niveau du Voyage et résultats du puzzle du jour.
const s = ref<StatsData | null>(null)
async function refresh(): Promise<void> {
  s.value = user.value ? await fetchStats() : null
}
onMounted(refresh)
watch(user, refresh)
</script>

<template>
  <section data-test="stats">
    <AuthPanel v-if="!user" />
    <template v-else>
      <h2 class="halo">{{ user.name }}</h2>

      <h3 class="halo">Voyage</h3>
      <div class="tiles">
        <div class="tile tile--wide"><b data-test="highest">{{ s ? s.journey.level : '…' }}</b><span>Niveau atteint</span></div>
      </div>

      <h3 class="halo">Puzzle du jour</h3>
      <div class="tiles" v-if="s">
        <div class="tile"><b data-test="count">{{ s.daily.count }}</b><span>Grilles faites</span></div>
        <div class="tile"><b data-test="streak">{{ s.daily.streak }}</b><span>Série en cours</span></div>
        <div class="tile"><b>{{ formatTime(s.daily.avgMs) }}</b><span>Moyenne</span></div>
        <div class="tile"><b>{{ formatTime(s.daily.bestMs) }}</b><span>Meilleur temps</span></div>
        <div class="tile tile--wide"><b>{{ formatTime(s.daily.worstMs) }}</b><span>Pire temps</span></div>
      </div>
      <p class="note halo">Pas encore de classement.</p>
    </template>
  </section>
</template>

<style scoped>
section {
  width: min(26rem, 100%);
  color: #374151;
  text-align: center;
}
h2 {
  font-weight: 800;
}
h3 {
  margin: 1.1rem 0 0.6rem;
  font-size: 1rem;
}
.tiles {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}
.tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  padding: 0.9rem 0.4rem;
  border: 2px solid #fff;
  border-radius: 22px;
  background: linear-gradient(#eaf6ff, #ffffff);
  box-shadow: var(--shadow);
}
.tile--wide {
  grid-column: 1 / -1;
}
.tile b {
  font-size: 1.9rem;
  font-weight: 800;
  color: #2563eb;
  font-variant-numeric: tabular-nums;
}
.tile span {
  font-size: 0.8rem;
  color: #6b7280;
}
.note {
  margin-top: 1rem;
  font-size: 0.85rem;
  font-weight: 600;
}
</style>
