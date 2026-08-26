begin;
create table public.company_benefit_profiles(
  company_id uuid primary key references public.companies(id) on delete cascade,
  category_label text not null default '', discount_percent integer not null default 0 check(discount_percent between 0 and 100),
  accent_hue integer not null default 210 check(accent_hue between 0 and 360), tags text[] not null default '{}', address text not null default '',
  favorite boolean not null default false, featured boolean not null default false, sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);
create table public.company_benefits(
  id uuid primary key default extensions.gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  label text not null, description text not null default '', enabled boolean not null default true, sort_order integer not null default 0,
  audience_mode text not null default 'all' check(audience_mode in('all','registered','segment')),
  union_codes text[] not null default '{}', employment_category_codes text[] not null default '{}', gender_codes text[] not null default '{}', tag_codes text[] not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index company_benefits_company_sort_idx on public.company_benefits(company_id,enabled,sort_order);
create trigger company_benefit_profiles_updated_at before update on public.company_benefit_profiles for each row execute function public.set_h0072_updated_at();
create trigger company_benefits_updated_at before update on public.company_benefits for each row execute function public.set_h0072_updated_at();
alter table public.company_benefit_profiles enable row level security;alter table public.company_benefit_profiles force row level security;
alter table public.company_benefits enable row level security;alter table public.company_benefits force row level security;
revoke all on public.company_benefit_profiles,public.company_benefits from public,anon,authenticated;
grant select on public.company_benefit_profiles,public.company_benefits to anon,authenticated;
grant insert,update,delete on public.company_benefit_profiles,public.company_benefits to authenticated;
create policy company_profiles_read on public.company_benefit_profiles for select to anon,authenticated using(public.can_view_company(company_id) or public.has_admin_permission('companies.read'));
create policy company_profiles_write on public.company_benefit_profiles for all to authenticated using(public.has_admin_permission('companies.write')) with check(public.has_admin_permission('companies.write'));
create policy company_benefits_read on public.company_benefits for select to anon,authenticated using((enabled and public.can_view_company(company_id) and public.matches_current_affiliate_audience(audience_mode,union_codes,employment_category_codes,gender_codes,tag_codes)) or public.has_admin_permission('companies.read'));
create policy company_benefits_write on public.company_benefits for all to authenticated using(public.has_admin_permission('companies.write')) with check(public.has_admin_permission('companies.write'));
create trigger company_benefit_profiles_admin_audit after insert or update or delete on public.company_benefit_profiles for each row execute function public.audit_admin_write();
create trigger company_benefits_admin_audit after insert or update or delete on public.company_benefits for each row execute function public.audit_admin_write();
comment on table public.company_benefit_profiles is 'Non-financial Claude presentation for Supabase companies.';
commit;
