begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
-- Receipt-only counterpart of the approved certification identity correction.
-- The shared withdrawal/runtime identity guard and every P0 function are unchanged.
insert into public.savings_certification_function_backup(signature,definition)
select 'P1_RECEIPT_20260921:'||oid::regprocedure::text,pg_get_functiondef(oid)
from pg_proc where pronamespace='public'::regnamespace and proname in
 ('admin_confirm_savings_receipt','admin_confirm_savings_account_receipt','admin_confirm_savings_reconciliation');
create function public.savings_receipt_assert_identity(p_participant_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare p public.savings_participants%rowtype;
begin
 lock table public.affiliates in share mode;
 select * into p from public.savings_participants where id=p_participant_id for update;
 if p.id is null or p.identity_status<>'RESOLVED'
 or (select count(*) from public.affiliates where numero_control=p.legacy_folio and not coalesce(is_archived,false))<>1
 or not exists(select 1 from public.affiliates where id=p.affiliate_id and numero_control=p.legacy_folio and not coalesce(is_archived,false)) then
  raise exception 'SAVINGS_EXACT_IDENTITY_REQUIRED';
 end if;
 return p.affiliate_id;
end $$;
revoke all on function public.savings_receipt_assert_identity(uuid) from public,anon,authenticated,service_role;
do $patch$ declare r record;begin
 if (select count(*) from public.savings_certification_function_backup where signature like 'P1_RECEIPT_20260921:%')<>3
 then raise exception 'SAVINGS_RECEIPT_CONTRACT_DRIFT';end if;
 for r in select definition from public.savings_certification_function_backup where signature like 'P1_RECEIPT_20260921:%' loop
  if position('public.savings_runtime_assert_identity(' in r.definition)=0 then raise exception 'SAVINGS_RECEIPT_IDENTITY_CONTRACT_DRIFT';end if;
  execute replace(r.definition,'public.savings_runtime_assert_identity(','public.savings_receipt_assert_identity(');
 end loop;
end $patch$;
notify pgrst,'reload schema';
commit;
