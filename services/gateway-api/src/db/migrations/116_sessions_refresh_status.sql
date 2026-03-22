-- Allow long-lived refresh token sessions alongside short-lived access sessions.
DO $$
DECLARE
  existing_constraint TEXT;
BEGIN
  SELECT c.conname
    INTO existing_constraint
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'sessions'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%status%'
    AND pg_get_constraintdef(c.oid) ILIKE '%active%'
    AND pg_get_constraintdef(c.oid) ILIKE '%pending_totp%'
    AND pg_get_constraintdef(c.oid) ILIKE '%revoked%'
  ORDER BY c.oid DESC
  LIMIT 1;

  IF existing_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.sessions DROP CONSTRAINT %I', existing_constraint);
  END IF;

  ALTER TABLE public.sessions
    ADD CONSTRAINT sessions_status_check
    CHECK (status IN ('active', 'pending_totp', 'revoked', 'refresh'));
END $$;
