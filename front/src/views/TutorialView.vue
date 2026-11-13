<script setup lang="ts">
import DemoPlayer from '../components/DemoPlayer.vue'
import { samplePuzzle, sampleSolution, sampleCaptions } from '../puzzle'
</script>

<template>
  <section class="tuto" data-test="tutorial">
    <h2 class="halo">Comment jouer</h2>
    <DemoPlayer
      :puzzle="samplePuzzle"
      :path="sampleSolution"
      :captions="sampleCaptions"
    />
    <ol>
      <li>
        <strong>But :</strong> relier l'entrée (<span class="g">vert</span>) à la sortie
        (<span class="r">rouge</span>) avec une seule voie, sans boucle ni bifurcation.
      </li>
      <li>
        <strong>Les chiffres</strong> du bord donnent le nombre de cases que la voie traverse
        dans la ligne ou la colonne.
      </li>
      <li>
        <strong>Toucher une case</strong> : un point bleu, « il y a un rail ici ». Retoucher l'efface.
      </li>
      <li>
        <strong>Glisser</strong> d'une case à l'autre : trace la voie, les virages se font tout seuls.
        Repasser dessus l'efface.
      </li>
      <li>
        <strong>Clic droit</strong>, appui à deux doigts sur un pavé tactile ou appui long sur mobile :
        une croix ✕, « pas de rail ici ».
      </li>
      <li>
        <strong>Rails gris</strong> (à partir du niveau 70) : déjà posés, on n'y touche pas.
        La voie passe par eux, telle qu'ils sont dessinés.
      </li>
      <li>
        <strong>Pouvoirs</strong> (à partir du niveau 20) : un coup de pouce par niveau et par type,
        trois en réserve au maximum. Les pièces gagnées en jouant servent à en racheter.
        Couleurs (niveau 20) : les chiffres passent au <span class="g">vert</span> quand la ligne
        est complète, au <span class="r">rouge</span> quand c'est impossible.
        Une case (50), Canon (80), Une ligne (110).
      </li>
      <li><strong>Ctrl+Z</strong> annule, <strong>Ctrl+Maj+Z</strong> rétablit.</li>
    </ol>
    <p class="note">
      Une ligne ou une colonne à <strong>1</strong> se traverse tout droit, sur une seule case.
      Une fois la grille résolue, le train 🚂 parcourt ta voie.
    </p>
  </section>
</template>

<style scoped>
.tuto {
  max-width: 36rem;
  line-height: 1.55;
  color: #374151;
}
h2 {
  margin-bottom: 0.75rem;
  text-align: center;
  font-weight: 800;
}
/* étapes numérotées dans des pastilles, comme les cubes de l'accueil */
ol {
  margin-top: 1.25rem;
  padding: 0;
  list-style: none;
  counter-reset: step;
  display: grid;
  gap: 0.7rem;
}
li {
  counter-increment: step;
  position: relative;
  padding: 0.7rem 0.9rem 0.7rem 3.2rem;
  border: 2px solid #fff;
  border-radius: 18px;
  background: linear-gradient(#eef7ff, #ffffff);
  box-shadow: 0 3px 10px rgba(30, 64, 175, 0.12);
}
li::before {
  content: counter(step);
  position: absolute;
  left: 0.8rem;
  top: 50%;
  transform: translateY(-50%);
  width: 1.8rem;
  height: 1.8rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #2563eb;
  color: #fff;
  font-weight: 800;
  font-size: 0.9rem;
}
.note {
  margin-top: 1rem;
  padding: 0.7rem 0.9rem;
  border-radius: 14px;
  background: #fef9c3;
  color: #713f12;
  font-size: 0.9rem;
}
.g {
  color: #16a34a;
  font-weight: 700;
}
.r {
  color: #dc2626;
  font-weight: 700;
}
</style>
