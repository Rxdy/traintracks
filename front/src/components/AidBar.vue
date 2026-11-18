<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { Given } from '../puzzle'
import { aids, buyAid, useAid, type AidId, type AidInfo, type AidTarget } from '../wallet'
import AidIcon from './AidIcon.vue'
import CoinIcon from './CoinIcon.vue'

// Barre des aides : seules celles déjà débloquées apparaissent. Le joueur choisit toujours la cible, rien
// n'est aléatoire ; le serveur calcule le résultat et débite le stock.
const props = defineProps<{ size: number; level?: number; snapshot: () => { edges: string[]; crosses: string[]; marks: number } }>()
const emit = defineEmits<{
  (e: 'reveal', givens: Given[], crosses: { row: number; col: number }[]): void
  (e: 'picking', value: boolean): void
  (e: 'colors'): void // les indicateurs de couleur sont activés sur ce niveau
}>()

const LABEL: Record<AidId, string> = { colors: 'Couleurs', cell: 'Une case', cannon: 'Canon', line: 'Une ligne' }
const HELP: Record<AidId, string> = {
  colors: 'Active les indicateurs de couleur des compteurs sur ce niveau.',
  cell: 'Révèle le rail d\'une case que tu choisis.',
  cannon: 'Tire sur des cases de la voie que tu n\'as pas encore bien posées, et les révèle.',
  line: 'Révèle tous les rails d\'une ligne ou colonne.',
}

// Ce que montre le compteur : le stock, plus l'essai offert pas encore utilisé (4 au déblocage, puis 3).
const count = (a: AidInfo): number => a.stock + (a.demoPending ? 1 : 0)

// Tous les pouvoirs sont montrés dès le niveau 1 : ceux pas encore débloqués sont des emplacements vides, pour que le joueur
// comprenne qu'il en existe d'autres et quand ils arrivent.
const slots = computed(() => aids.value)
// Le niveau où un pouvoir se débloque : on le présente (ce qu'il fait, et l'essai offert), une seule fois par niveau.
const dismissed = ref(false)
const fresh = computed(() => (props.level ? slots.value.find((a) => a.unlocked && a.unlockLevel === props.level) : undefined))
const mode = ref<{ aid: AidInfo; step: 'buy' | 'pick' | 'line' } | null>(null)
const message = ref('')
// Le message s'efface tout seul (4 s) ou au toucher : il ne doit jamais rester sur l'écran de jeu.
let messageTimer = 0
watch(message, (m) => {
  clearTimeout(messageTimer)
  if (m) messageTimer = window.setTimeout(() => (message.value = ''), 4000)
})
onBeforeUnmount(() => clearTimeout(messageTimer))
const busy = ref(false)

function cancel(): void {
  mode.value = null
  emit('picking', false)
}

function choose(a: AidInfo): void {
  message.value = ''
  if (!a.unlocked) {
    cancel()
    message.value = `Ce pouvoir se débloque au niveau ${a.unlockLevel}.`
    return
  }
  if (mode.value?.aid.id === a.id) return cancel()
  cancel()
  if (a.usedThisLevel) {
    message.value = 'Déjà utilisée sur ce niveau.'
    return
  }
  if (a.stock === 0 && !a.demoPending) {
    mode.value = { aid: a, step: 'buy' } // prix affiché, à confirmer
    return
  }
  if (a.id === 'colors' || a.id === 'cannon') void run(a, undefined) // pas de cible : actif tout de suite
  else if (a.id === 'cell') {
    mode.value = { aid: a, step: 'pick' }
    emit('picking', true)
  } else mode.value = { aid: a, step: a.id }
}

async function run(a: AidInfo, target: AidTarget): Promise<void> {
  busy.value = true
  const snap = props.snapshot()
  const out = await useAid(a.id, target, snap.edges, snap.crosses)
  busy.value = false
  cancel()
  if (!out.ok) {
    message.value = out.error
    return
  }
  const r = out.result
  if (a.id === 'colors') {
    emit('colors')
    message.value = 'Indicateurs de couleur activés sur ce niveau.'
  } else {
    emit('reveal', r.givens ?? [], r.crosses ?? [])
    if (a.id === 'cannon') message.value = `${r.givens?.length ?? 0} cases révélées.`
    else message.value = r.givens?.length ? 'Rails révélés.' : 'Cette case reste vide.'
  }
  if (out.demo) message.value += ' (offerte)'
}

// Appelé par la grille quand le joueur touche une case pendant une aide qui attend une case.
function onPick(row: number, col: number): void {
  if (mode.value?.step === 'pick') void run(mode.value.aid, { row, col })
}

async function confirmBuy(): Promise<void> {
  if (!mode.value) return
  busy.value = true
  const out = await buyAid(mode.value.aid.id)
  busy.value = false
  message.value = out.ok ? 'Acheté.' : out.error
  mode.value = null
}

defineExpose({ onPick })
</script>

<template>
  <div v-if="slots.length" class="aids" data-test="aids">
    <p v-if="message" class="msg" data-test="aid-message" role="status" title="Toucher pour fermer" @click="message = ''">{{ message }}</p>

    <div v-if="mode" class="panel" data-test="aid-panel">
      <strong>{{ LABEL[mode.aid.id] }}</strong>
      <template v-if="mode.step === 'buy'">
        <span>{{ mode.aid.price }} <CoinIcon /> pour en racheter une.</span>
        <button type="button" class="btn btn--small" data-test="aid-confirm" :disabled="busy" @click="confirmBuy">Confirmer</button>
      </template>
      <span v-else-if="mode.step === 'pick'" data-test="aid-hint">Touche la case à révéler.</span>
      <template v-else>
        <span>Ligne :</span>
        <button v-for="i in props.size" :key="'r' + i" type="button" class="btn btn--small n" :data-test="'aid-row-' + (i - 1)" @click="run(mode.aid, { axis: 'row', index: i - 1 })">{{ i }}</button>
        <span>Colonne :</span>
        <button v-for="i in props.size" :key="'c' + i" type="button" class="btn btn--small n" :data-test="'aid-col-' + (i - 1)" @click="run(mode.aid, { axis: 'col', index: i - 1 })">{{ i }}</button>
      </template>
      <button type="button" class="btn btn--ghost btn--small" data-test="aid-cancel" @click="cancel">Annuler</button>
    </div>

    <!-- Les pouvoirs : un rectangle arrondi avec une image, un compteur qui baisse à chaque usage. -->
    <div class="row">
      <button
        v-for="a in slots"
        :key="a.id"
        type="button"
        class="aid"
        :class="{ locked: !a.unlocked, demo: a.unlocked && a.demoPending && !a.usedThisLevel, empty: a.unlocked && count(a) === 0, used: a.usedThisLevel, active: mode?.aid.id === a.id, fresh: a.unlocked && a.unlockLevel === props.level && !dismissed }"
        :data-test="'aid-' + a.id"
        :disabled="busy"
        :title="a.unlocked ? LABEL[a.id] + ' : ' + HELP[a.id] : 'Emplacement vide : se débloque au niveau ' + a.unlockLevel"
        :aria-label="a.unlocked ? LABEL[a.id] + ', ' + count(a) + ' restante' + (count(a) > 1 ? 's' : '') + (a.demoPending ? ' (une offerte)' : '') : 'Emplacement vide, se débloque au niveau ' + a.unlockLevel"
        @click="choose(a)"
      >
        <template v-if="a.unlocked">
          <span class="icon"><AidIcon :name="a.id" /></span>
          <span class="badge" data-test="aid-count">
            <template v-if="count(a) > 0">{{ count(a) }}</template>
            <template v-else>{{ a.price }}<CoinIcon size="0.8em" /></template>
          </span>
        </template>
        <span v-else class="icon slot" data-test="aid-slot"><AidIcon name="lock" /></span>
      </button>
    </div>

    <div v-if="fresh && !dismissed" class="fresh" data-test="aid-new" role="status">
      <span class="icon"><AidIcon :name="fresh.id" /></span>
      <div class="txt">
        <strong>Nouveau pouvoir : {{ LABEL[fresh.id] }}</strong>
        <span>{{ HELP[fresh.id] }} Tu en as {{ count(fresh) }} pour commencer (le bouton avec son compteur) ; une fois épuisées, tu peux en racheter avec tes pièces.</span>
      </div>
      <button type="button" class="btn btn--ghost btn--small" data-test="aid-new-ok" @click="dismissed = true">OK</button>
    </div>
  </div>
</template>

<style scoped>
.aids {
  display: grid;
  gap: 0.6rem;
  justify-items: center;
  width: min(30rem, 100%);
}
.row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.9rem;
}
.aid {
  position: relative;
  display: grid;
  place-items: center;
  width: 4.2rem;
  height: 3.4rem;
  padding: 0;
  border: 3px solid #fff;
  border-radius: 0.85rem; /* un rectangle aux angles légèrement arrondis, pas un rond */
  background: linear-gradient(#ffffff, #e8f1fb);
  box-shadow: var(--shadow);
  color: #1d4ed8;
  cursor: pointer;
}
.aid .icon {
  width: 1.9rem;
  height: 1.9rem;
}
.aid .badge {
  position: absolute;
  top: -0.35rem;
  right: -0.45rem;
  min-width: 1.35rem;
  height: 1.35rem;
  padding: 0 0.3rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  background: #1f2937;
  color: #fff;
  font-size: 0.8rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.aid .badge small {
  font-size: 0.65rem;
  margin-left: 0.1rem;
}
.aid.demo {
  border-color: #f59e0b;
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.35), var(--shadow);
}
.aid.fresh {
  animation: aid-pulse 1.6s ease-in-out infinite;
}
@keyframes aid-pulse {
  50% {
    transform: scale(1.1);
  }
}
@media (prefers-reduced-motion: reduce) {
  .aid.fresh {
    animation: none;
  }
}
.fresh {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.35rem 0.65rem;
  border-radius: 14px;
  background: #fffbeb;
  border: 2px solid #f59e0b;
  box-shadow: var(--shadow);
  color: #374151;
  font-size: 0.82rem;
  line-height: 1.3;
  text-align: left;
}
.fresh .icon {
  flex: none;
  width: 1.8rem;
  height: 1.8rem;
  color: #1d4ed8;
}
.fresh .txt {
  display: grid;
  gap: 0.15rem;
}
.aid.empty {
  color: #92400e;
  background: linear-gradient(#fffbeb, #fde68a);
}
.aid.empty .badge {
  background: #b45309;
}
.aid.locked {
  border: 3px dashed #9ca3af;
  background: rgba(255, 255, 255, 0.35);
  box-shadow: none;
  color: #9ca3af;
}
.aid.locked .icon {
  width: 1.3rem;
  height: 1.3rem;
}
.aid.used {
  opacity: 0.45;
}
.aid.active {
  border-color: #2563eb;
}
.aid:disabled {
  cursor: default;
}
.panel,
.msg {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.4rem 0.8rem;
  border-radius: 14px;
  background: #fff;
  box-shadow: var(--shadow);
  font-weight: 600;
  color: #374151;
}
.msg {
  cursor: pointer;
  display: block;
  text-align: center;
}
.n {
  min-width: 2rem;
}
</style>
