-- Registre des suppressions de compte (droit à l'effacement et sauvegardes).
-- Une sauvegarde restaurée peut contenir un compte supprimé depuis : ce registre permet de le re-supprimer aussitôt après la restauration.
-- Il ne garde AUCUNE donnée personnelle : seulement l'identifiant aléatoire (« u:<uuid> ») et la date. Purgé après 35 jours
-- (la durée de conservation des sauvegardes), voir server/src/deleted.ts.
CREATE TABLE deleted_owners (
  owner text PRIMARY KEY,
  deleted_at timestamptz NOT NULL
);
