-- Add project-scoped identity docs for per-project custom instructions.
ALTER TABLE sven_identity_docs
  ADD COLUMN IF NOT EXISTS project_key TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sven_identity_docs_scope_check'
      AND conrelid = 'sven_identity_docs'::regclass
  ) THEN
    ALTER TABLE sven_identity_docs DROP CONSTRAINT sven_identity_docs_scope_check;
  END IF;
END $$;

ALTER TABLE sven_identity_docs
  ADD CONSTRAINT sven_identity_docs_scope_check
  CHECK (scope IN ('global', 'chat', 'project'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sven_identity_docs_scope_target_check'
      AND conrelid = 'sven_identity_docs'::regclass
  ) THEN
    ALTER TABLE sven_identity_docs
      ADD CONSTRAINT sven_identity_docs_scope_target_check
      CHECK (
        (scope = 'global' AND chat_id IS NULL AND (project_key IS NULL OR btrim(project_key) = ''))
        OR (scope = 'chat' AND chat_id IS NOT NULL AND (project_key IS NULL OR btrim(project_key) = ''))
        OR (scope = 'project' AND chat_id IS NULL AND project_key IS NOT NULL AND btrim(project_key) <> '')
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_identity_docs_project
  ON sven_identity_docs (scope, project_key)
  WHERE scope = 'project';

