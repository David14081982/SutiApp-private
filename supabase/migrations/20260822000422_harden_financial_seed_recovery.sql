begin;

alter table public.affiliate_profile_audit_log drop constraint affiliate_profile_audit_actor_source_check;
alter table public.affiliate_profile_audit_log add constraint affiliate_profile_audit_actor_source_check check(
  (change_source='ADMIN' and changed_by is not null and batch_id is null)
  or
  (change_source in('BULK_INITIAL_FINANCIAL_PROFILE_SEED','BULK_INITIAL_FINANCIAL_PROFILE_SEED_RECOVERY') and changed_by is null and batch_id is not null)
);

create or replace function public.recover_affiliate_financial_profile_seed(p_batch_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare v_batch public.affiliate_financial_profile_seed_batches%rowtype; v_now timestamptz:=clock_timestamp();
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  select * into v_batch from public.affiliate_financial_profile_seed_batches where id=p_batch_id for update;
  if v_batch.id is null then raise exception 'SEED_BATCH_NOT_FOUND' using errcode='P0001'; end if;
  if v_batch.status='RECOVERED' then return jsonb_build_object('batch_id',p_batch_id,'status','RECOVERED','idempotent',true); end if;
  if (select count(*) from public.affiliate_financial_profile_seed_snapshot where batch_id=p_batch_id)<>947 then raise exception 'RECOVERY_SNAPSHOT_INCOMPLETE' using errcode='P0001'; end if;
  if exists(
    select 1 from public.affiliate_financial_profile_seed_snapshot s join public.affiliates a on a.id=s.affiliate_id
    where s.batch_id=p_batch_id and (a.financial_union_code is distinct from s.new_financial_union_code
      or a.financial_employee_category_code is distinct from s.new_financial_employee_category_code
      or a.financial_profile_seed_source_hash<>v_batch.source_file_hash
      or a.financial_profile_seed_row_ordinal<>s.source_row_ordinal)
  ) then raise exception 'RECOVERY_BLOCKED_BY_CURRENT_PROFILE_DIFFERENCE' using errcode='P0001'; end if;

  insert into public.affiliate_profile_audit_log(affiliate_id,field_name,old_value,new_value,changed_by,reason,profile_version,batch_id,change_source,changed_at)
  select a.id,'financial_employee_category_code',to_jsonb(a.financial_employee_category_code),to_jsonb(s.old_financial_employee_category_code),null,
    'BULK_INITIAL_FINANCIAL_PROFILE_SEED_RECOVERY',a.financial_profile_version+1,p_batch_id,'BULK_INITIAL_FINANCIAL_PROFILE_SEED_RECOVERY',v_now
  from public.affiliates a join public.affiliate_financial_profile_seed_snapshot s on s.affiliate_id=a.id and s.batch_id=p_batch_id
  where a.financial_employee_category_code is distinct from s.old_financial_employee_category_code;
  insert into public.affiliate_profile_audit_log(affiliate_id,field_name,old_value,new_value,changed_by,reason,profile_version,batch_id,change_source,changed_at)
  select a.id,'financial_union_code',to_jsonb(a.financial_union_code),to_jsonb(s.old_financial_union_code),null,
    'BULK_INITIAL_FINANCIAL_PROFILE_SEED_RECOVERY',a.financial_profile_version+1,p_batch_id,'BULK_INITIAL_FINANCIAL_PROFILE_SEED_RECOVERY',v_now
  from public.affiliates a join public.affiliate_financial_profile_seed_snapshot s on s.affiliate_id=a.id and s.batch_id=p_batch_id
  where a.financial_union_code is distinct from s.old_financial_union_code;

  update public.affiliates a set
    financial_union_code=s.old_financial_union_code,
    financial_employee_category_code=s.old_financial_employee_category_code,
    financial_profile_version=a.financial_profile_version+1,
    financial_profile_updated_at=v_now,
    financial_profile_updated_by=null,
    financial_profile_seed_source_hash=s.old_seed_source_hash,
    financial_profile_seed_row_ordinal=s.old_seed_row_ordinal,
    financial_profile_seeded_at=s.old_seeded_at,
    updated_at=v_now
  from public.affiliate_financial_profile_seed_snapshot s where s.batch_id=p_batch_id and a.id=s.affiliate_id;
  update public.affiliate_financial_profile_seed_batches set status='RECOVERED',recovered_at=v_now,
    result=result||jsonb_build_object('status','RECOVERED','recovered_at',v_now) where id=p_batch_id;
  return jsonb_build_object('batch_id',p_batch_id,'status','RECOVERED','affiliates_restored',947,'idempotent',false);
end $$;

notify pgrst, 'reload schema';
commit;
