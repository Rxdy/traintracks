-- Trois trains enregistrés (« schémas ») par joueur ; celui qui roule est le n° `active` (0, 1 ou 2).
-- `cars` garde le train qui roule (copie de presets[active]) : la lecture reste simple.
ALTER TABLE train_layout
  ADD COLUMN presets jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN active int NOT NULL DEFAULT 0 CHECK (active BETWEEN 0 AND 2);
UPDATE train_layout SET presets = jsonb_build_array(cars, cars, cars);
