begin;

do $$ begin
  if exists(select 1 from public.program_requests where impersonation_session_id is not null) or
     exists(select 1 from public.affiliate_payroll_declaration_audit where impersonation_session_id is not null) then
    raise exception 'RECOVERY_BLOCKED_ASSISTED_AUDIT_EXISTS';
  end if;
end $$;

drop trigger if exists program_requests_capture_impersonation on public.program_requests;
drop function if exists public.capture_program_request_impersonation();
alter table public.program_requests drop column impersonation_reason,drop column impersonation_session_id,drop column usuario_contexto_affiliate_id;
alter table public.affiliate_payroll_declaration_audit drop column impersonation_reason,drop column impersonation_session_id,drop column usuario_contexto_affiliate_id;

create or replace function public.start_affiliate_impersonation(p_affiliate_id uuid, p_reason text)
returns table(session_id uuid, affiliate_id uuid, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare principal uuid := (select auth.uid()); created public.impersonation_sessions%rowtype;
begin
  if principal is null or not public.has_admin_permission('affiliates.impersonate') then raise exception 'ADMIN_DENIED' using errcode='P0001'; end if;
  if char_length(btrim(coalesce(p_reason,''))) < 8 then raise exception 'REASON_REQUIRED' using errcode='P0001'; end if;
  if not exists(select 1 from public.affiliates a where a.id=p_affiliate_id) then raise exception 'AFFILIATE_NOT_FOUND' using errcode='P0001'; end if;
  update public.impersonation_sessions s set ended_at=now(), ended_by_auth_user_id=principal where s.actor_real_auth_user_id=principal and s.ended_at is null and s.expires_at <= now();
  if exists(select 1 from public.impersonation_sessions s where s.actor_real_auth_user_id=principal and s.ended_at is null) then raise exception 'IMPERSONATION_ALREADY_ACTIVE' using errcode='P0001'; end if;
  insert into public.impersonation_sessions(actor_real_auth_user_id,usuario_contexto_affiliate_id,reason,expires_at)
  values(principal,p_affiliate_id,btrim(p_reason),now()+interval '30 minutes') returning * into created;
  insert into public.identity_audit_log(actor_real_auth_user_id,usuario_contexto_affiliate_id,action,result,details)
  values(principal,p_affiliate_id,'IMPERSONATION_STARTED','SUCCESS',jsonb_build_object('session_id',created.id,'expires_at',created.expires_at,'reason',created.reason));
  return query select created.id, created.usuario_contexto_affiliate_id, created.expires_at;
end $$;

create or replace function public.get_impersonation_context()
returns table(session_id uuid, actor_real_auth_user_id uuid, usuario_contexto_affiliate_id uuid, reason text, expires_at timestamptz)
language sql stable security definer set search_path = '' as $$
 select s.id,s.actor_real_auth_user_id,s.usuario_contexto_affiliate_id,s.reason,s.expires_at
 from public.impersonation_sessions s where s.actor_real_auth_user_id=(select auth.uid()) and s.ended_at is null and s.expires_at>now()
 and public.has_admin_permission('affiliates.impersonate') limit 1 $$;

create or replace function public.get_effective_affiliate_id()
returns uuid language sql stable security definer set search_path = '' as $$ select coalesce(
 (select s.usuario_contexto_affiliate_id from public.impersonation_sessions s where s.actor_real_auth_user_id=(select auth.uid()) and s.ended_at is null and s.expires_at>now() and public.has_admin_permission('affiliates.impersonate') limit 1),
 (select a.id from public.affiliates a where a.auth_user_id=(select auth.uid()) limit 1)
) $$;

create or replace function public.search_affiliates_for_impersonation(p_query text)
returns table(id uuid, numero_control text, display_name text, full_name text, auth_eligibility text)
language plpgsql stable security definer set search_path = '' as $$ begin
 if not public.has_admin_permission('affiliates.read') then raise exception 'ADMIN_DENIED' using errcode='P0001'; end if;
 if char_length(btrim(coalesce(p_query,''))) < 2 then return; end if;
 return query select a.id,a.numero_control,a.display_name,a.full_name,a.auth_eligibility from public.affiliates a
 where a.numero_control ilike '%'||btrim(p_query)||'%' or a.display_name ilike '%'||btrim(p_query)||'%' or a.full_name ilike '%'||btrim(p_query)||'%'
 order by a.source_row_ordinal limit 20;
end $$;

create or replace function public.save_current_declared_payroll(p_gross_pay_per_fortnight numeric,p_deductions_per_fortnight numeric,p_expected_version integer default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_affiliate_id uuid; v_existing public.affiliate_payroll_declarations%rowtype; v_saved public.affiliate_payroll_declarations%rowtype;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  select id into v_affiliate_id from public.affiliates where auth_user_id=v_actor limit 1;
  if v_affiliate_id is null then raise exception 'AFFILIATE_IDENTITY_REQUIRED' using errcode='42501'; end if;
  if public.get_effective_affiliate_id() is distinct from v_affiliate_id or exists(select 1 from public.impersonation_sessions where actor_real_auth_user_id=v_actor and ended_at is null and expires_at>now()) then raise exception 'PAYROLL_DECLARATION_IMPERSONATION_DENIED' using errcode='42501'; end if;
  if p_gross_pay_per_fortnight is null or p_gross_pay_per_fortnight<=0 or p_gross_pay_per_fortnight>1000000 or p_deductions_per_fortnight is null or p_deductions_per_fortnight<0 or p_deductions_per_fortnight>=p_gross_pay_per_fortnight then raise exception 'PAYROLL_DECLARATION_INVALID' using errcode='22023'; end if;
  select * into v_existing from public.affiliate_payroll_declarations where affiliate_id=v_affiliate_id for update;
  if v_existing.affiliate_id is null then
    if coalesce(p_expected_version,0)<>0 then raise exception 'PAYROLL_DECLARATION_VERSION_CONFLICT' using errcode='40001'; end if;
    insert into public.affiliate_payroll_declarations(affiliate_id,gross_pay_per_fortnight,deductions_per_fortnight,updated_by_auth_user_id) values(v_affiliate_id,round(p_gross_pay_per_fortnight,2),round(p_deductions_per_fortnight,2),v_actor) returning * into v_saved;
  else
    if p_expected_version is null or p_expected_version<>v_existing.version then raise exception 'PAYROLL_DECLARATION_VERSION_CONFLICT' using errcode='40001'; end if;
    update public.affiliate_payroll_declarations set gross_pay_per_fortnight=round(p_gross_pay_per_fortnight,2),deductions_per_fortnight=round(p_deductions_per_fortnight,2),version=version+1,updated_at=now(),updated_by_auth_user_id=v_actor where affiliate_id=v_affiliate_id returning * into v_saved;
  end if;
  insert into public.affiliate_payroll_declaration_audit(affiliate_id,actor_real_auth_user_id,action,old_gross_pay_per_fortnight,old_deductions_per_fortnight,new_gross_pay_per_fortnight,new_deductions_per_fortnight,declaration_version)
  values(v_affiliate_id,v_actor,case when v_existing.affiliate_id is null then 'INSERT' else 'UPDATE' end,v_existing.gross_pay_per_fortnight,v_existing.deductions_per_fortnight,v_saved.gross_pay_per_fortnight,v_saved.deductions_per_fortnight,v_saved.version);
  return public.get_current_declared_payroll();
end $$;

revoke all on function public.start_affiliate_impersonation(uuid,text),public.get_impersonation_context(),public.get_effective_affiliate_id(),public.search_affiliates_for_impersonation(text),public.save_current_declared_payroll(numeric,numeric,integer) from public,anon;
grant execute on function public.start_affiliate_impersonation(uuid,text),public.get_impersonation_context(),public.get_effective_affiliate_id(),public.search_affiliates_for_impersonation(text),public.save_current_declared_payroll(numeric,numeric,integer) to authenticated;
drop function if exists public.is_active_admin();
drop function if exists public.get_current_loan_term_policy();
drop table if exists public.loan_term_policy;
commit;
