'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');

const read = (path) => fs.readFileSync(path, 'utf8');
const sourceRaw = fs.readFileSync('data/icon-installation-source.json');
const source = JSON.parse(sourceRaw);
const hash = crypto.createHash('sha256').update(sourceRaw).digest('hex').toUpperCase();
const migration = read('supabase/migrations/20260821000400_create_app_settings.sql');
const repository = read('app/visual-repositories.js');
const content = read('app/visual-content.js');
const admin = read('app/screens-admin-branding.jsx');
const home = read('app/screens-home-r2.jsx');
const brand = read('app/brand.jsx');
const bundle = read('app/bundle.js');
const html = read('SutiApp.html');
const serviceWorker = read('sw.js');
const manifest = JSON.parse(read('manifest.webmanifest'));

assert.strictEqual(hash, '62C384D8E78D02181CCC52D22F812EF612A193D74B7784182EEBB8126A8473D4');
assert.strictEqual(source.install_screens.length, 3);
assert(source.install_screens.every((entry, index) => entry.position === index + 1 && entry.asset_key === null));
assert(migration.includes('create table public.app_settings'));
assert(migration.includes('alter table public.app_settings force row level security'));
assert(migration.includes('grant select on table public.app_settings to anon, authenticated'));
assert(!migration.match(/grant\s+(insert|update|delete|all)/i));
assert(!migration.match(/for\s+(insert|update|delete|all)\s+to\s+(anon|authenticated)/i));
assert(repository.includes('window.BrandingRepository'));
assert(repository.includes("list('app_settings'"));
assert(repository.includes('window.AssetRepository.publicUrl(row.app_icon_asset)'));
assert(content.includes('window.BrandingRepository.get()'));

for (const runtime of [admin, home, brand]) {
  assert(!runtime.match(/getSutiBranding|suti\.branding\.v1|brand-app-icon|brand-install-[123]|sutibranding/));
}
assert(!admin.match(/localStorage|image-slot|ImageSlotAPI/));
assert(admin.includes("'data-branding-source':'supabase'"));
assert.strictEqual((admin.match(/'data-install-position'/g) || []).length, 1);
assert(admin.includes('window.AdminRepository.updateSettings'));
assert(admin.includes('window.AdminRepository.uploadBrandingAsset'));
assert(home.includes('app.visual'));
assert(home.includes("'data-install-branding-state': 'loaded'"));
assert(brand.includes('institutional_seal_url'));
assert(bundle.includes('window.BrandingRepository'));
assert(bundle.includes("'data-branding-source': 'supabase'"));

assert.strictEqual(manifest.name, source.settings.app_name);
assert.strictEqual(manifest.short_name, source.settings.short_name);
assert.strictEqual(manifest.description, source.settings.description);
assert(html.includes(`<title>${source.settings.app_name}</title>`));
require('./verification-helpers').assertPwaVersionSync();
for (const path of ['icon-180.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png']) {
  assert(fs.statSync(path).size > 0);
}

console.log('Icon/installation static verification PASS: Supabase-only runtime, RLS admin writer, ordered install slots, reproducible PWA copies.');
