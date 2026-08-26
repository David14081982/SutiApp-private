'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const profile = JSON.parse(fs.readFileSync(path.join(root, 'data/h0071-catalog-profile.json'), 'utf8'));
const allowed = new Set([
  'AFFILIATE_SEGMENTATION', 'APP_CONFIGURATION', 'CONTENT_CONFIGURATION',
  'MARKETPLACE_CATALOG', 'PROGRAM_CATALOG', 'FINANCIAL_LEGACY',
  'GLIDE_HELPER', 'UNRESOLVED',
]);
const expectedCounts = {
  AFFILIATE_SEGMENTATION: 4,
  APP_CONFIGURATION: 2,
  CONTENT_CONFIGURATION: 1,
  MARKETPLACE_CATALOG: 10,
  PROGRAM_CATALOG: 1,
  FINANCIAL_LEGACY: 4,
  GLIDE_HELPER: 1,
  UNRESOLVED: 4,
};

assert.strictEqual(profile.contract.audit_only_non_authoritative, true);
assert.strictEqual(profile.contract.google_access, 'READ_ONLY');
assert.strictEqual(profile.contract.tables_created, 0);
assert.strictEqual(profile.contract.rows_migrated, 0);
assert.strictEqual(profile.subdomains.length, 27);
assert.strictEqual(new Set(profile.subdomains.map((row) => row.id)).size, 27);
assert(profile.subdomains.every((row) => allowed.has(row.classification)));
assert(profile.subdomains.every((row) => row.can_migrate_now === false));
assert(profile.subdomains.every((row) => row.current_writer && row.current_authority && row.future_authority && row.reason));

const actualCounts = Object.fromEntries([...allowed].map((name) => [name, 0]));
for (const row of profile.subdomains) actualCounts[row.classification] += 1;
assert.deepStrictEqual(actualCounts, expectedCounts);

const financial = profile.subdomains.filter((row) => row.classification === 'FINANCIAL_LEGACY');
assert.deepStrictEqual(financial.map((row) => row.id).sort(), [
  'payment_collection_status_assets', 'payment_terms_months',
  'raffle_payment_choices', 'real_estate_investment_modes',
]);
assert(profile.subdomains.find((row) => row.id === 'glide_operational_roles').reason.includes('not affiliate cargo'));
assert(profile.subdomains.find((row) => row.id === 'employee_categories').reason.includes('protected financial consumers'));
assert(profile.subdomains.find((row) => row.id === 'unions').reason.includes('protected financial consumers'));

const migrationNames = fs.readdirSync(path.join(root, 'supabase/migrations'));
assert.strictEqual(migrationNames.filter((name) => /0071|create_catalogs/i.test(name)).length, 0);
assert(migrationNames.some((name) => /program_catalog_cutover/i.test(name)), 'later ADR-037 catalog cutover evidence missing');
console.log('H-007.1 catalog reconciliation PASS: 19 sheets, 27 subdomains, 8 classifications, 0 migration candidates, Google read-only.');
