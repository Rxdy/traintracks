-- La clé d'unicité de l'adresse (007) se calcule toute seule à chaque insertion ou changement d'adresse : aucun
-- chemin d'écriture (inscription, compte d'essai, futur import…) ne peut l'oublier.
CREATE FUNCTION email_key_of(e text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN split_part(lower(e), '@', 2) IN ('gmail.com', 'googlemail.com')
      THEN replace(split_part(split_part(lower(e), '@', 1), '+', 1), '.', '') || '@gmail.com'
    ELSE split_part(split_part(lower(e), '@', 1), '+', 1) || '@' || split_part(lower(e), '@', 2)
  END
$$;

CREATE FUNCTION users_set_email_key() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.email_key := email_key_of(NEW.email);
  RETURN NEW;
END
$$;

CREATE TRIGGER users_email_key BEFORE INSERT OR UPDATE OF email ON users
  FOR EACH ROW EXECUTE FUNCTION users_set_email_key();
