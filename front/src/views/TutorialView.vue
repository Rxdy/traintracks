<script setup lang="ts">
import { computed, inject, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import TutorialGrid from '../components/TutorialGrid.vue'
import WinReceipt from '../components/WinReceipt.vue'
import { claimReward, LESSONS, TUTORIAL_REWARD } from '../tutorial'
import { isTouch } from '../platform'
import { setCoins } from '../wallet'

// Tutoriel : cinq petits exercices, chacun en pas à pas. À chaque pas le joueur n'a le droit de faire qu'UNE action,
// sur les cases indiquées ; tout le reste est refusé. Le dernier exercice (un petit circuit) rapporte des pièces,
// une seule fois par joueur.
const go = inject<(view: string) => void>('go', () => undefined) // « Quitter » à la fin : retour à l'accueil
const at = ref(0) // exercice
const si = ref(0) // pas dans l'exercice
const hint = ref('')
const reward = ref<{ earned: number } | null>(null)
const rewardFailed = ref(false)

// Hauteur laissée à la grille : ce qui reste de l'écran sous la consigne, moins le pied de page. Recalculée à chaque
// changement de consigne, pour que la page ne défile jamais (ni à une erreur, ni à la fin).
const wrap = ref<HTMLElement | null>(null)
const avail = ref(0)
function measure(): void {
  const top = wrap.value?.getBoundingClientRect().top
  if (top === undefined) return
  const footer = document.querySelector<HTMLElement>('.footer')
  const below = (footer?.offsetHeight ?? 0) + 64 // pied de page, écart et marge du bas
  avail.value = Math.max(0, Math.floor(window.innerHeight - top - below))
}
onMounted(() => {
  measure()
  window.addEventListener('resize', measure)
})
onUnmounted(() => window.removeEventListener('resize', measure))

const lesson = computed(() => LESSONS[at.value])
const done = computed(() => si.value >= lesson.value.steps.length)
const step = computed(() => (done.value ? null : lesson.value.steps[si.value]))
const isLast = computed(() => at.value === LESSONS.length - 1)
const say = computed(() => (done.value ? lesson.value.done : (isTouch() && step.value!.textTouch) || step.value!.text))

async function advance(edges: string[]): Promise<void> {
  hint.value = ''
  si.value++
  if (si.value < lesson.value.steps.length || !isLast.value) return
  const r = await claimReward(edges)
  if (r.ok) {
    reward.value = { earned: r.earned }
    setCoins(r.coins)
  } else rewardFailed.value = true
}
watch([at, si, hint, reward, rewardFailed], () => void nextTick(measure), { flush: 'post' })
const refuse = (m: string): void => {
  hint.value = m
}
function next(): void {
  at.value++
  si.value = 0
  hint.value = ''
}
function restart(): void {
  at.value = 0
  si.value = 0
  hint.value = ''
  reward.value = null
  rewardFailed.value = false
}
</script>

<template>
  <section class="tuto" data-test="tutorial">
    <ol class="chips" aria-label="Exercices">
      <li v-for="(l, i) in LESSONS" :key="l.id" :class="{ now: i === at, past: i < at }" :data-test="'dot-' + l.id">{{ i + 1 }}</li>
    </ol>

    <div class="coach" :class="{ ok: done }" data-test="coach" aria-live="polite">
      <p class="kicker">Exercice {{ at + 1 }} sur {{ LESSONS.length }}</p>
      <h2 data-test="coach-title">{{ lesson.title.replace(/^\d+\. /, '') }}</h2>
      <p class="say" data-test="coach-text">{{ say }}</p>
      <template v-if="done && isLast">
        <WinReceipt v-if="reward && reward.earned > 0" class="receipt" :lines="[{ label: 'Tutoriel terminé', amount: reward.earned }]" />
        <p v-else-if="reward" class="small" data-test="already">Tu avais déjà reçu la récompense du tutoriel.</p>
        <p v-else-if="rewardFailed" class="small" data-test="reward-failed">Serveur injoignable : la récompense n'a pas pu être versée. Rejoue le tutoriel pour la recevoir.</p>
        <p v-else class="small">…</p>
      </template>

      <!-- Une seule zone de hauteur fixe pour le message d'erreur, les boutons et la note : rien ne bouge, rien ne fait défiler. -->
      <div class="slot">
        <p v-if="hint && !done" class="hint" data-test="hint">{{ hint }}</p>
        <button v-else-if="step?.action.type === 'info'" type="button" class="btn btn--small" data-test="ok" @click="si++">Compris</button>
        <button v-else-if="done && !isLast" type="button" class="btn btn--small" data-test="next" @click="next">Exercice suivant</button>
        <div v-else-if="done && isLast" class="end">
          <button type="button" class="btn btn--small" data-test="restart" @click="restart">Rejouer</button>
          <button type="button" class="btn btn--small btn--ghost" data-test="leave" @click="go('home')">Quitter</button>
        </div>
        <p v-else-if="at === 0 && si === 0" class="small">Terminer le tutoriel rapporte {{ TUTORIAL_REWARD }} pièces, une seule fois.</p>
      </div>
    </div>

    <div ref="wrap" class="gridwrap">
      <TutorialGrid :key="lesson.id" :lesson="lesson" :action="step?.action ?? null" :avail-height="avail" @advance="advance" @refuse="refuse" />
    </div>
  </section>
</template>

<style scoped>
.tuto {
  width: 100%;
  max-width: 36rem;
  display: grid;
  gap: 1rem;
  justify-items: center;
}
/* même langage que l'accueil : cubes arrondis à bordure blanche */
.gridwrap {
  width: 100%;
}
.chips {
  display: flex;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.chips li {
  width: 2.3rem;
  height: 2.3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #fff;
  border-radius: 30%;
  background: rgba(255, 255, 255, 0.9);
  color: #6b7280;
  font-weight: 800;
  box-shadow: 0 3px 10px rgba(30, 64, 175, 0.18);
}
.chips li.past {
  background: #16a34a;
  color: #fff;
}
.chips li.now {
  background: var(--blue);
  color: #fff;
  transform: scale(1.12);
}
.coach {
  width: 100%;
  padding: 0.9rem 1.1rem 1rem;
  border: 3px solid #fff;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: var(--shadow);
  text-align: center;
}
.kicker {
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}
.coach h2 {
  margin: 0.15rem 0 0.4rem;
  font-size: 1.4rem;
  font-weight: 800;
  color: var(--ink);
}
.coach.ok h2 {
  color: #15803d;
}
.say {
  font-size: 1.05rem;
  line-height: 1.45;
  color: #1f2937;
  min-height: 3em;
}
.slot {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 3.1rem; /* deux lignes de message */
  margin-top: 0.5rem;
}
.end {
  display: flex;
  gap: 0.6rem;
}
.hint {
  width: 100%;
  padding: 0.35rem 0.8rem;
  border-radius: 12px;
  background: #fef3c7;
  color: #78350f;
  font-weight: 600;
  font-size: 0.9rem;
  line-height: 1.25;
}
.small {
  margin: 0;
  font-size: 0.85rem;
  color: var(--muted);
}
.receipt {
  margin: 0.6rem auto 0;
}
/* Écrans bas : consigne resserrée pour laisser la place à la grille (le « Exercice n sur 5 » remplace les pastilles). */
@media (max-height: 760px) {
  .tuto {
    gap: 0.6rem;
  }
  .chips {
    display: none;
  }
  .coach {
    padding: 0.55rem 0.9rem 0.6rem;
  }
  .coach h2 {
    margin: 0 0 0.2rem;
    font-size: 1.15rem;
  }
  .say {
    min-height: 0;
    font-size: 1rem;
    line-height: 1.35;
  }
  .slot {
    height: 2.8rem;
    margin-top: 0.3rem;
  }
  .hint {
    padding: 0.25rem 0.6rem;
    font-size: 0.85rem;
  }
}
</style>
