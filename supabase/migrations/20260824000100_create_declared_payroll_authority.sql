begin;

create table public.affiliate_payroll_declarations (
  affiliate_id uuid primary key references public.affiliates(id) on delete restrict,
  gross_pay_per_fortnight numeric(14,2) not null,
  deductions_per_fortnight numeric(14,2) not null,
  payment_period text not null default 'quincenal',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by_auth_user_id uuid not null references auth.users(id) on delete restrict,
  constraint affiliate_payroll_gross_check check (gross_pay_per_fortnight > 0 and gross_pay_per_fortnight <= 1000000),
  constraint affiliate_payroll_deductions_check check (deductions_per_fortnight >= 0 and deductions_per_fortnight < gross_pay_per_fortnight),
  constraint affiliate_payroll_period_check check (payment_period = 'quincenal'),
  constraint affiliate_payroll_version_check check (version > 0)
);

create table public.affiliate_payroll_declaration_audit (
  id bigint generated always as identity primary key,
  affiliate_id uuid not null references public.affiliates(id) on delete restrict,
  actor_real_auth_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('INSERT','UPDATE')),
  old_gross_pay_per_fortnight numeric(14,2),
  old_deductions_per_fortnight numeric(14,2),
  new_gross_pay_per_fortnight numeric(14,2) not null,
  new_deductions_per_fortnight numeric(14,2) not null,
  declaration_version integer not null check (declaration_version > 0),
  created_at timestamptz not null default now()
);

create index affiliate_payroll_audit_affiliate_idx
  on public.affiliate_payroll_declaration_audit(affiliate_id, created_at desc);

alter table public.affiliate_payroll_declarations enable row level security;
alter table public.affiliate_payroll_declarations force row level security;
alter table public.affiliate_payroll_declaration_audit enable row level security;
alter table public.affiliate_payroll_declaration_audit force row level security;

revoke all on public.affiliate_payroll_declarations, public.affiliate_payroll_declaration_audit
  from public, anon, authenticated;

create function public.get_current_declared_payroll()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_affiliate_id uuid := public.get_effective_affiliate_id();
  v_row public.affiliate_payroll_declarations%rowtype;
begin
  if auth.uid() is null or v_affiliate_id is null then
    raise exception 'AFFILIATE_IDENTITY_REQUIRED' using errcode = '42501';
  end if;

  select * into v_row
  from public.affiliate_payroll_declarations
  where affiliate_id = v_affiliate_id;

  if v_row.affiliate_id is null then
    return jsonb_build_object(
      'status', 'EMPTY',
      'source', 'SUPABASE_DECLARED_PAYROLL',
      'guidelinePercent', 30
    );
  end if;

  return jsonb_build_object(
    'status', 'READY',
    'source', 'SUPABASE_DECLARED_PAYROLL',
    'grossPayPerFortnight', v_row.gross_pay_per_fortnight,
    'deductionsPerFortnight', v_row.deductions_per_fortnight,
    'netPayPerFortnight', round(v_row.gross_pay_per_fortnight - v_row.deductions_per_fortnight, 2),
    'paymentPeriod', v_row.payment_period,
    'version', v_row.version,
    'updatedAt', v_row.updated_at,
    'guidelinePercent', 30
  );
end;
$$;

create function public.save_current_declared_payroll(
  p_gross_pay_per_fortnight numeric,
  p_deductions_per_fortnight numeric,
  p_expected_version integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_affiliate_id uuid;
  v_existing public.affiliate_payroll_declarations%rowtype;
  v_saved public.affiliate_payroll_declarations%rowtype;
begin
  if v_actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select id into v_affiliate_id
  from public.affiliates
  where auth_user_id = v_actor
  limit 1;

  if v_affiliate_id is null then
    raise exception 'AFFILIATE_IDENTITY_REQUIRED' using errcode = '42501';
  end if;

  if public.get_effective_affiliate_id() is distinct from v_affiliate_id or exists (
    select 1 from public.impersonation_sessions
    where actor_real_auth_user_id = v_actor and ended_at is null and expires_at > now()
  ) then
    raise exception 'PAYROLL_DECLARATION_IMPERSONATION_DENIED' using errcode = '42501';
  end if;

  if p_gross_pay_per_fortnight is null or p_gross_pay_per_fortnight <= 0 or p_gross_pay_per_fortnight > 1000000 or
     p_deductions_per_fortnight is null or p_deductions_per_fortnight < 0 or
     p_deductions_per_fortnight >= p_gross_pay_per_fortnight then
    raise exception 'PAYROLL_DECLARATION_INVALID' using errcode = '22023';
  end if;

  select * into v_existing
  from public.affiliate_payroll_declarations
  where affiliate_id = v_affiliate_id
  for update;

  if v_existing.affiliate_id is null then
    if coalesce(p_expected_version, 0) <> 0 then
      raise exception 'PAYROLL_DECLARATION_VERSION_CONFLICT' using errcode = '40001';
    end if;
    insert into public.affiliate_payroll_declarations(
      affiliate_id, gross_pay_per_fortnight, deductions_per_fortnight, updated_by_auth_user_id
    ) values (
      v_affiliate_id, round(p_gross_pay_per_fortnight, 2), round(p_deductions_per_fortnight, 2), v_actor
    ) returning * into v_saved;
  else
    if p_expected_version is null or p_expected_version <> v_existing.version then
      raise exception 'PAYROLL_DECLARATION_VERSION_CONFLICT' using errcode = '40001';
    end if;
    update public.affiliate_payroll_declarations set
      gross_pay_per_fortnight = round(p_gross_pay_per_fortnight, 2),
      deductions_per_fortnight = round(p_deductions_per_fortnight, 2),
      version = version + 1,
      updated_at = now(),
      updated_by_auth_user_id = v_actor
    where affiliate_id = v_affiliate_id
    returning * into v_saved;
  end if;

  insert into public.affiliate_payroll_declaration_audit(
    affiliate_id, actor_real_auth_user_id, action,
    old_gross_pay_per_fortnight, old_deductions_per_fortnight,
    new_gross_pay_per_fortnight, new_deductions_per_fortnight, declaration_version
  ) values (
    v_affiliate_id, v_actor, case when v_existing.affiliate_id is null then 'INSERT' else 'UPDATE' end,
    v_existing.gross_pay_per_fortnight, v_existing.deductions_per_fortnight,
    v_saved.gross_pay_per_fortnight, v_saved.deductions_per_fortnight, v_saved.version
  );

  return public.get_current_declared_payroll();
end;
$$;

create function public.get_current_declared_payroll_impact(p_payment_per_period numeric)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_affiliate_id uuid := public.get_effective_affiliate_id();
  v_row public.affiliate_payroll_declarations%rowtype;
  v_net numeric(14,2);
  v_remaining numeric(14,2);
  v_existing_percent numeric;
  v_loan_percent numeric;
begin
  if auth.uid() is null or v_affiliate_id is null then
    raise exception 'AFFILIATE_IDENTITY_REQUIRED' using errcode = '42501';
  end if;
  if p_payment_per_period is null or p_payment_per_period <= 0 or p_payment_per_period > 1000000 then
    raise exception 'PAYROLL_IMPACT_PAYMENT_INVALID' using errcode = '22023';
  end if;

  select * into v_row
  from public.affiliate_payroll_declarations
  where affiliate_id = v_affiliate_id;

  if v_row.affiliate_id is null then
    return jsonb_build_object(
      'status', 'EMPTY',
      'source', 'SUPABASE_DECLARED_PAYROLL',
      'guidelinePercent', 30
    );
  end if;

  v_net := round(v_row.gross_pay_per_fortnight - v_row.deductions_per_fortnight, 2);
  v_remaining := round(v_net - p_payment_per_period, 2);
  v_existing_percent := least(100, greatest(0, round((v_row.deductions_per_fortnight * 100 / v_row.gross_pay_per_fortnight)::numeric, 2)));
  v_loan_percent := least(100 - v_existing_percent, greatest(0, round((p_payment_per_period * 100 / v_row.gross_pay_per_fortnight)::numeric, 2)));

  return jsonb_build_object(
    'status', 'READY',
    'source', 'SUPABASE_DECLARED_PAYROLL',
    'grossPayPerFortnight', v_row.gross_pay_per_fortnight,
    'deductionsPerFortnight', v_row.deductions_per_fortnight,
    'netPayPerFortnight', v_net,
    'loanPaymentPerFortnight', round(p_payment_per_period, 2),
    'remainingNetPay', v_remaining,
    'loanToNetPercent', round((p_payment_per_period * 100 / v_net)::numeric, 1),
    'existingDeductionsBarPercent', v_existing_percent,
    'loanBarPercent', v_loan_percent,
    'remainingBarPercent', greatest(0, 100 - v_existing_percent - v_loan_percent),
    'guidelinePercent', 30,
    'withinGuideline', p_payment_per_period <= (v_net * 0.30),
    'paymentPeriod', v_row.payment_period,
    'version', v_row.version,
    'updatedAt', v_row.updated_at
  );
end;
$$;

revoke all on function public.get_current_declared_payroll() from public, anon;
revoke all on function public.save_current_declared_payroll(numeric,numeric,integer) from public, anon;
revoke all on function public.get_current_declared_payroll_impact(numeric) from public, anon;
grant execute on function public.get_current_declared_payroll() to authenticated;
grant execute on function public.save_current_declared_payroll(numeric,numeric,integer) to authenticated;
grant execute on function public.get_current_declared_payroll_impact(numeric) to authenticated;

comment on table public.affiliate_payroll_declarations is
  'Owner-authorized affiliate-declared fortnightly payroll input. It is not an official pay stub and never controls eligibility, approval, Google financial rules or payroll execution.';
comment on function public.get_current_declared_payroll_impact(numeric) is
  'Server-side informational projection using an authoritative quote payment and affiliate-declared payroll. The 30 percent guideline is informational only.';

notify pgrst, 'reload schema';
commit;
