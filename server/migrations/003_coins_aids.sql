-- Portefeuille : le solde ne change que par ces fonctions du serveur, jamais sur la parole du navigateur.
CREATE TABLE wallets (
  owner text PRIMARY KEY,
  coins int NOT NULL DEFAULT 0 CHECK (coins >= 0)
);

-- Récompenses déjà versées : (propriétaire, nature, référence) unique = impossible de verser deux fois.
CREATE TABLE rewards (
  owner text NOT NULL,
  kind text NOT NULL,                      -- 'level', 'signup'...
  ref text NOT NULL,
  amount int NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (owner, kind, ref)
);

-- Stock d'aides : 3 au maximum par type.
CREATE TABLE aid_stock (
  owner text NOT NULL,
  aid text NOT NULL,
  qty int NOT NULL CHECK (qty BETWEEN 0 AND 3),
  PRIMARY KEY (owner, aid)
);

-- Cadeau de déblocage : 3 en stock + 1 usage de démonstration gratuit (demo_used passe à vrai une fois fait).
CREATE TABLE aid_gifts (
  owner text NOT NULL,
  aid text NOT NULL,
  demo_used boolean NOT NULL DEFAULT false,
  PRIMARY KEY (owner, aid)
);

-- Ce qui s'est passé pendant le niveau en cours (pour reprendre où on en était).
ALTER TABLE level_runs
  ADD COLUMN aids jsonb NOT NULL DEFAULT '[]',        -- aides déjà utilisées sur ce niveau
  ADD COLUMN paid_used boolean NOT NULL DEFAULT false, -- une aide payante a servi : plus de bonus « sans aide »
  ADD COLUMN reveals jsonb NOT NULL DEFAULT '[]',      -- cases révélées (rails posés dans le bon sens)
  ADD COLUMN crosses jsonb NOT NULL DEFAULT '[]';      -- cases révélées vides
