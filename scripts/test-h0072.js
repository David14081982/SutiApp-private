'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');

const read = (path) => fs.readFileSync(path, 'utf8');
const sql = read('supabase/migrations/20260821000300_create_visual_content_storage.sql');
const sourceRaw = fs.readFileSync('data/h0072-visual-source.json');
const source = JSON.parse(sourceRaw);
const sourceHash = crypto.createHash('sha256').update(sourceRaw).digest('hex').toUpperCase();
const importer = read('scripts/import-h0072-visual-content.py');
const visualRepo = read('app/visual-repositories.js');
const institutionalRepo = read('app/institutional-repositories.js');
const home = read('app/screens-home-r2.jsx');
const app = read('app/app.jsx');

assert.strictEqual(sourceHash, 'A677797640D181E42770204A5E1249D77CE6270989AEFCD8FC25644188ED56D3');
assert.strictEqual(source.companies.physical_rows, 1);
assert.strictEqual(source.companies.migrable_rows, 0);
assert.strictEqual(source.home_banners.rows.length, 10);
assert.strictEqual(source.marketplace_banners.rows.length, 13);
assert.strictEqual(source.convenio_assets.rows.length, 35);
assert.strictEqual(source.popup_candidates.rows.length, 3);
assert.strictEqual(source.local_branding.length, 4);

for (const table of ['app_assets', 'asset_sources', 'companies', 'company_assets', 'banners', 'popups']) {
  assert(sql.includes(`create table public.${table}`), `missing ${table}`);
  assert(sql.includes(`alter table public.${table} enable row level security`), `RLS missing ${table}`);
  assert(sql.includes(`alter table public.${table} force row level security`), `forced RLS missing ${table}`);
}
assert.match(sql, /category_raw text null/i);
assert.match(sql, /insert into storage\.buckets/i);
assert(sql.includes("'app-assets'"));
assert(sql.includes("'company-assets'"));
assert(sql.includes("'documents'"));
assert(!/grant\s+(insert|update|delete|all)/i.test(sql), 'client write grant found');
assert.match(sql, /asset_sources.*intentionally not readable/is);

assert(importer.includes('SUPABASE_SECRET_KEY'));
assert(importer.includes('SUPABASE_ACCESS_TOKEN'));
assert(!importer.includes('print(env'));
assert(!visualRepo.match(/\bDATA\b|localStorage|glide-prod/));
assert(!institutionalRepo.match(/\bimage_url\b.*select|\bdocument_url\b.*select/));
assert(home.includes("data-h0072-banner-state"));
assert(!home.includes('visual.homeBanners[0]'));
assert(home.includes('data-home-banner-dots') && home.includes('window.ImageViewer') && home.includes('window.openSafeContentUrl'));
assert(app.includes('window.useVisualContent()'));
assert(app.includes('visual.popups'));
assert(!app.includes('activeForScreen(currentScreen'));

const manifest = JSON.parse(read('manifest.webmanifest'));
assert.deepStrictEqual(manifest.icons.map((icon) => icon.src), ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png']);
for (const icon of manifest.icons) assert(fs.existsSync(icon.src), `missing ${icon.src}`);
assert(fs.existsSync('icon-180.png'));
require('./verification-helpers').assertPwaVersionSync();

console.log('H-007.2 static verification PASS: scoped Storage registry, raw categories, public-read RLS, no client writes, no visual DATA/localStorage fallback.');
