begin;

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

revoke all on function public.get_financial_shadow_runtime_rules() from public,anon,authenticated;
grant execute on function public.get_financial_shadow_runtime_rules() to service_role;
comment on function public.get_financial_shadow_runtime_rules() is 'Service-only deployment canary. Uses the latest certified shadow batch before cutover and the exact active batch after cutover.';
notify pgrst,'reload schema';
commit;
