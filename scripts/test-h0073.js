'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');

const read = (path) => fs.readFileSync(path, 'utf8');
const raw = fs.readFileSync('data/h0073-companies-source.json');
const source = JSON.parse(raw);
const hash = crypto.createHash('sha256').update(raw).digest('hex').toUpperCase();
const importer = read('scripts/import-h0073-companies.py');
const repository = read('app/visual-repositories.js');
const screen = read('app/screens-convenios.jsx');

assert.strictEqual(hash, '41871AE58415B5654F37058BF361350E598B93DD8AFF9EF3BA07BC94ECA4718F');
assert.strictEqual(source.rows.length, 33);
assert.strictEqual(new Set(source.rows.map((row) => row.source_row_ordinal)).size, 33);
assert.strictEqual(source.rows.reduce((total, row) => total + row.asset_columns.length, 0), 35);
assert(source.rows.every((row) => row.name_raw && row.asset_columns.includes('E')));
assert(importer.includes('SUPABASE_SECRET_KEY'));
assert(!importer.includes('print(env'));
assert(repository.includes('company_assets(role,sort_order'));
assert(repository.includes('cover_url'));
assert(repository.includes('gallery_urls'));
assert(!repository.match(/glide-prod|localStorage|\bDATA\b/));
assert(screen.includes('app.visual'));
assert(screen.includes('data-h0073-company-count'));
assert(screen.includes('company.cover_url'));
assert(!screen.match(/glide-prod|localStorage|adminStore|companyStore|catalogStore|\bDATA\b/));
assert(screen.includes('visual.marketplaceBanners'));
assert(!screen.match(/anunciosLive|conveniosLive|conveniosCats/i));

console.log('H-007.3 static verification PASS: 33 immutable rows, 35 existing-asset links, Supabase-only repository/UI, no migrated-area fallback.');
