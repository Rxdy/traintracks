-- Classement : chacun choisit d'y apparaître ou non (oui par défaut ; seul le pseudo est montré).
ALTER TABLE users ADD COLUMN leaderboard boolean NOT NULL DEFAULT true;

-- Changement d'adresse e-mail : l'adresse ne change qu'une fois confirmée depuis la NOUVELLE boîte (lien à usage unique, 1 h).
CREATE TABLE email_changes (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  new_email text NOT NULL,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);

-- Import des données : un fichier d'export ne peut être importé qu'UNE fois (sinon on pourrait dupliquer sa progression).
CREATE TABLE imports (
  export_id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  imported_at timestamptz NOT NULL
);
