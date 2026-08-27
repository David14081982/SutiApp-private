'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

function env() {
  const out = {};
  for (const raw of fs.readFileSync(path.join(root, 'supabase.env'), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = raw.trim(); if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const at = line.indexOf('='); out[line.slice(0, at).trim()] = line.slice(at + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  return out;
}
async function request(url, options = {}) { const response = await fetch(url, options), text = await response.text(); let data; try { data = JSON.parse(text); } catch (_) { data = text; } return { status: response.status, data }; }
async function login(v, alias) { return request(v.SUPABASE_URL + '/auth/v1/token?grant_type=password', { method:'POST', headers:{ apikey:v.SUPABASE_PUBLISHABLE_KEY, 'Content-Type':'application/json' }, body:JSON.stringify({ email:v[alias + '_EMAIL'], password:v[alias + '_PASSWORD'] }) }); }
function catalog(v, token) { return request(v.SUPABASE_URL + '/functions/v1/financial-legacy', { method:'POST', headers:{ apikey:v.SUPABASE_PUBLISHABLE_KEY, Authorization:'Bearer ' + token, 'Content-Type':'application/json' }, body:JSON.stringify({ action:'catalog' }) }); }
const normalized = (value) => String(value == null ? '' : value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
function groups(rows, keyOf) { return Array.from(rows.reduce((map, row) => { const key = keyOf(row), list = map.get(key) || []; list.push(row); map.set(key, list); return map; }, new Map()).values()); }
function counts(rows, valueOf) { return Object.fromEntries(rows.reduce((map, row) => { const value = valueOf(row); map.set(value, (map.get(value) || 0) + 1); return map; }, new Map())); }

(async () => {
  const v = env();
  for (const key of ['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','H005_TEST_EMAIL','H005_TEST_PASSWORD','H005_TEST2_EMAIL','H005_TEST2_PASSWORD','H005_TEST3_EMAIL','H005_TEST3_PASSWORD']) assert(v[key], key + ' missing');
  const [admin, responsible, normal] = await Promise.all([login(v, 'H005_TEST'), login(v, 'H005_TEST2'), login(v, 'H005_TEST3')]);
  assert.equal(admin.status, 200); assert.equal(responsible.status, 200); assert.equal(normal.status, 200);
  const [allowed, deniedResponsible, deniedNormal, deniedAnonymous] = await Promise.all([
    catalog(v, admin.data.access_token), catalog(v, responsible.data.access_token), catalog(v, normal.data.access_token),
    request(v.SUPABASE_URL + '/functions/v1/financial-legacy', { method:'POST', headers:{ apikey:v.SUPABASE_PUBLISHABLE_KEY, 'Content-Type':'application/json' }, body:JSON.stringify({ action:'catalog' }) }),
  ]);
  assert.equal(allowed.status, 200, JSON.stringify(allowed.data));
  assert.equal(allowed.data.data.source, 'SUPABASE_FINANCIAL_CRITERIA');
  assert([401,403].includes(deniedResponsible.status), 'unauthorized responsible read allowed');
  assert([401,403].includes(deniedNormal.status), 'normal user read allowed');
  assert([401,403].includes(deniedAnonymous.status), 'anonymous read allowed');
  const rows = allowed.data.data.rules; assert(Array.isArray(rows) && rows.length > 0, 'empty catalog');
  assert(rows.every((row) => row.criterion_identity && row.program_id && row.fund && row.category && row.union));
  assert(rows.every((row) => ['AVAILABLE','SCHEDULED','UNAVAILABLE'].includes(row.status)));
  assert(rows.every((row) => ['AUTO','MOSTRAR','OCULTAR'].includes(row.visibility_mode)));
  assert(rows.every((row) => row.payment_period === 'quincenal'));
  const exactKey = (row) => [row.program_id,row.fund,row.union,row.category,row.max_amount,row.rate,row.payment_count,row.term_label,row.available_on || '',row.visibility_mode].map(normalized).join('|');
  const contextKey = (row) => [row.program_id,row.fund,row.union,row.category,row.available_on || ''].map(normalized).join('|');
  const valueKey = (row) => [row.max_amount,row.rate,row.payment_count,row.term_label,row.visibility_mode].map(normalized).join('|');
  const duplicateGroups = groups(rows, exactKey).filter((set) => set.length > 1);
  const conflictGroups = groups(rows, contextKey).filter((set) => new Set(set.map(valueKey)).size > 1);
  const conditionDifferenceGroups = groups(rows, (row) => [row.program_id,row.fund].map(normalized).join('|')).filter((set) => new Set(set.map((row) => [row.union,row.category,row.available_on || '',row.term_label].map(normalized).join('|'))).size > 1);
  console.log(JSON.stringify({
    status:'PASS', source:'SUPABASE_FINANCIAL_CRITERIA', total:rows.length,
    distinct:{ programs:new Set(rows.map((row) => row.program_id)).size, funds:new Set(rows.map((row) => row.fund)).size, unions:new Set(rows.map((row) => row.union)).size, categories:new Set(rows.map((row) => row.category)).size },
    availability:counts(rows, (row) => row.status), visibilityModes:counts(rows, (row) => row.visibility_mode), effectiveVisibility:counts(rows, (row) => row.effective_visibility),
    potentialDuplicateGroups:duplicateGroups.length, potentialConflictGroups:conflictGroups.length, conditionDifferenceGroups:conditionDifferenceGroups.length,
    unknownSemanticFields:['Concatenado','Ícono','Beneficiario','Simulación Interés a pagar total','Plazo para cálculo AD. NÓMINA','MOSTRAR PROGRAMA','FECHA AÑO'],
    permissions:{ authorizedAdmin:'ALLOWED', unauthorizedResponsible:'DENIED', normalUser:'DENIED', anonymous:'DENIED' },
    writes:{ google:0, supabaseFinancial:0, appsScript:0, businessRows:0, browser:0 },
  }));
})().catch((error) => { console.error(JSON.stringify({ status:'FAIL', error:error.message })); process.exit(1); });
