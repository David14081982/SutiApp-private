begin;

-- Retry is allowed only from the certified fail-safe rollback state.
do $$ declare v_batch public.financial_criteria_import_batches%rowtype; v_authority text;
begin
  select authority into v_authority from public.financial_criteria_authority where id='primary' for update;
  if v_authority<>'GOOGLE_SHADOW' then raise exception 'FINANCIAL_RETRY_REQUIRES_GOOGLE_SHADOW' using errcode='P0001'; end if;
  select * into v_batch from public.financial_criteria_import_batches where status='ROLLED_BACK' order by imported_at desc limit 1 for update;
  if v_batch.id is null or v_batch.rule_count<>146 or v_batch.fund_count<>35 or v_batch.duplicate_group_count<>2
    or v_batch.conflict_group_count<>1 or v_batch.source_snapshot_hash<>'174F940E195DE5DAE595AAF798CC1B49976AA899E76D6CF141FB9D711A6E9C8A' then
    raise exception 'FINANCIAL_RETRY_EQUIVALENCE_INVALID' using errcode='P0001';
  end if;
  if to_regprocedure('public.resolve_suti_loan_quote_contract_v1_engine(jsonb,text,text,text,numeric,integer,jsonb)') is null then
    alter function public.resolve_suti_loan_quote_contract(jsonb,text,text,text,numeric,integer,jsonb) rename to resolve_suti_loan_quote_contract_v1_engine;
  end if;
  if to_regprocedure('public.create_validated_financial_program_request_v1_engine(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,text,integer,jsonb)') is null then
    alter function public.create_validated_financial_program_request(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,text,integer,jsonb) rename to create_validated_financial_program_request_v1_engine;
  end if;
end $$;

revoke all on function public.resolve_suti_loan_quote_contract_v1_engine(jsonb,text,text,text,numeric,integer,jsonb) from public,anon,authenticated,service_role;
create or replace function public.resolve_suti_loan_quote_contract(
  p_eligible_rules jsonb,p_financial_union text,p_financial_employee_category text,p_program_id text,
  p_amount numeric,p_term integer,p_policy jsonb
) returns jsonb language sql stable security definer set search_path=''
as $$ select public.resolve_suti_loan_quote_contract_v1_engine($1,$2,$3,$4,$5,$6,$7)||jsonb_build_object('source','SUPABASE_FINANCIAL_CRITERIA') $$;
revoke all on function public.resolve_suti_loan_quote_contract(jsonb,text,text,text,numeric,integer,jsonb) from public,anon,authenticated;
grant execute on function public.resolve_suti_loan_quote_contract(jsonb,text,text,text,numeric,integer,jsonb) to service_role;

revoke all on function public.create_validated_financial_program_request_v1_engine(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,text,integer,jsonb) from public,anon,authenticated,service_role;
create or replace function public.create_validated_financial_program_request(
  p_actor_real_auth_user_id uuid,p_affiliate_id uuid,p_impersonation_session_id uuid,p_program_item_id uuid,
  p_notes text,p_signature_data text,p_terms_version_id uuid,p_document_ids uuid[],p_idempotency_key uuid,
  p_amount numeric,p_term integer,p_term_semantics text,p_expected_profile_version integer,p_financial_submission_snapshot jsonb
) returns public.program_requests language plpgsql volatile security definer set search_path=''
as $$ declare v_row public.program_requests;
begin
  v_row:=public.create_validated_financial_program_request_v1_engine($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14);
  update public.program_requests set source_context=coalesce(source_context,'{}'::jsonb)
    ||jsonb_build_object('financial_confirmation','SUPABASE_REVALIDATED','financial_criteria_source','SUPABASE')
  where id=v_row.id returning * into v_row;
  return v_row;
end $$;
revoke all on function public.create_validated_financial_program_request(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.create_validated_financial_program_request(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,text,integer,jsonb) to service_role;

do $$ declare v_batch public.financial_criteria_import_batches%rowtype;
begin
  select * into v_batch from public.financial_criteria_import_batches where status='ROLLED_BACK' order by imported_at desc limit 1 for update;
  update public.financial_criteria_import_batches set status='ACTIVE',activated_at=now() where id=v_batch.id;
  update public.financial_criteria_authority set authority='SUPABASE',active_import_batch_id=v_batch.id,
    source_snapshot_hash=v_batch.source_snapshot_hash,changed_at=now(),changed_reason='Autonomous retry after service RPC and A/B shadow Edge canaries passed'
  where id='primary';
  update public.financial_session_snapshots set invalidated_at=now(),invalidation_reason='FINANCIAL_AUTHORITY_CUTOVER_RETRY' where invalidated_at is null;
  insert into public.financial_configuration_audit(resource_type,resource_id,action,new_value,reason)
  values('AUTHORITY','primary','CUTOVER_RETRY',jsonb_build_object('authority','SUPABASE','batch_id',v_batch.id,'source_snapshot_hash',v_batch.source_snapshot_hash),
    'Autonomous retry after service RPC and A/B shadow Edge canaries passed');
end $$;

notify pgrst,'reload schema';
commit;
