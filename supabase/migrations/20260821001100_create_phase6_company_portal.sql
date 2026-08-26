begin;

alter table public.admin_assignments drop constraint admin_assignments_permissions_check;
alter table public.admin_assignments add constraint admin_assignments_permissions_check check (permissions <@ array[
  'assets.read','assets.write','companies.read','companies.write','popups.read','popups.write',
  'banners.read','banners.write','documents.read','documents.write','affiliates.read','affiliates.impersonate',
  'news.read','news.write','content.read','content.write','marketplace.read','marketplace.write',
  'marketplace.quotes.read','marketplace.quotes.write','memberships.read','memberships.write',
  'company_portal.read','company_portal.write'
]::text[]);

do $$ declare admin_count integer;
begin
  select count(*) into admin_count from public.admin_assignments where enabled;
  if admin_count<>1 then raise exception 'PHASE6_ADMIN_PRECONDITION_FAILED: expected exactly one enabled assignment, found %',admin_count; end if;
  update public.admin_assignments set permissions=array(select distinct p from unnest(permissions||array['company_portal.read','company_portal.write']) p),updated_at=now() where enabled;
end $$;

create table public.company_portal_plans (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null check(length(btrim(name)) between 1 and 100),
  description text null check(description is null or length(description)<=300),
  monthly_price numeric(14,2) not null default 0 check(monthly_price>=0),
  annual_price numeric(14,2) not null default 0 check(annual_price>=0),
  max_products integer not null check(max_products between 1 and 999),
  allows_popups boolean not null default false,
  allows_stats_history boolean not null default false,
  benefits jsonb not null default '[]'::jsonb check(jsonb_typeof(benefits)='array'),
  enabled boolean not null default true,
  sort_order integer not null check(sort_order>0),
  record_origin text not null default 'ADMIN_PHASE6' check(record_origin='ADMIN_PHASE6'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.company_portal_subscriptions (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null unique references public.companies(id) on delete restrict,
  plan_id uuid null references public.company_portal_plans(id) on delete restrict,
  billing_cycle text null check(billing_cycle in ('monthly','annual')),
  status text not null default 'pending' check(status in ('pending','active','paused','expired')),
  starts_on date null,
  ends_on date null,
  record_origin text not null default 'ADMIN_PHASE6' check(record_origin='ADMIN_PHASE6'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_portal_subscription_dates check(
    (status='pending' and plan_id is null and billing_cycle is null and starts_on is null and ends_on is null)
    or (plan_id is not null and billing_cycle is not null and starts_on is not null and ends_on>=starts_on)
  )
);

create index company_portal_plans_sort_idx on public.company_portal_plans(enabled,sort_order);
create index company_portal_subscriptions_plan_idx on public.company_portal_subscriptions(plan_id,status);
create trigger company_portal_plans_updated_at before update on public.company_portal_plans for each row execute function public.set_h0072_updated_at();
create trigger company_portal_subscriptions_updated_at before update on public.company_portal_subscriptions for each row execute function public.set_h0072_updated_at();
create trigger company_portal_plans_admin_audit after insert or update or delete on public.company_portal_plans for each row execute function public.audit_admin_write();
create trigger company_portal_subscriptions_admin_audit after insert or update or delete on public.company_portal_subscriptions for each row execute function public.audit_admin_write();

alter table public.company_portal_plans enable row level security;
alter table public.company_portal_plans force row level security;
alter table public.company_portal_subscriptions enable row level security;
alter table public.company_portal_subscriptions force row level security;
revoke all on public.company_portal_plans,public.company_portal_subscriptions from public,anon,authenticated;
grant select,insert,update,delete on public.company_portal_plans,public.company_portal_subscriptions to authenticated;

create policy company_portal_plans_read on public.company_portal_plans for select to authenticated using(
  public.has_admin_permission('company_portal.read') or exists(
    select 1 from public.company_portal_subscriptions s where s.plan_id=id and public.is_marketplace_company_member(s.company_id)
  )
);
create policy company_portal_plans_admin_write on public.company_portal_plans for all to authenticated
using(public.has_admin_permission('company_portal.write')) with check(public.has_admin_permission('company_portal.write'));
create policy company_portal_subscriptions_read on public.company_portal_subscriptions for select to authenticated
using(public.has_admin_permission('company_portal.read') or public.is_marketplace_company_member(company_id));
create policy company_portal_subscriptions_admin_write on public.company_portal_subscriptions for all to authenticated
using(public.has_admin_permission('company_portal.write')) with check(public.has_admin_permission('company_portal.write'));

grant insert,update,delete on public.marketplace_company_memberships to authenticated;
create policy marketplace_memberships_admin_insert on public.marketplace_company_memberships for insert to authenticated
with check(public.has_admin_permission('company_portal.write'));
create policy marketplace_memberships_admin_update on public.marketplace_company_memberships for update to authenticated
using(public.has_admin_permission('company_portal.write')) with check(public.has_admin_permission('company_portal.write'));
create policy marketplace_memberships_admin_delete on public.marketplace_company_memberships for delete to authenticated
using(public.has_admin_permission('company_portal.write'));

comment on table public.company_portal_plans is 'Phase 6 Admin-authored commercial plans. Starts empty: no commercial terms were invented.';
comment on table public.company_portal_subscriptions is 'Single authoritative portal subscription per company; pending explicitly represents no approved commercial plan.';
commit;
