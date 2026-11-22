-- Wagons à collectionner (shared/wagons.ts). Par joueur (« owner », invité ou compte) comme les pièces et les aides.
-- wagons_owned : combien d'exemplaires de chaque wagon (6 au plus). Le train de départ y est inscrit au premier passage.
CREATE TABLE wagons_owned (
  owner text NOT NULL,
  wagon text NOT NULL,
  qty int NOT NULL CHECK (qty BETWEEN 0 AND 6),
  PRIMARY KEY (owner, wagon)
);

-- train_layout : l'ordre des wagons derrière la locomotive (tableau d'identifiants, 6 au plus).
CREATE TABLE train_layout (
  owner text PRIMARY KEY,
  cars jsonb NOT NULL DEFAULT '[]',
  updated_at timestamptz NOT NULL
);
