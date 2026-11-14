#!/usr/bin/env bash
# Sauvegarde quotidienne de la base Train Tracks (sur le Pi) :
#   export PostgreSQL → chiffrement (age, clé PUBLIQUE seulement sur le Pi) → copie sur Google Drive (rclone).
# Mise en place et restauration : docs/sauvegardes.md. À lancer par cron, jamais par une personne qui doit taper un mot de passe.
set -euo pipefail

DIR=${BACKUP_DIR:-/home/rudya/backups/traintracks}
CONTENEUR=${DB_CONTAINER:-traintracks-db-prod}
CLE_PUBLIQUE=${AGE_PUBKEY_FILE:-/home/rudya/.config/traintracks-backup/age.pub}
DISTANT=${RCLONE_REMOTE:-gdrive:traintracks-backups}
GARDER_LOCAL=${GARDER_LOCAL:-7}      # jours, sur la carte SD du Pi
GARDER_DISTANT=${GARDER_DISTANT:-35} # jours, sur Google Drive (la page « Mentions légales » annonce 5 semaines)

umask 077
mkdir -p "$DIR"
nom="traintracks-$(date +%Y%m%d-%H%M%S).dump.age"
partiel="$DIR/.$nom.partiel"
trap 'rm -f "$partiel"' EXIT

# pipefail : si pg_dump échoue, tout le script échoue (pas de fichier « réussi » mais vide ou tronqué)
docker exec "$CONTENEUR" pg_dump -U traintracks -Fc traintracks | age -R "$CLE_PUBLIQUE" > "$partiel"
[ -s "$partiel" ] || { echo "export vide, sauvegarde abandonnée" >&2; exit 1; }
mv "$partiel" "$DIR/$nom"

rclone copy "$DIR/$nom" "$DISTANT" --quiet
find "$DIR" -name 'traintracks-*.dump.age' -mtime "+$GARDER_LOCAL" -delete
rclone delete "$DISTANT" --min-age "${GARDER_DISTANT}d" --quiet

echo "$(date -Is) sauvegarde ok : $nom ($(du -h "$DIR/$nom" | cut -f1))"
