# Aides, pièces et serveur (proposition à valider)

## Architecture : le serveur fait foi
Le serveur détient les niveaux et leurs solutions, valide les parties, tient les comptes, les scores et
les pièces. Le navigateur n'est qu'une interface.

- **Niveaux côté serveur uniquement.** Le client ne reçoit que la grille du niveau en cours (compteurs,
  entrée, sortie, rails imposés), jamais les suivants, jamais la solution. Aujourd'hui les 90 niveaux sont
  dans le bundle (`front/src/levels.ts`) : à retirer du front.
- **Validation par le serveur.** À la fin, le client envoie son tracé. Le serveur le vérifie avec la même
  logique (`track.ts`, `puzzle.ts`, partagés en TypeScript) et répond juste ou faux. Seule la réponse
  « juste » débloque le niveau suivant et crédite les pièces.
- **Temps mesuré par le serveur** (de la demande de niveau à la soumission) : un chrono client est falsifiable.
- **Les aides sont des appels serveur** : elles ont besoin de la solution, et le serveur débite les pièces.
- **Anonymes** : le serveur crée un identifiant anonyme (stocké dans le navigateur) et y enregistre la
  progression ; à l'inscription ou la connexion, il la rattache au compte.
- **Google** : le jeton est vérifié côté serveur (la vérification faite dans le front deviendra redondante).
- **Base** : PostgreSQL dans un conteneur (docker-compose). Tables : joueurs, niveaux (grille + solution),
  progression, pièces, stock d'aides. **Serveur : TypeScript avec Fastify** (la validation des tracés réutilise
  les règles de `track.ts` / `puzzle.ts`, partagées avec le front).
- **Conséquence** : le Voyage exige d'être en ligne (le niveau suivant dépend de la réponse du serveur) ;
  le tutoriel reste hors ligne.

## Comptes et sécurité
- **Inscription** : pseudo, e-mail, mot de passe. Le compte n'est actif qu'après confirmation par e-mail
  (lien à durée limitée, usage unique).
- **Robustesse du mot de passe** : estimée en bits par un outil de type zxcvbn, pas par un simple compte de
  caractères (« Password123! » paraît fort en bits naïfs et se devine en quelques secondes).
  L'estimation est volontairement **prudente** : 36 bits laissent passer un mot inventé suivi de chiffres et d'un
  symbole (« Ruleju42170! » : 38 bits), pas les mots de passe courants même décorés (« Password123! » : 19 bits).
  Quatre mots ou une phrase font plus de 65 bits.
  Distinguer un mot français inconnu de l'outil d'un tirage au hasard est impossible ; sur-noter un mot
  faible est pire que sous-noter un bon mot de passe. **Seuil retenu :
  36 bits, sans minimum de longueur** (les bits suffisent) ; aucune valeur en dessous n'est acceptée. L'estimation tient compte du
  pseudo et de l'e-mail saisis.
- **Indicateur** : barre de robustesse, libellé et nombre de bits affichés pendant la frappe ; le bouton
  d'inscription reste inactif sous le seuil. **Le serveur recalcule** : il ne fait jamais confiance au navigateur.
- **Mot de passe stocké** : haché avec sel par un algorithme lent (argon2id).
- **Limite d'essais à la connexion** : 5 échecs consécutifs pour un e-mail bloquent la connexion 15 minutes
  (le délai double à chaque récidive, jusqu'à 24 h) ; plafond aussi par adresse IP. Un succès remet le compteur
  à zéro. Le blocage s'applique même à un e-mail inconnu, pour ne pas révéler quels comptes existent.
- Pseudo **unique** (utile pour un futur classement). E-mail déjà inscrit : la réponse est identique à un
  succès (rien ne révèle qui a un compte) et le titulaire reçoit un mail d'avertissement.

## Tactile (téléphone)
Le jeu se joue au doigt : poser et glisser des rails, appui long pour une croix (`touch-action: none`,
événements pointeur). Deux corrections faites : sur Android, l'appui long envoie aussi `contextmenu`, ce qui
retirait la croix qu'il venait de poser ; et un geste interrompu par le système (`pointercancel`) laissait
un tracé « en cours ». Non testé sur un vrai téléphone, seulement par tests automatiques.

## Pièces
- Niveau du Voyage gagné : 10 (4×4), 15 (5×5), 20 (6×6), 25 (7×7), 30 (8×8). Le Voyage est linéaire : un
  niveau ne se rejoue pas, donc rien à bloquer ; le serveur refuse de créditer deux fois le même niveau.
- Niveau gagné **sans aucune aide** (hors démonstration offerte) : +5.
- Puzzle du jour : 20, plus un supplément pour une série de jours ; seul le premier temps du jour compte.
- **Inscription : 100 pièces, versées à la confirmation de l'e-mail** (Google est déjà confirmé : versées
  à la création du compte). Évite les faux comptes.
- **Affichage** : le solde est visible sur l'accueil **et pendant une partie**.
- Pas d'achat de pièces avec de l'argent réel pour l'instant.

## Les 4 aides (de la plus faible à la plus forte), cible choisie par le joueur
| # | Aide | Effet | Prix | S'ouvre au niveau |
|---|---|---|---|---|
| 1 | Couleurs | Active les indicateurs de couleur des compteurs sur le niveau en cours | 10 | 20 |
| 2 | Une case | Pose le rail de la case choisie dans le bon sens (ou une croix) | 20 | 50 |
| 3 | Canon | Révèle au hasard 3 à 6 cases de la voie (selon la grille) parmi celles que le joueur n'a pas déjà bien posées, réparties sur des lignes et colonnes différentes | 30 | 80 |
| 4 | Une ligne | Pose tous les rails de la ligne ou colonne choisie, dans le bon sens | 50 | 110 |

- **Indicateurs de couleur désactivés par défaut** (ils aidaient beaucoup trop) : c'est la première aide qui les active.
- Les niveaux d'ouverture suivent la durée de jeu (un niveau de début de partie dure moins de 30 s).
- Les quatre emplacements sont visibles dès le niveau 1 ; ceux pas encore débloqués sont des emplacements vides.
- Prix fixes, affichés avant la confirmation ; rien n'est débité avant.
- Rails révélés = rails imposés (verrouillés).

## Au déblocage
- 3 en stock + 1 usage de démonstration offert : le compteur affiche 4 au déblocage, puis 3 après l'essai.
- Cet usage offert ne retire ni le +5 « sans aide » ni les étoiles de rapidité.
- Une aide doit fonctionner avec toutes les mécaniques à venir (rochers, gares, deux trains, tunnels) :
  case à cocher dans les issues #2 à #5.

## Limiter les aides
Stock plafonné à 3 par type ; une aide de chaque type par niveau ; aucune aide pendant le puzzle du
jour ; un niveau où une aide payante a servi ne donne pas les étoiles de rapidité (issue #6).

## Achat des aides (pas de boutique)
Pas d'écran Boutique ni de cosmétiques. Quand le stock d'une aide est vide, on la rachète avec les pièces
gagnées en jouant, directement depuis le bouton de l'aide (jusqu'au plafond de 3). Pas d'argent réel.

## État d'avancement
- Fait : serveur Fastify + PostgreSQL, comptes (confirmation d'e-mail, robustesse en bits, blocage des essais),
  niveaux et progression côté serveur (le navigateur ne reçoit que la grille en cours, le serveur valide
  le tracé et mesure le temps).
- Fait : pièces (gain à chaque niveau, 100 à la confirmation de l'e-mail), 4 aides (Couleurs, Une case,
  Canon, Une ligne) calculées par le serveur, cadeau de déblocage (3 en stock + 1 essai offert),
  achat avec les pièces gagnées, solde visible à l'accueil et en partie, reprise des cases révélées.
  Les rails révélés se comportent comme des rails imposés (verrouillés, dans le bon sens).
- Fait : générateur de puzzles à solution unique (shared/generator.ts) et puzzle du jour côté serveur : graine =
  date (fuseau Europe/Paris), toujours en 6×6, même grille pour tous,
  sans aide, premier temps du jour seul compté, 20 pièces + 2 par jour de série (max +10), statistiques
  (nombre, moyenne, meilleur, pire, série) et reprise gardée par le serveur.
- Reste : Google côté serveur, classement, étoiles de rapidité.
- Les pouvoirs s'ouvrent aux niveaux 20, 50, 80 et 110 (un tous les 30 niveaux après le premier).
