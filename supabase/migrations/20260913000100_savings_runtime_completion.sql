begin;
-- Savings-only audited correction, plan preview and reporting boundaries.
alter table public.savings_contribution_overrides drop constraint savings_override_reason_check;
alter table public.savings_contribution_overrides add constraint savings_override_reason_check check(length(reason)<=1000);
create table public.savings_runtime_function_backup(signature text primary key,definition text not null);
alter table public.savings_runtime_function_backup enable row level security;
alter table public.savings_runtime_function_backup force row level security;
revoke all on public.savings_runtime_function_backup from public,anon,authenticated,service_role;
insert into public.savings_runtime_function_backup
select oid::regprocedure::text,pg_get_functiondef(oid) from pg_proc where pronamespace='public'::regnamespace
and proname in ('get_admin_savings_financial_account','admin_override_savings_contribution');

create function public.savings_balance_review_version(p_record_id uuid) returns text
language sql stable security definer set search_path='' as $$
 select md5((public.savings_certification_context(p_record_id)->'snapshot')::text||':'||coalesce((select max(a.id)::text from public.savings_audit_events a join public.savings_balance_certifications c on c.participant_id=a.participant_id where c.record_id=p_record_id),'0'))
$$;
revoke all on function public.savings_balance_review_version(uuid) from public,anon,authenticated,service_role;

create function public.admin_adjust_savings_balance(p_record_id uuid,p_capital numeric,p_yield numeric,p_version text,p_observation text,p_client_action_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.savings_balance_certifications%rowtype; b record; old public.savings_audit_events%rowtype; v text; delta numeric; comp text; target numeric; result jsonb; ctx jsonb; accepted jsonb; field text;
 command jsonb:=jsonb_build_object('record_id',p_record_id,'capital',p_capital,'yield',p_yield,'version',p_version,'observation',p_observation);
begin
 if auth.uid() is null or not public.has_admin_permission('savings.approve') then raise exception 'SAVINGS_APPROVE_DENIED' using errcode='42501';end if;
 if p_client_action_id is null or p_version is null or p_capital is null or p_yield is null or p_capital<0 or p_yield<0 or p_capital+p_yield>999999999999.99
 or p_capital<>round(p_capital,2) or p_yield<>round(p_yield,2) or length(coalesce(p_observation,''))>1000 then raise exception 'SAVINGS_AMOUNT_INVALID';end if;
 perform pg_advisory_xact_lock(hashtextextended('savings-adjust:'||p_client_action_id,0));
 select * into old from public.savings_audit_events where client_action_id=p_client_action_id;
 if found then
  if old.after_data->'command' is distinct from command or old.actor_real_auth_user_id<>auth.uid() then raise exception 'SAVINGS_IDEMPOTENCY_CONFLICT';end if;
  return old.after_data->'result';
 end if;
 select * into c from public.savings_balance_certifications where record_id=p_record_id;
 if not found then raise exception 'SAVINGS_CERTIFICATION_REQUIRED';end if;
 lock table public.affiliates in share mode;
 perform 1 from public.savings_review_records where source_folio=(select source_folio from public.savings_review_records where id=p_record_id) order by id for update;
 perform 1 from public.savings_participants where id=c.participant_id for update;
 v:=public.savings_balance_review_version(p_record_id);
 if v<>p_version then raise exception 'SAVINGS_PREVIEW_STALE';end if;
 ctx:=public.savings_certification_context(p_record_id);
 if (ctx#>>'{person,identity,match_count}')::int<>1 or (ctx#>>'{person,identity,active_match_count}')::int<>1 or ctx#>>'{person,identity_pending}'='true' then raise exception 'SAVINGS_EXACT_IDENTITY_REQUIRED';end if;
 if not exists(select 1 from public.savings_participants p join public.affiliates a on a.id=p.affiliate_id and a.numero_control=p.legacy_folio and not coalesce(a.is_archived,false) where p.id=c.participant_id and p.legacy_folio=ctx#>>'{person,folio}' and p.identity_status='RESOLVED') then raise exception 'SAVINGS_EXACT_IDENTITY_REQUIRED';end if;
 if ctx#>>'{source_update,pending}'='true' then raise exception 'SAVINGS_SOURCE_UPDATE_PENDING';end if;
 select a.after_data->'source_snapshot' into accepted from public.savings_audit_events a where a.participant_id=c.participant_id and a.action='ADJUST_CONFIRMED_BALANCE' order by id desc limit 1;
 accepted:=coalesce(accepted,c.source_snapshot);
 foreach field in array array['R','S','W','F','X','Z','D'] loop
  if ((ctx#>'{snapshot,source}')||(ctx#>'{snapshot,proposal}'))->field is distinct from ((accepted->'source')||(accepted->'proposal'))->field then raise exception 'SAVINGS_PLAN_REVIEW_REQUIRED';end if;
 end loop;
 select * into b from public.savings_participant_balance(c.participant_id);
 if p_capital<b.held_capital or p_yield<b.held_yield then raise exception 'SAVINGS_HELD_BALANCE_PROTECTED';end if;
 foreach comp in array array['CAPITAL','YIELD'] loop
  target:=case when comp='CAPITAL' then p_capital else p_yield end;
  delta:=target-case when comp='CAPITAL' then b.capital else b.yield_amount end;
  if delta<>0 then
   insert into public.savings_transactions(participant_id,enrollment_id,transaction_type,component,direction,amount,effective_date,idempotency_key,data_classification,created_by_auth_user_id)
   values(c.participant_id,c.enrollment_id,'ADJUSTMENT',comp,case when delta>0 then 'CREDIT' else 'DEBIT' end,abs(delta),public.savings_operation_today(),'BALANCE_ADJUST:'||p_client_action_id||':'||comp,'CANONICAL',auth.uid());
  end if;
 end loop;
 result:=jsonb_build_object('capital',p_capital,'yield',p_yield,'total',p_capital+p_yield);
 insert into public.savings_audit_events(actor_real_auth_user_id,usuario_contexto_affiliate_id,participant_id,resource,action,target_id,before_data,after_data,reason,client_action_id)
 values(auth.uid(),public.get_effective_affiliate_id(),c.participant_id,'savings_balance_certifications','ADJUST_CONFIRMED_BALANCE',c.id::text,to_jsonb(b),jsonb_build_object('command',command,'result',result,'source_snapshot',ctx->'snapshot'),coalesce(p_observation,''),p_client_action_id);
 return result;
end $$;

-- Never allow the old override shortcut to alter a certified opening or evade
-- receipt versions. Existing non-certified behavior is preserved privately.
alter function public.admin_override_savings_contribution(uuid,date,numeric,text,uuid) rename to savings_override_before_runtime;
revoke all on function public.savings_override_before_runtime(uuid,date,numeric,text,uuid) from public,anon,authenticated,service_role;
create function public.admin_override_savings_contribution(p_enrollment_id uuid,p_contribution_date date,p_actual_amount numeric,p_reason text,p_client_action_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.has_admin_permission('savings.write') then raise exception 'SAVINGS_WRITE_DENIED' using errcode='42501';end if;
 if exists(select 1 from public.savings_balance_certifications where enrollment_id=p_enrollment_id) then raise exception 'SAVINGS_USE_CONFIRMED_RECEIPT';end if;
 return public.savings_override_before_runtime(p_enrollment_id,p_contribution_date,p_actual_amount,p_reason,p_client_action_id);
end $$;

alter function public.get_admin_savings_financial_account(uuid,date) rename to savings_account_before_runtime;
revoke all on function public.savings_account_before_runtime(uuid,date) from public,anon,authenticated,service_role;
create function public.get_admin_savings_financial_account(p_record_id uuid,p_until date default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; snapshot jsonb;
begin
 result:=public.savings_account_before_runtime(p_record_id,p_until);
 if result->>'certified'='true' then
  result:=jsonb_set(result,'{balance_version}',to_jsonb(public.savings_balance_review_version(p_record_id)));
  select a.after_data->'source_snapshot' into snapshot from public.savings_audit_events a
  where a.participant_id=(result#>>'{certificate,participant_id}')::uuid and a.action='ADJUST_CONFIRMED_BALANCE' order by id desc limit 1;
  if snapshot is not null then result:=jsonb_set(result,'{source_changed}',to_jsonb((result#>'{context,snapshot,related}') is distinct from (snapshot->'related')));end if;
 end if;
 return result;
end $$;

create function public.get_admin_savings_period_report(p_from date,p_to date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare rows jsonb;
begin
 if auth.uid() is null or not public.has_admin_permission('savings.reports') then raise exception 'SAVINGS_REPORT_DENIED' using errcode='42501';end if;
 if p_from is null or p_to is null or p_to<p_from or p_to>p_from+1098 then raise exception 'SAVINGS_REPORT_RANGE_INVALID';end if;
 with tx as (select t.* from public.savings_transactions t where data_classification='CANONICAL' and effective_date between p_from and p_to),
 report as(select p.id,p.legacy_folio folio,public.savings_identity_display(p.legacy_folio)->>'identity_display_name' name,
 coalesce(sum(t.amount) filter(where t.transaction_type='WITHDRAWAL' and t.component='CAPITAL' and t.direction='DEBIT'),0) capital_delivered,
 coalesce(sum(t.amount) filter(where t.transaction_type='WITHDRAWAL' and t.component='YIELD' and t.direction='DEBIT'),0) yield_delivered,
 coalesce(sum(case when direction='CREDIT' then amount else -amount end) filter(where t.transaction_type in ('CONTRIBUTION','ADJUSTMENT') and contribution_date is not null),0) actual_received,
 coalesce(sum(t.amount) filter(where t.transaction_type='YIELD_CREDIT'),0) yield_credited,
 count(distinct t.id) movements
 from public.savings_participants p left join tx t on t.participant_id=p.id where p.data_classification='CANONICAL' group by p.id)
 select coalesce(jsonb_agg(to_jsonb(report) order by name,folio),'[]') into rows from report;
 return jsonb_build_object('from',p_from,'to',p_to,'rows',rows,'totals',jsonb_build_object(
 'capital_delivered',coalesce((select sum((r->>'capital_delivered')::numeric) from jsonb_array_elements(rows)r),0),
 'yield_delivered',coalesce((select sum((r->>'yield_delivered')::numeric) from jsonb_array_elements(rows)r),0),
 'actual_received',coalesce((select sum((r->>'actual_received')::numeric) from jsonb_array_elements(rows)r),0),
 'yield_credited',coalesce((select sum((r->>'yield_credited')::numeric) from jsonb_array_elements(rows)r),0)),
 'historical_note','Los retiros anteriores al saldo confirmado se conservan en su lista original; no se vuelven a descontar ni se inventa su reparto de capital y rendimiento.');
end $$;
revoke all on function public.admin_adjust_savings_balance(uuid,numeric,numeric,text,text,uuid),public.admin_override_savings_contribution(uuid,date,numeric,text,uuid),public.get_admin_savings_financial_account(uuid,date),public.get_admin_savings_period_report(date,date) from public,anon,authenticated,service_role;
grant execute on function public.admin_adjust_savings_balance(uuid,numeric,numeric,text,text,uuid),public.admin_override_savings_contribution(uuid,date,numeric,text,uuid),public.get_admin_savings_financial_account(uuid,date),public.get_admin_savings_period_report(date,date) to authenticated;
commit;
