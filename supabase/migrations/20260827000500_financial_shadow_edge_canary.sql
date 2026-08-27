begin;

-- Exact shared projection for runtime and the pre-cutover Edge canary.
-- This helper has no API grant; only SECURITY DEFINER wrappers can invoke it.
create or replace function public.financial_runtime_rules_for_batch(p_batch_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$ declare v_result jsonb;
begin
  if current_user<>'postgres' then raise exception 'FINANCIAL_RULE_PROJECTION_DENIED' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.program_id||'--'||f.code||'--r'||coalesce(r.legacy_sheet_row,r.version),
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
end $$;

create or replace function public.get_financial_runtime_rules()
returns jsonb language plpgsql stable security definer set search_path=''
as $$ declare v_authority public.financial_criteria_authority%rowtype; v_result jsonb;
begin
  if current_user<>'postgres' and coalesce(auth.role(),'')<>'service_role' then raise exception 'FINANCIAL_RUNTIME_RULES_DENIED' using errcode='42501'; end if;
  select * into v_authority from public.financial_criteria_authority where id='primary';
  if v_authority.authority<>'SUPABASE' or v_authority.active_import_batch_id is null then raise exception 'FINANCIAL_CRITERIA_NOT_CONFIGURED' using errcode='P0001'; end if;
  v_result:=public.financial_runtime_rules_for_batch(v_authority.active_import_batch_id);
  if jsonb_array_length(v_result)<>146 then raise exception 'FINANCIAL_CRITERIA_NOT_CONFIGURED' using errcode='P0001'; end if;
  return v_result;
end $$;

create or replace function public.get_financial_shadow_runtime_rules()
returns jsonb language plpgsql stable security definer set search_path=''
as $$ declare v_authority public.financial_criteria_authority%rowtype; v_batch public.financial_criteria_import_batches%rowtype; v_result jsonb;
begin
  if current_user<>'postgres' and coalesce(auth.role(),'')<>'service_role' then raise exception 'FINANCIAL_SHADOW_RULES_DENIED' using errcode='42501'; end if;
  select * into v_authority from public.financial_criteria_authority where id='primary';
  if v_authority.authority='GOOGLE_SHADOW' then
    select * into v_batch from public.financial_criteria_import_batches
    where status in('STAGED','ROLLED_BACK') order by imported_at desc limit 1;
  elsif v_authority.authority='SUPABASE' and v_authority.active_import_batch_id is not null then
    select * into v_batch from public.financial_criteria_import_batches where id=v_authority.active_import_batch_id and status='ACTIVE';
  else
    raise exception 'FINANCIAL_SHADOW_CANARY_DISABLED' using errcode='P0001';
  end if;
  if v_batch.id is null or v_batch.rule_count<>146 or v_batch.fund_count<>35
    or v_batch.duplicate_group_count<>2 or v_batch.conflict_group_count<>1
    or v_batch.source_snapshot_hash !~ '^[A-F0-9]{64}$' then
    raise exception 'FINANCIAL_SHADOW_NOT_CERTIFIED' using errcode='P0001';
  end if;
  v_result:=public.financial_runtime_rules_for_batch(v_batch.id);
  if jsonb_array_length(v_result)<>146 then raise exception 'FINANCIAL_SHADOW_NOT_CERTIFIED' using errcode='P0001'; end if;
  return v_result;
end $$;

revoke all on function public.financial_runtime_rules_for_batch(uuid) from public,anon,authenticated,service_role;
revoke all on function public.get_financial_runtime_rules() from public,anon,authenticated;
grant execute on function public.get_financial_runtime_rules() to service_role;
revoke all on function public.get_financial_shadow_runtime_rules() from public,anon,authenticated;
grant execute on function public.get_financial_shadow_runtime_rules() to service_role;

comment on function public.financial_runtime_rules_for_batch(uuid) is 'Internal no-grant projection shared by authoritative runtime and certified shadow canary.';
comment on function public.get_financial_shadow_runtime_rules() is 'Service-only deployment canary. Uses the latest certified shadow batch before cutover and the exact active batch after cutover.';

notify pgrst,'reload schema';
commit;
