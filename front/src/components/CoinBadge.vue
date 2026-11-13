<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { coins, refreshWallet } from '../wallet'
import CoinIcon from './CoinIcon.vue'
import { user } from '../auth'

// Solde de pièces : visible à l'accueil ET pendant une partie. Le serveur seul décide du solde.
onMounted(refreshWallet)
watch(user, refreshWallet) // connexion / déconnexion : le solde change de propriétaire
</script>

<template>
  <span class="coins" data-test="coins" :aria-label="'Pièces : ' + (coins ?? 0)" role="status">
    <CoinIcon size="1.25em" />
    <b data-test="coins-value">{{ coins ?? '…' }}</b>
  </span>
</template>

<style scoped>
.coins {
  /* La taille suit le montant : jamais étirée par la grille ou la barre qui la contient. */
  display: inline-flex;
  width: fit-content;
  justify-self: end;
  white-space: nowrap;
  align-items: center;
  gap: 0.3rem;
  padding: 0.25rem 0.7rem;
  border-radius: 999px;
  background: #fff;
  box-shadow: var(--shadow);
  color: #92400e;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
</style>
