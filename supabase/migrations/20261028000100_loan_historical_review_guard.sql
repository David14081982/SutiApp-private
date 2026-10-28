begin;
set local lock_timeout='2s';
set local statement_timeout='60s';

-- Operational review only. No balance, historical row or fund mapping is changed.
create schema loan_review_private;
revoke all on schema loan_review_private from public,anon,authenticated,service_role;
create table loan_review_private.function_backup(signature text primary key,definition text not null);
create table public.loan_historical_review_cases (
 id uuid primary key default gen_random_uuid(),
 affiliate_id uuid not null references public.affiliates(id) on delete restrict,
 obligation_key text not null check(length(btrim(obligation_key)) between 1 and 180),
 cause_code text not null check(cause_code in ('FUND_UNRESOLVED','INSTALLMENT_AMOUNT_MISSING','CONTROL_MISSING')),
 cause text not null check(length(btrim(cause)) between 10 and 2000),
 evidence jsonb not null check(jsonb_typeof(evidence)='array' and jsonb_array_length(evidence)>0),
 previous_value jsonb not null,
 created_at timestamptz not null default clock_timestamp(),
 unique(affiliate_id,obligation_key)
);
create table public.loan_historical_review_events (
 id uuid primary key default gen_random_uuid(),
 case_id uuid not null references public.loan_historical_review_cases(id) on delete restrict,
 action text not null check(action in ('REGISTER','RESOLVE')),
 actor_auth_user_id uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default clock_timestamp(),
 reason text not null check(length(btrim(reason)) between 10 and 2000),
 evidence jsonb not null check(jsonb_typeof(evidence)='array' and jsonb_array_length(evidence)>0),
 before_state jsonb not null,
 resolution jsonb not null,
 check(jsonb_typeof(before_state)='object' and jsonb_typeof(resolution)='object'),
 check(action<>'RESOLVE' or coalesce((before_state->>'status'='PENDING' and resolution->>'status'='RESOLVED'
  and length(btrim(coalesce(resolution->>'decision','')))>=10),false)),
 unique(case_id,action)
);
alter table public.loan_historical_review_cases enable row level security;
alter table public.loan_historical_review_cases force row level security;
alter table public.loan_historical_review_events enable row level security;
alter table public.loan_historical_review_events force row level security;
revoke all on public.loan_historical_review_cases,public.loan_historical_review_events from public,anon,authenticated,service_role;
create function loan_review_private.immutable() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'HISTORICAL_REVIEW_AUDIT_IMMUTABLE' using errcode='42501';end $$;
create trigger loan_review_cases_immutable before update or delete on public.loan_historical_review_cases
 for each row execute function loan_review_private.immutable();
create trigger loan_review_events_immutable before update or delete on public.loan_historical_review_events
 for each row execute function loan_review_private.immutable();

create function loan_review_private.pending(p_affiliate_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.loan_historical_review_cases c where c.affiliate_id=p_affiliate_id
 and not exists(select 1 from public.loan_historical_review_events e where e.case_id=c.id and e.action='RESOLVE'))
$$;
create function loan_review_private.assert_clear(p_affiliate_id uuid) returns void
language plpgsql stable security definer set search_path='' as $$
begin
 if loan_review_private.pending(p_affiliate_id) then
  raise exception 'HISTORICAL_LOAN_MAPPING_REQUIRED' using errcode='P0001';
 end if;
end $$;

create function public.get_self_loan_historical_review() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare target uuid;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501';end if;
 target:=public.get_effective_affiliate_id();
 if target is null then raise exception 'AFFILIATE_CONTEXT_DENIED' using errcode='42501';end if;
 return jsonb_build_object('status',case when loan_review_private.pending(target)
  then 'HISTORICAL_LOAN_MAPPING_REQUIRED' else 'CLEAR' end);
end $$;

create function public.list_admin_loan_historical_reviews(p_affiliate_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not (public.has_admin_permission('program_requests.read')
  and public.admin_module_boundary(array['finanzas'],'read')) then
  raise exception 'HISTORICAL_REVIEW_READ_DENIED' using errcode='42501';
 end if;
 return coalesce((select jsonb_agg(to_jsonb(c)||jsonb_build_object(
  'numero_control',a.numero_control,'full_name',a.full_name,'status','PENDING',
  'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at,e.id)
   from public.loan_historical_review_events e where e.case_id=c.id),'[]'::jsonb)) order by c.created_at,c.id)
 from public.loan_historical_review_cases c join public.affiliates a on a.id=c.affiliate_id
 where (p_affiliate_id is null or c.affiliate_id=p_affiliate_id)
 and not exists(select 1 from public.loan_historical_review_events e where e.case_id=c.id and e.action='RESOLVE')),'[]'::jsonb);
end $$;

-- No resolution writer is exposed. Future resolution must add an evidence-backed
-- immutable event through a separately validated, permission-gated atomic writer.
create function loan_review_private.enforce_request() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.program_id='prestamo' and (tg_op='INSERT' or new.status='approved' and old.status is distinct from new.status) then
  perform loan_review_private.assert_clear(new.affiliate_id);
 end if;
 return new;
end $$;
create trigger a_loan_historical_review_guard before insert or update of status on public.program_requests
 for each row execute function loan_review_private.enforce_request();

-- Guard the existing common capacity entry point, including the fast quote RPC
-- and old sessions. All original financial statements stay byte-identical.
do $$ declare original text; patched text; signature text:='loan_capacity_private.resolve(uuid,jsonb,uuid[],uuid)';
begin
 original:=pg_get_functiondef(signature::regprocedure);
 if position(E'\nbegin\n' in original)=0 then raise exception 'CAPACITY_GUARD_ANCHOR_MISSING';end if;
 insert into loan_review_private.function_backup values(signature,original);
 patched:=overlay(original placing E'\nbegin\n perform loan_review_private.assert_clear(p_affiliate_id);\n' from position(E'\nbegin\n' in original) for length(E'\nbegin\n'));
 execute patched;
end $$;

revoke all on all functions in schema loan_review_private from public,anon,authenticated,service_role;
revoke all on function public.get_self_loan_historical_review(),public.list_admin_loan_historical_reviews(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_self_loan_historical_review(),public.list_admin_loan_historical_reviews(uuid) to authenticated;
commit;
