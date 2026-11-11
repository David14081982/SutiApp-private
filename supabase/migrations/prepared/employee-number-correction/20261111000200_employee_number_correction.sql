-- H-EMPLOYEE-NUMBER-CORRECTION-001 — PREPARED ONLY; not applied to production
-- Source: read-only capture-before.json, 2026-11-11; definitions checked against captured MD5.
-- Current authority remains public.affiliates, including archived current assignments.
-- No affiliate, document, Auth, financial, or historical business row is changed by this script.
-- Replace only four existing bodies; create_admin_affiliate is an unchanged baseline guard.
-- No new table, global UNIQUE constraint, RLS/grant change, or historical cleanup.
begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
-- Drain existing affiliate writers before publishing the replacement bodies.
lock table public.affiliates in share row exclusive mode;
do $employee_number_correction$
declare
 item record; target oid; prior_metadata jsonb; after_metadata jsonb;
 target_oids oid[]:=array[to_regprocedure('public.affiliate_control_reservation_guard()')::oid,to_regprocedure('public.change_admin_affiliate_control(uuid,text,timestamp with time zone,text,text,uuid)')::oid,to_regprocedure('public.create_admin_affiliate(jsonb,text)')::oid,to_regprocedure('public.find_admin_affiliate_duplicates(jsonb,uuid)')::oid,to_regprocedure('public.preview_admin_affiliate_control(uuid,text)')::oid];
 prior_bindings jsonb; after_bindings jsonb;
begin
 if not exists(select 1 from pg_catalog.pg_trigger t
  where t.tgrelid='public.affiliates'::regclass and t.tgname='affiliates_control_reservation'
   and t.tgfoid=to_regprocedure('public.affiliate_control_reservation_guard()')
   and t.tgtype=23 and t.tgenabled='O' and not t.tgisinternal and t.tgqual is null
   and t.tgnargs=0 and t.tgattr::text=(select a.attnum::text from pg_catalog.pg_attribute a
    where a.attrelid='public.affiliates'::regclass and a.attname='numero_control' and not a.attisdropped))
 then raise exception 'EMPLOYEE_NUMBER_TRIGGER_BINDING_DRIFT'; end if;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.oid),'[]'::jsonb) into prior_bindings
 from pg_catalog.pg_trigger t where t.tgfoid=any(target_oids);
 for item in select * from (values
  ('public.affiliate_control_reservation_guard()','b79eec5f83824c48157e7b8c00d9dff1','00e7c2a02cefa986452dede1eb267b1b','postgres','{postgres=X/postgres,service_role=X/postgres}','["search_path=\"\""]'::jsonb,true,'v',true,$definition_0$
CREATE OR REPLACE FUNCTION public.affiliate_control_reservation_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if tg_op='UPDATE' and new.numero_control is not distinct from old.numero_control then return new; end if;
 if new.numero_control is null then return new; end if;
 -- A repeatable snapshot cannot recheck a competing assignment after its lock.
 if pg_catalog.current_setting('transaction_isolation')='repeatable read' then
  raise exception 'AFFILIATE_CONTROL_RETRY_REQUIRED' using errcode='40001';
 end if;
 -- This VOLATILE trigger takes a fresh query snapshot after the per-number lock.
 -- Archived affiliates retain their current assignment; existing rows are unchanged.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('affiliate-current-control:'||new.numero_control,0));
 if exists(select 1 from public.affiliates a where a.id<>new.id and a.numero_control=new.numero_control)
 then raise exception 'AFFILIATE_CONTROL_RESERVED' using errcode='23505'; end if;
 return new;
end $function$
$definition_0$),
  ('public.change_admin_affiliate_control(uuid,text,timestamp with time zone,text,text,uuid)','74eaef04c9301e2065b84be22d5186eb','2bf5c50e4433d52ccfb0966f71417529','postgres','{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}','["search_path=\"\""]'::jsonb,true,'v',true,$definition_1$
CREATE OR REPLACE FUNCTION public.change_admin_affiliate_control(p_affiliate_id uuid, p_new_control text, p_expected_updated_at timestamp with time zone, p_expected_fingerprint text, p_reason text, p_client_action_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare person public.affiliates%rowtype; report jsonb; saved public.affiliate_control_changes%rowtype;
begin
 perform public.affiliate_control_authorize();
 p_new_control:=btrim(p_new_control);
 if p_client_action_id is null or length(coalesce(p_reason,''))>500 then raise exception 'AFFILIATE_CONTROL_INPUT_INVALID' using errcode='22023'; end if;
 -- Serialize with ordinary create/edit as well, including concurrent creations
 -- of the desired number. No global unique constraint on historical numbers.
 lock table public.affiliates in share row exclusive mode;
 select * into saved from public.affiliate_control_changes where client_action_id=p_client_action_id;
 if saved.id is not null then
  if saved.affiliate_id<>p_affiliate_id or saved.new_control is distinct from p_new_control
   or saved.actor_auth_user_id<>auth.uid() or saved.reason is distinct from coalesce(p_reason,'')
  then raise exception 'AFFILIATE_CONTROL_ACTION_CONFLICT' using errcode='22023'; end if;
  return jsonb_build_object('change',to_jsonb(saved),'replayed',true);
 end if;
 select * into person from public.affiliates where id=p_affiliate_id for update;
 if person.id is null then raise exception 'AFFILIATE_NOT_FOUND' using errcode='P0001'; end if;
 if person.updated_at is distinct from p_expected_updated_at then raise exception 'AFFILIATE_VERSION_CONFLICT' using errcode='PT409'; end if;
 report:=public.preview_admin_affiliate_control(p_affiliate_id,p_new_control);
 if jsonb_array_length(report->'blockers')>0 then raise exception 'AFFILIATE_CONTROL_BLOCKED' using errcode='22023'; end if;
 if report->>'fingerprint' is distinct from p_expected_fingerprint then raise exception 'AFFILIATE_CONTROL_IMPACT_CHANGED' using errcode='PT409'; end if;
 update public.affiliates set numero_control=p_new_control,
  financial_profile_version=financial_profile_version+1,
  financial_profile_updated_at=now(),financial_profile_updated_by=auth.uid(),updated_at=clock_timestamp()
 where id=person.id;
 insert into public.affiliate_control_changes(affiliate_id,actor_auth_user_id,old_control,new_control,reason,impact,client_action_id)
 values(person.id,auth.uid(),person.numero_control,p_new_control,coalesce(p_reason,''),report,p_client_action_id)
 returning * into saved;
 insert into public.affiliate_admin_events(affiliate_id,actor_auth_user_id,action,before_values,after_values,changed_fields,reason)
 values(person.id,auth.uid(),'UPDATE',jsonb_build_object('numero_control',person.numero_control),
  jsonb_build_object('numero_control',p_new_control,'control_change_id',saved.id),array['numero_control'],coalesce(p_reason,''));
 return jsonb_build_object('change',to_jsonb(saved),'replayed',false);
end $function$
$definition_1$),
  ('public.create_admin_affiliate(jsonb,text)','54613d2725ed82238bf61c318c923227','54613d2725ed82238bf61c318c923227','postgres','{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}','["search_path=\"\""]'::jsonb,true,'v',false,null::text),
  ('public.find_admin_affiliate_duplicates(jsonb,uuid)','667c21be139be19867c5d64208fd9dbc','f1ad935c5b37d0150a45926e8408e539','postgres','{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}','["search_path=\"\""]'::jsonb,true,'s',true,$definition_3$
CREATE OR REPLACE FUNCTION public.find_admin_affiliate_duplicates(p_values jsonb, p_exclude_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare v_result jsonb;
begin
  if not public.has_admin_permission('affiliates.read') then raise exception 'AFFILIATE_READ_DENIED' using errcode='42501'; end if;
  if jsonb_typeof(p_values)<>'object' then raise exception 'AFFILIATE_VALUES_REQUIRED' using errcode='22023'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',a.id,'numero_control',a.numero_control,'name',coalesce(a.full_name,a.display_name,'Sin nombre'),
    'match_state',case when a.is_archived then 'ARCHIVED_MATCH' else 'ACTIVE_MATCH' end,
    'matches',array_remove(array[
      case when nullif(btrim(p_values->>'numero_control'),'') is not null and a.numero_control=btrim(p_values->>'numero_control') then 'numero_control' end,
      case when nullif(upper(btrim(p_values->>'rfc_raw')),'') is not null and upper(btrim(a.rfc_raw))=upper(btrim(p_values->>'rfc_raw')) then 'rfc' end,
      case when nullif(upper(btrim(p_values->>'curp_raw')),'') is not null and upper(btrim(a.curp_raw))=upper(btrim(p_values->>'curp_raw')) then 'curp' end,
      case when nullif(lower(btrim(p_values->>'historical_email_raw')),'') is not null and a.historical_email_normalized=lower(btrim(p_values->>'historical_email_raw')) then 'email' end
    ],null)) order by a.source_row_ordinal nulls last,a.created_at),'[]'::jsonb) into v_result
  from public.affiliates a where (p_exclude_id is null or a.id<>p_exclude_id) and (
    (nullif(btrim(p_values->>'numero_control'),'') is not null and a.numero_control=btrim(p_values->>'numero_control'))
    or (nullif(upper(btrim(p_values->>'rfc_raw')),'') is not null and upper(btrim(a.rfc_raw))=upper(btrim(p_values->>'rfc_raw')))
    or (nullif(upper(btrim(p_values->>'curp_raw')),'') is not null and upper(btrim(a.curp_raw))=upper(btrim(p_values->>'curp_raw')))
    or (nullif(lower(btrim(p_values->>'historical_email_raw')),'') is not null and a.historical_email_normalized=lower(btrim(p_values->>'historical_email_raw'))));
  return v_result;
end $function$
$definition_3$),
  ('public.preview_admin_affiliate_control(uuid,text)','ef7976362c8a7601efe9dca332bd8b1f','e7abfb1e5f9e07e172bedf804c02b286','postgres','{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}','["search_path=\"\""]'::jsonb,true,'v',true,$definition_4$
CREATE OR REPLACE FUNCTION public.preview_admin_affiliate_control(p_affiliate_id uuid, p_new_control text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare person public.affiliates%rowtype; report jsonb; blocks jsonb:='[]'; link_risk boolean:=false;
begin
 perform public.affiliate_control_authorize();
 p_new_control:=btrim(p_new_control);
 select * into person from public.affiliates where id=p_affiliate_id;
 if person.id is null then raise exception 'AFFILIATE_NOT_FOUND' using errcode='P0001'; end if;
 if person.is_archived then raise exception 'AFFILIATE_ARCHIVED' using errcode='22023'; end if;
 if p_new_control is null or length(p_new_control) not between 1 and 80
  or p_new_control ~ '[[:cntrl:]]' then raise exception 'AFFILIATE_CONTROL_INVALID' using errcode='22023'; end if;
 if person.numero_control is not distinct from p_new_control then raise exception 'AFFILIATE_NO_CHANGE' using errcode='22023'; end if;
 if exists(select 1 from public.affiliates where id<>person.id and numero_control=p_new_control)
 then blocks:=blocks||jsonb_build_array('NUMBER_ALREADY_ASSIGNED'); end if;
 report:=public.affiliate_control_inventory(person.id,person.numero_control,p_new_control);
 if exists(select 1 from jsonb_array_elements(report->'groups') g where (g->>'new_number_conflicts')::bigint>0)
 then blocks:=blocks||jsonb_build_array('NUMBER_HAS_UNRELATED_RECORDS'); end if;
 -- A historical CSV certification can be the only valid login proof. Never
 -- silently invalidate it, nor rewrite historical certification to make it fit.
 select exists(select 1 from auth.users u where u.id=person.auth_user_id
  and public.has_certified_affiliate_auth_link(u.id,person.id,u.email)
  and (person.historical_email_normalized is distinct from lower(btrim(u.email))
   or (select count(*) from public.affiliates a where a.historical_email_normalized=lower(btrim(u.email)))<>1)) into link_risk;
 if link_risk then blocks:=blocks||jsonb_build_array('ACCESS_REPAIR_REQUIRED'); end if;
 report:=report||jsonb_build_object('affiliate_id',person.id,'old_control',person.numero_control,
  'new_control',p_new_control,'expected_updated_at',person.updated_at,'blockers',blocks,
  'automatic_changes',jsonb_build_array('Número vigente del afiliado','Invalidación de cotizaciones anteriores'),
  'manual_review_required',true);
 return report||jsonb_build_object('fingerprint',md5(report::text));
end $function$
$definition_4$)
 ) as expected(signature,before_hash,after_hash,expected_owner,expected_acl,expected_config,
  expected_security_definer,expected_volatility,changed,definition)
 loop
  target:=to_regprocedure(item.signature);
  if target is null then raise exception 'EMPLOYEE_NUMBER_FUNCTION_MISSING:%',item.signature; end if;
  if md5(replace(pg_get_functiondef(target),chr(13),'')) is distinct from item.before_hash
  then raise exception 'EMPLOYEE_NUMBER_BASELINE_DRIFT:%',item.signature; end if;
  if exists(select 1 from pg_catalog.pg_proc p where p.oid=target and
   (pg_catalog.pg_get_userbyid(p.proowner) is distinct from item.expected_owner
    or p.proacl::text is distinct from item.expected_acl
    or to_jsonb(p.proconfig) is distinct from item.expected_config
    or p.prosecdef is distinct from item.expected_security_definer
    or p.provolatile::text is distinct from item.expected_volatility))
  then raise exception 'EMPLOYEE_NUMBER_SECURITY_METADATA_DRIFT:%',item.signature; end if;
  select to_jsonb(p)-'prosrc' into prior_metadata from pg_catalog.pg_proc p where p.oid=target;
  if item.changed then execute item.definition; end if;
  if md5(replace(pg_get_functiondef(target),chr(13),'')) is distinct from item.after_hash
  then raise exception 'EMPLOYEE_NUMBER_PATCH_POSTCONDITION:%',item.signature; end if;
  select to_jsonb(p)-'prosrc' into after_metadata from pg_catalog.pg_proc p where p.oid=target;
  if after_metadata is distinct from prior_metadata
  then raise exception 'EMPLOYEE_NUMBER_FUNCTION_METADATA_CHANGED:%',item.signature; end if;
 end loop;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.oid),'[]'::jsonb) into after_bindings
 from pg_catalog.pg_trigger t where t.tgfoid=any(target_oids);
 if after_bindings is distinct from prior_bindings then raise exception 'EMPLOYEE_NUMBER_TRIGGER_BINDING_CHANGED'; end if;
end $employee_number_correction$;
commit;
