<script setup lang="ts">
import { computed, inject, onMounted, ref, watch } from 'vue'
import AuthPanel from '../components/AuthPanel.vue'
import { user } from '../auth'
import { fetchStats, formatLong, formatTime, type StatsData } from '../stats'
import { THEME_NAMES, THEMES, LEVELS_PER_THEME, themeForLevel } from '../scenery'

// Tout vient du serveur : le Voyage (niveaux, temps, records, pièces) et les résultats du puzzle du jour.
const go = inject<(view: string) => void>('go', () => undefined)
const s = ref<StatsData | null>(null)
async function refresh(): Promise<void> {
  s.value = user.value ? await fetchStats() : null
}
onMounted(refresh)
watch(user, refresh)

// Environnement en cours, et nombre d'environnements déjà traversés (un tout nouveau tour recommence à zéro de ce côté).
const j = computed(() => s.value?.journey ?? null)
const place = computed(() => {
  const level = j.value?.level ?? 1
  const chapter = Math.floor((level - 1) / LEVELS_PER_THEME)
  return { name: THEME_NAMES[themeForLevel(level)], crossed: chapter, total: THEMES.length }
})
</script>

<template>
  <section data-test="stats">
    <AuthPanel v-if="!user" />
    <template v-else>
      <h2 class="halo">{{ user.name }}</h2>

      <h3 class="halo">Voyage</h3>
      <div class="tiles">
        <!-- une seule tuile : le niveau en cours vaut presque toujours « terminés + 1 », deux tuiles disaient la même chose -->
        <div class="tile tile--wide"><b data-test="highest">{{ j ? j.level : '…' }}</b><span>Niveau en cours · <span data-test="solved">{{ j ? j.solved : '…' }}</span> terminé{{ j && j.solved > 1 ? 's' : '' }}</span></div>
        <div class="tile"><b data-test="playtime">{{ j ? formatLong(j.totalTimeMs) : '…' }}</b><span>Temps de jeu</span></div>
        <div class="tile"><b>{{ j ? formatTime(j.avgMs) : '…' }}</b><span>Temps moyen</span></div>
        <div class="tile"><b data-test="fastest">{{ j?.fastest ? formatTime(j.fastest.timeMs) : '—' }}</b><span>Le plus rapide{{ j?.fastest ? ` (niv. ${j.fastest.level})` : '' }}</span></div>
        <div class="tile"><b>{{ j?.slowest ? formatTime(j.slowest.timeMs) : '—' }}</b><span>Le plus long{{ j?.slowest ? ` (niv. ${j.slowest.level})` : '' }}</span></div>
        <div class="tile"><b data-test="coins-earned">{{ j ? j.coinsEarned : '…' }}</b><span>Pièces gagnées</span></div>
        <div class="tile"><b>{{ j ? j.coins : '…' }}</b><span>Pièces en poche</span></div>
        <div class="tile tile--wide" data-test="place"><b>{{ place.name }}</b><span>Environnement en cours · {{ place.crossed }} traversé{{ place.crossed > 1 ? 's' : '' }} sur {{ place.total }}</span></div>
      </div>

      <template v-if="j && j.bySize.length">
        <h3 class="halo">Par taille de grille</h3>
        <ul class="sizes" data-test="by-size">
          <li v-for="z in j.bySize" :key="z.size">
            <b>{{ z.size }}×{{ z.size }}</b>
            <span>{{ z.count }} niveau{{ z.count > 1 ? 'x' : '' }}</span>
            <span>moy. {{ formatTime(z.avgMs) }}</span>
            <span>record {{ formatTime(z.bestMs) }}</span>
          </li>
        </ul>
      </template>

      <h3 class="halo">Puzzle du jour</h3>
      <div class="tiles" v-if="s">
        <div class="tile"><b data-test="count">{{ s.daily.count }}</b><span>Grilles faites</span></div>
        <div class="tile"><b data-test="streak">{{ s.daily.streak }}</b><span>Série en cours</span></div>
        <div class="tile"><b data-test="best-streak">{{ s.daily.bestStreak }}</b><span>Meilleure série</span></div>
        <div class="tile"><b>{{ formatTime(s.daily.avgMs) }}</b><span>Moyenne</span></div>
        <div class="tile"><b>{{ formatTime(s.daily.bestMs) }}</b><span>Meilleur temps</span></div>
        <div class="tile tile--wide"><b>{{ formatTime(s.daily.worstMs) }}</b><span>Pire temps</span></div>
      </div>
      <button type="button" class="btn btn--small rank" data-test="to-ranking" @click="go('ranking')">Voir le classement</button>
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
.sizes {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.4rem;
}
.sizes li {
  display: grid;
  grid-template-columns: 3.4rem 1fr 1fr 1fr;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.6rem;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.9);
  font-size: 0.82rem;
  text-align: left;
}
.rank {
  margin-top: 1rem;
}
</style>
