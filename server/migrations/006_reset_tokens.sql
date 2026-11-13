-- Jetons de réinitialisation du mot de passe : seule l'empreinte est stockée, usage unique, durée limitée (1 h).
CREATE TABLE reset_tokens (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);
