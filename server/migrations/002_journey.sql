-- Les niveaux (grille ET solution) ne vivent que côté serveur : le navigateur ne reçoit que la grille en cours.
CREATE TABLE levels (
  id int PRIMARY KEY,
  puzzle jsonb NOT NULL,
  solution jsonb NOT NULL,
  intro text
);

-- Progression d'un joueur. owner = 'u:<id joueur>' ou 'a:<id anonyme>' (joueur pas encore inscrit).
CREATE TABLE progress (
  owner text NOT NULL,
  level int NOT NULL REFERENCES levels(id),
  solved_at timestamptz NOT NULL,
  time_ms int NOT NULL,                    -- mesuré par le serveur : de la demande du niveau à la réponse juste
  PRIMARY KEY (owner, level)
);

-- Niveau en cours de jeu : l'heure de départ, que le navigateur ne peut pas truquer.
CREATE TABLE level_runs (
  owner text PRIMARY KEY,
  level int NOT NULL,
  started_at timestamptz NOT NULL
);
