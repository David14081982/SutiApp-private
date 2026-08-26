begin;

create table public.app_settings (
  id text primary key,
  app_name text not null,
  short_name text not null,
  description text not null,
  app_icon_asset_id uuid not null references public.app_assets(id) on delete restrict,
  institutional_seal_asset_id uuid null references public.app_assets(id) on delete restrict,
  favicon_asset_id uuid not null references public.app_assets(id) on delete restrict,
  apple_touch_asset_id uuid not null references public.app_assets(id) on delete restrict,
  pwa_icon_192_asset_id uuid not null references public.app_assets(id) on delete restrict,
  pwa_icon_512_asset_id uuid not null references public.app_assets(id) on delete restrict,
  pwa_maskable_512_asset_id uuid not null references public.app_assets(id) on delete restrict,
  install_screen_1_asset_id uuid null references public.app_assets(id) on delete restrict,
  install_screen_2_asset_id uuid null references public.app_assets(id) on delete restrict,
  install_screen_3_asset_id uuid null references public.app_assets(id) on delete restrict,
  source_snapshot_hash text not null,
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton_check check (id = 'primary'),
  constraint app_settings_name_check check (length(trim(app_name)) between 1 and 80),
  constraint app_settings_short_name_check check (length(trim(short_name)) between 1 and 30),
  constraint app_settings_description_check check (length(trim(description)) between 1 and 240),
  constraint app_settings_source_hash_check check (source_snapshot_hash ~ '^[A-F0-9]{64}$')
);

create trigger app_settings_set_updated_at before update on public.app_settings
for each row execute function public.set_h0072_updated_at();

alter table public.app_settings enable row level security;
alter table public.app_settings force row level security;
revoke all on table public.app_settings from public, anon, authenticated;
grant select on table public.app_settings to anon, authenticated;
create policy app_settings_public_read on public.app_settings
for select to anon, authenticated using (id = 'primary');

insert into public.app_settings (
  id, app_name, short_name, description,
  app_icon_asset_id, favicon_asset_id, apple_touch_asset_id,
  pwa_icon_192_asset_id, pwa_icon_512_asset_id, pwa_maskable_512_asset_id,
  source_snapshot_hash
)
select
  'primary',
  'SutiApp — SUTISSSTESON',
  'SutiApp',
  'App de afiliados SUTISSSTESON: créditos, ahorro, convenios y servicios sindicales.',
  icon_512.id,
  icon_192.id,
  apple_touch.id,
  icon_192.id,
  icon_512.id,
  maskable.id,
  '62C384D8E78D02181CCC52D22F812EF612A193D74B7784182EEBB8126A8473D4'
from public.app_assets icon_512
join public.app_assets icon_192 on icon_192.asset_key = 'brand.favicon-pwa-192'
join public.app_assets apple_touch on apple_touch.asset_key = 'brand.pwa.apple-touch'
join public.app_assets maskable on maskable.asset_key = 'brand.pwa.maskable-512'
where icon_512.asset_key = 'brand.pwa.512';

do $$
begin
  if (select count(*) from public.app_settings) <> 1 then
    raise exception 'H icon-install bootstrap requires all four approved H-007.2 branding assets';
  end if;
end;
$$;

comment on table public.app_settings is 'Public runtime branding/install configuration. Browser writes remain disabled until real Admin Auth and authorization exist.';
comment on column public.app_settings.install_screen_1_asset_id is 'Explicit position 1; order is not derived from a filename.';
comment on column public.app_settings.install_screen_2_asset_id is 'Explicit position 2; order is not derived from a filename.';
comment on column public.app_settings.install_screen_3_asset_id is 'Explicit position 3; order is not derived from a filename.';

commit;
