-- Avatars : une liste fixe choisie dans le jeu (shared/avatars.ts), jamais une image envoyée par un joueur.
-- users.avatar = l'avatar affiché. Les 8 gratuits sont à tout le monde (rien à stocker) ; seuls les achetés sont notés ici.
-- Supprimé avec le compte (ON DELETE CASCADE) : rien à ajouter à la suppression.
ALTER TABLE users ADD COLUMN avatar text NOT NULL DEFAULT 'loco';

CREATE TABLE avatars_owned (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  avatar text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (user_id, avatar)
);
