<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import TrackGrid from '../components/TrackGrid.vue'
import AuthPanel from '../components/AuthPanel.vue'
import CoinBadge from '../components/CoinBadge.vue'
import WinReceipt from '../components/WinReceipt.vue'
import type { Puzzle } from '../puzzle'
import { user, logout } from '../auth'
import { beginDaily, fetchDaily, startDaily, submitDaily, type DailyResult, type DailyStatus } from '../daily'
import { formatTime } from '../stats'
import { setCoins } from '../wallet'

// Puzzle du jour : une grille par jour, la même pour tous, en mode chrono. Le serveur la génère, vérifie le
// tracé et mesure le temps ; seul le premier temps du jour compte. Pas d'aide.
const emit = defineEmits<{ (e: 'playing', value: boolean): void }>()

const playing = ref(false)
watch(playing, (p) => emit('playing', p), { immediate: true })

const status = ref<DailyStatus | null>(null)
const puzzle = ref<Puzzle | null>(null)
const date = ref('')
const outcome = ref<DailyResult | null>(null)
const loading = ref(false)
const error = ref('')

async function refresh(): Promise<void> {
  status.value = user.value ? await fetchDaily() : null
}
onMounted(refresh)
watch(user, refresh)

async function start(): Promise<void> {
  loading.value = true
  error.value = ''
  const r = await startDaily()
  loading.value = false
  if (!r) {
    error.value = 'Serveur injoignable : vérifie ta connexion.'
    return
  }
  puzzle.value = r.puzzle
  date.value = r.date
  outcome.value = null
  playing.value = true
}

// Le serveur vérifie le tracé : la victoire n'existe qu'après sa réponse.
async function validate(_ms: number, edges: string[]): Promise<boolean> {
  const r = await submitDaily(edges)
  if (!r) return false
  outcome.value = r
  setCoins(r.coins)
  return true
}

function quit(): void {
  playing.value = false
  void refresh()
}
</script>

<template>
  <section data-test="daily">
    <AuthPanel v-if="!user" />

    <!-- En jeu : plus de menu -->
    <template v-else-if="playing && puzzle">
      <div class="bar">
        <button type="button" class="btn btn--ghost btn--small" data-test="quit" @click="quit">← Quitter</button>
        <span class="title">Puzzle du jour</span>
        <CoinBadge />
      </div>
      <div class="play-area">
        <TrackGrid :key="date" :puzzle="puzzle" :validate="validate" :official-ms="outcome?.timeMs ?? null" @begin="beginDaily()">
          <template #win>
            <template v-if="outcome && outcome.counted">
              <p class="note" data-test="saved">Temps enregistré<template v-if="outcome.streak > 1"> · série de {{ outcome.streak }} jours</template></p>
              <WinReceipt :lines="[{ label: 'Puzzle du jour', amount: outcome.earned.base }, { label: 'Série de ' + outcome.streak + ' jours', amount: outcome.earned.streakBonus }]" />
            </template>
            <p v-else-if="outcome" class="note halo" data-test="not-counted">
              Temps non retenu : seul le premier essai du jour compte.
            </p>
          </template>
        </TrackGrid>
      </div>
    </template>

    <!-- Salon -->
    <div v-else class="lobby">
      <p class="note halo">Une grille par jour, la même pour tous, chronométrée, sans pouvoirs.</p>
      <p v-if="status?.done" class="note halo" data-test="already">
        Fait aujourd'hui en {{ formatTime(status.timeMs) }}. Tu peux rejouer, mais seul le premier temps compte.
      </p>
      <p v-if="status && status.streak > 0" class="note halo" data-test="streak">
        {{ status.streak }} jour{{ status.streak > 1 ? 's' : '' }} d'affilée
      </p>
      <button type="button" class="btn btn--big" data-test="start" :disabled="loading || !status" @click="start">
        {{ status?.done ? 'Rejouer' : 'Lancer' }}
      </button>
      <p v-if="error" class="note halo" data-test="load-error">{{ error }}</p>
      <p class="note halo">Pas encore de classement.</p>
      <p class="note halo">
        Compte : <strong>{{ user.name }}</strong>
        <button type="button" class="link-btn" @click="logout">Déconnexion</button>
      </p>
    </div>
  </section>
</template>

<style scoped>
section {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1; /* remplit la hauteur : barre en haut, contenu centré dans le reste */
  align-self: stretch;
  width: 100%;
}
.play-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.lobby {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  text-align: center;
}
h2 {
  color: #111827;
  font-weight: 800;
}
.note {
  font-size: 0.95rem;
  font-weight: 600;
}
.note .link-btn {
  margin-left: 0.5rem;
}
.bar {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  width: min(92vw, 560px);
}
.bar .btn {
  justify-self: start;
}
.title {
  font-weight: 800;
  color: #374151;
}
</style>
