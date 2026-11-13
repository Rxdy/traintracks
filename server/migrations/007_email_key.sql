-- Une adresse = un compte. La clé canonique ignore la casse, les « +étiquettes » (a+jeu@x.fr = a@x.fr) et, chez
-- Gmail, les points (a.b@gmail.com = ab@gmail.com) : sinon une même boîte mail servirait à ouvrir plusieurs comptes.
ALTER TABLE users ADD COLUMN email_key text;
UPDATE users SET email_key = CASE
  WHEN split_part(email, '@', 2) IN ('gmail.com', 'googlemail.com')
    THEN replace(split_part(split_part(email, '@', 1), '+', 1), '.', '') || '@gmail.com'
  ELSE split_part(split_part(email, '@', 1), '+', 1) || '@' || split_part(email, '@', 2)
END;
-- comptes d'essai déjà en double : le plus ancien garde la clé canonique, les autres gardent leur adresse brute
UPDATE users u SET email_key = u.email
FROM (SELECT id, row_number() OVER (PARTITION BY email_key ORDER BY created_at, id) AS rn FROM users) d
WHERE u.id = d.id AND d.rn > 1;
ALTER TABLE users ALTER COLUMN email_key SET NOT NULL;
CREATE UNIQUE INDEX users_email_key_idx ON users (email_key);
