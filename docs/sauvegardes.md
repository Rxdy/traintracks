# Sauvegardes de la base (production)

Le Pi stocke la base sur une **carte SD** : une panne de carte perdrait tout. La sauvegarde ne reste donc pas sur le Pi.

**Principe** : chaque nuit à 3 h, le Pi exporte la base, la **chiffre** avec une clé publique (`age`), garde 7 jours sur sa carte et envoie une copie sur **Google Drive** (35 jours). La clé **privée** n'est jamais sur le Pi : elle est dans Bitwarden. Un vol du Pi ou un accès à ton Drive ne permet donc pas de lire les données.

Script : [scripts/backup-db.sh](../scripts/backup-db.sh).

## Mise en place (une fois)

1. **Sur ton PC, créer la paire de clés** (la clé privée ne va jamais sur le Pi) :
   ```
   age-keygen -o traintracks-backup.key
   ```
   La commande affiche `Public key: age1…`. Mets **tout le contenu de `traintracks-backup.key` dans Bitwarden** (note sécurisée « Traintracks – clé de sauvegarde »), puis supprime le fichier de ton PC.
2. **Sur le Pi** :
   ```
   sudo apt install age rclone
   mkdir -p ~/.config/traintracks-backup ~/backups/traintracks
   echo "age1…(la clé publique)" > ~/.config/traintracks-backup/age.pub
   ```
3. **Relier rclone à Google Drive.** Le Pi n'a pas de navigateur : sur ton PC, lance `rclone authorize "drive"`, connecte-toi, puis colle le résultat quand `rclone config` (sur le Pi) le demande. Nom du stockage : `gdrive`, droits « drive.file » (rclone ne voit que ce qu'il crée).
4. **Copier le script sur le Pi** (`/home/rudya/traintracks/scripts/backup-db.sh`), `chmod +x`, puis le **lancer une fois à la main** et vérifier qu'un fichier `.dump.age` apparaît sur le Pi **et** dans le Drive.
5. **Planifier** (`crontab -e`) : la sauvegarde tourne à 3 h et un mail d'alerte part si elle échoue.
   ```
   0 3 * * * /home/rudya/traintracks/scripts/backup-db.sh >> /home/rudya/backups/traintracks.log 2>&1 || printf 'From: infra@rxdy.fr\nTo: rudyalvs@gmail.com\nSubject: Sauvegarde Traintracks ECHEC\n\nVoir /home/rudya/backups/traintracks.log\n' | msmtp -t
   ```

## Restaurer (à essayer UNE FOIS avant d'en avoir besoin)

Une sauvegarde jamais restaurée n'est pas une sauvegarde. Sur ton PC, avec la clé privée récupérée de Bitwarden et un fichier téléchargé du Drive :
```
age -d -i traintracks-backup.key traintracks-AAAAMMJJ-HHMMSS.dump.age > restauration.dump
docker run --rm -d --name pg-test -e POSTGRES_PASSWORD=test -p 5544:5432 postgres:17-alpine
docker cp restauration.dump pg-test:/r.dump
docker exec pg-test createdb -U postgres traintracks
docker exec pg-test pg_restore -U postgres -d traintracks --no-owner /r.dump
docker exec pg-test psql -U postgres traintracks -c '\dt'      # les tables doivent apparaître
```
Pour restaurer en production : arrêter l'API, `pg_restore --clean` dans le conteneur `traintracks-db-prod`, relancer l'API.

## Après une restauration : rejouer les suppressions de comptes (RGPD)

Une sauvegarde peut contenir un compte supprimé depuis. Le jeu garde donc un **registre des suppressions** (table `deleted_owners` : seulement l'identifiant aléatoire du compte et la date, aucune donnée personnelle, purgé après 35 jours). **Après toute restauration**, à faire avant de rouvrir le site :

```
# 1. Si l'ancienne base est encore lisible, AVANT de la remplacer : exporter son registre (il est plus récent que celui de la sauvegarde)
docker exec traintracks-api-prod npx tsx src/deleted.cli.ts export > suppressions.json
# 2. restaurer la sauvegarde (voir plus haut)
# 3. re-supprimer les comptes supprimés depuis (le fichier est facultatif)
docker cp suppressions.json traintracks-api-prod:/tmp/
docker exec traintracks-api-prod npx tsx src/deleted.cli.ts apply /tmp/suppressions.json
```
La commande affiche le nombre de comptes re-supprimés.

**Limite** : si le Pi est perdu en entier, le registre le plus récent est celui de la dernière sauvegarde. Les suppressions faites depuis (au plus une journée) sont alors à rejouer à la main si on retrouve les demandes (courriel « compte supprimé » reçu par le joueur, journal de l'API).

## Limites à connaître

- **Si tu perds la clé privée**, les sauvegardes sont définitivement illisibles : garde-la dans Bitwarden (et une copie hors ligne si possible).
- **Une nuit de données peut être perdue** (un export par jour).
- **Le Drive est lié à ton compte Google** : si le compte est suspendu, la copie distante l'est aussi.
