<script setup lang="ts">
import RotateHint from './components/RotateHint.vue'
import { computed, onMounted, onUnmounted, provide, ref, watch } from 'vue'
import TutorialView from './views/TutorialView.vue'
import DailyView from './views/DailyView.vue'
import JourneyView from './views/JourneyView.vue'
import StatsView from './views/StatsView.vue'
import RankingView from './views/RankingView.vue'
import AccountView from './views/AccountView.vue'
import LegalView from './views/LegalView.vue'
import LandscapeBg from './components/LandscapeBg.vue'
import InstallButton from './components/InstallButton.vue'
import CoinBadge from './components/CoinBadge.vue'
import { notice, pseudoPrompt, resetToken } from './auth'
import { homeTheme } from './journey'
import { sound, soundOn, suspend, unlock } from './sound/director'

// Accueil = le Voyage (mode principal). Les autres écrans s'ouvrent depuis
// les petits cubes de l'accueil.
type View = 'home' | 'daily' | 'tuto' | 'stats' | 'ranking' | 'account' | 'legal'
const TITLES: Record<View, string> = {
  home: '',
  daily: 'Puzzle du jour',
  tuto: 'Tutoriel',
  stats: 'Statistiques',
  ranking: 'Classement',
  account: 'Compte',
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

function go(v: string): void {
  view.value = v as View
  playing.value = false
}
provide('go', go) // les écrans (inscription, compte) renvoient vers les mentions légales
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
        <button v-if="view !== 'home'" type="button" class="btn btn--ghost btn--small" data-test="home" @click="go('home')">
          <span aria-hidden="true">🏠</span> Accueil
        </button>
      </div>
      <h1 class="title">
        {{ TITLES[view] || 'Train Tracks' }}
      </h1>
      <div class="right">
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

    <p v-if="notice" class="notice" data-test="notice" role="status" @click="notice = ''">{{ notice }}</p>

    <main class="board-area" :class="{ top: panel }">
      <div class="content" :class="{ panel }" data-test="content">
        <JourneyView v-if="view === 'home'" @playing="playing = $event" @navigate="go" />
        <DailyView v-else-if="view === 'daily'" @playing="playing = $event" />
        <TutorialView v-else-if="view === 'tuto'" />
        <StatsView v-else-if="view === 'stats'" />
        <RankingView v-else-if="view === 'ranking'" />
        <LegalView v-else-if="view === 'legal'" />
        <AccountView v-else />
      </div>
    </main>

    <footer v-if="!playing && view !== 'legal'" class="footer">
      <button type="button" class="foot-link" data-test="legal-footer" @click="go('legal')">Mentions légales et confidentialité</button>
    </footer>
  </div>
</template>

<style scoped>
.notice {
  position: relative;
  z-index: 5;
  margin: 0.5rem auto 0;
  max-width: 24rem;
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
