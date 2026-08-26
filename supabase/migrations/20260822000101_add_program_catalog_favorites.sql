begin;
create table public.program_catalog_favorites (
  auth_user_id uuid not null,
  item_id uuid not null references public.program_catalog_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (auth_user_id,item_id)
);
alter table public.program_catalog_favorites enable row level security;
alter table public.program_catalog_favorites force row level security;
revoke all on public.program_catalog_favorites from public,anon,authenticated;
grant select,insert,delete on public.program_catalog_favorites to authenticated;
create policy program_catalog_favorites_self on public.program_catalog_favorites for all to authenticated using (auth_user_id=(select auth.uid())) with check (auth_user_id=(select auth.uid()));
comment on table public.program_catalog_favorites is 'Per-user interaction state for program catalog items; never catalog authority.';
commit;
