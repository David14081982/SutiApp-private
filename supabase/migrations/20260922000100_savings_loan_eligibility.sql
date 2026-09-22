begin;
set local lock_timeout='2s';
set local statement_timeout='60s';

-- Access to Caja de Ahorro only. No financial ledger or legacy writes.
create table public.savings_loan_policy (
 id boolean primary key default true check(id),
 minimum_months integer check(minimum_months>=0),
 starts_from text check(starts_from in ('ENROLLMENT','FIRST_DEDUCTION')),
 version integer not null default 0 check(version>=0),
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id) on delete restrict,
 check((minimum_months is null and starts_from is null and version=0) or
       (minimum_months is not null and starts_from is not null and version>0))
);
insert into public.savings_loan_policy(id) values(true);
create table public.savings_loan_authorizations (
 id uuid primary key default extensions.gen_random_uuid(),
 affiliate_id uuid not null references public.affiliates(id) on delete restrict,
 granted_by uuid not null references auth.users(id) on delete restrict,
 granted_at timestamptz not null default now(),
 reason text not null check(length(btrim(reason)) between 8 and 1000),
 revoked_at timestamptz,
 revoked_by uuid references auth.users(id) on delete restrict,
 -- Durable evidence ID: validated by the INSERT trigger, retained if the
 -- existing owner-authorized request archive/deletion workflow later removes it.
 used_request_id uuid unique,
 used_at timestamptz,
 check((revoked_at is null)=(revoked_by is null)),
 check((used_request_id is null)=(used_at is null)),
 check(revoked_at is null or used_at is null)
);
create unique index savings_loan_one_open_authorization on public.savings_loan_authorizations(affiliate_id)
 where revoked_at is null and used_request_id is null;
create table public.savings_loan_access_events (
 id uuid primary key default extensions.gen_random_uuid(),
 action text not null check(action in ('POLICY','GRANT','REVOKE','USE')),
 actor_real_auth_user_id uuid not null references auth.users(id) on delete restrict,
 affiliate_id uuid references public.affiliates(id) on delete restrict,
 authorization_id uuid references public.savings_loan_authorizations(id) on delete restrict,
 request_id uuid,
 reason text not null,
 command jsonb not null,
 evidence jsonb not null,
 client_action_id uuid not null unique,
 created_at timestamptz not null default now()
);
create index savings_loan_access_history on public.savings_loan_access_events(affiliate_id,created_at desc);
create table public.savings_loan_function_backup(signature text primary key,definition text not null,installed_definition text);
do $$ declare t text; begin
 foreach t in array array['savings_loan_policy','savings_loan_authorizations','savings_loan_access_events','savings_loan_function_backup'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('alter table public.%I force row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
 end loop;
end $$;

create function public.savings_loan_access_event_immutable() returns trigger
language plpgsql set search_path='' as $$ begin raise exception 'SAVINGS_LOAN_AUDIT_IMMUTABLE';end $$;
create trigger savings_loan_access_event_immutable before update or delete on public.savings_loan_access_events
for each row execute function public.savings_loan_access_event_immutable();

-- Private reader. Canonical first_actual_contribution_date is maintained by
-- certified opening/actual receipt writers; never use an expected schedule or balance.
create function public.savings_loan_eligibility(p_affiliate_id uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare p public.savings_loan_policy%rowtype; e public.savings_enrollments%rowtype;
 a public.savings_loan_authorizations%rowtype; start_on date; eligible_on date; first_deduction date;
 today date:=(now() at time zone 'America/Hermosillo')::date;
 ordinary boolean:=false; why text;
begin
 if p_affiliate_id is null then raise exception 'AFFILIATE_CONTEXT_UNAVAILABLE';end if;
 select * into p from public.savings_loan_policy where id;
 if not found then raise exception 'SAVINGS_LOAN_POLICY_UNAVAILABLE';end if;
 select en.* into e from public.savings_enrollments en join public.savings_participants sp on sp.id=en.participant_id
 where sp.affiliate_id=p_affiliate_id and sp.identity_status='RESOLVED' and sp.certification_status='CERTIFIED'
 and sp.data_classification='CANONICAL' and en.data_classification='CANONICAL'
 order by en.sequence_number desc limit 1;
 first_deduction:=e.first_actual_contribution_date;
 -- A certified zero opening may contain a future *planned* first date. Even
 -- after that date passes, require a positive confirmed receipt; a zero receipt
 -- must not turn the plan into tenure evidence.
 if exists(select 1 from public.savings_balance_certifications c where c.enrollment_id=e.id
   and (c.command->>'first_date')::date>c.cutoff_on) then
  select min(o.contribution_date) into first_deduction from (
   select distinct on (contribution_date) contribution_date,actual_amount from public.savings_contribution_overrides
   where enrollment_id=e.id and contribution_date<=today order by contribution_date,version_number desc
  ) o where o.actual_amount>0;
 end if;
 if e.id is null or public.savings_enrollment_effective_status(e.status,e.terminated_at,today) not in ('ACTIVE','TERMINATION_PENDING')
    or (not e.continue_saving and (e.terminated_at is null or (e.terminated_at at time zone 'America/Hermosillo')::date<=today))
    or (e.enrollment_started_at at time zone 'America/Hermosillo')::date>today
    or not exists(select 1 from public.savings_contribution_plans plan where plan.enrollment_id=e.id and plan.data_classification='CANONICAL'
      and plan.amount>0 and (plan.effective_to is null or plan.effective_to>=today)) then why:='NOT_ACTIVE_SAVER';
 elsif first_deduction is null or first_deduction>today then why:='NO_ACTUAL_DEDUCTION';
 elsif p.minimum_months is null then why:='POLICY_NOT_CONFIGURED';
 else
  start_on:=case p.starts_from when 'ENROLLMENT' then (e.enrollment_started_at at time zone 'America/Hermosillo')::date else first_deduction end;
  eligible_on:=(start_on+make_interval(months=>p.minimum_months))::date;
  ordinary:=today>=eligible_on;
  why:=case when ordinary then 'ELIGIBLE' else 'MINIMUM_TENURE' end;
 end if;
 select * into a from public.savings_loan_authorizations where affiliate_id=p_affiliate_id and revoked_at is null and used_request_id is null;
 return jsonb_build_object('eligible',ordinary or a.id is not null,'ordinary_eligible',ordinary,'reason',why,
  'authorization_id',case when not ordinary then a.id else null end,'active_authorization_id',a.id,
  'minimum_months',p.minimum_months,'starts_from',p.starts_from,'policy_version',p.version,
  'enrollment_id',e.id,'enrollment_date',(e.enrollment_started_at at time zone 'America/Hermosillo')::date,
  'first_deduction_date',first_deduction,'eligible_on',eligible_on);
end $$;
revoke all on function public.savings_loan_eligibility(uuid) from public,anon,authenticated;
grant execute on function public.savings_loan_eligibility(uuid) to service_role;

create function public.get_admin_savings_loan_access(p_numero_control text default null) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare target uuid; n integer; result jsonb; history jsonb; person jsonb; can_policy boolean; can_grant boolean;
begin
 can_grant:=public.has_admin_permission('program_requests.write') and public.has_admin_permission('workflow.write');
 can_policy:=public.has_admin_permission('financial_rules.write') or can_grant;
 if auth.uid() is null or not (can_policy or can_grant or public.has_admin_permission('financial_rules.read')) then
  raise exception 'SAVINGS_LOAN_ACCESS_DENIED' using errcode='42501';end if;
 if nullif(btrim(p_numero_control),'') is not null then
  select count(*),(array_agg(id))[1] into n,target from public.affiliates where numero_control=btrim(p_numero_control) and not is_archived;
  if n<>1 then raise exception 'AFFILIATE_CONTROL_NOT_UNIQUE_OR_MISSING';end if;
  select jsonb_build_object('id',id,'numero_control',numero_control,'name',coalesce(nullif(display_name,''),full_name)) into person from public.affiliates where id=target;
  result:=public.savings_loan_eligibility(target);
 end if;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc),'[]') into history from
  (select action,actor_real_auth_user_id,affiliate_id,authorization_id,request_id,reason,created_at,evidence,
    coalesce((select coalesce(nullif(a.display_name,''),a.full_name) from public.affiliates a where a.auth_user_id=ev.actor_real_auth_user_id and not a.is_archived limit 1),actor_real_auth_user_id::text) actor_label
   from public.savings_loan_access_events ev where (target is null and action='POLICY') or affiliate_id=target
   order by created_at desc limit 30) q;
 return jsonb_build_object('policy',(select to_jsonb(p)-'id' from public.savings_loan_policy p where id),
  'person',person,'eligibility',result,'history',history,'can_configure',can_policy,'can_authorize',can_grant);
end $$;
revoke all on function public.get_admin_savings_loan_access(text) from public,anon,service_role;
grant execute on function public.get_admin_savings_loan_access(text) to authenticated;

create function public.set_admin_savings_loan_policy(p_months integer,p_starts_from text,p_expected_version integer,p_reason text,p_client_action_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare prior public.savings_loan_policy%rowtype; old public.savings_loan_access_events%rowtype; result jsonb;
 command jsonb:=jsonb_build_object('months',p_months,'starts_from',p_starts_from,'expected_version',p_expected_version,'reason',p_reason);
begin
 if auth.uid() is null or not (public.has_admin_permission('financial_rules.write') or
   (public.has_admin_permission('program_requests.write') and public.has_admin_permission('workflow.write'))) then raise exception 'SAVINGS_LOAN_ACCESS_DENIED' using errcode='42501';end if;
 if p_months is null or p_months<0 or p_starts_from is null or p_starts_from not in ('ENROLLMENT','FIRST_DEDUCTION')
 or p_expected_version is null or p_client_action_id is null or length(btrim(coalesce(p_reason,''))) not between 8 and 1000 then raise exception 'SAVINGS_LOAN_POLICY_INVALID';end if;
 -- Check supported date arithmetic without imposing a business preset or arbitrary month menu.
 perform (current_date+make_interval(months=>p_months))::date;
 perform pg_advisory_xact_lock(hashtextextended('savings-loan-policy',0));
 select * into old from public.savings_loan_access_events where client_action_id=p_client_action_id;
 if found then
  if old.actor_real_auth_user_id<>auth.uid() or old.action<>'POLICY' or old.command<>command then raise exception 'SAVINGS_LOAN_IDEMPOTENCY_CONFLICT';end if;
  return old.evidence->'after';
 end if;
 select * into prior from public.savings_loan_policy where id for update;
 if prior.version is distinct from p_expected_version then raise exception 'SAVINGS_LOAN_POLICY_STALE';end if;
 update public.savings_loan_policy set minimum_months=p_months,starts_from=p_starts_from,version=version+1,updated_at=now(),updated_by=auth.uid() where id returning to_jsonb(savings_loan_policy) into result;
 insert into public.savings_loan_access_events(action,actor_real_auth_user_id,reason,command,evidence,client_action_id)
 values('POLICY',auth.uid(),btrim(p_reason),command,jsonb_build_object('before',to_jsonb(prior),'after',result),p_client_action_id);
 update public.financial_session_snapshots set invalidated_at=now(),invalidation_reason='SAVINGS_LOAN_POLICY_CHANGED' where invalidated_at is null and session_purpose='LOAN';
 return result;
end $$;
revoke all on function public.set_admin_savings_loan_policy(integer,text,integer,text,uuid) from public,anon,service_role;
grant execute on function public.set_admin_savings_loan_policy(integer,text,integer,text,uuid) to authenticated;

create function public.set_admin_savings_loan_authorization(p_affiliate_id uuid,p_action text,p_authorization_id uuid,p_reason text,p_client_action_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare a public.savings_loan_authorizations%rowtype; old public.savings_loan_access_events%rowtype; evidence jsonb; n integer;
 command jsonb:=jsonb_build_object('affiliate_id',p_affiliate_id,'action',p_action,'authorization_id',p_authorization_id,'reason',p_reason);
begin
 if auth.uid() is null or not public.has_admin_permission('program_requests.write') or not public.has_admin_permission('workflow.write') then
  raise exception 'SAVINGS_LOAN_ACCESS_DENIED' using errcode='42501';end if;
 if p_affiliate_id is null or p_action is null or p_action not in ('GRANT','REVOKE') or p_client_action_id is null
 or length(btrim(coalesce(p_reason,''))) not between 8 and 1000 or (p_action='GRANT' and p_authorization_id is not null) then raise exception 'SAVINGS_LOAN_AUTHORIZATION_INVALID';end if;
 perform pg_advisory_xact_lock(hashtextextended('savings-loan-policy',0));
 select * into old from public.savings_loan_access_events where client_action_id=p_client_action_id;
 if found then
  if old.actor_real_auth_user_id<>auth.uid() or old.command<>command then raise exception 'SAVINGS_LOAN_IDEMPOTENCY_CONFLICT';end if;
  return old.evidence;
 end if;
 if not exists(select 1 from public.affiliates where id=p_affiliate_id and not is_archived) then raise exception 'AFFILIATE_CONTEXT_UNAVAILABLE';end if;
 select count(*) into n from public.affiliates where numero_control=(select numero_control from public.affiliates where id=p_affiliate_id) and not is_archived;
 if n<>1 then raise exception 'AFFILIATE_CONTROL_NOT_UNIQUE_OR_MISSING';end if;
 if p_action='GRANT' then
  insert into public.savings_loan_authorizations(affiliate_id,granted_by,reason) values(p_affiliate_id,auth.uid(),btrim(p_reason)) returning * into a;
 else
  update public.savings_loan_authorizations set revoked_at=now(),revoked_by=auth.uid()
   where id=p_authorization_id and affiliate_id=p_affiliate_id and revoked_at is null and used_request_id is null returning * into a;
  if not found then raise exception 'SAVINGS_LOAN_AUTHORIZATION_NOT_ACTIVE';end if;
 end if;
 evidence:=jsonb_build_object('authorization',to_jsonb(a),'eligibility',public.savings_loan_eligibility(p_affiliate_id));
 insert into public.savings_loan_access_events(action,actor_real_auth_user_id,affiliate_id,authorization_id,reason,command,evidence,client_action_id)
 values(p_action,auth.uid(),p_affiliate_id,a.id,btrim(p_reason),command,evidence,p_client_action_id);
 update public.financial_session_snapshots set invalidated_at=now(),invalidation_reason='SAVINGS_LOAN_AUTHORIZATION_CHANGED'
 where affiliate_id=p_affiliate_id and invalidated_at is null and session_purpose='LOAN';
 return evidence;
end $$;
revoke all on function public.set_admin_savings_loan_authorization(uuid,text,uuid,text,uuid) from public,anon,service_role;
grant execute on function public.set_admin_savings_loan_authorization(uuid,text,uuid,text,uuid) to authenticated;

create function public.assert_savings_loan_quote_access(p_affiliate_id uuid,p_selected_id text,p_rules jsonb) returns void
language plpgsql volatile security definer set search_path='' as $$
begin
 if exists(select 1 from jsonb_array_elements(p_rules) r where r->>'status'='AVAILABLE'
  and (r->>'id'=p_selected_id or r->>'program_id'=p_selected_id)
  and split_part(r->>'id','--',2)='caja-de-ahorro') and
 not (public.savings_loan_eligibility(p_affiliate_id)->>'eligible')::boolean then
  raise exception 'FINANCIAL_PROGRAM_NOT_ELIGIBLE';end if;
end $$;
revoke all on function public.assert_savings_loan_quote_access(uuid,text,jsonb) from public,anon,authenticated,service_role;

-- Preserve current deployed quote body and ACL/OID. Fail if the expected insertion
-- point changed; no overwriting an unknown production definition.
do $$ declare def text; patched text; target_signature text:='public.resolve_current_loan_snapshot_quote(uuid,text,numeric,integer)';begin
 select pg_get_functiondef(target_signature::regprocedure) into def;
 if def not like '%v_quote := public.resolve_suti_loan_quote_contract(%' or def not like '%  begin%v_payroll :=%' then raise exception 'SAVINGS_LOAN_QUOTE_DEFINITION_CHANGED';end if;
 patched:=replace(replace(def,E'\r\n',E'\n'),E'  begin\n    v_payroll :=',E'  perform public.assert_savings_loan_quote_access(v_affiliate_id,p_program_id,v_snapshot.eligible_rules);\n  begin\n    v_payroll :=');
 if patched not like '%perform public.assert_savings_loan_quote_access(v_affiliate_id,p_program_id,v_snapshot.eligible_rules);%' then raise exception 'SAVINGS_LOAN_QUOTE_PATCH_NOT_APPLIED';end if;
 insert into public.savings_loan_function_backup values(target_signature,def,null);
 execute patched;
 update public.savings_loan_function_backup set installed_definition=pg_get_functiondef(target_signature::regprocedure) where signature=target_signature;
end $$;

-- Atomic request-time decision, including clients with an old snapshot/Edge version.
-- AFTER INSERT lets the exception reference this real request and rolls everything
-- back on failure. Retrying the existing request never consumes a second grant.
create function public.enforce_savings_loan_request_access() returns trigger
language plpgsql security definer set search_path='' as $$
declare decision jsonb; grant_id uuid; evidence jsonb; requires_savings boolean;
begin
 if new.program_id<>'prestamo' then return new;end if;
 select bool_or(f.code='caja-de-ahorro') into requires_savings
 from public.financial_rules r join public.financial_funds f on f.id=r.fund_id
 where coalesce(r.legacy_criterion_identity,'SUPABASE_RULE:'||r.id::text)=new.financial_submission_snapshot->>'criterion_identity';
 if requires_savings is null then raise exception 'FINANCIAL_PROGRAM_NOT_ELIGIBLE';end if;
 if not requires_savings then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended('savings-loan-policy',0));
 perform pg_advisory_xact_lock(hashtextextended('savings-config',0));
 decision:=public.savings_loan_eligibility(new.affiliate_id);
 if not (decision->>'eligible')::boolean then raise exception 'FINANCIAL_PROGRAM_NOT_ELIGIBLE';end if;
 grant_id:=nullif(decision->>'authorization_id','')::uuid;
 if grant_id is not null then
  update public.savings_loan_authorizations set used_request_id=new.id,used_at=now()
   where id=grant_id and affiliate_id=new.affiliate_id and revoked_at is null and used_request_id is null;
  if not found then raise exception 'FINANCIAL_PROGRAM_NOT_ELIGIBLE';end if;
  evidence:=decision||jsonb_build_object('request_actor',new.actor_real_auth_user_id,'impersonation_session_id',new.impersonation_session_id);
  insert into public.savings_loan_access_events(action,actor_real_auth_user_id,affiliate_id,authorization_id,request_id,reason,command,evidence,client_action_id)
  values('USE',new.actor_real_auth_user_id,new.affiliate_id,grant_id,new.id,'Autorización aplicada a una solicitud',jsonb_build_object('request_id',new.id),evidence,extensions.gen_random_uuid());
 end if;
 return new;
end $$;
revoke all on function public.enforce_savings_loan_request_access() from public,anon,authenticated,service_role;
create trigger program_requests_savings_loan_access after insert on public.program_requests
for each row execute function public.enforce_savings_loan_request_access();
notify pgrst,'reload schema';
commit;
