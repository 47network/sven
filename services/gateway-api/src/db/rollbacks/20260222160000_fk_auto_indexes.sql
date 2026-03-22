-- Roll back only indexes created by migration 20260222160000.
DO $$
DECLARE
  idx RECORD;
BEGIN
  FOR idx IN
    SELECT ns.nspname AS schema_name, cls.relname AS index_name
    FROM pg_class cls
    JOIN pg_namespace ns
      ON ns.oid = cls.relnamespace
    WHERE cls.relkind = 'i'
      AND cls.relname LIKE 'idx_fkauto_20260222160000_%'
      AND ns.nspname NOT IN ('pg_catalog', 'information_schema')
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS %I.%I', idx.schema_name, idx.index_name);
  END LOOP;
END $$;
