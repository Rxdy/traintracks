<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { WAGON_IDS, MAX_PER_WAGON } from '../../../shared/wagons.js'
import { drawWagon, myTrain } from '../myTrain'
import { coins } from '../wallet'
import { styleOf, wagonLabel } from '../trainStyle'
import { sound } from '../sound/director'
import CoinIcon from './CoinIcon.vue'
import WagonThumb from './WagonThumb.vue'

// La machine « Wagon surprise » : on tire la manette, trois rouleaux défilent longtemps et s'arrêtent un à un, de gauche
// à droite. Le serveur décide (2 chances sur 3) : gagné, les trois s'arrêtent sur le même wagon, un wagon qu'on a moins
// de 6 fois ; perdu, ils s'arrêtent sur des wagons différents (souvent les deux premiers pareils : presque !).
// Chaque rouleau montre 3 wagons ; seule la ligne du milieu compte.
const emit = defineEmits<{ (e: 'close'): void; (e: 'myTrain'): void }>()

type Phase = 'idle' | 'spinning' | 'won' | 'lost'
const phase = ref<Phase>('idle')
const prize = ref<string | null>(null)
const added = ref(false)
const message = ref('')
const pulled = ref(false)

const DURATIONS = [2.2, 3.5, 5.0] // s : les rouleaux s'arrêtent un à un, le dernier se fait attendre
const pick = () => WAGON_IDS[Math.floor(Math.random() * WAGON_IDS.length)]!
const randomStrip = (n: number) => Array.from({ length: n }, pick)
// chaque rouleau : sa bande de wagons, sa position (en wagons) et la durée de son arrêt
const reels = ref(DURATIONS.map(() => ({ items: randomStrip(3), at: 0, dur: 0 })))
const stopped = ref(0) // rouleaux déjà arrêtés (0 à 3)
// perdu : trois wagons qui ne sont pas tous pareils ; une fois sur deux, les deux premiers le sont
function losing(): string[] {
  const a = pick()
  const b = Math.random() < 0.5 ? a : pick()
  let c = pick()
  while (c === a) c = pick() // le troisième n'est jamais le premier : jamais trois pareils
  return [a, b, c]
}
let stopTimers: number[] = []

const price = computed(() => myTrain.value.price)
const left = computed(() => myTrain.value.left)
const poor = computed(() => (coins.value ?? 0) < price.value)
const prizeStyle = computed(() => (prize.value ? styleOf(prize.value) : null))
const prizeCount = computed(() => (prize.value ? myTrain.value.owned[prize.value] ?? 0 : 0))

async function pull(): Promise<void> {
  if (phase.value === 'spinning') return
  message.value = ''
  if (left.value === 0) {
    message.value = 'Tu as déjà tous les wagons !'
    return
  }
  if (poor.value) {
    message.value = `Il te faut ${price.value} pièces pour un tirage. Joue des niveaux pour en gagner.`
    sound.sfx('error')
    return
  }
  pulled.value = true
  window.setTimeout(() => (pulled.value = false), 450)
  phase.value = 'spinning'
  sound.sfx('coin')
  const out = await drawWagon()
  if (!out.ok) {
    phase.value = 'idle'
    message.value = out.error
    sound.sfx('error')
    return
  }
  prize.value = out.wagon
  added.value = out.added
  const mids = out.wagon ? [out.wagon, out.wagon, out.wagon] : losing()
  stopped.value = 0
  // les bandes : du hasard, puis [voisin, ARRÊT, voisin] ; on repart du haut sans animation
  reels.value = DURATIONS.map((_d, k) => {
    const n = 30 + k * 14
    const items = [...randomStrip(n), pick(), mids[k]!, pick()]
    return { items, at: 0, dur: 0 }
  })
  await nextTick()
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      reels.value = reels.value.map((r, k) => ({ ...r, at: r.items.length - 3, dur: DURATIONS[k]! }))
    }),
  )
  stopTimers = DURATIONS.map((d, k) =>
    window.setTimeout(() => {
      stopped.value = k + 1
      sound.sfx('pose')
    }, d * 1000 + 30 * k),
  )
  stopTimer = window.setTimeout(() => {
    phase.value = out.wagon ? 'won' : 'lost'
    sound.sfx(out.wagon ? 'reveal' : 'error')
  }, DURATIONS[DURATIONS.length - 1]! * 1000 + 200)
}
let stopTimer = 0

const onKey = (e: KeyboardEvent) => e.key === 'Escape' && phase.value !== 'spinning' && emit('close')
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  clearTimeout(stopTimer)
  stopTimers.forEach(clearTimeout)
})
</script>

<template>
  <Teleport to="body">
    <div class="back" data-test="machine" @click.self="phase !== 'spinning' && emit('close')">
      <div class="wrap" role="dialog" aria-modal="true" aria-label="Wagon surprise">
        <button type="button" class="close" data-test="machine-close" aria-label="Fermer" :disabled="phase === 'spinning'" @click="emit('close')">✕</button>
        <p class="purse" data-test="machine-coins">{{ coins ?? 0 }} <CoinIcon /></p>

        <div class="machine" :class="{ won: phase === 'won' }">
          <div class="marquee">
            <span v-for="b in 11" :key="b" class="bulb" :style="{ '--b': b }" />
            <strong>WAGON SURPRISE</strong>
          </div>
          <div class="cabinet">
            <div class="reels">
              <div v-for="(r, k) in reels" :key="k" class="reel" :class="{ blur: phase === 'spinning' && r.dur > 0 && stopped <= k, stop: stopped > k && phase === 'spinning' }" data-test="reel">
                <div class="strip" :style="{ transform: `translateY(calc(var(--item) * ${-r.at}))`, transition: r.dur ? `transform ${r.dur}s cubic-bezier(.12,.62,.2,1)` : 'none' }">
                  <span v-for="(id, j) in r.items" :key="j" class="cell" :class="{ mid: j === r.at + 1 }" :data-test="j === r.at + 1 ? 'reel-mid' : undefined" :data-wagon="id"><WagonThumb :id="id" /></span>
                </div>
              </div>
              <span class="line" aria-hidden="true" />
            </div>
            <p class="plate" data-test="machine-plate">
              <template v-if="phase === 'won' && prizeStyle">Gagné !</template>
              <template v-else-if="phase === 'lost'">Perdu</template>
              <template v-else-if="phase === 'spinning'">Ça tourne…</template>
              <template v-else>{{ price }} <CoinIcon /> le tirage</template>
            </p>
          </div>
          <p class="counter" data-test="machine-left">Encore {{ left }} wagon{{ left > 1 ? 's' : '' }} à gagner</p>
          <!-- la manette -->
          <button type="button" class="lever" :class="{ pulled }" data-test="machine-pull" :disabled="phase === 'spinning'" aria-label="Tirer la manette" @click="pull">
            <span class="rod" /><span class="knob" />
          </button>
        </div>

        <div class="result" role="status">
          <template v-if="phase === 'won' && prizeStyle">
            <strong data-test="machine-prize">{{ wagonLabel(prize!) }} !</strong>
            <span>Tu en as {{ prizeCount }}/{{ MAX_PER_WAGON }}. {{ added ? 'Il roule déjà dans ton train.' : 'Ton train est plein : choisis sa place dans Mon train.' }}</span>
          </template>
          <template v-else-if="phase === 'lost'">
            <strong data-test="machine-lost">Pas de wagon cette fois.</strong>
            <span>Il faut trois wagons pareils.</span>
          </template>
          <span v-else-if="message" class="err" data-test="machine-msg">{{ message }}</span>
          <span v-else-if="phase === 'idle'">Trois wagons pareils : il est à toi. Deux chances sur trois.</span>
          <div v-if="phase !== 'spinning'" class="actions">
            <button type="button" class="btn btn--small" data-test="machine-again" :disabled="left === 0" @click="pull">{{ phase === 'won' || phase === 'lost' ? 'Encore' : 'Tirer' }} · {{ price }} <CoinIcon /></button>
            <button v-if="phase === 'won'" type="button" class="btn btn--ghost btn--small" data-test="machine-my-train" @click="emit('myTrain')">Ma collection</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.back {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 0.75rem;
  background: rgba(15, 23, 42, 0.62);
}
.wrap {
  /* taille d'un wagon dans un rouleau : la machine entière tient en hauteur (téléphone couché) comme en largeur */
  --item: clamp(2.4rem, min(calc((100dvh - 8.5rem) / 4.6), 12vw), 4.4rem);
  position: relative;
  display: flex;
  align-items: center;
  gap: 1rem;
  max-width: 100%;
}
@media (orientation: portrait) {
  .wrap {
    flex-direction: column;
  }
}
.close {
  position: fixed;
  left: 0.75rem;
  top: 0.75rem;
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 50%;
  border: 0;
  background: #fff;
  font-weight: 800;
  font-size: 1.1rem;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  cursor: pointer;
}
.purse {
  position: fixed;
  right: 0.75rem;
  top: 0.75rem;
  margin: 0;
  padding: 0.35rem 0.8rem;
  border-radius: 999px;
  background: #fff;
  color: #92400e;
  font-weight: 800;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
}
.machine {
  position: relative;
  width: calc(var(--item) * 4.9);
  margin-right: 2.4rem; /* la manette */
}
.marquee {
  position: relative;
  margin: 0 1.6rem;
  height: calc(var(--item) * 0.95);
  border-radius: 999px 999px 0.6rem 0.6rem;
  background: linear-gradient(#991b1b, #7f1d1d);
  border: 4px solid #e2b33c;
  box-shadow: 0 4px 0 #5b1212;
  display: grid;
  place-items: end center;
  padding-bottom: 0.35rem;
}
.marquee strong {
  color: #fde68a;
  font-size: calc(var(--item) * 0.3);
  letter-spacing: 0.08em;
  text-shadow: 0 2px 0 #7c2d12, 0 0 10px rgba(253, 230, 138, 0.6);
  white-space: nowrap;
}
.bulb {
  position: absolute;
  top: 0.3rem;
  left: calc(8% + (var(--b) - 1) * 8.4%);
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: #fde68a;
  box-shadow: 0 0 6px 2px rgba(253, 224, 71, 0.8);
  animation: blink 0.9s steps(2) infinite;
  animation-delay: calc(var(--b) * -0.45s);
}
.won .bulb {
  animation-duration: 0.3s;
}
@keyframes blink {
  50% {
    background: #fff7d6;
    box-shadow: 0 0 2px 1px rgba(253, 224, 71, 0.3);
  }
}
.cabinet {
  margin-top: 0.25rem;
  padding: 0.7rem 0.8rem 0.6rem;
  border-radius: 1.2rem;
  background: linear-gradient(#dc2626, #991b1b 70%, #7f1d1d);
  border: 4px solid #e2b33c;
  box-shadow: inset 0 6px 0 rgba(255, 255, 255, 0.18), 0 8px 18px rgba(0, 0, 0, 0.45);
}
.reels {
  position: relative;
  display: flex;
  gap: 0.4rem;
  padding: 0.4rem;
  border-radius: 0.8rem;
  background: #5b1212;
}
.reel {
  position: relative;
  flex: 1;
  height: calc(var(--item) * 3);
  overflow: hidden;
  border-radius: 0.55rem;
  background: linear-gradient(#fffbeb, #fef3c7);
  box-shadow: inset 0 4px 8px rgba(0, 0, 0, 0.35);
}
.reel::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(rgba(0, 0, 0, 0.38), transparent 24%, transparent 76%, rgba(0, 0, 0, 0.38));
  pointer-events: none;
}
.strip {
  will-change: transform;
}
/* un rouleau qui vient de s'arrêter : un petit rebond, son cadre s'éclaire */
.reel.stop {
  animation: reel-stop 0.35s ease-out;
  box-shadow: 0 0 0 3px #fbbf24;
}
@keyframes reel-stop {
  40% { transform: translateY(4px); }
}
@media (prefers-reduced-motion: reduce) {
  .reel.stop { animation: none; }
}
.reel.blur .strip {
  filter: blur(1.5px);
}
.cell {
  display: grid;
  place-items: center;
  height: var(--item);
  padding: 0 0.2rem;
  opacity: 0.75;
}
.cell.mid {
  opacity: 1;
}
.line {
  position: absolute;
  left: 0.15rem;
  right: 0.15rem;
  top: calc(0.4rem + var(--item));
  height: var(--item);
  border-radius: 0.6rem;
  border: 3px solid rgba(253, 230, 138, 0.7);
  pointer-events: none;
}
.won .line {
  border-color: #fde68a;
  box-shadow: 0 0 18px 5px rgba(253, 224, 71, 0.85), inset 0 0 14px rgba(253, 224, 71, 0.5);
}
.plate {
  margin: 0.55rem 1.4rem 0;
  padding: 0.35rem;
  border-radius: 0.6rem;
  background: linear-gradient(#fde68a, #e2b33c);
  box-shadow: inset 0 -3px 0 #b45309;
  text-align: center;
  font-weight: 800;
  color: #3b2400;
}
.counter {
  margin: 0 2rem;
  padding: 0.3rem 0.5rem;
  border-radius: 0 0 0.8rem 0.8rem;
  background: #5b1212;
  border: 4px solid #e2b33c;
  border-top: 0;
  text-align: center;
  color: #fde68a;
  font-weight: 800;
  font-size: 0.78rem;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.lever {
  position: absolute;
  right: -2.4rem;
  top: calc(var(--item) * 1.6);
  width: 2.2rem;
  height: calc(var(--item) * 2.4);
  border: 0;
  padding: 0;
  background: none;
  cursor: pointer;
}
.lever:disabled {
  cursor: default;
}
.rod {
  position: absolute;
  left: calc(50% - 5px);
  bottom: 50%;
  width: 10px;
  height: 50%;
  border-radius: 5px;
  background: linear-gradient(90deg, #d1d5db, #6b7280);
  transform-origin: 50% 100%;
  transition: transform 0.2s ease-in;
}
.knob {
  position: absolute;
  left: calc(50% - 1rem);
  top: -0.6rem;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #fca5a5, #dc2626 55%, #7f1d1d);
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.4);
  transition: transform 0.2s ease-in;
}
.lever::before {
  content: '';
  position: absolute;
  left: 0.3rem;
  right: 0.3rem;
  top: calc(50% - 0.9rem);
  height: 1.8rem;
  border-radius: 0.45rem;
  background: linear-gradient(90deg, #d1d5db, #6b7280);
  border: 3px solid #e2b33c;
}
.lever.pulled .rod {
  transform: scaleY(-1);
}
.lever.pulled .knob {
  transform: translateY(calc(var(--item) * 2.4 - 0.6rem));
}
.result {
  width: min(15rem, 80vw);
  padding: 0.75rem;
  border-radius: 1rem;
  background: #fff;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-size: 0.9rem;
}
.result strong {
  font-size: 1.05rem;
}
.result strong::first-letter {
  text-transform: uppercase;
}
.err {
  color: #b91c1c;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
@media (prefers-reduced-motion: reduce) {
  .bulb {
    animation: none;
  }
  .rod,
  .knob {
    transition: none;
  }
}
</style>
