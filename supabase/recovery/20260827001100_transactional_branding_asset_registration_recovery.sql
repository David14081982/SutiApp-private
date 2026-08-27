begin;

revoke all on function public.register_branding_assets(jsonb) from public, anon, authenticated;
drop function if exists public.register_branding_assets(jsonb);

commit;

-- Recovery order: deploy the previous frontend first, then run this file.
-- This recovery changes no app_settings, app_assets, asset_sources or Storage rows.
