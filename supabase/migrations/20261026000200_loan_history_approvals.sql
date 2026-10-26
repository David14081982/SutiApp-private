begin;
set local lock_timeout='3s';
set local statement_timeout='60s';
-- H-HISTORY-IMMEDIATE-APPROVAL-001. Only own approval metadata is published.
-- Google observations, approval writers and scheduled/manual synchronization stay unchanged.
do $guard$ begin
 if current_user<>'postgres' then raise exception 'HISTORY_APPROVAL_OWNER_REQUIRED'; end if;
 if to_regnamespace('loan_history_private') is null
  or to_regprocedure('public.can_read_loan_history_publication()') is null
  or not exists(select 1 from pg_publication where pubname='supabase_realtime') then
  raise exception 'HISTORY_APPROVAL_INFRASTRUCTURE_REQUIRED'; end if;
 if to_regclass('public.loan_history_approval_publication') is not null
  or to_regclass('loan_history_private.approval_context_backup') is not null
  or to_regprocedure('public.get_self_loan_history_approvals()') is not null then
  raise exception 'HISTORY_APPROVAL_ALREADY_INSTALLED'; end if;
 if not exists(select 1 from pg_proc p join pg_roles r on r.oid=p.proowner
   where p.oid=to_regprocedure('public.get_self_loan_history_context()') and r.rolname='postgres'
   and p.prosecdef and p.provolatile='s' and p.proconfig=array['search_path=""']
   and md5(replace(p.prosrc,E'\r\n',E'\n'))='be2a50a826e76bc74c9be7fd361871e9') then
  raise exception 'HISTORY_APPROVAL_CONTEXT_DRIFT'; end if;
end $guard$;

-- Exact definition and object metadata for recovery. Contains no user records.
create table loan_history_private.approval_context_backup (
 id boolean primary key default true check(id), definition text not null,
 original_source_hash text not null, installed_source_hash text,
 function_oid oid not null, owner_oid oid not null, acl aclitem[], config text[],
 security_definer boolean not null, volatility "char" not null
);
alter table loan_history_private.approval_context_backup enable row level security;
alter table loan_history_private.approval_context_backup force row level security;
revoke all on loan_history_private.approval_context_backup from public,anon,authenticated,service_role;
insert into loan_history_private.approval_context_backup
 (definition,original_source_hash,function_oid,owner_oid,acl,config,security_definer,volatility)
 select pg_get_functiondef(p.oid),md5(p.prosrc),p.oid,p.proowner,p.proacl,p.proconfig,p.prosecdef,p.provolatile
 from pg_proc p where p.oid='public.get_self_loan_history_context()'::regprocedure;

create table public.loan_history_approval_publication (
 affiliate_id uuid primary key references public.affiliates(id) on delete cascade,
 version uuid not null
);
alter table public.loan_history_approval_publication enable row level security;
alter table public.loan_history_approval_publication force row level security;
revoke all on public.loan_history_approval_publication from public,anon,authenticated,service_role;
create policy own_approval_publication on public.loan_history_approval_publication for select to authenticated
 using(affiliate_id=public.get_effective_affiliate_id() and public.can_read_loan_history_publication());
grant select on public.loan_history_approval_publication to authenticated;

create function loan_history_private.publish_approval_revision() returns trigger
language plpgsql security definer set search_path='' as $$
declare prior jsonb; current_value jsonb; owner_id uuid;
begin
 if tg_op<>'INSERT' and old.status='approved' and old.financial_processing_status is not null
   and old.rental_start is null and old.financial_approved_at is not null
   and jsonb_typeof(old.financial_approval_snapshot)='object' then
  prior:=jsonb_build_object('id',old.id,'affiliate_id',old.affiliate_id,'folio',old.folio,
   'created_at',old.created_at,'approved_at',old.financial_approved_at,
   'fund',old.financial_approval_snapshot->'financialResult'->'fund',
   'principal',old.financial_approval_snapshot->'financialResult'->'amount',
   'total',old.financial_approval_snapshot->'financialResult'->'total',
   'term',old.financial_approval_snapshot->'financialResult'->'paymentCount');
 end if;
 if tg_op<>'DELETE' and new.status='approved' and new.financial_processing_status is not null
   and new.rental_start is null and new.financial_approved_at is not null
   and jsonb_typeof(new.financial_approval_snapshot)='object' then
  current_value:=jsonb_build_object('id',new.id,'affiliate_id',new.affiliate_id,'folio',new.folio,
   'created_at',new.created_at,'approved_at',new.financial_approved_at,
   'fund',new.financial_approval_snapshot->'financialResult'->'fund',
   'principal',new.financial_approval_snapshot->'financialResult'->'amount',
   'total',new.financial_approval_snapshot->'financialResult'->'total',
   'term',new.financial_approval_snapshot->'financialResult'->'paymentCount');
 end if;
 if prior is distinct from current_value then
  -- Distinct owners receive one tiny invalidation each. No timers, HTTP or loans.
  -- A legitimate affiliate cascade already removed its parent. Never recreate
  -- metadata for that absent identity or prevent its existing deletion flow.
  for owner_id in select distinct a.id
   from (values(prior),(current_value)) as affected(x)
   join public.affiliates a on a.id=(x->>'affiliate_id')::uuid where x is not null loop
   insert into public.loan_history_approval_publication as publication(affiliate_id,version)
    values(owner_id,pg_catalog.gen_random_uuid())
    on conflict(affiliate_id) do update set version=excluded.version;
  end loop;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
revoke all on function loan_history_private.publish_approval_revision() from public,anon,authenticated,service_role;
create trigger loan_history_approval_revision after insert or update or delete on public.program_requests
 for each row execute function loan_history_private.publish_approval_revision();

create or replace function public.get_self_loan_history_context()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare person public.affiliates%rowtype; actor uuid:=auth.uid();
begin
 if actor is null then raise exception 'HISTORY_AUTH_REQUIRED' using errcode='42501'; end if;
 select * into person from public.affiliates where id=public.get_effective_affiliate_id();
 if person.id is null or person.is_archived then raise exception 'HISTORY_IDENTITY_DENIED' using errcode='42501'; end if;
 if person.numero_control is null or btrim(person.numero_control)='' or person.numero_control<>btrim(person.numero_control)
   or person.numero_control='0' or (select count(*) from public.affiliates a where not a.is_archived and a.numero_control=person.numero_control)<>1
 then raise exception 'HISTORY_IDENTITY_AMBIGUOUS' using errcode='42501'; end if;
 return jsonb_build_object('actor',actor,'affiliate_id',person.id,'folio',person.numero_control,'server_now',now(),
  'approval_revision',(select version from public.loan_history_approval_publication where affiliate_id=person.id),
  'requests',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'folio',r.folio,'status',r.status,
    'approved_at',r.financial_approved_at,'financial',r.financial_processing_status is not null and r.rental_start is null,
    'created_at',r.created_at,
    'approval_display',case when r.status='approved' and r.financial_processing_status is not null
      and r.rental_start is null and r.financial_approved_at is not null
      and jsonb_typeof(r.financial_approval_snapshot)='object' then jsonb_build_object(
       'fund',r.financial_approval_snapshot->'financialResult'->'fund',
       'principal',r.financial_approval_snapshot->'financialResult'->'amount',
       'total',r.financial_approval_snapshot->'financialResult'->'total',
       'term',r.financial_approval_snapshot->'financialResult'->'paymentCount') else null end)
    order by r.created_at,r.id)
   from public.program_requests r where r.affiliate_id=person.id),'[]'::jsonb));
end $$;

create function public.get_self_loan_history_approvals() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare ctx jsonb;
begin
 ctx:=public.get_self_loan_history_context();
 if not loan_history_private.folio_is_addressable(ctx->>'folio') then
  raise exception 'HISTORY_IDENTITY_AMBIGUOUS' using errcode='42501'; end if;
 return ctx;
end $$;
revoke all on function public.get_self_loan_history_approvals() from public,anon,authenticated,service_role;
grant execute on function public.get_self_loan_history_approvals() to authenticated;
comment on function public.get_self_loan_history_approvals() is
 'Own confirmed approval metadata only; no owner parameters, Google, observations or installment reads.';
comment on table public.loan_history_approval_publication is
 'Per-affiliate opaque approval invalidation only. No amounts, quotas, names or business write API.';
alter publication supabase_realtime add table public.loan_history_approval_publication;

do $verify$ begin
 if exists(select 1 from loan_history_private.approval_context_backup b join pg_proc p on p.oid=b.function_oid
  where p.proowner is distinct from b.owner_oid or p.proacl is distinct from b.acl
   or p.proconfig is distinct from b.config or p.prosecdef is distinct from b.security_definer
   or p.provolatile is distinct from b.volatility) then raise exception 'HISTORY_APPROVAL_CONTEXT_METADATA_DRIFT'; end if;
 update loan_history_private.approval_context_backup set installed_source_hash=
  (select md5(prosrc) from pg_proc where oid=function_oid);
end $verify$;
notify pgrst,'reload schema';
commit;
