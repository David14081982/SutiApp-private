-- PUBLIC REVIEW COPY: ACCOUNT_* are aliases; exact original retained in private local evidence.
-- PREPARED ONLY. Run through the existing TLS read-only connection.
-- The runner must assert transaction_read_only = 'on' before the main SELECT.
-- No impersonation, JWT changes, writers, request reads or document-byte reads.
-- This is metadata evidence, not a loan feasibility or physical integrity test.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '2s';
SHOW transaction_read_only;

WITH requested(employee) AS (VALUES ('ACCOUNT_A'::text),('ACCOUNT_B'::text),('ACCOUNT_C'::text)),
targets AS (
 SELECT r.employee,a.id,a.is_archived,a.auth_user_id,
        u.id IS NOT NULL AS auth_account_exists,
        u.email_confirmed_at IS NOT NULL AS auth_email_confirmed,
        a.historical_email_normalized=lower(btrim(u.email)) AS direct_email_matches
 FROM requested r
 LEFT JOIN public.affiliates a ON a.numero_control=r.employee
 LEFT JOIN auth.users u ON u.id=a.auth_user_id
), ranked AS (
 SELECT t.employee,d.*,row_number() OVER(
  PARTITION BY d.affiliate_id,d.document_type_id
  ORDER BY d.created_at DESC,d.id DESC) AS version_rank
 FROM targets t
 JOIN document_retirement_private.active_documents d ON d.affiliate_id=t.id
 WHERE NOT EXISTS(SELECT 1 FROM document_evidence_private.withdrawals w WHERE w.document_id=d.id)
), current_metadata AS (
 SELECT d.employee,d.affiliate_id,d.document_type_id,d.status,
        pa.mime_type,pa.file_size,
        pa.id IS NOT NULL AS asset_reference_resolves,
        pa.status='READY' AS asset_ready,
        pa.owner_affiliate_id=d.affiliate_id AS explicit_owner_matches,
        pa.owner_affiliate_id IS NULL AS legacy_owner_unspecified,
        pa.content_sha256 ~ '^[A-Fa-f0-9]{64}$' AS declared_hash_shape_valid,
        so.id IS NOT NULL AS storage_metadata_exists,
        CASE WHEN so.metadata->>'size' ~ '^[0-9]+$'
             THEN (so.metadata->>'size')::numeric=pa.file_size ELSE false END AS metadata_size_matches
 FROM ranked d
 LEFT JOIN public.affiliate_files af ON af.id=d.affiliate_file_id
 LEFT JOIN public.private_assets pa ON pa.id=coalesce(d.private_asset_id,af.private_asset_id)
 LEFT JOIN storage.objects so ON so.bucket_id=pa.storage_bucket AND so.name=pa.storage_path
 WHERE d.version_rank=1
)
SELECT jsonb_build_object(
 'observed_at',clock_timestamp(),
 'transaction_read_only',current_setting('transaction_read_only'),
 'scope','CURRENT_METADATA_ONLY_NO_BYTES_NO_REQUESTS_NO_IMPERSONATION',
 'accounts',(
  SELECT jsonb_agg(to_jsonb(x) ORDER BY x.employee) FROM (
   SELECT employee,count(id) AS matching_affiliate_rows,
    count(id) FILTER(WHERE NOT is_archived) AS active_affiliate_rows,
    count(id) FILTER(WHERE auth_account_exists) AS auth_account_links,
    count(id) FILTER(WHERE auth_account_exists AND auth_email_confirmed) AS confirmed_auth_links,
    count(id) FILTER(WHERE auth_account_exists AND auth_email_confirmed AND direct_email_matches) AS direct_email_link_matches
   FROM targets GROUP BY employee
  ) x
 ),
 'documents',(
  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.employee,x.document_ordinal),'[]'::jsonb) FROM (
   SELECT employee,row_number() OVER(PARTITION BY employee ORDER BY document_type_id,affiliate_id) AS document_ordinal,
    status,mime_type,file_size AS declared_bytes,asset_reference_resolves,asset_ready,
    explicit_owner_matches,legacy_owner_unspecified,declared_hash_shape_valid,
    storage_metadata_exists,metadata_size_matches
   FROM current_metadata
  ) x
 ),
 'limitations',jsonb_build_array(
  'Direct email matching is only one Auth linkage condition; certified links and complete authorization are not evaluated.',
  'Current version ordering follows local audited documentary SQL; confirm the current catalog before interpretation.',
  'Storage metadata and declared hash shape do not attest actual bytes, content integrity or usability.',
  'No actual user session, upload, access URL, financial eligibility or loan submission is executed.'
 )
)
WHERE current_setting('transaction_read_only')='on';
ROLLBACK;
