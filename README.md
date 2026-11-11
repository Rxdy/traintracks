# Train Tracks 🚂

Une implémentation web du jeu de logique **Train Tracks** (aussi connu sous le
nom de *Tracks* / *Train Tracks Puzzle*).

## Le jeu

Train Tracks est un puzzle de logique sur une grille. Le but est de relier deux
extrémités de voie ferrée (une entrée et une sortie sur les bords de la grille)
en posant des rails, tout en respectant des contraintes :

- des **compteurs** sur chaque ligne et chaque colonne indiquent le nombre de
  cases contenant un morceau de rail,
- quelques morceaux de rail sont **donnés au départ** comme indices,
- la voie forme un **chemin unique et continu** de l'entrée à la sortie, sans
  boucle ni embranchement.

## Objectifs du projet

- 🎯 **Un puzzle quotidien** — une nouvelle grille à résoudre chaque jour.
- 🧩 **Jouer en ligne** — interface web légère pour poser les rails et vérifier
  sa solution.
- 🤖 **Un solveur** — résolution automatique d'une grille donnée, utile pour
  générer et valider les puzzles quotidiens.

## Structure du projet

```
traintracks/
├── Makefile             # raccourcis (make up, make down, ...)
├── docker-compose.yml   # orchestration des services
└── front/               # application front-end (Vue.js 3 + Vite)
    ├── Dockerfile        # build multi-stage → image nginx alpine légère
    ├── nginx.conf        # config nginx (mode SPA)
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── main.js
        ├── App.vue
        └── style.css
```

## Démarrage

Prérequis : **Docker** et **Docker Compose**.

```bash
make up
```

Le front est ensuite disponible sur <http://localhost:8090>.

## Commandes utiles

| Commande       | Description                                            |
| -------------- | ------------------------------------------------------ |
| `make up`      | Build l'image et démarre le front en arrière-plan      |
| `make down`    | Arrête et supprime les conteneurs                      |
| `make build`   | (Re)build l'image seulement                            |
| `make logs`    | Suit les logs du front                                 |
| `make restart` | Redémarre les conteneurs                               |
| `make re`      | `down` puis `up` (rebuild complet)                     |
| `make clean`   | Supprime conteneurs, image locale et volumes           |

## Stack technique

- **Front-end** : Vue.js 3 + Vite
- **Serveur** : nginx (image `nginx:alpine`, build multi-stage pour une image finale légère)
- **Orchestration** : Docker Compose
