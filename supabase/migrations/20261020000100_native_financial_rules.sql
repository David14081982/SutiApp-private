begin;
set local lock_timeout='3s';
set local statement_timeout='60s';
-- Native financial rules retain existing authority, legacy ids, ACLs and calculations.
do $guard$ begin
  if md5(pg_get_functiondef('public.get_financial_runtime_rules()'::regprocedure)) not in ('3a21d95c8c34291b449f9f28a4064f7a','76a0c6157a1125727b0b58caee8813bb') then raise exception 'NATIVE_FINANCIAL_RULES_SCHEMA_DRIFT: get_financial_runtime_rules'; end if;
  if md5(pg_get_functiondef('public.financial_runtime_rules_for_batch(uuid)'::regprocedure)) not in ('0cb608abbafe6430971749dce02a9b6f','3fb46116dcd144d452f8f7cf12cab811') then raise exception 'NATIVE_FINANCIAL_RULES_SCHEMA_DRIFT: financial_runtime_rules_for_batch'; end if;
  if md5(pg_get_functiondef('public.set_financial_rule_visibility(text,text,text)'::regprocedure)) not in ('de2638da994c94218bf7e652a66634fc','e291c9cdd703ea2bea4505c3ab0b5db0') then raise exception 'NATIVE_FINANCIAL_RULES_SCHEMA_DRIFT: set_financial_rule_visibility'; end if;
end $guard$;

CREATE OR REPLACE FUNCTION public.get_financial_runtime_rules()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare v_authority public.financial_criteria_authority%rowtype; v_result jsonb;
begin
  if current_user<>'postgres' and coalesce(auth.role(),'')<>'service_role' then raise exception 'FINANCIAL_RUNTIME_RULES_DENIED' using errcode='42501'; end if;
  select * into v_authority from public.financial_criteria_authority where id='primary';
  if v_authority.authority<>'SUPABASE' or v_authority.active_import_batch_id is null then raise exception 'FINANCIAL_CRITERIA_NOT_CONFIGURED' using errcode='P0001'; end if;
  v_result:=public.financial_runtime_rules_for_batch(v_authority.active_import_batch_id);
  if jsonb_array_length(v_result)<1 then raise exception 'FINANCIAL_CRITERIA_NOT_CONFIGURED' using errcode='P0001'; end if;
  return v_result;
end $function$;

CREATE OR REPLACE FUNCTION public.financial_runtime_rules_for_batch(p_batch_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare v_result jsonb;
begin
  if current_user<>'postgres' then raise exception 'FINANCIAL_RULE_PROJECTION_DENIED' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.program_id||'--'||f.code||'--r'||coalesce(r.legacy_sheet_row::text,r.id::text),
    'rule_id',r.id,'program_id',r.program_id,'fund',f.name,'category',r.financial_employee_category_label,
    'union',r.financial_union_label,'financial_union_code',r.financial_union_code,
    'financial_employee_category_code',r.financial_employee_category_code,
    'max_amount',r.max_amount,'rate_factor',r.rate_factor,'rate',r.rate_percent,
    'payment_count',r.payment_count,'payment_period',r.payment_period,'max_term',r.max_term,'term_label',r.term_label,
    'available_on',r.available_on,'criterion_identity',coalesce(r.legacy_criterion_identity,'SUPABASE_RULE:'||r.id::text),
    'sheet_row',r.legacy_sheet_row,'visibility_mode',r.visibility_mode,'lifecycle_status',r.lifecycle_status,
    'source_snapshot_hash',r.source_snapshot_hash,'review_required',r.review_required,'review_signals',r.review_signals
  ) order by r.legacy_sheet_row nulls last,r.created_at,r.id),'[]'::jsonb) into v_result
  from public.financial_rules r join public.financial_funds f on f.id=r.fund_id
  join public.financial_programs p on p.id=r.program_id
  where r.imported_batch_id=p_batch_id and r.lifecycle_status in('PUBLISHED','SCHEDULED')
    and r.enabled and f.enabled and f.publication_status='PUBLISHED' and p.enabled and p.publication_status='PUBLISHED';
  return v_result;
end $function$;

CREATE OR REPLACE FUNCTION public.set_financial_rule_visibility(p_criterion_identity text, p_visibility_mode text, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare v_old public.financial_rules%rowtype; v_new public.financial_rules%rowtype;
begin
  if not public.has_admin_permission('financial_criteria.visibility.write') then raise exception 'VISIBILITY_WRITE_REQUIRED' using errcode='42501'; end if;
  if p_visibility_mode not in('AUTO','MOSTRAR','OCULTAR') or length(btrim(coalesce(p_reason,'')))<8 then raise exception 'VISIBILITY_CHANGE_INVALID' using errcode='22023'; end if;
  select r.* into v_old from public.financial_rules r join public.financial_criteria_authority a on a.id='primary' and a.authority='SUPABASE' and a.active_import_batch_id=r.imported_batch_id
  where coalesce(r.legacy_criterion_identity,'SUPABASE_RULE:'||r.id::text)=p_criterion_identity and r.lifecycle_status in('PUBLISHED','SCHEDULED') for update of r;
  if v_old.id is null then raise exception 'CRITERION_FINGERPRINT_MISMATCH' using errcode='P0001'; end if;
  update public.financial_rules set visibility_mode=p_visibility_mode where id=v_old.id returning * into v_new;
  update public.financial_session_snapshots set invalidated_at=now(),invalidation_reason='FINANCIAL_VISIBILITY_CHANGED' where invalidated_at is null;
  insert into public.financial_configuration_audit(actor_auth_user_id,resource_type,resource_id,action,old_value,new_value,reason)
  values(auth.uid(),'RULE',v_old.id::text,'VISIBILITY_CHANGE',jsonb_build_object('visibility_mode',v_old.visibility_mode),jsonb_build_object('visibility_mode',v_new.visibility_mode),btrim(p_reason));
  return jsonb_build_object('criterion_identity',coalesce(v_new.legacy_criterion_identity,'SUPABASE_RULE:'||v_new.id::text),'sheet_row',v_new.legacy_sheet_row,
    'previous_visibility',v_old.visibility_mode,'visibility_mode',v_new.visibility_mode,'changed_at',now(),'source','SUPABASE_FINANCIAL_CRITERIA');
end $function$;
commit;
