-- Up
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   IF TG_OP = 'UPDATE' THEN
      NEW.updated_at = CURRENT_TIMESTAMP;
   END IF;
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
   tbl RECORD;
BEGIN
   FOR tbl IN
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
   LOOP
      IF EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_name = tbl.tablename AND column_name = 'updated_at'
      ) THEN
         EXECUTE format(
            'CREATE TRIGGER set_updated_at_%I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();',
            tbl.tablename,
            tbl.tablename
         );
      END IF;
   END LOOP;
END $$;

-- Down
DO $$
DECLARE
   tbl RECORD;
BEGIN
   FOR tbl IN
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
   LOOP
      IF EXISTS (
         SELECT 1
         FROM pg_trigger
         WHERE tgname = format('set_updated_at_%I', tbl.tablename)
      ) THEN
         EXECUTE format(
            'DROP TRIGGER IF EXISTS set_updated_at_%I ON %I;',
            tbl.tablename,
            tbl.tablename
         );
      END IF;
   END LOOP;
END $$;

DROP FUNCTION IF EXISTS update_updated_at_column;
