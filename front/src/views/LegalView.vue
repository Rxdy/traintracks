<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from '../api'

// Mentions légales et politique de confidentialité. L'éditeur, son contact et l'hébergeur viennent du serveur
// (variables LEGAL_NAME, LEGAL_CONTACT, LEGAL_HOST) : rien de personnel n'est écrit dans le code.
const legal = ref({ name: '', contact: '', host: '' })
onMounted(async () => {
  const r = await api('GET', '/api/legal')
  if (r?.status === 200) legal.value = r.data as typeof legal.value
})
const todo = 'à renseigner'
const version = __APP_VERSION__ + (__APP_COMMIT__ ? ` (${__APP_COMMIT__})` : '')
</script>

<template>
  <article class="legal" data-test="legal">
    <h2>Mentions légales</h2>
    <p><b>Éditeur et responsable de la publication :</b> <span data-test="legal-name">{{ legal.name || todo }}</span>.</p>
    <p><b>Contact :</b> <span data-test="legal-contact">{{ legal.contact || todo }}</span>.</p>
    <p><b>Hébergement :</b> <span data-test="legal-host">{{ legal.host || todo }}</span>.</p>
    <p>Train Tracks est un jeu de logique gratuit, sans publicité. <span data-test="app-version">Version {{ version }}</span>.</p>

    <h2>Politique de confidentialité</h2>
    <h3>Ce que nous gardons</h3>
    <ul>
      <li><b>Compte :</b> pseudo, adresse e-mail, mot de passe (jamais en clair : seule une empreinte est conservée). Si tu te connectes avec Google : l'identifiant que Google donne à ton compte, en plus de l'adresse e-mail ; ni ton nom, ni ta photo.</li>
      <li><b>Jeu :</b> niveaux terminés et temps, pièces, aides, résultats du puzzle du jour.</li>
      <li><b>Classement :</b> ton pseudo, ton avatar, ton niveau et tes temps sont visibles de tous dans les classements. Tu peux ne pas y apparaître (case à décocher dans l'écran Compte) ; ton adresse e-mail n'est jamais montrée.</li>
      <li><b>Sécurité :</b> les essais de connexion ratés, par adresse e-mail et par adresse IP, pour bloquer les tentatives de devinette. Ces compteurs s'effacent d'eux-mêmes.</li>
    </ul>
    <p>Sans compte, ta progression est rattachée à un identifiant aléatoire gardé dans ton navigateur (cookie). Elle est ajoutée à ton compte si tu t'inscris.</p>

    <h3>À quoi ça sert</h3>
    <p>Uniquement à faire fonctionner le jeu : te connecter, garder ta progression, te prévenir par e-mail (confirmation d'adresse, mot de passe oublié, suppression de compte). Rien n'est vendu, rien n'est utilisé pour de la publicité ni du suivi.</p>

    <h3>Cookies</h3>
    <p>Deux cookies, tous deux nécessaires au fonctionnement (donc sans bandeau de consentement) : la session de connexion (30 jours) et l'identifiant anonyme de progression (1 an). Pas de cookie de mesure d'audience, pas de traceur tiers.</p>

    <h3>Qui reçoit tes données</h3>
    <p>Si tu choisis « Continuer avec Google », Google confirme ton identité et nous transmet uniquement ton adresse e-mail et un identifiant ; nous ne lui envoyons rien sur ton jeu. Google sait en revanche que tu te connectes à Train Tracks, selon <b>sa</b> politique de confidentialité. Le service d'e-mail d'OVHcloud (France) envoie les messages du jeu (confirmation d'adresse, mot de passe oublié, suppression de compte). Une copie de sauvegarde de la base est aussi conservée sur un stockage en ligne, <b>chiffrée</b> : elle est illisible sans la clé que seul l'éditeur possède. Aucune donnée n'est transmise à des annonceurs ou à des réseaux sociaux.</p>

    <h3>Combien de temps</h3>
    <p>Tant que ton compte existe. Quand tu le supprimes, tout est effacé immédiatement du jeu. Les sauvegardes chiffrées sont gardées 5 semaines au plus, puis détruites : tes données peuvent donc y rester jusqu'à ce délai, sans jamais être réutilisées.</p>

    <h3>Tes droits</h3>
    <p>Tu peux accéder à tes données, les corriger, les récupérer ou les effacer, <b>seul(e), depuis l'écran Compte</b> : changer ton adresse e-mail, exporter tes données (fichier signé, que tu peux réimporter) et supprimer ton compte (bouton « Supprimer mon compte »). Pour le reste, écris à l'adresse de contact ci-dessus. Tu peux aussi saisir la CNIL (cnil.fr) si tu estimes que tes droits ne sont pas respectés.</p>
  </article>
</template>

<style scoped>
.legal {
  width: min(40rem, 100%);
  padding: 1rem 1.2rem 1.4rem;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: var(--shadow);
  color: #374151;
  font-size: 0.92rem;
  line-height: 1.5;
}
h2 {
  margin: 1.2rem 0 0.4rem;
  font-size: 1.2rem;
  font-weight: 800;
  color: #111827;
}
h2:first-child {
  margin-top: 0;
}
h3 {
  margin: 0.9rem 0 0.2rem;
  font-size: 1rem;
  font-weight: 800;
  color: #1f2937;
}
p,
ul {
  margin: 0.3rem 0;
}
ul {
  padding-left: 1.2rem;
}
</style>
