<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import HeroArt from '../components/HeroArt.vue'
import MenuIcon from '../components/MenuIcon.vue'
import TrackGrid from '../components/TrackGrid.vue'
import AidBar from '../components/AidBar.vue'
import CabinFrame from '../components/CabinFrame.vue'
import type { Route } from '../trainRoute'
import type { LandFrame } from '../scenery/motion'
import type { Scenery } from '../scenery'
import CoinBadge from '../components/CoinBadge.vue'
import QuitButton from '../components/QuitButton.vue'
import WinReceipt from '../components/WinReceipt.vue'
import { beginLevel, fetchStatus, setHomeLevel, startLevel, submitLevel, type JourneyStatus, type PlayLevel, type StartedLevel } from '../journey'
import { refreshWallet, setCoins } from '../wallet'
import { user } from '../auth'
import { themeForLevel } from '../scenery'
import { sound } from '../sound/director'

// Le Voyage : page principale. On ne montre que le niveau en cours (pas de
// liste, pas de taille de grille) et un gros bouton pour jouer.
const emit = defineEmits<{
  (e: 'playing', value: boolean): void
  (e: 'navigate', view: string): void
}>()

// Petits cubes d'accès aux autres écrans, de part et d'autre du grand cube.
const leftCubes = [
  { id: 'daily', label: 'Puzzle du jour' },
  { id: 'tuto', label: 'Tutoriel' },
  { id: 'ranking', label: 'Classement' },
] as const
// Ces écrans demandent un compte : cadenas tant qu'on n'est pas connecté
// (le cube mène alors à l'écran de connexion).
const needsAccount = new Set(['daily', 'stats'])
const isLocked = (id: string) => needsAccount.has(id) && !user.value
const rightCubes = [
  { id: 'stats', label: 'Statistiques' },
  { id: 'account', label: 'Compte' },
] as const
// Compte : l'initiale du joueur quand il est connecté
const initial = computed(() => user.value?.name.trim().charAt(0).toUpperCase() || undefined)

// Le serveur détient les niveaux : on ne connaît que le niveau en cours, qu'il nous donne quand on joue.
const status = ref<JourneyStatus | null>(null)
const target = computed(() => status.value?.level ?? 1)
const allDone = computed(() => status.value?.allDone ?? false)
const officialMs = ref<number | null>(null) // temps de résolution mesuré par le serveur
const earned = ref<{ base: number; bonus: number } | null>(null) // pièces gagnées au dernier niveau, d'après le serveur
const loading = ref(false)
const loadError = ref('')

async function refresh(): Promise<void> {
  status.value = await fetchStatus()
  if (status.value) setHomeLevel(status.value.level)
}
onMounted(refresh)
watch(user, refresh) // connexion / déconnexion : la progression change de propriétaire

// Niveau en cours de jeu (null = accueil du Voyage).
const current = ref<PlayLevel | null>(null)
const resume = ref<Pick<StartedLevel, 'reveals' | 'crosses'>>({ reveals: [], crosses: [] })
const grid = ref<InstanceType<typeof TrackGrid> | null>(null)
const aidBar = ref<InstanceType<typeof AidBar> | null>(null)
const picking = ref(false)
const trainRunning = ref(false) // le train roule : la cabine montre la carte vue de la locomotive
const trainS = ref(0) // position de la locomotive sur son trajet (cases)
const landFrame = shallowRef<LandFrame | null>(null) // voitures, barrières, animaux : l'image du décor vivant, reprise par la cabine
const cabScene = ref<{ route: Route; scenery: Scenery; rails: Route | null } | null>(null) // le trajet et le décor de la carte, pour la vue de la cabine
const storeDown = computed(() => levelFinished.value && !trainRunning.value) // le store de la cabine se ferme sur le récapitulatif
const fmt = (ms: number): string => {
  const t = Math.floor(ms / 1000)
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}
const won = ref(false) // le tracé est validé : le Plateau cède la place au Trajet (la cabine monte, les bonus partent)
const levelFinished = ref(false) // le train est passé : le récapitulatif et « Niveau suivant » apparaissent sur le store
const colorHints = ref(false) // indicateurs de couleur : désactivés par défaut, l'aide « Couleurs » les active sur ce niveau
// Une pièce sonne par ligne de gain, quand le récapitulatif apparaît (le décor se tait un instant).
watch(levelFinished, (v) => {
  if (!v || !earned.value) return
  const lines = [earned.value.base, earned.value.bonus].filter((a) => a > 0).length
  for (let i = 0; i < lines; i++) window.setTimeout(() => sound.coin(), i * 350)
})
watch(current, (c) => emit('playing', c !== null), { immediate: true })

async function play(): Promise<void> {
  loading.value = true
  loadError.value = ''
  const r = await startLevel()
  loading.value = false
  if (!r) {
    loadError.value = 'Serveur injoignable : vérifie ta connexion.'
    return
  }
  if ('done' in r) {
    await refresh()
    current.value = null
    return
  }
  resume.value = { reveals: r.reveals ?? [], crosses: r.crosses ?? [] }
  colorHints.value = (r.usedAids ?? []).includes('colors') // reprise : les couleurs déjà payées restent actives
  picking.value = false
  won.value = false
  levelFinished.value = false
  trainRunning.value = false
  trainS.value = 0
  cabScene.value = null
  landFrame.value = null
  earned.value = null
  officialMs.value = null
  current.value = r.level
  void refreshWallet() // une aide a pu se débloquer en démarrant ce niveau
}

// Le serveur vérifie le tracé : seule sa réponse « juste » donne la victoire et débloque la suite.
async function validate(_ms: number, edges: string[]): Promise<boolean> {
  if (!current.value) return false
  const r = await submitLevel(current.value.id, edges)
  if (!r.ok) return false
  status.value = r.next
  setCoins(r.coins) // les pièces gagnées, d'après le serveur
  earned.value = r.earned
  officialMs.value = r.timeMs
  return true
}

// Après la victoire : un niveau suivant existe si la progression a dépassé le niveau joué.
const hasNext = computed(() => !!current.value && !!status.value && !status.value.allDone && status.value.level > current.value.id)

function quit(): void {
  current.value = null
  void refresh()
}
</script>

<template>
  <section data-test="journey">
    <!-- Accueil du Voyage -->
    <div v-if="!current" class="home">
      <div class="side">
        <button v-for="c in leftCubes" :key="c.id" type="button" class="mini" :data-test="'nav-' + c.id" :disabled="isLocked(c.id)" :title="isLocked(c.id) ? 'Connecte-toi (cube Compte) pour y accéder' : undefined" @click="emit('navigate', c.id)">
          <span class="ico" aria-hidden="true"><MenuIcon :name="c.id" /></span>
          <span class="lbl">{{ c.label }}</span>
          <span v-if="isLocked(c.id)" class="lock" data-test="lock" role="img" aria-label="Connexion requise">🔒</span>
        </button>
      </div>

      <button
        type="button"
        class="hero"
        data-test="play"
        :aria-label="allDone ? 'Tous les niveaux sont terminés' : target > 1 ? 'Continuer' : 'Commencer'"
        :disabled="allDone || loading || !status"
        @click="play"
      >
        <HeroArt />
        <span class="hero-level" data-test="home-level">Niveau {{ target }}</span>
        <span class="hero-cta" aria-hidden="true">▶</span>
      </button>

      <div class="side">
        <button v-for="c in rightCubes" :key="c.id" type="button" class="mini" :data-test="'nav-' + c.id" :disabled="isLocked(c.id)" :title="isLocked(c.id) ? 'Connecte-toi (cube Compte) pour y accéder' : undefined" @click="emit('navigate', c.id)">
          <span class="ico" aria-hidden="true"><MenuIcon :name="c.id" :initial="c.id === 'account' ? initial : undefined" :avatar="c.id === 'account' ? user?.avatar : undefined" /></span>
          <span class="lbl">{{ c.label }}</span>
          <span v-if="isLocked(c.id)" class="lock" data-test="lock" role="img" aria-label="Connexion requise">🔒</span>
        </button>
      </div>

      <p v-if="loadError" class="trophy all" data-test="load-error">{{ loadError }}</p>
      <p v-if="allDone" class="trophy all" data-test="coming-soon">Tu as terminé tous les niveaux disponibles. De nouveaux niveaux arrivent bientôt.</p>
    </div>

    <!-- En jeu : aucun menu, juste de quoi quitter / naviguer -->
    <template v-else>
      <div class="bar">
        <QuitButton class="back" data-test="quit" @click="quit" />
        <span class="title" data-test="level-title">Niveau {{ current.id }}</span>
        <CoinBadge />
      </div>

      <div class="play-area">
        <!-- Présentation d'une nouveauté : fixe pendant tout le niveau (pas de saut). -->
        <p v-if="current.intro" class="intro" data-test="intro">
          <span class="swatch" aria-hidden="true"></span>
          {{ current.intro }}
        </p>
        <div class="stage">
          <TrackGrid
            ref="grid"
            :key="current.id"
            :puzzle="current.puzzle"
            :validate="validate"
            :official-ms="officialMs"
            :theme="themeForLevel(current.id)"
            :picking="picking"
            :color-hints="colorHints"
            @begin="beginLevel()"
            @solved="won = true"
            external-recap
            @finish="levelFinished = true"
            @train="trainRunning = $event"
            @progress="trainS = $event"
            @scene="cabScene = $event"
            @land="landFrame = $event"
            :initial="{ givens: resume.reveals, crosses: resume.crosses }"
            @pick="(r, c) => aidBar?.onPick(r, c)"
          />
          <!-- Les bonus : sous la grille (portrait) ou à sa droite (paysage), seulement pendant le Plateau. -->
          <div class="bonus-dock" :class="{ gone: won }" data-test="bonus-col">
            <AidBar
              ref="aidBar"
              :key="'aids-' + current.id"
              :size="current.puzzle.size"
              :level="current.id"
              :snapshot="() => grid?.snapshotForAid() ?? { edges: [], crosses: [], marks: 0 }"
              @reveal="(g, c) => grid?.reveal(g, c)"
              @colors="colorHints = true"
              @picking="picking = $event"
            />
          </div>
        </div>
        <!-- Cabine sous la grille, collée au décor et sur toute la largeur. Pare-brise : la voie défile quand le train roule ; à l'arrivée un store
             se ferme et porte le récapitulatif, avec « Niveau suivant » juste dessous. Pouvoirs : colonne à droite. -->
        <CabinFrame :shown="won" :scene="cabScene" :land="landFrame" :progress="trainS" :running="trainRunning" :theme="themeForLevel(current.id)" :store-down="storeDown">
          <template #store>
            <div v-if="levelFinished" class="finish" data-test="finish">
              <template v-if="earned">
                <div class="head">
                  <p class="win" data-test="win">Niveau terminé</p>
                  <p class="time" data-test="result-time"><span>Temps</span> {{ fmt(officialMs ?? 0) }}</p>
                </div>
                <WinReceipt
                  :lines="[
                    { label: 'Victoire', amount: earned.base },
                    { label: 'Sans aide', amount: earned.bonus },
                  ]"
                />
              </template>
              <!-- « Niveau suivant » juste sous le récapitulatif, sur le store -->
              <button v-if="hasNext" type="button" class="btn cta next" data-test="next" :disabled="loading" @click="play">Niveau suivant</button>
              <p v-else class="trophy" data-test="coming-soon">Dernier niveau disponible terminé. De nouveaux niveaux arrivent bientôt.</p>
            </div>
          </template>
        </CabinFrame>
      </div>
    </template>
  </section>
</template>

<style scoped>
section {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center; /* accueil : centré verticalement */
  flex: 1; /* remplit la hauteur : barre en haut, contenu centré dans le reste */
  align-self: stretch; /* en partie : occupe toute la hauteur, barre tout en haut */
  width: 100%;
}
/* la grille est centrée dans la place restante sous la barre */
.play-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
}
.store .finish {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  width: min(100%, 22rem);
  padding: 0.45rem 0.8rem 0.5rem;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.2);
  text-align: center;
}
.store .head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.8rem;
  width: 100%;
}
.store .win {
  font-size: 0.95rem;
  font-weight: 800;
  color: #15803d;
}
.store .time {
  font-size: 1.1rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: #1f2937;
}
.store .time span {
  margin-right: 0.25rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: #6b7280;
}
.store .finish :deep(.receipt) {
  display: flex;
  justify-content: space-between;
  gap: 0.6rem;
  width: 100%;
  padding-top: 0;
}
.store .finish :deep(.receipt .row) {
  flex: none;
  gap: 0.3rem;
  font-size: 0.8rem;
}
.store .finish :deep(.receipt .total) {
  font-size: 0.85rem;
}
.store .finish :deep(.receipt .fill),
.store .finish :deep(.receipt .rule) {
  display: none;
}

/* Le plateau : la grille, et les bonus dessous (portrait) ou à droite (paysage). */
.stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}
.bonus-dock {
  display: grid;
  justify-items: center;
  width: min(94vw, 30rem);
  transition: opacity 0.4s ease, transform 0.5s ease;
}
.bonus-dock.gone {
  opacity: 0;
  transform: translateY(1.5rem);
  pointer-events: none;
}
.bonus-dock :deep(.aids) {
  width: 100%;
}
.bonus-dock :deep(.row) {
  flex-wrap: nowrap;
  gap: 0.6rem;
}
.bonus-dock :deep(.aid) {
  flex: 1 1 0;
  width: auto;
  max-width: 5.5rem;
  height: 3.6rem;
}
/* Paysage (l'écran est plus large que haut) : les bonus forment une colonne à droite de la grille. */
@media (min-aspect-ratio: 1/1) {
  .stage {
    flex-direction: row;
    gap: 1.5rem;
  }
  .bonus-dock {
    width: 5.5rem;
  }
  .bonus-dock :deep(.row) {
    flex-direction: column;
  }
  .bonus-dock :deep(.aid) {
    flex: none;
    width: 100%;
    max-width: none;
  }
  .bonus-dock.gone {
    transform: translateX(1.5rem);
  }
  /* Messages et choix d'un pouvoir : trop larges pour la colonne, ils s'ouvrent à sa droite. */
  .bonus-dock {
    position: relative;
  }
  .bonus-dock :deep(.panel),
  .bonus-dock :deep(.msg),
  .bonus-dock :deep(.fresh) {
    position: absolute;
    top: 0;
    left: calc(100% + 0.6rem);
    z-index: 8;
    width: max-content;
    max-width: 16rem;
  }
}
.store .next {
  width: 100%;
  margin-top: 0.35rem;
  padding: 0.45rem 0;
  font-size: 1rem;
  font-weight: 800;
}
.store .trophy {
  margin: 0.3rem 0 0;
  font-size: 0.8rem;
  line-height: 1.25;
  color: #374151;
}
.intro {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  max-width: min(92vw, 30rem);
  padding: 0.6rem 0.9rem;
  border: 2px solid #fff;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 4px 14px rgba(30, 64, 175, 0.2);
  font-size: 0.9rem;
  font-weight: 600;
  line-height: 1.35;
  color: #334155;
}
/* petit échantillon du rail gris, comme sur la grille */
.swatch {
  flex: none;
  width: 1.6rem;
  height: 0.55rem;
  border-radius: 2px;
  background: repeating-linear-gradient(90deg, #475569 0 70%, #cbd5e1 70% 100%);
  background-size: 0.55rem 100%;
}
/* Téléphone d'abord : [cubes] [grand cube] [cubes] sur une seule ligne. */
.home {
  --side: clamp(54px, 17vw, 92px);
  --hero: clamp(150px, 50vw, 320px);
  display: grid;
  grid-template-columns: var(--side) var(--hero) var(--side);
  align-items: center;
  justify-content: center;
  gap: clamp(0.5rem, 2.5vw, 1.25rem);
  transform: translateY(-9vh); /* un peu plus haut que le centre exact */
}
.side {
  display: grid;
  gap: clamp(0.5rem, 2.5vw, 1rem);
}
.mini {
  position: relative;
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  padding: 0.2rem;
  font: inherit;
  border: 2px solid #fff;
  border-radius: 18%;
  background: rgba(255, 255, 255, 0.9);
  color: #1f2937;
  box-shadow: 0 4px 12px rgba(30, 64, 175, 0.18);
  cursor: pointer;
  transition: transform 0.12s ease;
}
.mini:hover,
.mini:focus-visible {
  transform: translateY(-2px);
}
.mini:disabled {
  cursor: not-allowed;
  box-shadow: none;
}
.mini:disabled {
  background: #e5e7eb;
}
.mini:disabled .ico,
.mini:disabled .lbl {
  opacity: 0.35;
  filter: grayscale(1);
}
.mini:disabled:hover {
  transform: none;
}
/* Verrou : filtre grisé sur tout le cube, cadenas au centre. */
.lock {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: inherit;
  background: rgba(156, 163, 175, 0.45);
  font-size: clamp(1.4rem, 6.5vw, 2.1rem);
}
.ico {
  display: block;
  width: clamp(1.9rem, 9vw, 2.9rem);
  height: clamp(1.9rem, 9vw, 2.9rem);
}
.lbl {
  font-size: clamp(0.5rem, 2.3vw, 0.72rem);
  font-weight: 700;
  line-height: 1.1;
  text-align: center;
}
.hero {
  position: relative;
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: clamp(0.6rem, 3vw, 1.2rem);
  font: inherit;
  border: 3px solid #fff;
  border-radius: 14%;
  overflow: hidden;
  color: #fff;
  cursor: pointer;
  box-shadow: 0 10px 28px rgba(30, 64, 175, 0.35);
  transition: transform 0.12s ease;
}
.hero:hover,
.hero:focus-visible {
  transform: translateY(-3px) scale(1.02);
}
.hero-level,
.hero-cta {
  position: relative;
  font-weight: 800;
  border-radius: 999px;
}
.hero-level {
  padding: 0.15em 0.8em;
  font-size: clamp(1.1rem, 5.5vw, 2rem);
  letter-spacing: -0.01em;
  color: #111827;
  background: rgba(255, 255, 255, 0.88);
}
.hero-cta {
  width: clamp(2.6rem, 12vw, 3.6rem);
  height: clamp(2.6rem, 12vw, 3.6rem);
  display: flex;
  align-items: center;
  justify-content: center;
  padding-left: 0.12em; /* centre optique du triangle */
  font-size: clamp(1.1rem, 5vw, 1.6rem);
  background: #2563eb;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
}
.all {
  grid-column: 1 / -1;
  text-align: center;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 12px;
  padding: 0.4rem;
}
.bar {
  position: relative;
  z-index: 6; /* au-dessus du décor de fin de niveau, qui monte jusqu'en haut de l'écran */
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  width: min(92vw, 560px);
  color: #374151;
}
.back {
  justify-self: start;
}
.title {
  justify-self: center;
  padding: 0.3rem 0.9rem;
  border: 2px solid #fff;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92); /* lisible sur le décor, qui monte jusqu'en haut de l'écran */
  box-shadow: var(--shadow);
  font-weight: 800;
  text-align: center;
}
.cta {
  background: #16a34a;
  box-shadow: 0 6px 16px rgba(22, 163, 74, 0.35);
  padding: 0.7em 1.8em;
  font-size: 1.1rem;
}
.cta:hover:not(:disabled) {
  background: #15803d;
}
</style>
