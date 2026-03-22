BEGIN;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'operator', 'user'));

INSERT INTO _migrations (name)
VALUES ('060_users_role_operator')
ON CONFLICT (name) DO NOTHING;

COMMIT;
