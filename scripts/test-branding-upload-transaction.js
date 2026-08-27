'use strict';

const assert = require('assert');
const fs = require('fs');

const read = (path) => fs.readFileSync(path, 'utf8');
const migration = read('supabase/migrations/20260827001100_transactional_branding_asset_registration.sql');
const recovery = read('supabase/recovery/20260827001100_transactional_branding_asset_registration_recovery.sql');
const repository = read('app/admin-repository.js');
const screen = read('app/screens-admin-branding.jsx');
const bundle = read('app/bundle.js');

assert(migration.includes('create or replace function public.register_branding_assets(p_assets jsonb)'));
assert(migration.includes('security definer') && migration.includes("set search_path = ''"));
assert(migration.includes("has_admin_permission('assets.write')"));
assert(migration.includes('from storage.objects o'));
assert(migration.includes('insert into public.asset_sources') && migration.includes('on conflict do nothing'));
assert(migration.includes('set app_icon_asset_id = v_asset_id, pwa_icon_512_asset_id = v_asset_id'));
assert(migration.includes('set favicon_asset_id = v_asset_id, pwa_icon_192_asset_id = v_asset_id'));
assert(migration.includes('revoke all on function public.register_branding_assets(jsonb) from public, anon, authenticated'));
assert(migration.includes('grant execute on function public.register_branding_assets(jsonb) to authenticated'));
assert(recovery.includes('drop function if exists public.register_branding_assets(jsonb)'));

assert(repository.includes("db.rpc('register_branding_assets'"));
assert(!repository.includes("from('asset_sources').upsert"));
assert(repository.includes('normalizedPng(file,512,'));
assert(repository.includes('normalizedPng(file,192,'));
assert(repository.includes('normalizedPng(file,180,'));
assert(repository.includes("'brand.favicon-pwa-192':192"));
assert(repository.includes("{assetKey:'brand.pwa.maskable-512',file:variants[0]}"));
assert(repository.includes('removeUnlinkedObject'));
assert(screen.includes("'data-branding-asset-error':field"));
assert(screen.includes("role:'alert'"));
assert(!screen.includes("alert('No fue posible guardar el archivo.')"));

assert(bundle.includes("db.rpc('register_branding_assets'"));
assert(bundle.includes('data-branding-asset-error'));

const sync = read('scripts/sync-icon-installation.py');
assert(sync.includes('REQUIRED_ASSET_COLUMNS'));
assert(sync.includes('STATIC_DIMENSIONS'));
assert(sync.includes('png_dimensions(data)'));

console.log('Branding upload transaction static verification PASS.');
