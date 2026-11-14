-- Connexions externes (Google…). Un compte peut en avoir plusieurs ; un identifiant externe ne sert qu'à UN compte.
-- Seul l'identifiant stable donné par le fournisseur (« sub ») est gardé : pas d'adresse ni de nom en double.
-- Supprimé avec le compte (ON DELETE CASCADE) : rien à ajouter à la suppression (voir deleted.ts).
CREATE TABLE identities (
  provider text NOT NULL,
  subject text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (provider, subject)
);
CREATE INDEX identities_user ON identities (user_id);
