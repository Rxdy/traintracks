-- Puzzle du jour : une grille par date, générée par le serveur (graine = la date) puis conservée.
CREATE TABLE daily_puzzles (
  date text PRIMARY KEY,                   -- AAAA-MM-JJ
  puzzle jsonb NOT NULL,
  solution jsonb NOT NULL,
  created_at timestamptz NOT NULL
);

-- Partie du jour en cours : l'heure de départ est celle du serveur.
CREATE TABLE daily_runs (
  owner text PRIMARY KEY,
  date text NOT NULL,
  started_at timestamptz NOT NULL
);

-- Le premier temps de chaque jour (seul celui-là compte pour les statistiques et le futur classement).
CREATE TABLE daily_results (
  owner text NOT NULL,
  date text NOT NULL,
  time_ms int NOT NULL,
  solved_at timestamptz NOT NULL,
  PRIMARY KEY (owner, date)
);
