-- H05: access-path optimization only. Original financial SQL and historical rows remain unchanged.
begin;
set local lock_timeout='2s';
set local statement_timeout='30s';
set local search_path='';
do $guard$
declare f regprocedure:=to_regprocedure('public.get_self_savings_if_changed(text)'); i regclass:=to_regclass('public.savings_legacy_evidence_participant_type_source_idx');
begin
 if md5(pg_get_functiondef('public.get_self_savings_live_readonly()'::regprocedure))<>'74f504337e4f336e6b12da3ab32f30a6'
 or md5(pg_get_functiondef('public.savings_effective_action(text,uuid)'::regprocedure))<>'407fefd589bc4f840a0fc36d988e831b'
 then raise exception 'H05_FINANCIAL_READER_DRIFT';end if;
 if f is not null and (md5(pg_get_functiondef(f))<>all(array['5319d0ff16cf0a401393478b02a1632d','290ca2bafdf4f13b689dbbbebacd1b48'])
 or not(select prosecdef and provolatile='s' and proowner='postgres'::regrole and proconfig=array['search_path=""'] from pg_proc where oid=f)
 or has_function_privilege('anon',f,'EXECUTE') or not has_function_privilege('authenticated',f,'EXECUTE'))
 then raise exception 'H05_ENDPOINT_DRIFT';end if;
 if i is not null and (pg_get_indexdef(i)<>'CREATE INDEX savings_legacy_evidence_participant_type_source_idx ON public.savings_legacy_evidence USING btree (participant_id, record_type, source_sheet, source_row DESC)'
 or not(select indisvalid and indisready from pg_index where indexrelid=i)) then raise exception 'H05_INDEX_DRIFT';end if;
 if not(select relrowsecurity from pg_class where oid='public.savings_legacy_evidence'::regclass) then raise exception 'H05_RLS_DRIFT';end if;
end;
$guard$;
-- Keep a fresh delegating endpoint for already-open H05 clients. Publish old frontend separately.
-- Candidate additive endpoint. It never changes the original financial getter.
create or replace function public.get_self_savings_if_changed(p_known_version text default null)
returns jsonb language plpgsql stable security definer set search_path='' as $function$
declare
 v_actor uuid:=auth.uid();
 v_affiliate uuid:=public.get_effective_affiliate_id();
 v_session text:=auth.jwt()->>'session_id';
 v_participant uuid;
 v_participant_mark text;
 v_batch_mark text;
 v_evidence_mark text;
 v_versions_mark text;
 v_beneficiaries_mark text;
 v_action_mark text;
 v_actions jsonb;
 v_impersonation jsonb;
 v_context jsonb;
 v_version text;
 v_cacheable boolean;
begin
 if v_actor is null or v_affiliate is null then
  raise exception 'SAVINGS_AFFILIATE_REQUIRED' using errcode='42501';
 end if;
 select to_jsonb(i) into v_impersonation from public.get_impersonation_context() i;
 v_context:=jsonb_build_object('actor_auth_user_id',v_actor,'effective_affiliate_id',v_affiliate,
  'actor_session_id',v_session,'impersonation_id',v_impersonation->>'session_id');

 return jsonb_build_object('version',null,'modified',true,'cacheable',false,'context',v_context,
  'data',public.get_self_savings_live_readonly());
end;
$function$;
alter function public.get_self_savings_if_changed(text) owner to postgres;
revoke all on function public.get_self_savings_if_changed(text) from public,anon,authenticated;
grant execute on function public.get_self_savings_if_changed(text) to authenticated;
drop index if exists public.savings_legacy_evidence_participant_type_source_idx;
do $guard$
declare f regprocedure:=to_regprocedure('public.get_self_savings_if_changed(text)'); i regclass:=to_regclass('public.savings_legacy_evidence_participant_type_source_idx');
begin
 if md5(pg_get_functiondef('public.get_self_savings_live_readonly()'::regprocedure))<>'74f504337e4f336e6b12da3ab32f30a6'
 or md5(pg_get_functiondef('public.savings_effective_action(text,uuid)'::regprocedure))<>'407fefd589bc4f840a0fc36d988e831b'
 then raise exception 'H05_FINANCIAL_READER_DRIFT';end if;
 if f is not null and (md5(pg_get_functiondef(f))<>all(array['5319d0ff16cf0a401393478b02a1632d','290ca2bafdf4f13b689dbbbebacd1b48'])
 or not(select prosecdef and provolatile='s' and proowner='postgres'::regrole and proconfig=array['search_path=""'] from pg_proc where oid=f)
 or has_function_privilege('anon',f,'EXECUTE') or not has_function_privilege('authenticated',f,'EXECUTE'))
 then raise exception 'H05_ENDPOINT_DRIFT';end if;
 if i is not null and (pg_get_indexdef(i)<>'CREATE INDEX savings_legacy_evidence_participant_type_source_idx ON public.savings_legacy_evidence USING btree (participant_id, record_type, source_sheet, source_row DESC)'
 or not(select indisvalid and indisready from pg_index where indexrelid=i)) then raise exception 'H05_INDEX_DRIFT';end if;
 if not(select relrowsecurity from pg_class where oid='public.savings_legacy_evidence'::regclass) then raise exception 'H05_RLS_DRIFT';end if;
end;
$guard$;
commit;
