begin;

drop function if exists public.get_financial_shadow_runtime_rules();

-- Keep the authoritative runtime RPC independent from the removed helper.
create or replace function public.get_financial_runtime_rules()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_authority public.financial_criteria_authority%rowtype; v_result jsonb;
begin
  if current_user<>'postgres' and coalesce(auth.role(),'')<>'service_role' then raise exception 'FINANCIAL_RUNTIME_RULES_DENIED' using errcode='42501'; end if;
  select * into v_authority from public.financial_criteria_authority where id='primary';
  if v_authority.authority<>'SUPABASE' or v_authority.active_import_batch_id is null then raise exception 'FINANCIAL_CRITERIA_NOT_CONFIGURED' using errcode='P0001'; end if;
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
  where r.imported_batch_id=v_authority.active_import_batch_id and r.lifecycle_status in('PUBLISHED','SCHEDULED')
    and r.enabled and f.enabled and f.publication_status='PUBLISHED' and p.enabled and p.publication_status='PUBLISHED';
  if jsonb_array_length(v_result)<1 then raise exception 'FINANCIAL_CRITERIA_NOT_CONFIGURED' using errcode='P0001'; end if;
  return v_result;
end $$;

revoke all on function public.get_financial_runtime_rules() from public,anon,authenticated;
grant execute on function public.get_financial_runtime_rules() to service_role;
drop function if exists public.financial_runtime_rules_for_batch(uuid);

notify pgrst,'reload schema';
commit;
