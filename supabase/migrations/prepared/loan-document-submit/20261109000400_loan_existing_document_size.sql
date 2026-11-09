-- Preserve the canonical size range for already-registered private originals.
-- New uploads retain their existing 10 MiB check in prepare_document_operation.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='60s';
DO $guard$
DECLARE definition text;
BEGIN
 SELECT pg_get_constraintdef(oid) INTO definition FROM pg_constraint
 WHERE conrelid='document_lab_integrity.assets'::regclass AND conname='assets_size_check';
 IF definition IS DISTINCT FROM 'CHECK (((size > 0) AND (size <= 10485760)))' THEN
  RAISE EXCEPTION 'DOCUMENT_SIZE_CONSTRAINT_DRIFT';
 END IF;
END $guard$;
ALTER TABLE document_lab_integrity.assets DROP CONSTRAINT assets_size_check;
ALTER TABLE document_lab_integrity.assets ADD CONSTRAINT assets_size_check
 CHECK (size>0 AND size<=CASE WHEN bucket='private-assets' THEN 104857600 ELSE 10485760 END);
COMMIT;
