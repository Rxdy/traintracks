# Mécanismes du Voyage (validés)

Plan réel dans `shared/curriculum.ts` (se relit avec `make plan`). Les nouveautés arrivent seules, jamais sur un
pouvoir ni sur un changement de taille de grille. Entre deux nouveautés : niveaux normaux, puis la règle seule,
puis des mélanges.

| Niveau | Mécanisme | État |
|---|---|---|
| 70 | Rails imposés : rail déjà posé, forme fixée | jouable |
| 150 | Rochers : case interdite à la voie, rien n'y est posé | jouable |
| 300 | Gares numérotées (voir ci-dessous) | à faire |
| 410 | Chiffres masqués : certains chiffres du bord sont cachés (« ? ») | à faire |
| 520 | Deux trains : deux entrées, deux sorties | à faire |
| 800 | Tunnels : deux ouvertures, le train entre par l'une et sort par l'autre | pas encore validé |

Pouvoirs : Couleurs (20), Une case (50), Canon (80), Une ligne (110).

## Gares numérotées (décidé)
Les gares portent 1, 2, 3… et la voie doit les visiter dans cet ordre, de l'entrée vers la sortie.
Différence avec un rail imposé : une gare dit par où le train passe ET dans quel ordre, mais pas la forme du passage.
- Niveau 300 : gares sans numéro (passage obligatoire, forme libre).
- Un peu plus tard : gares numérotées (ordre de visite). Même mécanisme, deux étapes.
- Solveur : vérifier que les gares apparaissent dans l'ordre sur la voie.

## Idées écartées ou gardées pour plus tard
- Voie à longueur limitée : inutile, le total est déjà la somme des chiffres du bord.
- Gare en ligne droite (quai horizontal ou vertical) : trop proche d'un rail imposé, variante tardive possible.
- Gare à distance (le chiffre est la position sur la voie) : pour les grands paliers.
- Virage ou tout droit imposé, passage à niveau, chiffres « au plus », brouillard : après les tunnels si besoin.
