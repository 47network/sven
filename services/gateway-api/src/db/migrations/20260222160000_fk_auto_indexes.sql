-- Ensure every foreign key join column set has a supporting index.
DO $$
DECLARE
  fk RECORD;
  has_supporting_index BOOLEAN;
  col_list TEXT;
  idx_name TEXT;
BEGIN
  FOR fk IN
    SELECT
      c.oid AS constraint_oid,
      ns.nspname AS schema_name,
      cls.relname AS table_name,
      c.conname AS constraint_name,
      c.conrelid,
      c.conkey
    FROM pg_constraint c
    JOIN pg_class cls
      ON cls.oid = c.conrelid
    JOIN pg_namespace ns
      ON ns.oid = cls.relnamespace
    WHERE c.contype = 'f'
      AND ns.nspname NOT IN ('pg_catalog', 'information_schema')
      AND cls.relkind IN ('r', 'p')
    ORDER BY ns.nspname, cls.relname, c.conname
  LOOP
    SELECT EXISTS (
      SELECT 1
      FROM pg_index i
      WHERE i.indrelid = fk.conrelid
        AND i.indisvalid
        AND i.indpred IS NULL
        AND i.indnkeyatts >= cardinality(fk.conkey)
        AND NOT EXISTS (
          SELECT 1
          FROM generate_subscripts(fk.conkey, 1) AS s(pos)
          WHERE i.indkey[s.pos - 1] <> fk.conkey[s.pos]
        )
    )
    INTO has_supporting_index;

    IF has_supporting_index THEN
      CONTINUE;
    END IF;

    SELECT string_agg(format('%I', att.attname), ', ' ORDER BY ord.n)
    INTO col_list
    FROM unnest(fk.conkey) WITH ORDINALITY AS ord(attnum, n)
    JOIN pg_attribute att
      ON att.attrelid = fk.conrelid
     AND att.attnum = ord.attnum;

    idx_name := format(
      'idx_fkauto_20260222160000_%s',
      substr(md5(fk.schema_name || '.' || fk.table_name || '.' || fk.constraint_name), 1, 16)
    );

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I.%I (%s)',
      idx_name,
      fk.schema_name,
      fk.table_name,
      col_list
    );
  END LOOP;
END $$;
