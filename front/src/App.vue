<script setup lang="ts">
import TrackGrid from './components/TrackGrid.vue'
import { samplePuzzle } from './puzzle'
</script>

<template>
  <div class="app">
    <header class="header">
      <h1 class="title">Train Tracks <span aria-hidden="true">🚂</span></h1>
      <p class="subtitle">Puzzle du jour</p>
    </header>

    <main class="board-area">
      <TrackGrid :puzzle="samplePuzzle" />
    </main>

    <footer class="hint">
      Glisse pour tracer la voie (bleu) &nbsp;•&nbsp; repasse dessus, ou tape une
      case, pour effacer<br />
      Clic droit / appui long : marquer ✕ &nbsp;•&nbsp; Ctrl+Z pour annuler
      &nbsp;•&nbsp; départ en <span class="c-green">vert</span>, sortie en
      <span class="c-red">rouge</span>.
    </footer>
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(0.75rem, 3vmin, 1.5rem);
  padding: clamp(1rem, 4vmin, 2rem);
  background: #ffffff;
}

.header {
  text-align: center;
}

.title {
  margin: 0;
  font-size: clamp(1.5rem, 6vmin, 2.4rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #111827;
}

.subtitle {
  margin: 0.25rem 0 0;
  font-size: clamp(0.85rem, 3vmin, 1rem);
  color: #6b7280;
}

.board-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.hint {
  text-align: center;
  font-size: clamp(0.75rem, 2.6vmin, 0.9rem);
  color: #9ca3af;
  max-width: 32rem;
  line-height: 1.6;
}

.c-green {
  color: #16a34a;
  font-weight: 600;
}

.c-red {
  color: #dc2626;
  font-weight: 600;
}
</style>
