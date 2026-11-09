-- Restore the prior Edge artifact first. Never remove an enrolled original.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='60s';
DO $guard$
DECLARE definition text;
BEGIN
 SELECT regexp_replace(pg_get_constraintdef(oid),'\s+',' ','g') INTO definition FROM pg_constraint
 WHERE conrelid='document_lab_integrity.assets'::regclass AND conname='assets_size_check';
 IF definition IS DISTINCT FROM 'CHECK (((size > 0) AND (size <= CASE WHEN (bucket = ''private-assets''::text) THEN 104857600 ELSE 10485760 END)))' THEN
  RAISE EXCEPTION 'DOCUMENT_SIZE_CONSTRAINT_DRIFT';
 END IF;
 IF EXISTS(SELECT 1 FROM document_lab_integrity.assets WHERE size>10485760) THEN
  RAISE EXCEPTION 'RETAIN_EXISTING_DOCUMENT_HISTORY';
 END IF;
END $guard$;
ALTER TABLE document_lab_integrity.assets DROP CONSTRAINT assets_size_check;
ALTER TABLE document_lab_integrity.assets ADD CONSTRAINT assets_size_check CHECK (size>0 AND size<=10485760);
COMMIT;
