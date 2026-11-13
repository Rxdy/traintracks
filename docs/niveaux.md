# Ajouter des niveaux après la mise en ligne

Principe : **les niveaux ne se modifient jamais, on en ajoute à la suite.** Le gel (`freeze`) ne bloque pas
l'ajout : il protège seulement les niveaux déjà publiés contre un changement accidentel.

## Pourquoi un niveau publié ne doit pas changer

Des joueurs ont joué dessus : leur progression, leurs temps et leurs pièces renvoient à ce numéro de niveau.
Si la grille changeait, un temps ou une récompense n'aurait plus de sens.

## Les trois protections

1. **Base de données** (`seedLevels`, au démarrage du serveur) : n'insère que les numéros absents
   (`ON CONFLICT DO NOTHING`). Un niveau déjà en base n'est jamais modifié. Si le fichier diffère de la base,
   le serveur l'ignore et l'écrit dans le journal (« niveaux modifiés dans le fichier, ignorés »).
2. **Fichier de gel** `server/data/levels.lock.json` : une empreinte par niveau publié. `make build-levels`
   refuse de tourner si l'un d'eux a changé, et les tests échouent.
3. **Numéros continus** : 1, 2, 3… sans trou, sinon un joueur arriverait sur un niveau inexistant.

## Publier de nouveaux niveaux

```bash
make add-levels TO=350     # fabrique jusqu'au niveau 350, audite, gèle
git add server/data && git commit -m "Niveaux 300 à 350"
make up                    # reconstruit l'API : elle ajoute les nouveaux niveaux au démarrage
```

`make add-levels` enchaîne :
- `make build-levels TO=350` : garde les niveaux gelés tels quels, fabrique la suite ;
- `make audit` : unicité de la solution, montée de difficulté, conformité au plan ;
- `make freeze` : étend le gel jusqu'au niveau 350.

## Ce que voient les joueurs

- Un joueur en cours de route ne voit aucun changement.
- Un joueur qui avait **tout terminé** reprend au premier niveau ajouté (« de nouveaux niveaux arrivent
  bientôt » devient « Niveau suivant »).
- Aucune interruption : le serveur redémarre en quelques secondes, la base garde tout.

## Premier déploiement

Lance `make freeze` une fois, juste avant de publier : à partir de là, les 299 premiers niveaux sont protégés.
Ajouter ensuite des niveaux ne passe plus par un nouveau gel manuel : `make add-levels` s'en charge.

## Si un niveau publié est défectueux

On ne le corrige pas en place. Deux options :
- le laisser (s'il est jouable et à solution unique, un défaut de goût n'est pas un défaut) ;
- **ajouter** un niveau de remplacement à la suite et prévenir les joueurs. Retirer ou modifier un niveau
  demande une migration de base écrite à la main, car la progression y est attachée.

## Changer le plan (taille, règles, alternance)

Le plan s'applique aux niveaux **pas encore gelés**. Pour voir l'effet avant de fabriquer : `make plan TO=350`.
