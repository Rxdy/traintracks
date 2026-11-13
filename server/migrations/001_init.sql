CREATE TABLE users (
  id uuid PRIMARY KEY,
  pseudo text NOT NULL,
  pseudo_key text NOT NULL UNIQUE,        -- pseudo en minuscules : unicité sans tenir compte de la casse
  email text NOT NULL UNIQUE,             -- toujours en minuscules
  password_hash text,                     -- null pour un compte Google
  provider text NOT NULL DEFAULT 'local',
  email_confirmed_at timestamptz,
  created_at timestamptz NOT NULL
);

-- Jetons de confirmation d'e-mail : seul l'empreinte est stockée, usage unique, durée limitée.
CREATE TABLE email_tokens (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);

-- Sessions : le navigateur garde un jeton aléatoire, la base n'en garde que l'empreinte.
CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL
);

-- Blocage des essais de connexion, par e-mail et par adresse IP.
CREATE TABLE login_limits (
  key text PRIMARY KEY,
  failures int NOT NULL DEFAULT 0,
  level int NOT NULL DEFAULT 0,           -- nombre de blocages déjà subis (le délai double)
  locked_until timestamptz,
  updated_at timestamptz NOT NULL
);
