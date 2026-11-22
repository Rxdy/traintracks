<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import HeroArt from '../components/HeroArt.vue'
import MenuIcon from '../components/MenuIcon.vue'
import TrackGrid from '../components/TrackGrid.vue'
import AidBar from '../components/AidBar.vue'
import FinishDialog from '../components/FinishDialog.vue'
import CoinBadge from '../components/CoinBadge.vue'
import QuitButton from '../components/QuitButton.vue'
import WinReceipt from '../components/WinReceipt.vue'
import { beginLevel, fetchStatus, setHomeLevel, startLevel, submitLevel, type JourneyStatus, type PlayLevel, type StartedLevel } from '../journey'
import { refreshWallet, setCoins } from '../wallet'
import { user } from '../auth'
import { themeForLevel } from '../scenery'
import { sound } from '../sound/director'
import LevelLoading from '../components/LevelLoading.vue'
import { loadingTiming, preloadWorld, preloadWorldWhenIdle } from '../preload'

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
  { id: 'train', label: 'Mon train' },
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
const pickingLine = ref(false) // pouvoir « Une ligne » : on touche un compteur de la grille
const forcedAid = ref(false) // niveau de déblocage d'un pouvoir : la grille attend que le joueur essaie le pouvoir offert
const trainRunning = ref(false) // le train roule (la fenêtre de fin attend qu'il soit arrivé)
const storeDown = computed(() => levelFinished.value && !trainRunning.value) // la fenêtre de fin s'ouvre sur le récapitulatif
const fmt = (ms: number): string => {
  const t = Math.floor(ms / 1000)
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}
const won = ref(false) // le tracé est validé : le Plateau cède la place au Trajet (les bonus partent)
const levelFinished = ref(false) // le train est passé : le récapitulatif et « Niveau suivant » apparaissent sur le store
const colorHints = ref(false) // indicateurs de couleur : désactivés par défaut, l'aide « Couleurs » les active sur ce niveau
// Une pièce sonne par ligne de gain, quand le récapitulatif apparaît (le décor se tait un instant).
watch(levelFinished, (v) => {
  if (!v || !earned.value) return
  const lines = [earned.value.base, earned.value.bonus].filter((a) => a > 0).length
  for (let i = 0; i < lines; i++) window.setTimeout(() => sound.coin(), i * 350)
})

// Écran de chargement : toujours affiché entre « Jouer » et la grille. Le niveau (serveur) et le décor 3D (fichier) arrivent ensemble ;
// si tout est déjà prêt, la barre se remplit vite. Durée minimale courte (loadingTiming.minMs) pour qu'elle se voie arriver au bout.
const showLoading = ref(false)
const loadSteps = ref({ level: false, scenery: false })
const loadProgress = computed(() => (Number(loadSteps.value.level) + Number(loadSteps.value.scenery)) / 2)
onMounted(preloadWorldWhenIdle) // à l'accueil, le décor se charge pendant que le joueur lit le menu
// En partie dès l'écran de chargement : plus de menu, et la page ne défile plus (App.vue).
watch([current, showLoading], ([c, l]) => emit('playing', c !== null || l), { immediate: true })

async function play(): Promise<void> {
  loading.value = true
  loadError.value = ''
  loadSteps.value = { level: false, scenery: false }
  showLoading.value = true
  const minimum = new Promise<void>((done) => window.setTimeout(done, loadingTiming.minMs))
  const [r] = await Promise.all([
    startLevel().then((v) => ((loadSteps.value.level = true), v)),
    preloadWorld().then(() => (loadSteps.value.scenery = true)),
    minimum,
  ])
  showLoading.value = false
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
  earned.value = null
  officialMs.value = null
  current.value = r.level
  void refreshWallet() // une aide a pu se débloquer en démarrant ce niveau
}

// Le serveur vérifie le tracé : seule sa réponse « juste » donne la victoire et débloque la suite.
// Refus : un message qui dit la vraie raison (rien n'est perdu, le tracé reste sur la grille).
// La partie n'est plus ouverte côté serveur (session renouvelée, autre onglet) : on la rouvre, puis on renvoie le même tracé une fois.
async function validate(_ms: number, edges: string[]): Promise<true | string> {
  if (!current.value) return 'Niveau introuvable : recharge la page.'
  const id = current.value.id
  let r = await submitLevel(id, edges)
  if (!r.ok && r.reason === 'not_started') {
    const again = await startLevel()
    if (again && 'level' in again && again.level.id === id) r = await submitLevel(id, edges)
  }
  if (!r.ok) {
    if (r.reason === 'network') return 'Serveur injoignable : vérifie ta connexion, puis réessaie.'
    if (r.reason === 'wrong') return "Le serveur n'a pas reconnu ce tracé comme une solution."
    if (r.reason === 'server') return 'Le serveur a eu un souci. Réessaie dans un instant.'
    return "Ce niveau n'est plus celui en cours (joué sur un autre appareil ou un autre onglet ?). Recharge la page."
  }
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
    <LevelLoading v-if="showLoading" :level="target" :theme="themeForLevel(target)" :progress="loadProgress" />

    <!-- Accueil du Voyage -->
    <div v-else-if="!current" class="home">
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
    <template v-else-if="current">
      <div class="bar">
        <QuitButton class="back" data-test="quit" @click="quit" />
        <!-- en haut : le niveau et le temps au milieu, le son et les pièces à droite (les outils de tracé restent au-dessus de la grille) -->
        <div class="hud-mid" :class="{ gone: won }">
          <span class="title" data-test="level-title">Niveau {{ current.id }}</span>
          <span id="hud-timer" class="hud-slot"></span>
        </div>
        <div class="hud-right">
          <span id="hud-sound" class="hud-slot"></span>
          <CoinBadge class="coins-hud" :class="{ gone: won }" />
        </div>
      </div>

      <div class="play-area">
        <div class="stage">
          <TrackGrid
            ref="grid"
            :key="current.id"
            :hud="{ timer: '#hud-timer', sound: '#hud-sound' }"
            :puzzle="current.puzzle"
            :validate="validate"
            :official-ms="officialMs"
            :theme="themeForLevel(current.id)"
            :picking="picking"
            :locked="forcedAid"
            :color-hints="colorHints"
            @begin="beginLevel()"
            @solved="won = true"
            external-recap
            @finish="levelFinished = true"
            @train="trainRunning = $event"
            :initial="{ givens: resume.reveals, crosses: resume.crosses }"
            :picking-line="pickingLine"
            @pick-line="(axis, index) => aidBar?.onPickLine(axis, index)"
            @pick="(r, c) => aidBar?.onPick(r, c)"
          >
            <!-- Présentation d'une nouveauté : dans la bande « partie », fixe pendant tout le niveau (pas de saut). -->
            <template #intro>
              <p v-if="current.intro" class="intro" data-test="intro">
                <span class="swatch" aria-hidden="true"></span>
                {{ current.intro }}
              </p>
            </template>
          </TrackGrid>
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
              @forced="forcedAid = $event"
              @picking-line="pickingLine = $event"
            />
          </div>
        </div>
        <!-- À l'arrivée du train : le récapitulatif au centre de l'écran. -->
        <FinishDialog :open="storeDown" :can-next="hasNext" :busy="loading" end-message="Dernier niveau disponible terminé. De nouveaux niveaux arrivent bientôt." @replay="grid?.replayTrain()" @next="play">
          <template v-if="earned">
            <p class="time" data-test="result-time"><span>Temps</span> {{ fmt(officialMs ?? 0) }}</p>
            <WinReceipt
              :lines="[
                { label: 'Victoire', amount: earned.base },
                { label: 'Sans aide', amount: earned.bonus },
              ]"
            />
          </template>
        </FinishDialog>
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
/* Corps de la fenêtre de fin : le temps officiel, puis la facture. */
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
  width: 100%;
}
/* Portrait : une barre aussi large que la grille, quatre grands boutons. */
.bonus-dock :deep(.aid) {
  flex: 1 1 0;
  width: auto;
  max-width: 7rem;
  height: clamp(3.8rem, 9dvh, 5.5rem);
}
.bonus-dock :deep(.aid .icon) {
  width: clamp(1.9rem, 4.5dvh, 2.6rem);
  height: clamp(1.9rem, 4.5dvh, 2.6rem);
}
/* Paysage (l'écran est plus large que haut) : les bonus forment une colonne à droite de la grille. */
@media (min-aspect-ratio: 1/1) {
  /* Bandes de part et d'autre de la grille : « partie » à gauche (dans TrackGrid), « pouvoirs » à droite (ici). Leur largeur est ce
     qui reste de l'écran une fois la grille, les outils et les pouvoirs posés, partagé en deux. */
  .play-area {
    --band: clamp(1.25rem, calc((100vw - min(100dvh - 11rem, 62vw, 820px) - 13rem) / 2), 15rem);
  }
  .stage {
    flex-direction: row;
    gap: var(--band);
  }
  /* Paysage : une colonne de grands carrés, à la mesure de l'écran (environ 100 px sur un ordinateur). */
  .bonus-dock {
    --aid: clamp(4.2rem, 11vmin, 7rem);
    width: var(--aid);
  }
  .bonus-dock :deep(.row) {
    flex-direction: column;
    align-items: center;
    gap: calc(var(--aid) * 0.18);
  }
  .bonus-dock :deep(.aid) {
    flex: none;
    width: var(--aid);
    height: var(--aid);
    max-width: none;
    border-radius: calc(var(--aid) * 0.2);
  }
  .bonus-dock :deep(.aid .icon) {
    width: calc(var(--aid) * 0.46);
    height: calc(var(--aid) * 0.46);
  }
  .bonus-dock.gone {
    transform: translateX(1.5rem);
  }
  /* Messages et choix d'un pouvoir : trop larges pour la colonne, ils s'ouvrent à sa droite. */
  .bonus-dock {
    position: relative;
  }
  /* Détail d'un pouvoir, message, achat, consigne : dans la bande entre la grille et la colonne, en face du pouvoir concerné. */
  .bonus-dock :deep(.panel),
  .bonus-dock :deep(.msg),
  .bonus-dock :deep(div.fresh) {
    position: absolute;
    top: calc(var(--i, 0) * var(--aid) * 1.18);
    right: calc(100% + 0.6rem);
    z-index: 8;
    box-sizing: border-box;
    width: max(9rem, calc(var(--band) - 1.2rem));
    max-width: none;
  }
  /* `div.fresh` (plus spécifique que `.low`) fixait aussi `top` : la bulle du nouveau pouvoir d'un rang bas avait donc `top` ET
     `bottom`, sa hauteur s'étirait entre les deux et son texte débordait dessous. */
  .bonus-dock :deep(.low),
  .bonus-dock :deep(div.fresh.low) {
    top: auto;
    bottom: calc(var(--j, 0) * var(--aid) * 1.18);
  }
  .bonus-dock :deep(div.fresh) {
    flex-wrap: wrap;
  }

  /* la nouveauté du niveau, dans la bande « partie » : en colonne, sur toute sa largeur */
  .intro {
    max-width: none;
    width: 100%;
    box-sizing: border-box;
    align-items: flex-start;
  }
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
  width: 100%; /* pleine largeur : Quitter au bord gauche de l'écran, pièces au bord droit */
  padding: 0 0.75rem;
  box-sizing: border-box;
  color: #374151;
}
.back {
  justify-self: start;
}
/* Pendant le Trajet, le niveau et les pièces s'effacent : il ne reste que Quitter (à gauche) et la vitesse (à droite). */
.hud-mid,
.hud-right {
  display: flex;
  align-items: center;
  gap: clamp(0.3rem, 1.2vw, 0.5rem);
}
.hud-mid {
  justify-self: center;
}
.hud-right {
  justify-self: end;
}
.hud-slot {
  display: contents;
}
.hud-mid,
.coins-hud {
  transition: opacity 0.5s ease;
}
.hud-mid.gone,
.coins-hud.gone {
  opacity: 0;
  pointer-events: none;
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
  white-space: nowrap;
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

/* Téléphone couché : les messages des bonus tiennent entre la colonne et le bord de l'écran. */
@media (min-aspect-ratio: 1/1) and (max-height: 560px) {
  /* la grille prend toute la hauteur et les outils flottent au bord gauche : les bandes se partagent le reste */
  /* la barre du haut flotte : on laisse sa hauteur libre au-dessus de la grille (sinon elle recouvre les compteurs des colonnes),
     et la largeur des outils, qui flottent au bord gauche */
  .play-area {
    --band: clamp(1rem, calc((100vw - 100dvh - 10rem) / 2), 11rem);
    box-sizing: border-box;
    padding: 2.9rem 0 0 4.6rem;
  }
  .bonus-dock :deep(.panel),
  .bonus-dock :deep(.msg),
  .bonus-dock :deep(div.fresh) {
    font-size: 0.76rem;
  }
  .bonus-dock :deep(div.fresh .icon) {
    display: none;
  }
}
/* Téléphone couché : la barre du haut flotte par-dessus (elle ne prend plus de hauteur à la grille), le titre se range près de Quitter. */
@media (min-aspect-ratio: 1/1) and (max-height: 560px) {
  .bar {
    position: absolute;
    top: 0.5rem;
    left: 0;
    right: 0;
    grid-template-columns: auto 1fr auto;
    pointer-events: none;
  }
  .bar > * {
    pointer-events: auto;
  }
  .bar .hud-mid {
    justify-self: start;
    margin-left: 0.6rem;
  }
}
</style>
