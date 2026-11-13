# Jalons du Voyage (proposition à valider)

Base : issues GitHub #1 à #7. Constat sur le code : 90 niveaux existent (1-15 en 4×4, 16-60 en 5×5,
61-90 en 6×6 **tous** avec rails imposés). Ils sont écrits en dur dans `front/src/levels.ts`
(pas de base de données) et viennent d'un script externe.

## Règles de rythme proposées
1. Une nouveauté commence par un niveau d'introduction facile (texte + exemple).
2. On ne monte jamais la taille de grille et on n'introduit jamais une règle dans le même niveau.
3. Alternance : après l'intro, 2 niveaux « normaux » pour 1 niveau avec la mécanique, puis 1 pour 1.
   Tous les 10 niveaux, un niveau « mélange » qui combine les mécaniques déjà vues.
4. Chaque niveau garde une solution unique (test du solveur).

## Calendrier
| Niveaux | Grille | Contenu |
|---|---|---|
| 1-15 | 4×4 | Base (fait) |
| 16-60 | 5×5 | Base (fait) |
| 61-105 | 6×6 | Rails imposés : intro au 61, puis 1 niveau sur 3 |
| 106-149 | 6×6 | Rails imposés : 1 niveau sur 2 |
| 150-194 | 6×6 | Rochers : intro au 150, alternance avec imposés |
| 195-239 | 7×7 | Taille seule en 195-199 (rien de nouveau), puis rochers et imposés |
| 240-329 | 7×7 | Gares : intro au 240 |
| 330-419 | 8×8 | Deux trains : intro au 330 (taille montée avant, au 320) |
| 420+ | 8×8 et plus | Tunnels : intro au 420 |

## Écarts avec l'existant
- Les niveaux 61-90 ont tous des rails imposés : il faut en refaire une partie en 6×6 simple pour
  respecter l'alternance.
- Le **générateur TypeScript** (issue #6) est le prérequis de tout : puzzle du jour, nouveaux niveaux,
  vérification d'unicité avec les nouvelles mécaniques.
