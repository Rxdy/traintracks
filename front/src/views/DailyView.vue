<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import TrackGrid from '../components/TrackGrid.vue'
import AuthPanel from '../components/AuthPanel.vue'
import CoinBadge from '../components/CoinBadge.vue'
import QuitButton from '../components/QuitButton.vue'
import WinReceipt from '../components/WinReceipt.vue'
import CabinFrame from '../components/CabinFrame.vue'
import FinishDialog from '../components/FinishDialog.vue'
import type { Route } from '../trainRoute'
import type { Scenery } from '../scenery/generate'
import type { LandFrame } from '../scenery/motion'
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
// Cabine : comme au Voyage, le pare-brise suit le train et le store porte le récapitulatif à l'arrivée.
const trainRunning = ref(false)
const trainS = ref(0)
const landFrame = shallowRef<LandFrame | null>(null)
const cabScene = ref<{ route: Route; scenery: Scenery; rails: Route | null } | null>(null)
const grid = ref<InstanceType<typeof TrackGrid> | null>(null)
const won = ref(false) // tracé validé : la cabine monte
const finished = ref(false)
const storeDown = computed(() => finished.value && !trainRunning.value)

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
  won.value = false
  finished.value = false
  trainRunning.value = false
  trainS.value = 0
  cabScene.value = null
  landFrame.value = null
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
        <QuitButton data-test="quit" @click="quit" />
        <span class="title">Puzzle du jour</span>
        <CoinBadge />
      </div>
      <div class="play-area">
        <TrackGrid
          ref="grid"
          :key="date"
          :puzzle="puzzle"
          :validate="validate"
          :official-ms="outcome?.timeMs ?? null"
          external-recap
          @solved="won = true"
          @begin="beginDaily()"
          @finish="finished = true"
          @train="trainRunning = $event"
          @progress="trainS = $event"
          @scene="cabScene = $event"
          @land="landFrame = $event"
        />
        <CabinFrame :shown="won" :scene="cabScene" :land="landFrame" :progress="trainS" :running="trainRunning" />
        <!-- À l'arrivée du train : le récapitulatif au centre de l'écran. « Suivant » ramène au salon. -->
        <FinishDialog :open="storeDown" next-label="Retour" @replay="grid?.replayTrain()" @next="quit">
          <template v-if="outcome">
            <p class="time" data-test="result-time"><span>Temps</span> {{ formatTime(outcome.timeMs) }}</p>
            <template v-if="outcome.counted">
              <p class="note" data-test="saved">Temps enregistré<template v-if="outcome.streak > 1"> · série de {{ outcome.streak }} jours</template></p>
              <WinReceipt :lines="[{ label: 'Puzzle du jour', amount: outcome.earned.base }, { label: 'Série de ' + outcome.streak + ' jours', amount: outcome.earned.streakBonus }]" />
            </template>
            <p v-else class="note" data-test="not-counted">Temps non retenu : seul le premier essai du jour compte.</p>
          </template>
        </FinishDialog>
      </div>
    </template>

    <!-- Salon -->
    <div v-else class="lobby">
      <div class="card" data-test="lobby">
        <h2>Puzzle du jour</h2>
        <p class="hint">Une grille par jour, la même pour tous, chronométrée, sans pouvoirs.</p>
        <p v-if="status" class="size" data-test="size">Aujourd'hui : {{ status.size }}×{{ status.size }}</p>
        <p v-if="status?.done" class="done" data-test="already">
          Fait aujourd'hui en {{ formatTime(status.timeMs) }}. Tu peux rejouer, mais seul le premier temps compte.
        </p>
        <p v-if="status && status.streak > 0" class="streak" data-test="streak">
          {{ status.streak }} jour{{ status.streak > 1 ? 's' : '' }} d'affilée
        </p>
        <button type="button" class="btn btn--big" data-test="start" :disabled="loading || !status" @click="start">
          {{ status?.done ? 'Rejouer' : 'Lancer' }}
        </button>
        <p v-if="error" class="err" data-test="load-error">{{ error }}</p>
      </div>
      <p class="who">
        Connecté : <strong>{{ user.name }}</strong>
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
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
}
.lobby {
  width: min(26rem, 100%);
  display: grid;
  gap: 0.8rem;
  justify-items: center;
}
.card {
  width: 100%;
  display: grid;
  gap: 0.6rem;
  justify-items: center;
  padding: 1rem 1.1rem 1.2rem;
  border: 3px solid #fff;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: var(--shadow);
  text-align: center;
  color: #374151;
}
h2 {
  font-size: 1.4rem;
  color: var(--ink);
  font-weight: 800;
}
.hint {
  font-size: 0.9rem;
  color: var(--muted);
}
.size {
  padding: 0.1rem 0.8rem;
  border-radius: 999px;
  background: #eff6ff;
  color: var(--blue-dark);
  font-weight: 800;
}
.done {
  font-size: 0.9rem;
  font-weight: 600;
  color: #15803d;
}
.streak {
  font-weight: 700;
  color: var(--ink);
}
.err {
  color: #b91c1c;
  font-weight: 600;
}
.who {
  padding: 0.25rem 0.9rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.95);
  font-size: 0.85rem;
  color: #374151;
}
.who .link-btn {
  margin-left: 0.5rem;
}
.bar {
  position: relative;
  z-index: 6; /* au-dessus du décor de fin de niveau, qui monte jusqu'en haut de l'écran */
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  width: min(92vw, 560px);
}
.bar .btn,
.bar .quit {
  justify-self: start;
}
.title {
  justify-self: center;
  padding: 0.3rem 0.9rem;
  border: 2px solid #fff;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92); /* lisible sur le décor */
  box-shadow: var(--shadow);
  font-weight: 800;
  color: #374151;
}
/* Corps de la fenêtre de fin : le temps, la série, la facture. */
.time {
  margin: 0;
  text-align: center;
  font-size: 1.5rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: #1f2937;
}
.time span {
  margin-right: 0.35rem;
  font-size: 0.95rem;
  font-weight: 600;
  color: #6b7280;
}
.note {
  margin: 0;
  text-align: center;
  font-size: 0.9rem;
  color: #4b5563;
}
</style>
