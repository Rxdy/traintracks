"""Les 34 processus de Train Tracks (état cible : serveur et base de données font foi)."""
from bpmn_kit import Process

J = ("J", "Joueur", "joueur")
A = ("A", "Application (navigateur)", "application")
V = ("V", "Serveur", "technique")
D = ("D", "Base PostgreSQL", "stockage")
X = ("X", "Google", "externe")
N = ("N", "Pas de victoire", "neutre")


def flows(p, *pairs):
    for x in pairs:
        p.flow(*x)


def navigation():
    p = Process("01-navigation", "01 · Navigation et menu", [J, A])
    p.start("s", "Ouvre l'app", "J", 0)
    p.task("a", "Monte App, enregistre le service worker", "A", 1)
    p.task("b", "Affiche l'accueil : 4 cubes et le solde de pièces", "A", 2)
    p.task("c", "Clique un cube", "J", 3)
    p.gw("g", "Cube verrouillé ?", "A", 4)
    p.task("v", "Voit le cadenas : inscription requise (02)", "J", 5)
    p.end("e1", "Reste sur l'accueil", "J", 6)
    p.task("go", "Affiche l'écran choisi (le pied de page mène aux mentions légales)", "A", 5)
    p.end("e2", "Écran affiché", "A", 6)
    p.chain("s", "a", "b", "c", "g")
    flows(p, ("g", "v", "Oui"), ("g", "go", "Non"), ("v", "e1"), ("go", "e2"))
    return p


def compte():
    p = Process("02-compte", "02 · Compte et session", [J, A, V])
    p.start("s", "Ouvre l'écran Compte", "J", 0)
    p.gw("g", "Connecté ?", "A", 1)
    p.end("e1", "Choisit une connexion (03, 05, 06, 24)", "J", 1)
    p.task("a", "Affiche pseudo et e-mail, Déconnexion, Suppression (26)", "A", 2)
    p.task("d", "Clique Déconnexion", "J", 3)
    p.task("l", "Ferme la session", "V", 4)
    p.end("e2", "Retour au formulaire", "A", 5)
    flows(p, ("s", "g"), ("g", "e1", "Non"), ("g", "a", "Oui"), ("a", "d"), ("d", "l"), ("l", "e2"))
    return p


def inscription():
    p = Process("03-inscription", "03 · Inscription", [J, A, V, D])
    p.start("s", "Remplit pseudo, e-mail, mot de passe (lien vers la confidentialité)", "J", 0)
    p.task("a", "Valide le format, affiche l'indicateur de robustesse en bits", "A", 1)
    p.gw("g1", "Format et robustesse OK ?", "A", 2)
    p.task("v", "Reçoit l'inscription, recalcule la robustesse", "V", 3)
    p.gw("g2", "Robustesse suffisante ?", "V", 4)
    p.gw("g3", "Pseudo déjà pris ?", "V", 5)
    p.task("err", "Voit le message d'erreur", "J", 6)
    p.error("ee", "Inscription refusée", "J", 7)
    p.task("h", "Hache le mot de passe (sel + algorithme lent)", "V", 6)
    p.task("d", "Crée le joueur non confirmé", "D", 7)
    p.task("m", "Envoie l'e-mail de confirmation (ou d'avertissement si déjà inscrit)", "V", 8)
    p.end("e", "Voit « Vérifie ta boîte mail »", "A", 9)
    p.chain("s", "a", "g1")
    flows(p, ("g1", "err", "Non"), ("g1", "v", "Oui"), ("v", "g2"), ("g2", "err", "Non"), ("g2", "g3", "Oui"),
          ("g3", "err", "Oui"), ("g3", "h", "Non"), ("err", "ee"), ("h", "d"), ("d", "m"), ("m", "e"))
    return p


def confirmation():
    p = Process("04-confirmation-email", "04 · Confirmation de l'e-mail", [J, A, V, D])
    p.start("s", "Clique le lien reçu par e-mail", "J", 0)
    p.task("a", "Envoie le jeton du lien", "A", 1)
    p.task("v", "Vérifie le jeton", "V", 2)
    p.gw("g", "Jeton valide, non expiré ?", "V", 3)
    p.error("err", "Lien invalide ou expiré", "A", 4)
    p.task("d", "Marque confirmé, verse 100 pièces une seule fois (19)", "D", 4)
    p.end("e", "Compte confirmé, 100 pièces reçues", "A", 5)
    p.chain("s", "a", "v", "g")
    flows(p, ("g", "err", "Non"), ("g", "d", "Oui"), ("d", "e"))
    return p


def connexion():
    p = Process("05-connexion-locale", "05 · Connexion locale", [J, A, V, D])
    p.start("s", "Saisit e-mail et mot de passe", "J", 0)
    p.task("a", "Envoie la demande", "A", 1)
    p.task("v", "Reçoit la demande", "V", 2)
    p.task("d", "Lit les échecs récents (e-mail et adresse IP)", "D", 3)
    p.gw("g1", "Trop d'essais ?", "V", 4)
    p.task("err1", "Voit « Trop d'essais, réessaie dans X minutes »", "J", 5)
    p.error("ee1", "Connexion bloquée", "J", 6)
    p.task("c", "Compare le mot de passe (hash lent)", "V", 5)
    p.gw("g2", "Mot de passe correct ?", "V", 6)
    p.task("o", "Échecs à zéro, ouvre la session, rattache l'anonyme (07)", "V", 7)
    p.end("e", "Connecté", "A", 8)
    p.task("w", "Note l'échec ; au 5e, bloque 15 min", "D", 7)
    p.task("err2", "Voit « identifiants incorrects » (lien Mot de passe oublié, 24)", "J", 8)
    p.error("ee2", "Connexion refusée", "J", 9)
    p.chain("s", "a", "v", "d", "g1")
    flows(p, ("g1", "err1", "Oui"), ("g1", "c", "Non"), ("err1", "ee1"), ("c", "g2"), ("g2", "o", "Oui"),
          ("g2", "w", "Non"), ("o", "e"), ("w", "err2"), ("err2", "ee2"))
    return p


def google():
    p = Process("06-connexion-google", "06 · Connexion Google", [J, A, X, V, D])
    p.start("s", "Clique Continuer avec Google", "J", 0)
    p.gw("g1", "Google configuré sur le serveur ?", "A", 1)
    p.task("soon", "Voit « Google : pas encore disponible »", "J", 2)
    p.end("e0", "Rien ne se passe", "J", 3)
    p.task("go", "Suit le lien vers le serveur", "A", 2)
    p.task("st", "Crée un état et un vérificateur PKCE (cookie 10 min), redirige", "V", 3)
    p.task("au", "Fait choisir un compte, renvoie un code", "X", 4)
    p.task("cb", "Au retour, compare l'état au cookie, échange le code (secret côté serveur)", "V", 5)
    p.gw("g2", "État et adresse OK ?", "V", 6)
    p.task("err", "Voit « La connexion avec Google a échoué »", "J", 7)
    p.error("ee", "Connexion refusée, aucun compte créé", "J", 8)
    p.task("r", "Retrouve le joueur (identifiant, sinon adresse) ou le crée", "V", 7)
    p.task("d", "Écrit le lien Google (création : pseudo neutre, 100 pièces)", "D", 8)
    p.task("o", "Ouvre la session, rattache la progression anonyme (07)", "V", 9)
    p.end("e", "Connecté", "A", 10)
    flows(p, ("s", "g1"), ("g1", "soon", "Non"), ("g1", "go", "Oui"), ("soon", "e0"), ("go", "st"), ("st", "au"), ("au", "cb"),
          ("cb", "g2"), ("g2", "err", "Non"), ("g2", "r", "Oui"), ("err", "ee"), ("r", "d"), ("d", "o"), ("o", "e"))
    return p


def rattachement():
    p = Process("07-rattachement-anonyme", "07 · Rattachement de la progression anonyme", [V, D])
    p.start("s", "Inscription ou connexion réussie", "V", 0)
    p.task("d", "Lit la progression de l'identifiant anonyme", "D", 1)
    p.gw("g", "Progression anonyme présente ?", "V", 2)
    p.end("n", "Rien à rattacher", "D", 2)
    p.task("m", "Fusionne : union des niveaux, somme des pièces, aides plafonnées à 3", "V", 3)
    p.task("w", "Écrit sur le compte, supprime l'anonyme", "D", 4)
    p.end("e", "Progression liée au compte", "V", 5)
    flows(p, ("s", "d"), ("d", "g"), ("g", "n", "Non"), ("g", "m", "Oui"), ("m", "w"), ("w", "e"))
    return p


def voyage():
    p = Process("08-niveau-du-voyage", "08 · Jouer un niveau du Voyage", [J, A, V, D])
    p.start("s", "Clique Continuer (connecté ou anonyme)", "J", 0)
    p.task("r", "Reçoit la demande de niveau", "V", 1)
    p.task("d", "Lit la progression", "D", 2)
    p.task("c", "Choisit le niveau en cours, lance le chrono serveur", "V", 3)
    p.task("a", "Reçoit la grille seule, jamais la solution, l'affiche", "A", 4)
    p.task("p", "Joue : pose des rails, utilise des aides (11, 16)", "J", 5)
    p.task("b", "Envoie le tracé (12)", "A", 6)
    p.task("v", "Valide le tracé avec les règles du jeu", "V", 7)
    p.gw("g", "Tracé juste ?", "V", 8)
    p.error("n", "Tracé refusé, le joueur continue", "A", 8)
    p.task("w", "Enregistre niveau, temps, pièces (19), aides (18)", "D", 9)
    p.end("e", "Voit le décor se dévoiler (27), le train (13), puis Suivant", "A", 10)
    p.chain("s", "r", "d", "c", "a", "p", "b", "v", "g")
    flows(p, ("g", "n", "Non"), ("g", "w", "Oui"), ("w", "e"))
    return p


def quotidien():
    p = Process("09-puzzle-quotidien", "09 · Puzzle du jour", [J, A, V, D])
    p.start("s", "Ouvre Puzzle du jour", "J", 0)
    p.gw("g1", "Connecté ?", "A", 1)
    p.end("e1", "Doit d'abord s'inscrire (02)", "J", 1)
    p.task("r", "Demande la grille du jour (10)", "V", 2)
    p.task("sal", "Affiche le salon : Lancer, ou Rejouer si déjà fait", "A", 3)
    p.task("l", "Clique Lancer", "J", 4)
    p.task("pl", "Joue la grille, sans aide (11, 12)", "A", 5)
    p.task("v", "Valide le tracé, mesure le temps", "V", 6)
    p.gw("g2", "Tracé juste ?", "V", 7)
    p.error("n1", "Tracé refusé, le joueur continue", "A", 7)
    p.gw("g3", "Premier temps du jour ?", "V", 8)
    p.end("n2", "Temps non comptabilisé", "A", 8)
    p.task("w", "Enregistre le temps, verse 20 pièces + bonus de série (19)", "D", 9)
    p.end("e2", "Temps enregistré", "A", 10)
    flows(p, ("s", "g1"), ("g1", "e1", "Non"), ("g1", "r", "Oui"), ("r", "sal"), ("sal", "l"), ("l", "pl"),
          ("pl", "v"), ("v", "g2"), ("g2", "n1", "Non"), ("g2", "g3", "Oui"), ("g3", "n2", "Non"),
          ("g3", "w", "Oui"), ("w", "e2"))
    return p


def generation():
    G = ("G", "Générateur et solveur", "technique")
    p = Process("10-generation-puzzle-du-jour", "10 · Génération du puzzle du jour", [V, D, G])
    p.start("s", "Un joueur ouvre le puzzle du jour", "V", 0)
    p.task("d", "Cherche la grille de la date", "D", 1)
    p.gw("g1", "Grille existante ?", "V", 2)
    p.task("gen", "Génère depuis la graine = date : voie au hasard, compteurs", "G", 3)
    p.gw("g2", "Solution unique ?", "G", 4)
    p.end("n", "Autre tirage, on recommence (rails imposés si besoin)", "D", 4)
    p.task("sv", "Enregistre la grille et sa solution (base)", "G", 5)
    p.task("env", "Envoie la grille, sans la solution", "V", 6)
    p.end("e", "Même grille pour tous ce jour-là", "V", 7)
    flows(p, ("s", "d"), ("d", "g1"), ("g1", "gen", "Non"), ("g1", "env", "Oui"), ("gen", "g2"),
          ("g2", "n", "Non"), ("g2", "sv", "Oui"), ("sv", "env"), ("env", "e"))
    return p


def pose():
    R = ("R", "Règles (track.ts)", "technique")
    p = Process("11-pose-de-rail", "11 · Pose d'un rail", [J, A, R])
    p.start("s", "Touche, glisse ou clique une case", "J", 0)
    p.gw("g1", "Partie résolue ?", "A", 1)
    p.end("e0", "Aucun effet", "J", 1)
    p.gw("g2", "Glissement ?", "A", 2)
    p.task("d", "dragStep : trace ou efface l'arête", "R", 2)
    p.end("e1", "Contrôle (12)", "R", 3)
    p.gw("g3", "Appui long ou clic droit ?", "A", 4)
    p.task("x", "toggleCross : pose ou retire une croix", "R", 4)
    p.end("e2", "Contrôle (12)", "R", 5)
    p.task("t", "tapCell : rail ou croix", "A", 6)
    p.end("e3", "Contrôle (12)", "A", 7)
    flows(p, ("s", "g1"), ("g1", "e0", "Oui"), ("g1", "g2", "Non"), ("g2", "d", "Oui"), ("g2", "g3", "Non"),
          ("g3", "x", "Oui"), ("g3", "t", "Non"), ("d", "e1"), ("x", "e2"), ("t", "e3"))
    return p


def controle():
    p = Process("12-controle-grille", "12 · Contrôle de la grille complète (navigateur)", [A, N])
    p.start("s", "Geste appliqué : commit()", "A", 0)
    p.gw("g1", "Grille modifiée ?", "A", 1)
    p.end("n1", "Rien à faire", "N", 1)
    p.gw("g2", "Chemin continu ?", "A", 2)
    p.end("n2", "Chemin incomplet", "N", 2)
    p.gw("g3", "Rails imposés traversés ?", "A", 3)
    p.end("n3", "Rail imposé manqué", "N", 3)
    p.gw("g4", "Compteurs exacts ?", "A", 4)
    p.end("n4", "Compteurs faux", "N", 4)
    p.task("w", "Grille complète : fige le chrono affiché", "A", 5)
    p.task("t", "Envoie le tracé au serveur (08 ou 09)", "A", 6)
    p.end("e", "Attend la réponse du serveur", "A", 7)
    p.chain("s", "g1")
    for g, n, nx in (("g1", "n1", "g2"), ("g2", "n2", "g3"), ("g3", "n3", "g4"), ("g4", "n4", "w")):
        p.flow(g, n, "Non"); p.flow(g, nx, "Oui")
    p.chain("w", "t", "e")
    return p


def train():
    M = ("M", "Minuterie 30 ms", "technique")
    p = Process("13-animation-du-train", "13 · Animation du train", [A, M])
    p.start("s", "Le décor est dévoilé (27) ou le joueur relance le train", "A", 0)
    p.task("a", "tracePath, mesure grille et écran", "A", 1)
    p.task("b", "leadCells + buildRoute : droites et quarts de cercle", "A", 2)
    p.task("c", "Monte TrainRun", "A", 3)
    p.task("tk", "Tick : vitesse constante, 3,2 cases/s partout", "M", 4)
    p.task("pt", "pointAt : place locomotive et 3 wagons", "M", 5)
    p.gw("g", "Route terminée ?", "A", 6)
    p.end("e1", "Tick suivant", "M", 6)
    p.task("cl", "clearInterval, émet done", "A", 7)
    p.task("nx", "Active le bouton Niveau suivant", "A", 8)
    p.end("e2", "Train sorti, suite possible", "A", 9)
    p.chain("s", "a", "b", "c", "tk", "pt", "g")
    flows(p, ("g", "e1", "Non"), ("g", "cl", "Oui"), ("cl", "nx"), ("nx", "e2"))
    return p


def tutoriel():
    M = ("M", "Minuterie 800 ms", "technique")
    p = Process("14-tutoriel", "14 · Tutoriel (hors ligne)", [J, A, M])
    p.start("s", "Ouvre Tutoriel", "J", 0)
    p.task("a", "Affiche les règles et le lecteur (étape 0)", "A", 1)
    p.task("pl", "Clique Lecture", "J", 2)
    p.gw("g1", "Lecture en cours ?", "A", 3)
    p.end("e1", "Démo en pause", "A", 4)
    p.task("tk", "Tick : étape + 1, légende, croix automatiques", "M", 4)
    p.gw("g2", "Chemin terminé ?", "A", 5)
    p.end("e2", "stop() : démo terminée", "A", 6)
    p.end("e3", "Prochain tick", "M", 5)
    p.chain("s", "a", "pl", "g1")
    flows(p, ("g1", "e1", "Oui"), ("g1", "tk", "Non"), ("tk", "g2"), ("g2", "e2", "Oui"), ("g2", "e3", "Non"))
    return p


def stats():
    p = Process("15-statistiques", "15 · Statistiques", [J, A, V, D])
    p.start("s", "Ouvre Statistiques", "J", 0)
    p.gw("g", "Connecté ?", "A", 1)
    p.end("e1", "Doit d'abord s'inscrire (02)", "J", 1)
    p.task("r", "Demande les statistiques", "V", 2)
    p.task("d", "Lit niveaux résolus et temps", "D", 3)
    p.task("c", "Calcule niveau en cours, moyenne, meilleur et pire temps", "V", 4)
    p.end("e2", "Voit ses statistiques", "J", 5)
    flows(p, ("s", "g"), ("g", "e1", "Non"), ("g", "r", "Oui"), ("r", "d"), ("d", "c"), ("c", "e2"))
    return p


def aide():
    p = Process("16-utiliser-une-aide", "16 · Utiliser une aide", [J, A, V, D])
    p.start("s", "Touche le bouton d'une aide", "J", 0)
    p.gw("g1", "En stock ?", "A", 1)
    p.end("n", "Voit le raccourci d'achat (17)", "J", 1)
    p.task("a", "Affiche la grille, attend la cible", "A", 2)
    p.task("t", "Choisit la cible : case, ligne ou extrémité", "J", 3)
    p.task("b", "Envoie l'aide et la cible", "A", 4)
    p.task("c", "Contrôle : débloquée, une par type et par niveau", "V", 5)
    p.gw("g2", "Autorisée ?", "V", 6)
    p.error("r", "Refusée, rien débité", "A", 6)
    p.task("d", "Retire 1 du stock (ou l'usage offert), mémorise la case révélée", "D", 7)
    p.task("sv", "Calcule le résultat avec la solution", "V", 8)
    p.task("p", "Pose les rails dans le bon sens, ou affiche le verdict", "A", 9)
    p.end("e", "Voit le résultat", "J", 10)
    p.flow("s", "g1"); p.flow("g1", "n", "Non"); p.flow("g1", "a", "Oui")
    p.chain("a", "t", "b", "c", "g2")
    flows(p, ("g2", "r", "Non"), ("g2", "d", "Oui"), ("d", "sv"), ("sv", "p"), ("p", "e"))
    return p


def achat():
    p = Process("17-acheter-une-aide", "17 · Acheter une aide (pièces gagnées)", [J, A, V, D])
    p.start("s", "Touche « acheter » sur une aide à stock vide", "J", 0)
    p.task("a", "Affiche prix et solde", "A", 1)
    p.task("c", "Confirme ou annule", "J", 2)
    p.gw("g1", "Confirmé ?", "A", 3)
    p.end("n", "Annule, rien débité", "J", 3)
    p.task("v", "Contrôle : solde, stock < 3, aide débloquée", "V", 4)
    p.gw("g2", "Contrôle réussi ?", "V", 5)
    p.error("r", "Achat refusé", "A", 5)
    p.task("d", "Retire les pièces, ajoute 1 au stock (transaction)", "D", 6)
    p.end("e", "Solde et stock à jour partout", "A", 7)
    p.chain("s", "a", "c", "g1")
    flows(p, ("g1", "n", "Non"), ("g1", "v", "Oui"), ("v", "g2"), ("g2", "r", "Non"), ("g2", "d", "Oui"), ("d", "e"))
    return p


def deblocage():
    p = Process("18-debloquer-une-aide", "18 · Débloquer une aide", [J, A, V, D])
    p.start("s", "Niveau validé (08)", "V", 0)
    p.task("d", "Lit le stock et le niveau atteint", "D", 1)
    p.gw("g", "Nouveau jalon atteint ?", "V", 2)
    p.end("n", "Rien à débloquer", "A", 2)
    p.task("a", "Donne 3 en stock et 1 usage de démonstration offert", "V", 3)
    p.task("w", "Écrit le stock", "D", 4)
    p.task("p", "Affiche le déblocage, guide un premier usage", "A", 5)
    p.task("u", "Utilise l'aide offerte, guidé", "J", 6)
    p.task("r", "Usage offert : le stock reste à 3, bonus conservé (16)", "V", 7)
    p.end("e", "Il reste 3 aides, démo faite", "A", 8)
    p.flow("s", "d"); p.flow("d", "g"); p.flow("g", "n", "Non"); p.flow("g", "a", "Oui")
    p.chain("a", "w", "p", "u", "r", "e")
    return p


def pieces():
    p = Process("19-gagner-des-pieces", "19 · Gagner des pièces", [A, V, D])
    p.start("s", "Niveau validé (08), puzzle du jour (09) ou e-mail confirmé (04)", "V", 0)
    p.task("d", "Lit les récompenses déjà versées", "D", 1)
    p.gw("g", "Déjà versée ?", "V", 2)
    p.end("n", "Refusé : jamais deux fois", "D", 2)
    p.task("c", "Calcule : 10 à 30 selon la taille, +5 sans aide", "V", 3)
    p.task("w", "Ajoute les pièces, note la récompense", "D", 4)
    p.end("e", "Solde affiché à l'accueil et en partie", "A", 5)
    p.flow("s", "d"); p.flow("d", "g"); p.flow("g", "n", "Oui"); p.flow("g", "c", "Non")
    p.chain("c", "w", "e")
    return p


def install():
    B = ("B", "Navigateur", "externe")
    p = Process("20-installation-pwa", "20 · Installation PWA", [J, A, B])
    p.start("s", "Événement beforeinstallprompt", "B", 0)
    p.task("m", "preventDefault, mémorise l'événement", "A", 1)
    p.gw("g1", "Peut proposer ?", "A", 2)
    p.end("e0", "Bouton masqué", "B", 2)
    p.task("c", "Clique Installer", "J", 3)
    p.gw("g2", "Événement mémorisé ?", "A", 4)
    p.task("ios", "Suit l'aide : Partager > Sur l'écran d'accueil", "J", 5)
    p.end("e1", "Aide affichée", "J", 6)
    p.task("pr", "prompt() puis attend userChoice", "B", 5)
    p.end("e2", "accepted ou dismissed", "A", 6)
    flows(p, ("s", "m"), ("m", "g1"), ("g1", "e0", "Non"), ("g1", "c", "Oui"), ("c", "g2"),
          ("g2", "ios", "Non"), ("g2", "pr", "Oui"), ("ios", "e1"), ("pr", "e2"))
    return p


def sw_cycle():
    Nv = ("N", "Navigateur", "externe")
    W = ("W", "Service worker", "technique")
    C = ("C", "Caches", "stockage")
    p = Process("21-service-worker-installation", "21 · Service worker : installation", [Nv, W, C])
    p.start("s", "Page chargée (événement load)", "N", 0)
    p.gw("g", "Production et SW disponible ?", "N", 1)
    p.end("e0", "App en ligne seulement", "N", 2)
    p.task("r", "Enregistre sw.js (échec ignoré)", "W", 1)
    p.task("pc", "Précache /, manifeste, icônes", "C", 2)
    p.task("sk", "skipWaiting puis activate", "W", 3)
    p.task("cl", "Supprime les anciens traintracks-*", "C", 4)
    p.end("e", "clients.claim : SW actif", "W", 5)
    flows(p, ("s", "g"), ("g", "e0", "Non"), ("g", "r", "Oui"), ("r", "pc"), ("pc", "sk"), ("sk", "cl"), ("cl", "e"))
    return p


def sw_fetch():
    W = ("W", "Service worker", "technique")
    R = ("R", "Réseau", "externe")
    C = ("C", "Caches", "stockage")
    p = Process("22-service-worker-requetes", "22 · Service worker : requêtes", [W, R, C])
    p.start("s", "Requête GET de même origine", "W", 0)
    p.gw("ga", "Appel à l'API ?", "W", 1)
    p.end("api", "Réseau seulement, jamais en cache", "R", 1)
    p.gw("g1", "Navigation ?", "W", 2)
    p.task("n", "Réseau d'abord", "R", 2)
    p.gw("g2", "Réseau disponible ?", "R", 3)
    p.task("ok", "Sert le réseau, met en cache sous /", "R", 4)
    p.end("e1", "Page à jour", "R", 5)
    p.task("off", "Sert le cache (hors ligne)", "C", 3)
    p.end("e2", "Page hors ligne", "C", 4)
    p.task("ca", "Cache d'abord, mise à jour réseau en parallèle", "W", 7)
    p.end("e3", "Ressource servie", "W", 8)
    flows(p, ("s", "ga"), ("ga", "api", "Oui"), ("ga", "g1", "Non"), ("g1", "n", "Oui"), ("g1", "ca", "Non"),
          ("n", "g2"), ("g2", "ok", "Oui"), ("g2", "off", "Non"), ("ok", "e1"), ("off", "e2"), ("ca", "e3"))
    return p


def solveur():
    Vv = ("V", "Autre branche", "neutre")
    S_ = ("S", "Solveur (serveur)", "technique")
    p = Process("23-solveur", "23 · Résolution d'un puzzle (serveur)", [S_, Vv])
    p.start("s", "solve(puzzle, limit = 2)", "S", 0)
    p.task("a", "Part de l'entrée (parcours en profondeur)", "S", 1)
    p.gw("g1", "Case visitable ?", "S", 2)
    p.end("v1", "Branche abandonnée", "V", 2)
    p.gw("g2", "Sortie atteinte ?", "S", 3)
    p.end("v2", "Explore les voisines", "V", 3)
    p.gw("g3", "Imposés visités, compteurs exacts ?", "S", 4)
    p.end("v3", "Solution rejetée", "V", 4)
    p.task("m", "Mémorise la solution", "S", 5)
    p.gw("g4", "limit atteinte ?", "S", 6)
    p.end("v4", "Continue la recherche", "V", 6)
    p.end("e", "Retourne count et solutions", "S", 7)
    p.chain("s", "a", "g1")
    flows(p, ("g1", "v1", "Non"), ("g1", "g2", "Oui"), ("g2", "v2", "Non"), ("g2", "g3", "Oui"), ("g3", "v3", "Non"),
          ("g3", "m", "Oui"), ("m", "g4"), ("g4", "v4", "Non"), ("g4", "e", "Oui"))
    return p


def oubli():
    p = Process("24-mot-de-passe-oublie", "24 · Mot de passe oublié", [J, A, V, D])
    p.start("s", "Clique Mot de passe oublié, saisit son e-mail", "J", 0)
    p.task("a", "Envoie la demande", "A", 1)
    p.task("v", "Cherche un compte pour cette adresse (même un compte Google)", "V", 2)
    p.gw("g", "Compte et pas de mail récent ?", "V", 3)
    p.task("t", "Crée un jeton à usage unique (empreinte seule, 1 h)", "D", 4)
    p.task("m", "Envoie le lien par e-mail", "V", 5)
    p.end("e1", "Ne fait rien : réponse identique, on ne révèle pas qui est inscrit", "V", 4)
    p.end("e", "Voit « Si un compte existe, un lien vient d'être envoyé »", "A", 6)
    p.chain("s", "a", "v", "g")
    flows(p, ("g", "e1", "Non"), ("g", "t", "Oui"), ("t", "m"), ("m", "e"))
    return p


def reinit():
    p = Process("25-nouveau-mot-de-passe", "25 · Nouveau mot de passe", [J, A, V, D])
    p.start("s", "Clique le lien reçu par e-mail", "J", 0)
    p.task("a", "Affiche le formulaire de nouveau mot de passe", "A", 1)
    p.task("v", "Reçoit jeton et mot de passe, recalcule la robustesse", "V", 2)
    p.gw("g", "Jeton et mot de passe OK ?", "V", 3)
    p.error("err", "Lien invalide ou mot de passe trop faible", "A", 4)
    p.task("d", "Jeton marqué utilisé, nouveau hash, sessions fermées, blocage levé", "D", 4)
    p.task("m", "Prévient par e-mail que le mot de passe a changé", "V", 5)
    p.end("e", "Voit « Mot de passe modifié », se connecte (05)", "A", 6)
    p.chain("s", "a", "v", "g")
    flows(p, ("g", "err", "Non"), ("g", "d", "Oui"), ("d", "m"), ("m", "e"))
    return p


def suppression():
    p = Process("26-suppression-du-compte", "26 · Suppression du compte", [J, A, V, D])
    p.start("s", "Clique Supprimer mon compte", "J", 0)
    p.task("a", "Avertit : définitif. Demande le mot de passe", "A", 1)
    p.task("v", "Vérifie le mot de passe (même blocage que la connexion)", "V", 2)
    p.gw("g", "Mot de passe correct ?", "V", 3)
    p.error("err", "Suppression refusée, le compte reste", "A", 4)
    p.task("d", "Efface toutes ses données puis le compte", "D", 4)
    p.task("rg", "Note l'identifiant au registre des suppressions (35 jours)", "D", 5)
    p.task("m", "Envoie un e-mail de confirmation de suppression", "V", 6)
    p.end("e", "Déconnecté, retour à l'accueil, message de confirmation", "A", 7)
    p.chain("s", "a", "v", "g")
    flows(p, ("g", "err", "Non"), ("g", "d", "Oui"), ("d", "rg"), ("rg", "m"), ("m", "e"))
    return p


def decor():
    p = Process("27-decor-de-victoire", "27 · Décor de victoire", [J, A])
    p.start("s", "Le serveur répond « juste » (08)", "A", 0)
    p.task("t", "Choisit l'environnement du chapitre (10 niveaux)", "A", 1)
    p.task("r", "Rivière d'un bord à l'autre, pont sur une voie droite à angle droit", "A", 2)
    p.task("h", "Hameau le long de la voie, champs groupés, montagnes sur les rochers", "A", 3)
    p.task("d", "Route droite, passage à niveau si elle croise la voie", "A", 4)
    p.task("f", "Fond la grille nue, dévoile le paysage, efface les compteurs", "A", 5)
    p.task("c", "Rails aux couleurs de l'environnement", "A", 6)
    p.task("v", "Fait vivre le décor : eau, bateaux, voitures, animaux, météo", "A", 7)
    p.task("w", "Lance le train (13) après le fondu : barrières baissées", "A", 8)
    p.task("o", "Regarde, réduit ou rouvre le résultat, relance le train", "J", 9)
    p.end("e", "Résultat et Niveau suivant (sous les aides sur téléphone)", "A", 10)
    p.chain("s", "t", "r", "h", "d", "f", "c", "v", "w", "o", "e")
    return p


def ajout_niveaux():
    D2 = ("G", "Développeur", "joueur")
    V2 = ("V", "Serveur", "technique")
    B2 = ("D", "Base PostgreSQL", "stockage")
    p = Process("28-ajout-de-niveaux", "28 · Ajout de niveaux après déploiement", [D2, V2, B2])
    p.start("s", "make build-levels TO=N : fabrique les niveaux, garde les gelés", "G", 0)
    p.task("a", "make audit : unicité, difficulté, plan", "G", 1)
    p.task("f", "make freeze : verrouille les niveaux publiés (empreintes)", "G", 2)
    p.task("b", "Reconstruit l'image du serveur et le relance", "G", 3)
    p.task("l", "Au démarrage, lit levels.json et compare à la base", "V", 4)
    p.gw("g", "Niveau déjà en base ?", "V", 5)
    p.task("i", "Insère le niveau (jamais de mise à jour)", "D", 6)
    p.end("e1", "Ignoré, signalé s'il a changé dans le fichier", "V", 6)
    p.end("e2", "Joueurs au bout : reprennent au nouveau niveau", "V", 7)
    p.chain("s", "a", "f", "b", "l", "g")
    flows(p, ("g", "e1", "Oui"), ("g", "i", "Non"), ("i", "e2"))
    return p


def changer_email():
    p = Process("29-changer-adresse-email", "29 · Changer d'adresse e-mail", [J, A, V, D])
    p.start("s", "Saisit la nouvelle adresse et son mot de passe", "J", 0)
    p.task("a", "Envoie la demande", "A", 1)
    p.task("v", "Vérifie le mot de passe (même blocage que la connexion)", "V", 2)
    p.gw("g1", "Mot de passe correct ?", "V", 3)
    p.gw("g2", "Adresse valide et libre ?", "V", 4)
    p.task("err", "Voit le message d'erreur", "A", 5)
    p.error("ee", "Changement refusé, l'adresse reste", "J", 6)
    p.task("t", "Crée un jeton à usage unique (1 h), annule la demande précédente", "D", 5)
    p.task("m", "Envoie le lien à la NOUVELLE adresse, un avertissement à l'ancienne", "V", 6)
    p.task("c", "Clique le lien reçu dans la nouvelle boîte", "J", 7)
    p.task("v2", "Vérifie le jeton (valide, non utilisé, adresse toujours libre)", "V", 8)
    p.gw("g3", "Jeton valide ?", "V", 9)
    p.error("e2", "Lien invalide ou expiré, l'adresse reste", "A", 10)
    p.task("u", "Change l'adresse du compte, marque le jeton utilisé", "D", 10)
    p.end("e", "Voit « Nouvelle adresse confirmée »", "A", 11)
    p.chain("s", "a", "v", "g1")
    flows(p, ("g1", "err", "Non"), ("g1", "g2", "Oui"), ("g2", "err", "Non"), ("g2", "t", "Oui"), ("err", "ee"), ("t", "m"), ("m", "c"),
          ("c", "v2"), ("v2", "g3"), ("g3", "e2", "Non"), ("g3", "u", "Oui"), ("u", "e"))
    return p


def changer_mot_de_passe():
    p = Process("30-changer-mot-de-passe", "30 · Changer de mot de passe (connecté)", [J, A, V, D])
    p.start("s", "Saisit l'ancien et le nouveau mot de passe", "J", 0)
    p.task("a", "Affiche l'indicateur de robustesse, bouton inactif sous le seuil", "A", 1)
    p.task("v", "Vérifie l'ancien mot de passe (même blocage que la connexion)", "V", 2)
    p.gw("g1", "Ancien mot de passe correct ?", "V", 3)
    p.gw("g2", "Nouveau assez robuste et différent ?", "V", 4)
    p.task("err", "Voit le message d'erreur", "A", 5)
    p.error("ee", "Mot de passe inchangé", "J", 6)
    p.task("h", "Hache le nouveau mot de passe", "V", 5)
    p.task("d", "Met à jour l'empreinte, ferme les autres sessions", "D", 6)
    p.task("m", "Prévient par e-mail (jamais le mot de passe)", "V", 7)
    p.end("e", "Voit « Mot de passe modifié » ; les autres appareils se reconnectent", "A", 8)
    p.chain("s", "a", "v", "g1")
    flows(p, ("g1", "err", "Non"), ("g1", "g2", "Oui"), ("g2", "err", "Non"), ("g2", "h", "Oui"), ("err", "ee"), ("h", "d"), ("d", "m"), ("m", "e"))
    return p


def avatars():
    p = Process("31-avatars", "31 · Avatars : choisir ou acheter", [J, A, V, D])
    p.start("s", "Ouvre Compte : grille d'avatars (sans noms) et pièces", "J", 0)
    p.task("c", "Clique un avatar", "J", 1)
    p.gw("g1", "Déjà à lui (gratuit ou acheté) ?", "A", 2)
    p.task("sel", "Vérifie la liste fixe et la possession", "V", 3)
    p.task("u", "Enregistre l'avatar affiché", "D", 4)
    p.end("e1", "Avatar enregistré, affiché partout", "D", 5)
    p.task("cf", "Demande confirmation avec le prix", "A", 3)
    p.gw("g2", "Confirme ?", "J", 4)
    p.end("e0", "Annule, rien n'est débité", "J", 5)
    p.task("b", "Verrouille le joueur, vérifie solde et possession", "V", 5)
    p.gw("g3", "Solde suffisant et pas déjà acheté ?", "V", 6)
    p.task("err", "Voit « Pas assez de pièces » ou « déjà acheté »", "A", 7)
    p.error("ee", "Achat refusé, rien n'est débité", "J", 8)
    p.task("d", "Débite le prix, note l'achat (une seule fois)", "D", 7)
    p.end("e2", "Avatar acheté et adopté, solde mis à jour", "D", 8)
    p.chain("s", "c", "g1")
    flows(p, ("g1", "sel", "Oui"), ("sel", "u"), ("u", "e1"), ("g1", "cf", "Non"), ("cf", "g2"), ("g2", "e0", "Non"), ("g2", "b", "Oui"),
          ("b", "g3"), ("g3", "err", "Non"), ("g3", "d", "Oui"), ("err", "ee"), ("d", "e2"))
    return p


def exporter():
    p = Process("32-exporter-les-donnees", "32 · Exporter mes données", [J, A, V, D])
    p.start("s", "Clique Exporter", "J", 0)
    p.task("a", "Demande l'export", "A", 1)
    p.task("d", "Lit la progression et les puzzles du jour du compte", "D", 2)
    p.task("sg", "Numérote et signe le fichier (clé du serveur)", "V", 3)
    p.end("e", "Télécharge le fichier, à garder", "A", 4)
    p.chain("s", "a", "d", "sg", "e")
    return p


def importer():
    p = Process("33-importer-des-donnees", "33 · Importer des données", [J, A, V, D])
    p.start("s", "Choisit un fichier d'export", "J", 0)
    p.task("a", "Lit le fichier, l'envoie", "A", 1)
    p.task("v", "Vérifie la signature du serveur", "V", 2)
    p.gw("g1", "Signature valide ?", "V", 3)
    p.gw("g2", "Fichier jamais importé ?", "V", 4)
    p.error("e1", "Refusé : fichier modifié ou d'un autre serveur", "A", 3)
    p.error("e2", "Refusé : déjà importé", "A", 4)
    p.task("d", "Ajoute niveaux et puzzles du jour (ni pièces ni aides), note l'export", "D", 5)
    p.end("e", "Voit combien de niveaux et de puzzles sont importés", "A", 6)
    p.chain("s", "a", "v", "g1")
    flows(p, ("g1", "e1", "Non"), ("g1", "g2", "Oui"), ("g2", "e2", "Non"), ("g2", "d", "Oui"), ("d", "e"))
    return p


def classement():
    p = Process("34-classement", "34 · Classement", [J, A, V, D])
    p.start("s", "Ouvre Classement, choisit Voyage, Jour ou Série", "J", 0)
    p.task("a", "Demande le classement", "A", 1)
    p.task("v", "Ne retient que les joueurs qui ont choisi d'apparaître", "V", 2)
    p.task("d", "Lit niveau atteint, meilleur temps du jour ou plus longue série", "D", 3)
    p.task("c", "Trie, attribue les rangs, garde les 50 premiers, ajoute l'avatar de chacun", "V", 4)
    p.end("e", "Voit la liste et, connecté, sa place", "A", 5)
    p.chain("s", "a", "v", "d", "c", "e")
    return p


ALL = [navigation, compte, inscription, confirmation, connexion, google, rattachement, voyage, quotidien,
       generation, pose, controle, train, tutoriel, stats, aide, achat, deblocage, pieces, install,
       sw_cycle, sw_fetch, solveur, oubli, reinit, suppression, decor, ajout_niveaux,
       changer_email, changer_mot_de_passe, avatars, exporter, importer, classement]
