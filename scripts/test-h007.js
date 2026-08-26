'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const snapshotBytes = fs.readFileSync(path.join(root, 'data/h007-supabase-now-source.json'));
const snapshot = JSON.parse(snapshotBytes.toString('utf8'));
const sql = read('supabase/migrations/20260821000200_create_supabase_now_content.sql');
const repositories = read('app/institutional-repositories.js');
const controller = read('app/institutional-content.js');
const home = read('app/screens-home-r2.jsx');
const modules = read('app/screens-marketplace.jsx');
const store = read('app/sindicato-store.jsx');
const assets = read('app/assets-registry.jsx');
const data = read('app/data.jsx');
const bundle = read('app/bundle.js');

const expectedHash = '80910E831B93C324B55B3E10A225999B122EB6FBC1826F83FD8BA49A8D4ED915';
assert.strictEqual(crypto.createHash('sha256').update(snapshotBytes).digest('hex').toUpperCase(), expectedHash);
assert.deepStrictEqual({
  directory_members: snapshot.domains.directory.rows.length,
  minutes: snapshot.domains.minutes.rows.length,
  institutional_documents: snapshot.domains.institutional_documents.rows.length,
  institutional_programs: snapshot.domains.institutional_programs.rows.length,
}, { directory_members: 30, minutes: 5, institutional_documents: 8, institutional_programs: 17 });
assert.strictEqual(snapshot.source.excluded_financial_range, "'Secretaría de finanzas'!T:V");

for (const table of ['directory_members', 'minutes', 'institutional_documents', 'institutional_programs']) {
  assert(sql.includes(`create table public.${table}`), `missing table ${table}`);
  assert(sql.includes(`alter table public.${table} enable row level security`), `RLS missing ${table}`);
  assert(sql.includes(`alter table public.${table} force row level security`), `forced RLS missing ${table}`);
}
assert(sql.includes('grant select on table public.directory_members'));
assert(!/grant\s+(insert|update|delete|all)/i.test(sql), 'client write grant found');
assert(!/\b(inversion|inversión|rendimiento|total_rendimiento)\b/i.test(sql.replace(/intentionally excluded/gi, '')), 'financial field leaked into schema');

for (const source of [repositories, controller]) {
  assert(!/window\.DATA|localStorage|sessionStorage/.test(source), 'fallback/persistence found in Supabase content boundary');
}
assert(repositories.includes("'directory_members'"));
assert(controller.includes("phase: 'error'"));
assert(!/D\(\)\.comite/.test(home), 'home still reads committee mock');
assert(!/const\s+comite\s*=\s*\[/.test(data), 'committee mock remains in DATA');
assert(!/window\.DATA|localStorage|sessionStorage/.test(store), 'remaining union screens must use Supabase only');
const registry=read('app/union-screen-registry.js');
for (const id of ['categoria','antiguedad','jubilados']) assert(registry.includes("screen_key:'"+id+"'"), `remaining union screen missing: ${id}`);
assert(registry.includes("emergencias:'OBSOLETE'"),'Emergencias classification missing');
for (const retiredMock of ['Asamblea General — Mayo 2026', 'Estado financiero — 1er semestre 2026', 'Solicitud de ahorro voluntario']) {
  assert(!store.includes(retiredMock), `retired migrated mock remains: ${retiredMock}`);
}
assert(assets.includes('admin: !migrated'));
assert(modules.includes('MigratedModuloScreen'));
assert(modules.includes("'data-h007-content-block'"));

for (const marker of ['institutional-repositories.js', 'institutional-content.js', 'H007_MIGRATED_MODULE_IDS']) {
  assert(bundle.includes(marker), `bundle missing ${marker}`);
}
require('./verification-helpers').assertPwaVersionSync(root);
console.log('H-007 static verification PASS: 60/60 source rows, four isolated domains, RLS/public-read contract, no productive mock fallback.');
