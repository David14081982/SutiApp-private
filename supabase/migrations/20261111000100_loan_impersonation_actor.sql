-- H-LOAN-IMPERSONATION-CONTEXT-20261110: actor permission guard only.
-- Original readable definition and metadata: scripts/fixtures/loan-impersonation-context-before.json.
-- No business DML, permission grants, trigger rebinding or financial changes.
begin;
set local lock_timeout='2s';
set local statement_timeout='30s';
do $repair$
declare
  target_oid oid := 'public.capture_program_request_impersonation()'::regprocedure;
  original_definition text;
  before_metadata jsonb;
  before_bindings jsonb;
begin
  select pg_get_functiondef(p.oid),to_jsonb(p)-'prosrc'
    into original_definition,before_metadata from pg_proc p where p.oid=target_oid;
  if md5(replace(original_definition,chr(13),'')) <> '74ddf62f8613d5dc100e6bda7a5c213a' then
    raise exception 'IMPERSONATION_TRIGGER_BASELINE_CHANGED';
  end if;
  if md5(replace(pg_get_functiondef('public.admin_actor_can_impersonate()'::regprocedure),chr(13),'')) <> 'bc2b19b39eba99484c296218dfe175cb' then
    raise exception 'IMPERSONATION_ACTOR_AUTHORITY_CHANGED';
  end if;
  select coalesce(jsonb_agg(to_jsonb(t) order by t.oid),'[]'::jsonb)
    into before_bindings from pg_trigger t where t.tgfoid=target_oid;
  execute replace(original_definition,'not public.is_active_admin()','public.admin_actor_can_impersonate() IS NOT TRUE');
  if md5(replace(pg_get_functiondef(target_oid),chr(13),'')) <> 'db1410e3a55d25934bc79a19db784111'
     or (select to_jsonb(p)-'prosrc' from pg_proc p where p.oid=target_oid) is distinct from before_metadata
     or (select coalesce(jsonb_agg(to_jsonb(t) order by t.oid),'[]'::jsonb) from pg_trigger t where t.tgfoid=target_oid) is distinct from before_bindings then
    raise exception 'IMPERSONATION_TRIGGER_CONTRACT_CHANGED';
  end if;
end $repair$;
commit;
