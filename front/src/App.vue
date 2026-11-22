<script setup lang="ts">
import RotateHint from './components/RotateHint.vue'
import { computed, onMounted, onUnmounted, provide, ref, watch } from 'vue'
import TutorialView from './views/TutorialView.vue'
import DailyView from './views/DailyView.vue'
import JourneyView from './views/JourneyView.vue'
import StatsView from './views/StatsView.vue'
import RankingView from './views/RankingView.vue'
import AccountView from './views/AccountView.vue'
import DepotPage from './views/DepotPage.vue'
import TrainEditView from './views/TrainEditView.vue'
import CollectionView from './views/CollectionView.vue'
import LegalView from './views/LegalView.vue'
import LandscapeBg from './components/LandscapeBg.vue'
import InstallButton from './components/InstallButton.vue'
import CoinBadge from './components/CoinBadge.vue'
import WagonMachine from './components/WagonMachine.vue'
import { loadTrain } from './myTrain'
import { notice, pseudoPrompt, resetToken, user } from './auth'
// L'avis général part tout seul après 6 s (ou au toucher) : il ne reste jamais sur l'écran.
let noticeTimer = 0
watch(notice, (m) => {
  clearTimeout(noticeTimer)
  if (m) noticeTimer = window.setTimeout(() => (notice.value = ''), 6000)
})
import { homeTheme } from './journey'
import { sound, soundOn, suspend, unlock } from './sound/director'

// Accueil = le Voyage (mode principal). Les autres écrans s'ouvrent depuis
// les petits cubes de l'accueil.
type View = 'home' | 'daily' | 'tuto' | 'stats' | 'ranking' | 'account' | 'train' | 'trainEdit' | 'collection' | 'legal'
const TITLES: Record<View, string> = {
  home: '',
  daily: 'Puzzle du jour',
  tuto: 'Tutoriel',
  stats: 'Statistiques',
  ranking: 'Classement',
  account: 'Compte',
  train: 'Mon train',
  trainEdit: '',
  collection: 'Ma collection',
  legal: 'Mentions légales',
}

// Le navigateur n'autorise le son qu'après un geste : on prépare l'audio au premier toucher, et on le met en pause
// quand l'application passe en arrière-plan.
const onHidden = () => suspend(document.hidden)
onMounted(() => {
  window.addEventListener('pointerdown', unlock, { once: true, capture: true })
  document.addEventListener('visibilitychange', onHidden)
})
onUnmounted(() => {
  window.removeEventListener('pointerdown', unlock, { capture: true })
  document.removeEventListener('visibilitychange', onHidden)
})

const view = ref<View>('home')
// Vrai pendant une partie : on cache alors tout le reste.
const playing = ref(false)
// En partie (chargement, grille, Trajet) : la page ne défile plus et ne déborde plus (style.css, `lock-screen`).
watch(playing, (v) => document.documentElement.classList.toggle('lock-screen', v), { immediate: true })
// Le paysage suit tous les écrans de menu ; seule une partie en cours reste blanche.
const scenery = computed(() => !playing.value)
const panel = computed(() => view.value !== 'home' && !playing.value)

// le train ouvert dans la personnalisation (son garage au dépôt)
const trainSlot = ref(0)
function go(v: string, slot?: number): void {
  if (typeof slot === 'number') trainSlot.value = slot
  view.value = v as View
  playing.value = false
  window.scrollTo?.({ top: 0 }) // chaque écran s'ouvre par le haut (pas au défilement de l'écran d'avant)
}
provide('go', go) // go(écran, n° de train) ; les écrans (inscription, compte) renvoient vers les mentions légales
// La machine « Wagon surprise » : un bouton de l'accueil et la partie Mon train (page Compte) l'ouvrent.
const machineOpen = ref(false)
const openMachine = () => (machineOpen.value = true)
provide('openMachine', openMachine)
// Le train du joueur (pour le Trajet, l'accueil, le chargement) : relu au démarrage et quand le compte change
watch(() => user.value?.email, () => void loadTrain(), { immediate: true })
// Lien « mot de passe oublié » ouvert depuis l'e-mail : on arrive sur l'écran Compte.
watch(resetToken, (t) => t && go('account'), { immediate: true })
watch(pseudoPrompt, (v) => v && go('account'), { immediate: true })
</script>

<template>
  <div class="app" :class="{ immersive: playing, landscape: scenery }">
    <LandscapeBg v-if="scenery" :theme="homeTheme" />
    <RotateHint />

    <header v-if="!playing" class="header">
      <div class="left">
        <button v-if="view === 'trainEdit' || view === 'collection'" type="button" class="btn btn--ghost btn--small" data-test="to-depot" @click="go('train')">
          <span aria-hidden="true">←</span> Dépôt
        </button>
        <button v-else-if="view !== 'home'" type="button" class="btn btn--ghost btn--small" data-test="home" @click="go('home')">
          <span aria-hidden="true">🏠</span> Accueil
        </button>
      </div>
      <h1 class="title">
        {{ view === 'trainEdit' ? 'Train ' + (trainSlot + 1) : TITLES[view] || 'Train Tracks' }}
      </h1>
      <div class="right">
        <button v-if="view === 'home'" type="button" class="surprise" data-test="nav-machine" aria-label="Wagon surprise" title="Wagon surprise" @click="openMachine">
          <!-- une petite machine à sous : trois fenêtres, un fronton, une manette -->
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <rect x="3" y="9" width="21" height="18" rx="3.5" fill="#dc2626" stroke="#e2b33c" stroke-width="1.6" />
            <path d="M6 9 Q13.5 2.5 21 9 Z" fill="#991b1b" stroke="#e2b33c" stroke-width="1.4" />
            <rect x="6" y="13" width="15" height="7.5" rx="1.6" fill="#5b1212" />
            <rect x="7" y="14" width="4" height="5.5" rx="1" fill="#fffbeb" />
            <rect x="11.5" y="14" width="4" height="5.5" rx="1" fill="#fffbeb" />
            <rect x="16" y="14" width="4" height="5.5" rx="1" fill="#fffbeb" />
            <path d="M8 17.5h2M12.5 17.5h2M17 17.5h2" stroke="#14b8a6" stroke-width="2" stroke-linecap="round" />
            <rect x="8" y="22.5" width="11" height="2.4" rx="1" fill="#fde68a" />
            <path d="M24 18h3v-9" fill="none" stroke="#9ca3af" stroke-width="1.8" stroke-linecap="round" />
            <circle cx="27" cy="7.5" r="2.6" fill="#ef4444" stroke="#7f1d1d" stroke-width="0.8" />
          </svg>
        </button>
        <CoinBadge />
        <!-- musique des menus et train de l'accueil : même réglage que le bouton son du jeu -->
        <button type="button" class="btn btn--ghost btn--small snd" data-test="menu-sound" :aria-pressed="soundOn" :aria-label="soundOn ? 'Couper le son' : 'Activer le son'" :title="soundOn ? 'Couper le son' : 'Activer le son'" @click="sound.setOn(!soundOn)">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 9v6h4l5 4V5L8 9z" />
            <path v-if="soundOn" d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />
            <path v-else d="m17 9 4 6M21 9l-4 6" />
          </svg>
        </button>
        <InstallButton v-if="view === 'home'" />
      </div>
    </header>

    <WagonMachine v-if="machineOpen" @close="machineOpen = false" @my-train="machineOpen = false; go('collection')" />

    <p v-if="notice" class="notice" data-test="notice" role="status" @click="notice = ''">{{ notice }}</p>

    <main class="board-area" :class="{ top: panel }">
      <div class="content" :class="{ panel, wide: view === 'train' || view === 'trainEdit' || view === 'collection' }" data-test="content">
        <JourneyView v-if="view === 'home'" @playing="playing = $event" @navigate="go" />
        <DailyView v-else-if="view === 'daily'" @playing="playing = $event" />
        <TutorialView v-else-if="view === 'tuto'" />
        <StatsView v-else-if="view === 'stats'" />
        <RankingView v-else-if="view === 'ranking'" />
        <LegalView v-else-if="view === 'legal'" />
        <DepotPage v-else-if="view === 'train'" />
        <TrainEditView v-else-if="view === 'trainEdit'" :slot="trainSlot" />
        <CollectionView v-else-if="view === 'collection'" />
        <AccountView v-else />
      </div>
    </main>

    <footer v-if="!playing && view !== 'legal'" class="footer">
      <button type="button" class="foot-link" data-test="legal-footer" @click="go('legal')">Mentions légales et confidentialité</button>
    </footer>
  </div>
</template>

<style scoped>
/* bouton de la machine Wagon surprise, à côté des pièces sur l'accueil : l'icône seule */
.surprise {
  display: grid;
  place-items: center;
  width: 2.6rem;
  height: 2.6rem;
  padding: 0;
  border-radius: 50%;
  border: 0;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2), 0 0 0 3px rgba(245, 158, 11, 0.35);
  cursor: pointer;
}
.surprise svg {
  width: 1.8rem;
  height: 1.8rem;
}
.surprise:hover svg {
  transform: rotate(-6deg) scale(1.08);
}

/* Avis général : une bulle DANS la barre du haut, par-dessus le titre (jamais sur les chiffres de la grille), entre
   le bouton Quitter et les pièces ; elle part seule (voir le minuteur plus haut). */
.notice {
  position: fixed;
  top: max(0.55rem, calc(env(safe-area-inset-top) + 0.4rem));
  left: 50%;
  transform: translateX(-50%);
  z-index: 50;
  margin: 0;
  width: max-content;
  max-width: min(24rem, max(12rem, calc(100vw - 15rem)));
  cursor: pointer;
  padding: 0.5rem 1rem;
  border-radius: 12px;
  background: #fff;
  color: #1f2937;
  font-weight: 600;
  text-align: center;
  box-shadow: var(--shadow);
}
.app {
  position: relative;
  overflow-x: clip; /* le train sort de la page sans créer de défilement */
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(0.75rem, 3vmin, 1.5rem);
  padding: clamp(1rem, 4vmin, 2rem);
  background: #ffffff;
}
.app.landscape {
  background: transparent;
}
/* En partie : fond blanc, avec un léger voile de ciel pour garder l'ambiance. */
.app.immersive {
  background: linear-gradient(#dbeefe, #ffffff 45%);
}

.footer {
  position: relative;
  z-index: 1;
  margin-top: auto;
}
.foot-link {
  border: 0;
  background: none;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  color: #475569;
  text-decoration: underline;
  cursor: pointer;
}
.header,
.board-area {
  position: relative;
  z-index: 1;
}

.header {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  column-gap: 0.75rem;
  width: 100%;
  max-width: 48rem;
}
.left {
  justify-self: start;
}
.snd {
  width: 2.4rem;
  height: 2.4rem;
  padding: 0;
  justify-content: center;
}
.snd svg {
  width: 1.2rem;
  height: 1.2rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.right {
  justify-self: end;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.title {
  margin: 0;
  font-size: clamp(1.15rem, 5vmin, 2rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #111827;
}
.content:not(.panel) {
  /* accueil et parties : occupent toute la hauteur (barre de jeu tout en haut) */
  align-self: stretch;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.panel {
  /* Plus de grand carré blanc : chaque élément est son propre cube sur le décor. */
  width: min(100%, 36rem);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}
/* Mon train : toute la largeur disponible */
.panel.wide {
  width: min(100%, 96rem);
}

.board-area.top {
  align-items: flex-start; /* les pages de menu se posent en haut, sur le ciel */
}

.board-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}
</style>
