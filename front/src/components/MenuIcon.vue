<script setup lang="ts">
import { computed } from 'vue'
import { AVATAR_ART, DEFAULT_AVATAR } from '../avatars'
// Icônes illustrées des écrans du menu (même style que le jeu : formes
// pleines, contours blancs, couleurs vives). Remplacent les emojis.
//   daily   : calendrier avec la date du jour + chrono  → Puzzle du jour
//   tuto    : livre ouvert avec un bout de voie et un « ? » → Tutoriel
//   stats   : podium 1-2-3 avec étoile                 → Statistiques
//   account : avatar ; initiale du joueur s'il est connecté → Compte
//   train   : un garage d'où sort la locomotive            → Mon train (le dépôt)
const props = defineProps<{
  name: 'daily' | 'tuto' | 'stats' | 'ranking' | 'account' | 'train'
  initial?: string // repli : l'initiale du joueur connecté si son avatar n'est pas connu
  avatar?: string // l'avatar du joueur connecté (liste fixe, voir avatars/)
}>()
const art = computed(() => (props.avatar ? (AVATAR_ART[props.avatar] ?? AVATAR_ART[DEFAULT_AVATAR]) : null))
const artInner = computed(() => (art.value ? `<rect width="100" height="100" fill="${art.value.bg}"/>${art.value.body}` : ''))

const day = new Date().getDate()
</script>

<template>
  <svg class="menu-icon" :class="'menu-icon--' + props.name" viewBox="0 0 64 64" role="img" aria-hidden="true" :data-icon="props.name">
    <!-- Puzzle du jour : calendrier + chrono -->
    <g v-if="props.name === 'daily'">
      <rect x="6" y="10" width="46" height="44" rx="8" fill="#fff" stroke="#cbd5e1" stroke-width="2" />
      <path d="M6 22 V18 a8 8 0 0 1 8 -8 H44 a8 8 0 0 1 8 8 V22 Z" fill="#ef4444" />
      <rect x="15" y="5" width="5" height="12" rx="2.5" fill="#475569" />
      <rect x="38" y="5" width="5" height="12" rx="2.5" fill="#475569" />
      <text x="23" y="44" text-anchor="middle" font-size="19" font-weight="800" fill="#111827" font-family="system-ui, sans-serif" data-test="day">{{ day }}</text>
      <circle cx="50" cy="48" r="11" fill="#f59e0b" stroke="#fff" stroke-width="3" />
      <path d="M50 42 V48 L54.5 51" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
    </g>

    <!-- Tutoriel : livre ouvert + voie + « ? » -->
    <g v-else-if="props.name === 'tuto'">
      <path d="M4 18 Q18 12 32 18 Q46 12 60 18 V52 Q46 46 32 52 Q18 46 4 52 Z" fill="#1d4ed8" />
      <path d="M7 16 Q19 11 32 17 V50 Q19 45 7 50 Z" fill="#fff" />
      <path d="M32 17 Q45 11 57 16 V50 Q45 45 32 50 Z" fill="#f8fafc" />
      <g stroke="#cbd5e1" stroke-width="2.4" stroke-linecap="round">
        <path d="M12 25 H26" /><path d="M12 31 H26" /><path d="M12 37 H22" />
      </g>
      <path d="M37 42 H43 Q48 42 48 37 V33 Q48 28 53 28" fill="none" stroke="#2563eb" stroke-width="3.2" stroke-linecap="round" />
      <circle cx="51" cy="14" r="10" fill="#fbbf24" stroke="#fff" stroke-width="3" />
      <text x="51" y="19" text-anchor="middle" font-size="14" font-weight="800" fill="#fff" font-family="system-ui, sans-serif">?</text>
    </g>

    <!-- Classement : coupe -->
    <g v-else-if="props.name === 'ranking'">
      <path d="M18 8 H46 V26 Q46 40 32 42 Q18 40 18 26 Z" fill="#fbbf24" stroke="#fff" stroke-width="3" stroke-linejoin="round" />
      <path d="M18 14 H9 Q9 28 20 30 M46 14 H55 Q55 28 44 30" fill="none" stroke="#f59e0b" stroke-width="3.5" stroke-linecap="round" />
      <rect x="29" y="42" width="6" height="8" fill="#f59e0b" />
      <rect x="21" y="50" width="22" height="7" rx="2.5" fill="#60a5fa" stroke="#fff" stroke-width="2" />
      <path d="M32 14 L34 19 L39 19.6 L35.4 23 L36.4 28 L32 25.4 L27.6 28 L28.6 23 L25 19.6 L30 19 Z" fill="#fff" />
    </g>

    <!-- Stats : podium 2-1-3 + étoile -->
    <g v-else-if="props.name === 'stats'">
      <rect x="5" y="34" width="16" height="22" rx="3" fill="#60a5fa" />
      <rect x="24" y="22" width="16" height="34" rx="3" fill="#f59e0b" />
      <rect x="43" y="40" width="16" height="16" rx="3" fill="#34d399" />
      <g fill="#fff" font-size="11" font-weight="800" text-anchor="middle" font-family="system-ui, sans-serif">
        <text x="13" y="49">2</text><text x="32" y="42">1</text><text x="51" y="52">3</text>
      </g>
      <path d="M32 4 L35.2 11 L42.5 11.8 L37 16.8 L38.6 24 L32 20.3 L25.4 24 L27 16.8 L21.5 11.8 L28.8 11 Z" fill="#fde047" stroke="#fff" stroke-width="2" stroke-linejoin="round" />
    </g>

    <!-- Mon train : un garage, la locomotive qui en sort sur sa voie -->
    <g v-else-if="props.name === 'train'">
      <path d="M30 26 L45 14 L60 26 V54 H30 Z" fill="#b45309" stroke="#fff" stroke-width="2.5" stroke-linejoin="round" />
      <path d="M27 27 L45 12 L63 27" fill="none" stroke="#7f1d1d" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
      <rect x="36" y="31" width="18" height="23" rx="2" fill="#1f2937" />
      <rect x="2" y="54" width="60" height="4" rx="2" fill="#6b7280" />
      <rect x="6" y="32" width="24" height="16" rx="4" fill="#dc2626" stroke="#fff" stroke-width="2" />
      <rect x="20" y="26" width="12" height="20" rx="2.5" fill="#991b1b" stroke="#fff" stroke-width="2" />
      <rect x="9" y="25" width="5" height="9" rx="1.5" fill="#1f2937" />
      <circle cx="11" cy="50" r="4.5" fill="#1f2937" stroke="#fbbf24" stroke-width="2" />
      <circle cx="25" cy="50" r="4.5" fill="#1f2937" stroke="#fbbf24" stroke-width="2" />
      <circle cx="9" cy="19" r="3" fill="#f8fafc" /><circle cx="5" cy="13" r="2.2" fill="#f8fafc" opacity="0.8" />
    </g>

    <!-- Compte : avatar (initiale si connecté) -->
    <g v-else>
      <template v-if="art">
        <clipPath id="menu-avatar-clip"><circle cx="32" cy="32" r="27" /></clipPath>
        <g clip-path="url(#menu-avatar-clip)"><svg x="5" y="5" width="54" height="54" viewBox="0 0 100 100" data-test="menu-avatar" v-html="artInner" /></g>
        <circle cx="32" cy="32" r="27" fill="none" stroke="#fff" stroke-width="3" />
        <circle cx="52" cy="50" r="9" fill="#22c55e" stroke="#fff" stroke-width="3" />
        <path d="M48 50 L51 53 L56 47" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
      </template>
      <template v-else>
      <circle cx="32" cy="32" r="27" fill="#3b82f6" stroke="#fff" stroke-width="3" />
      <template v-if="props.initial">
        <text x="32" y="42" text-anchor="middle" font-size="28" font-weight="800" fill="#fff" font-family="system-ui, sans-serif" data-test="initial">{{ props.initial }}</text>
        <circle cx="52" cy="50" r="9" fill="#22c55e" stroke="#fff" stroke-width="3" />
        <path d="M48 50 L51 53 L56 47" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
      </template>
      <template v-else>
        <circle cx="32" cy="25" r="9" fill="#fff" />
        <path d="M14 50 Q14 35 32 35 Q50 35 50 50 Q42 56 32 56 Q22 56 14 50 Z" fill="#fff" />
        <circle cx="51" cy="51" r="10" fill="#22c55e" stroke="#fff" stroke-width="3" />
        <path d="M51 46 V56 M46 51 H56" stroke="#fff" stroke-width="3" stroke-linecap="round" />
      </template>
      </template>
    </g>
  </svg>
</template>

<style scoped>
.menu-icon {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}
</style>
