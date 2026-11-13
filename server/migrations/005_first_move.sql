-- Le temps d'un niveau compte du PREMIER GESTE du joueur, pas de l'ouverture du niveau (temps de lecture exclu).
-- L'heure vient du serveur : le navigateur ne fait que le prévenir qu'un geste a eu lieu.
ALTER TABLE level_runs ADD COLUMN acted_at timestamptz;
ALTER TABLE daily_runs ADD COLUMN acted_at timestamptz;
