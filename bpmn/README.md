# Processus BPMN de Train Tracks

23 diagrammes (état cible : serveur et base font foi) dans `out/` (PNG), générés depuis `processes.py` :

| # | Processus | # | Processus |
|---|-----------|---|-----------|
| 01 | Navigation et menu | 13 | Animation du train |
| 02 | Compte et session | 14 | Tutoriel (hors ligne) |
| 03 | Inscription | 15 | Statistiques |
| 04 | Confirmation de l'e-mail | 16 | Utiliser une aide |
| 05 | Connexion locale | 17 | Acheter une aide |
| 06 | Connexion Google | 18 | Débloquer une aide |
| 07 | Rattachement de la progression anonyme | 19 | Gagner des pièces |
| 08 | Jouer un niveau du Voyage | 20 | Installation PWA |
| 09 | Puzzle du jour | 21 | Service worker : installation |
| 10 | Génération du puzzle du jour | 22 | Service worker : requêtes |
| 11 | Pose d'un rail | 23 | Résolution d'un puzzle (serveur) |
| 12 | Contrôle de la grille complète | | |

## Régénérer

```bash
make bpmn            # ou : python3 bpmn/generate.py
```

Python 3 standard. Sortie : PNG uniquement (le SVG est jeté), via `rsvg-convert` ou ImageMagick.
Le script **échoue** si deux libellés se chevauchent, si un texte déborde de sa forme ou si un trait
traverse un libellé ou une forme.

## Conventions

- Flux : traits simples, sans pointe de flèche, lus de gauche à droite.
- Couleurs (convention de fait, la norme BPMN 2.0 n'en impose pas) : début vert, fin rouge,
  fin en erreur rouge foncé avec croix, décision jaune, tâche bleue.
  Le fond des couloirs indique le rôle (humain, application, stockage, externe, technique).
- Palette : `bpmn_kit/theme.json` uniquement.

## Réutiliser dans un autre projet

Copier `bpmn_kit/` + `generate.py`, écrire un `processes.py` (voir celui-ci : `Process`, `start`, `task`,
`gw`, `end`, `error`, `flow`).
