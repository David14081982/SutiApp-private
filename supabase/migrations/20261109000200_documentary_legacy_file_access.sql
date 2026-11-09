-- Exact legacy affiliate-file association access; no row or Storage mutation.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DO $$ BEGIN
 IF current_setting('document.release_authorized',true) IS DISTINCT FROM 'DOCUMENT_V1' THEN
  RAISE EXCEPTION 'DOCUMENT_RELEASE_AUTHORIZATION_REQUIRED';
 END IF;
END $$;

CREATE FUNCTION document_integration_private.affiliate_file_access(p_id uuid,p_mode text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE f public.affiliate_files; a public.private_assets; effective uuid; impersonation uuid;
BEGIN
 PERFORM document_integration_private.session_required();
 SELECT * INTO f FROM public.affiliate_files WHERE id=p_id;
 effective:=public.get_effective_affiliate_id();
 IF f.id IS NULL OR f.status<>'READY' OR f.classification<>'PRIVATE'
    OR NOT public.affiliate_document_file_is_active(f.id)
    OR NOT public.affiliate_document_asset_is_active(f.private_asset_id) THEN
  RAISE EXCEPTION 'DOCUMENT_CONTEXT_DENIED' USING errcode='42501';
 END IF;
 -- Same existing affiliate_files SELECT authority, with an explicit mode.
 IF p_mode='ADMIN' THEN
  IF NOT public.has_admin_permission('assets.read') THEN RAISE EXCEPTION 'DOCUMENT_CONTEXT_DENIED' USING errcode='42501'; END IF;
 ELSIF p_mode='SELF_SERVICE' THEN
  IF f.affiliate_id IS DISTINCT FROM effective OR f.expediente_classification<>'CURRENT_DOCUMENT' THEN
   RAISE EXCEPTION 'DOCUMENT_CONTEXT_DENIED' USING errcode='42501';
  END IF;
 ELSE RAISE EXCEPTION 'DOCUMENT_CONTEXT_DENIED' USING errcode='42501'; END IF;
 SELECT * INTO a FROM public.private_assets WHERE id=f.private_asset_id;
 IF a.id IS NULL OR a.status<>'READY' OR a.storage_bucket<>'private-assets'
    OR a.storage_bucket IS DISTINCT FROM f.storage_bucket OR a.storage_path IS DISTINCT FROM f.storage_path
    OR (a.owner_affiliate_id IS NOT NULL AND a.owner_affiliate_id<>f.affiliate_id)
    OR coalesce(lower(f.sha256),'')!~'^[a-f0-9]{64}$'
    OR lower(a.content_sha256) IS DISTINCT FROM lower(f.sha256) THEN
  RAISE EXCEPTION 'HISTORICAL_EVIDENCE_UNAVAILABLE';
 END IF;
 SELECT id INTO impersonation FROM public.impersonation_sessions
 WHERE actor_real_auth_user_id=auth.uid() AND actor_auth_session_id=auth.jwt()->>'session_id'
 AND ended_at IS NULL AND expires_at>clock_timestamp() ORDER BY started_at DESC LIMIT 1;
 RETURN jsonb_build_object('actor',auth.uid(),'effective',effective,'target',f.affiliate_id,
  'impersonation',impersonation,'bucket',a.storage_bucket,'path',a.storage_path,
  'mime',a.mime_type,'size',a.file_size,'sha256',lower(f.sha256),'asset',a.id,'association_id',f.id);
END $$;
REVOKE ALL ON FUNCTION document_integration_private.affiliate_file_access(uuid,text) FROM PUBLIC,anon,authenticated;

DO $$ DECLARE definition text; anchor text:='if p_source=''EXPEDIENTE'' then'; BEGIN
 definition:=pg_get_functiondef('public.resolve_document_access(text,uuid,text)'::regprocedure);
 IF (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1
    OR position('AFFILIATE_FILE' in definition)>0 THEN RAISE EXCEPTION 'DOCUMENT_RESOLVER_DRIFT'; END IF;
 EXECUTE replace(definition,anchor,
  'if p_source=''AFFILIATE_FILE'' then return document_integration_private.affiliate_file_access(p_association,p_mode); elsif p_source=''EXPEDIENTE'' then');
END $$;
COMMIT;
