<script setup lang="ts">
import { computed, inject, nextTick, onMounted, ref, watch } from 'vue'
import AuthPanel from '../components/AuthPanel.vue'
import CoinIcon from '../components/CoinIcon.vue'
import { user } from '../auth'
import { fetchStats, formatLong, formatTime, type StatsData } from '../stats'
import { PAL, THEME_NAMES, LEVELS_PER_THEME, themeForLevel } from '../scenery'
import { SKY } from '../scenery/sky'

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
// La frise du voyage : tous les niveaux déjà parcourus, du premier au niveau en cours, et rien au-delà.
// Chaque niveau : son numéro, et dessous la couleur de son environnement (le nom au début de chaque environnement).
// Par défaut on voit les 10 derniers ; on fait défiler vers la gauche pour remonter jusqu'au niveau 1.
// Le joueur ne voit jamais la suite : le voyage paraît sans fin.
// Les niveaux groupés par environnement : chaque groupe est un petit bandeau de paysage (son ciel, son sol).
const frieze = computed(() => {
  const level = j.value?.level ?? 1
  const groups: { theme: string; style: Record<string, string>; levels: { n: number; here: boolean }[] }[] = []
  for (let n = 1; n <= level; n++) {
    const t = themeForLevel(n)
    if (!groups.length || groups[groups.length - 1]!.theme !== t || groups[groups.length - 1]!.levels.length >= LEVELS_PER_THEME) {
      const sky = SKY[t], pal = PAL[t]
      groups.push({ theme: t, style: { '--s1': sky.top, '--s2': sky.low, '--g1': pal.a, '--g2': pal.b }, levels: [] })
    }
    groups[groups.length - 1]!.levels.push({ n, here: n === level })
  }
  return groups
})
const current = computed(() => THEME_NAMES[themeForLevel(j.value?.level ?? 1)])
const crossed = computed(() => Math.floor(((j.value?.level ?? 1) - 1) / LEVELS_PER_THEME))
const strip = ref<HTMLElement | null>(null)
// à l'ouverture (et quand les chiffres arrivent) : la frise est calée sur le niveau en cours, à droite
watch(frieze, async () => {
  await nextTick()
  if (strip.value) strip.value.scrollLeft = strip.value.scrollWidth
}, { flush: 'post' })
// les pièces : ce qu'on a, ce qu'on a dépensé, ce qu'on a gagné en tout
const spent = computed(() => (j.value ? Math.max(0, j.value.coinsEarned - j.value.coins) : 0))
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
        <!-- la frise des niveaux parcourus ; on fait défiler vers la gauche pour remonter au début -->
        <div ref="strip" class="frieze" data-test="frieze" tabindex="0" aria-label="Les niveaux parcourus, du premier au niveau en cours">
          <div v-for="(g, gi) in frieze" :key="gi" class="env" :style="g.style" :title="THEME_NAMES[g.theme as keyof typeof THEME_NAMES]">
            <div v-for="c in g.levels" :key="c.n" class="lvl" :class="{ here: c.here }" :data-test="c.here ? 'frieze-here' : undefined">
              <span class="num">{{ c.n }}</span>
              <span v-if="c.here" class="loco" aria-hidden="true">
                <svg viewBox="0 0 36 22"><rect x="2" y="7" width="20" height="10" rx="3" fill="#dc2626" /><rect x="15" y="2" width="9" height="15" rx="2" fill="#991b1b" /><rect x="5" y="3" width="4" height="6" rx="1" fill="#1f2937" /><circle cx="8" cy="18" r="3" fill="#1f2937" /><circle cx="19" cy="18" r="3" fill="#1f2937" /></svg>
              </span>
            </div>
          </div>
        </div>
        <p class="place" data-test="place">
          <b>{{ current }}</b> · l'environnement que tu traverses
          <span class="crossed">{{ crossed }} environnement{{ crossed > 1 ? 's' : '' }} traversé{{ crossed > 1 ? 's' : '' }}</span>
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

      <!-- les pièces : trois chiffres, sans le détail de leur origine -->
      <article class="card coins">
        <h2>Pièces</h2>
        <div class="purse">
          <div><span>En poche</span><b data-test="coins-now"><CoinIcon size="0.8em" /> {{ j ? j.coins : '…' }}</b></div>
          <div><span>Dépensées</span><b data-test="coins-spent">{{ j ? spent : '…' }}</b></div>
          <div><span>Gagnées au total</span><b data-test="coins-earned">{{ j ? j.coinsEarned : '…' }}</b></div>
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
.frieze {
  display: flex;
  gap: 0.35rem;
  overflow-x: auto;
  padding: 0.3rem 0.2rem 0.5rem;
  scroll-behavior: smooth;
  scrollbar-width: thin;
  /* à gauche, le passé s'estompe : on devine qu'on peut remonter */
  mask-image: linear-gradient(90deg, transparent, #000 3rem);
}
.frieze:focus-visible {
  outline: 3px solid var(--gold);
  outline-offset: 2px;
}
/* un environnement : un bandeau de paysage (ciel en haut, sol et collines en bas) qui englobe ses niveaux */
.env {
  flex: none;
  display: flex;
  padding: 0.55rem 0.35rem 1.35rem;
  border-radius: 0.9rem;
  border: 2px solid #fff;
  box-shadow: 0 2px 6px rgba(30, 64, 175, 0.15);
  /* des collines rondes sur l'horizon (deux rangs décalés), le sol, le ciel */
  background:
    radial-gradient(circle at 50% 100%, var(--g2) 0 60%, transparent 61%) 0.8rem 100% / 3.4rem 1.5rem repeat-x,
    radial-gradient(circle at 50% 100%, var(--g1) 0 60%, transparent 61%) 0 calc(100% - 0.7rem) / 4.6rem 1.9rem repeat-x,
    linear-gradient(var(--s1), var(--s2) 55%, var(--g1) 55%, var(--g2));
}
.lvl {
  position: relative;
  flex: none;
  /* à l'ouverture, les 10 niveaux d'avant et le niveau en cours remplissent la largeur */
  width: max(2.6rem, calc((min(100vw, 96rem) - 6rem) / 11));
  display: grid;
  place-items: center;
}
.num {
  display: grid;
  place-items: center;
  width: calc(100% - 0.45rem);
  max-width: 4.2rem;
  height: 2.1rem;
  border-radius: 0.55rem;
  background: rgba(255, 255, 255, 0.92);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--navy);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
}
.lvl.here .num {
  background: var(--navy);
  color: #fff;
  box-shadow: 0 0 0 3px var(--gold);
}
.loco {
  position: absolute;
  bottom: -1.3rem;
  width: 1.8rem;
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
  align-items: baseline;
  justify-content: space-between;
  gap: 0.6rem;
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
  color: #92400e;
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
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
  .frieze {
    scroll-behavior: auto;
  }
}
</style>
