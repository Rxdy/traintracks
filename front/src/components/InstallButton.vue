<script setup lang="ts">
import { ref } from 'vue'
import { canPropose, needsManualSteps, promptInstall } from '../install'

// Bouton « Installer » (coin de l'accueil). Visible seulement si l'appli peut
// être installée et ne l'est pas déjà.
const help = ref(false)

async function onClick(): Promise<void> {
  if (needsManualSteps.value) {
    help.value = !help.value
    return
  }
  await promptInstall()
}
</script>

<template>
  <div v-if="canPropose" class="install" data-test="install">
    <button type="button" class="btn btn--ghost btn--small" data-test="install-btn" aria-label="Installer l'appli" @click="onClick">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path d="M12 3v11m0 0l-4-4m4 4l4-4M5 20h14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <span class="label">Installer</span>
    </button>
    <p v-if="help" class="help" data-test="install-help">
      Sur iPhone / iPad : touche <b>Partager</b> <span aria-hidden="true">⬆️</span> puis
      <b>« Sur l'écran d'accueil »</b>.
    </p>
  </div>
</template>

<style scoped>
.install {
  position: relative;
}
/* téléphone debout : l'icône seule, pour laisser la place au titre */
@media (max-width: 26rem) {
  .label {
    display: none;
  }
}
.help {
  position: absolute;
  right: 0;
  top: calc(100% + 0.5rem);
  z-index: 20;
  width: 15rem;
  padding: 0.7rem 0.9rem;
  border: 2px solid #fff;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.97);
  box-shadow: 0 8px 22px rgba(30, 64, 175, 0.3);
  font-size: 0.85rem;
  line-height: 1.4;
  color: #374151;
  text-align: left;
}
</style>
