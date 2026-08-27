begin;

-- Recovery requires restoring the backed-up financial-legacy and
-- financial-criteria-admin Edge bundles in the same controlled operation.
update public.financial_criteria_import_batches set status='ROLLED_BACK'
where id=(select active_import_batch_id from public.financial_criteria_authority where id='primary') and status='ACTIVE';
update public.financial_criteria_authority set authority='GOOGLE_SHADOW',active_import_batch_id=null,source_snapshot_hash=null,
  changed_at=now(),changed_reason='Controlled recovery to the preserved Google reference' where id='primary';
update public.financial_session_snapshots set invalidated_at=now(),invalidation_reason='FINANCIAL_AUTHORITY_RECOVERY' where invalidated_at is null;
insert into public.financial_configuration_audit(resource_type,resource_id,action,new_value,reason)
values('AUTHORITY','primary','RECOVERY',jsonb_build_object('authority','GOOGLE_SHADOW'),'Controlled recovery to the preserved Google reference');

drop function if exists public.resolve_suti_loan_quote_contract(jsonb,text,text,text,numeric,integer,jsonb);
alter function public.resolve_suti_loan_quote_contract_v1_engine(jsonb,text,text,text,numeric,integer,jsonb)
rename to resolve_suti_loan_quote_contract;
revoke all on function public.resolve_suti_loan_quote_contract(jsonb,text,text,text,numeric,integer,jsonb) from public,anon,authenticated;
grant execute on function public.resolve_suti_loan_quote_contract(jsonb,text,text,text,numeric,integer,jsonb) to service_role;
comment on function public.resolve_suti_loan_quote_contract(jsonb,text,text,text,numeric,integer,jsonb) is
  'Recovered certified SUTI_LOAN_QUOTE_V1 calculator. Google reference authority requires the backed-up Edge bundle.';

drop function if exists public.create_validated_financial_program_request(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,text,integer,jsonb);
alter function public.create_validated_financial_program_request_v1_engine(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,text,integer,jsonb)
rename to create_validated_financial_program_request;
revoke all on function public.create_validated_financial_program_request(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.create_validated_financial_program_request(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,text,integer,jsonb) to service_role;

notify pgrst,'reload schema';
commit;
