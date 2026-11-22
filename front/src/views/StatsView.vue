<script setup lang="ts">
import { computed, inject, onMounted, ref, watch } from 'vue'
import AuthPanel from '../components/AuthPanel.vue'
import CoinIcon from '../components/CoinIcon.vue'
import { user } from '../auth'
import { fetchStats, formatLong, formatTime, type StatsData } from '../stats'
import { PAL, THEME_NAMES, LEVELS_PER_THEME, themeForLevel } from '../scenery'

// Statistiques, dans l'esprit du jeu : le voyage dessiné comme une ligne de chemin de fer (une gare par environnement,
// le train là où on en est), les temps sur des billets, les tailles de grille en barres, le puzzle du jour et sa série.
// Tout vient du serveur.
const go = inject<(view: string) => void>('go', () => undefined)
const s = ref<StatsData | null>(null)
async function refresh(): Promise<void> {
  s.value = user.value ? await fetchStats() : null
}
onMounted(refresh)
watch(user, refresh)

const j = computed(() => s.value?.journey ?? null)
const d = computed(() => s.value?.daily ?? null)
// La ligne du voyage : les environnements traversés, celui en cours, puis la voie qui continue et s'efface.
// Le joueur ne voit jamais de fin (ni nombre total de niveaux, ni nombre d'environnements) : le voyage paraît sans fin.
const SHOWN_BEHIND = 6 // environnements traversés montrés au plus (les plus récents)
const AHEAD = 4 // tronçons à venir, de plus en plus pâles, sans nom
const line = computed(() => {
  const level = j.value?.level ?? 1
  const per = LEVELS_PER_THEME
  const crossed = Math.floor((level - 1) / per) // environnements traversés depuis le début
  const from = Math.max(0, crossed - SHOWN_BEHIND)
  const stops: { name: string; color: string; done: boolean; here: boolean; fade: number }[] = []
  for (let k = from; k <= crossed; k++) {
    const t = themeForLevel(k * per + 1)
    stops.push({ name: THEME_NAMES[t], color: PAL[t].a, done: k < crossed, here: k === crossed, fade: 1 })
  }
  for (let a = 1; a <= AHEAD; a++) stops.push({ name: '', color: '#cbd5e1', done: false, here: false, fade: 1 - a / (AHEAD + 1) })
  const inChapter = ((level - 1) % per) / per // où en est le train dans l'environnement en cours
  const progress = (crossed - from + inChapter) / stops.length
  return { stops, crossed, progress, current: THEME_NAMES[themeForLevel(level)] }
})
const maxCount = computed(() => Math.max(1, ...(j.value?.bySize ?? []).map((z) => z.count)))
</script>

<template>
  <section class="stats" data-test="stats">
    <AuthPanel v-if="!user" />
    <template v-else>
      <!-- le voyage : la ligne de chemin de fer du tour en cours -->
      <article class="card voyage">
        <header class="head">
          <div>
            <p class="eyebrow">Voyage de {{ user.name }}</p>
            <p class="level">Niveau <b data-test="highest">{{ j ? j.level : '…' }}</b></p>
          </div>
          <p class="sub"><span data-test="solved">{{ j ? j.solved : '…' }}</span> niveau{{ j && j.solved > 1 ? 'x' : '' }} terminé{{ j && j.solved > 1 ? 's' : '' }}</p>
        </header>
        <div class="line" aria-hidden="true">
          <div class="rails" />
          <div class="segs">
            <span v-for="(st, k) in line.stops" :key="k" class="seg" :class="{ done: st.done, here: st.here, ahead: !st.name }" :style="{ '--c': st.color, '--f': st.fade }" :title="st.name || undefined" />
          </div>
          <span class="train" :style="{ left: `calc(${line.progress * 100}% - 0.9rem)` }">
            <svg viewBox="0 0 36 22"><rect x="2" y="7" width="20" height="10" rx="3" fill="#dc2626" /><rect x="15" y="2" width="9" height="15" rx="2" fill="#991b1b" /><rect x="5" y="3" width="4" height="6" rx="1" fill="#1f2937" /><circle cx="8" cy="18" r="3" fill="#1f2937" /><circle cx="19" cy="18" r="3" fill="#1f2937" /><rect x="26" y="9" width="9" height="8" rx="2" fill="#f59e0b" /><circle cx="30.5" cy="18.5" r="2.4" fill="#1f2937" /></svg>
          </span>
        </div>
        <p class="place" data-test="place">
          <b>{{ line.current }}</b> · l'environnement que tu traverses
          <span class="crossed">{{ line.crossed }} environnement{{ line.crossed > 1 ? 's' : '' }} traversé{{ line.crossed > 1 ? 's' : '' }}</span>
        </p>
      </article>

      <!-- les temps, sur des billets -->
      <article class="card times">
        <h2>Temps</h2>
        <div class="tickets">
          <div class="ticket"><span>Temps de jeu</span><b data-test="playtime">{{ j ? formatLong(j.totalTimeMs) : '…' }}</b></div>
          <div class="ticket"><span>Temps moyen</span><b>{{ j ? formatTime(j.avgMs) : '…' }}</b></div>
          <div class="ticket"><span>Le plus rapide</span><b data-test="fastest">{{ j?.fastest ? formatTime(j.fastest.timeMs) : '—' }}</b><small v-if="j?.fastest">niv. {{ j.fastest.level }}</small></div>
          <div class="ticket"><span>Le plus long</span><b>{{ j?.slowest ? formatTime(j.slowest.timeMs) : '—' }}</b><small v-if="j?.slowest">niv. {{ j.slowest.level }}</small></div>
        </div>
      </article>

      <!-- les pièces -->
      <article class="card coins">
        <h2>Pièces</h2>
        <div class="purse">
          <div><b data-test="coins-earned">{{ j ? j.coinsEarned : '…' }}</b><span>gagnées en jouant</span></div>
          <div><b><CoinIcon size="0.8em" /> {{ j ? j.coins : '…' }}</b><span>dans ta poche</span></div>
        </div>
      </article>

      <!-- par taille de grille -->
      <article v-if="j && j.bySize.length" class="card sizes-card">
        <h2>Par taille de grille</h2>
        <ul class="sizes" data-test="by-size">
          <li v-for="z in j.bySize" :key="z.size">
            <b class="sz">{{ z.size }}×{{ z.size }}</b>
            <span class="bar"><i :style="{ width: (z.count / maxCount) * 100 + '%' }" /></span>
            <span class="n">{{ z.count }} niveau{{ z.count > 1 ? 'x' : '' }}</span>
            <span class="t">moy. {{ formatTime(z.avgMs) }}</span>
            <span class="t">record {{ formatTime(z.bestMs) }}</span>
          </li>
        </ul>
      </article>

      <!-- le puzzle du jour -->
      <article v-if="d" class="card daily">
        <h2>Puzzle du jour</h2>
        <div class="streak">
          <div class="big"><b data-test="streak">{{ d.streak }}</b><span>jour{{ d.streak > 1 ? 's' : '' }} d'affilée</span></div>
          <div class="small">
            <p><span>Meilleure série</span><b data-test="best-streak">{{ d.bestStreak }}</b></p>
            <p><span>Grilles faites</span><b data-test="count">{{ d.count }}</b></p>
          </div>
        </div>
        <div class="tickets three">
          <div class="ticket"><span>Moyenne</span><b>{{ formatTime(d.avgMs) }}</b></div>
          <div class="ticket"><span>Meilleur temps</span><b>{{ formatTime(d.bestMs) }}</b></div>
          <div class="ticket"><span>Pire temps</span><b>{{ formatTime(d.worstMs) }}</b></div>
        </div>
      </article>

      <button type="button" class="btn rank" data-test="to-ranking" @click="go('ranking')">Voir le classement</button>
    </template>
  </section>
</template>

<style scoped>
.stats {
  --navy: #2f4a6b;
  --ink: #1f2937;
  --muted: #5b6676;
  --gold: #e2b33c;
  width: 100%;
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 0.9rem;
  align-items: start;
  color: var(--ink);
}
.stats > :deep([data-test='auth']) {
  grid-column: 1 / -1;
  justify-self: center;
}
.card {
  border-radius: 1.3rem;
  border: 3px solid #fff;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 3px 10px rgba(30, 64, 175, 0.15);
  padding: 1rem 1.2rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-width: 0;
}
h2 {
  margin: 0;
  font-size: 1rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--navy);
}
.voyage {
  grid-column: 1 / -1;
}
.times {
  grid-column: span 4;
}
.coins {
  grid-column: span 2;
}
.sizes-card {
  grid-column: span 3;
}
.daily {
  grid-column: span 3;
}
.rank {
  grid-column: 1 / -1;
  justify-self: center;
}
@media (max-width: 52rem) {
  .times,
  .coins,
  .sizes-card,
  .daily {
    grid-column: 1 / -1;
  }
}

/* le voyage */
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.5rem 1rem;
}
.eyebrow {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
}
.level {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 800;
}
.level b {
  font-size: 2.6rem;
  color: var(--navy);
  font-variant-numeric: tabular-nums;
}
.sub {
  margin: 0;
  color: var(--muted);
  font-weight: 600;
}
.line {
  position: relative;
  height: 3.2rem;
  margin: 0.3rem 0.4rem 0;
}
.rails {
  position: absolute;
  left: 0;
  right: 0;
  /* la voie continue au-delà et s'efface : pas de bout visible */
  mask-image: linear-gradient(90deg, #000 70%, transparent);
  top: 2.15rem;
  height: 0.5rem;
  border-top: 3px solid #6b7280;
  border-bottom: 3px solid #6b7280;
  background: repeating-linear-gradient(90deg, #7a4e2d 0 5px, transparent 5px 12px);
}
.segs {
  position: absolute;
  left: 0;
  right: 0;
  top: 1.5rem;
  display: flex;
  gap: 3px;
}
.seg {
  flex: 1;
  height: 0.45rem;
  border-radius: 999px;
  background: var(--c);
  opacity: 0.35;
}
.seg.done {
  opacity: 1;
}
.seg.ahead {
  opacity: var(--f);
}
.seg.here {
  opacity: 1;
  box-shadow: 0 0 0 2px #fff, 0 0 0 4px var(--gold);
}
.train {
  position: absolute;
  top: 0;
  width: 2.2rem;
  transition: left 0.6s ease;
}
.place {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.25rem 0.5rem;
  color: var(--muted);
}
.place b {
  color: var(--ink);
  font-size: 1.1rem;
}
.crossed {
  margin-left: auto;
  padding: 0.1rem 0.6rem;
  border-radius: 999px;
  background: #ecfdf5;
  color: #166534;
  font-weight: 700;
  font-size: 0.85rem;
}

/* les billets */
.tickets {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
  gap: 0.6rem;
}
.ticket {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding: 0.65rem 0.9rem 0.65rem 1.3rem;
  border-radius: 0.7rem;
  background: #fff8e6;
  border: 1.5px dashed #e7c77a;
}
.ticket::before {
  /* l'encoche du billet */
  content: '';
  position: absolute;
  left: -0.55rem;
  top: calc(50% - 0.5rem);
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  background: #fff;
  border: 1.5px dashed #e7c77a;
  border-left-color: transparent;
  border-bottom-color: transparent;
  transform: rotate(45deg);
}
.ticket span {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #92400e;
}
.ticket b {
  font-size: 1.6rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--ink);
}
.ticket small {
  color: var(--muted);
  font-weight: 600;
}

/* les pièces */
.purse {
  display: grid;
  gap: 0.6rem;
}
.purse div {
  display: flex;
  flex-direction: column;
  padding: 0.6rem 0.9rem;
  border-radius: 0.8rem;
  background: #fffbeb;
}
.purse b {
  font-size: 1.6rem;
  font-weight: 800;
  color: #92400e;
  font-variant-numeric: tabular-nums;
}
.purse span {
  color: var(--muted);
  font-size: 0.85rem;
}

/* par taille */
.sizes {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.55rem;
}
.sizes li {
  display: grid;
  grid-template-columns: 2.6rem minmax(4rem, 1fr) auto;
  grid-template-areas: 'sz bar n' 'sz t t';
  align-items: center;
  column-gap: 0.6rem;
  font-size: 0.85rem;
}
.sz {
  grid-area: sz;
  display: grid;
  place-items: center;
  height: 2.4rem;
  border-radius: 0.6rem;
  background: var(--navy);
  color: #fff;
  font-weight: 800;
}
.bar {
  grid-area: bar;
  height: 0.6rem;
  border-radius: 999px;
  background: #e5edf6;
  overflow: hidden;
}
.bar i {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #60a5fa, #2563eb);
}
.n {
  grid-area: n;
  font-weight: 700;
}
.t {
  grid-area: t;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.sizes li .t + .t {
  margin-left: 6.5rem;
}

/* puzzle du jour */
.streak {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}
.big {
  flex: 1 1 8rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0.6rem;
  border-radius: 0.9rem;
  background: linear-gradient(#fff7ed, #ffedd5);
}
.big b {
  font-size: 2.6rem;
  font-weight: 800;
  color: #c2410c;
  line-height: 1;
}
.big span {
  font-weight: 700;
  color: #9a3412;
}
.small {
  flex: 1 1 9rem;
  display: grid;
  gap: 0.4rem;
}
.small p {
  margin: 0;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 0.45rem 0.8rem;
  border-radius: 0.7rem;
  background: #f1f5f9;
}
.small b {
  font-size: 1.2rem;
  font-variant-numeric: tabular-nums;
}
@media (prefers-reduced-motion: reduce) {
  .train {
    transition: none;
  }
}
</style>
