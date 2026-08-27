'use strict';

const assert = require('assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const migrationPath = path.join(root, 'supabase', 'migrations', '20260827000100_financial_criteria_supabase_cutover.sql');
const recoveryPath = path.join(root, 'supabase', 'recovery', '20260827000100_financial_criteria_supabase_cutover_recovery.sql');
const importerPatchPath = path.join(root, 'supabase', 'migrations', '20260827000200_financial_import_effective_rate_equivalence.sql');
const serviceBoundaryPatchPath = path.join(root, 'supabase', 'migrations', '20260827000300_financial_service_role_import_boundary.sql');
const fundGroupingPatchPath = path.join(root, 'supabase', 'migrations', '20260827000400_financial_import_fund_grouping.sql');
const shadowCanaryPatchPath = path.join(root, 'supabase', 'migrations', '20260827000500_financial_shadow_edge_canary.sql');
const shadowCanaryRecoveryPath = path.join(root, 'supabase', 'recovery', '20260827000500_financial_shadow_edge_canary_recovery.sql');
const canaryTransitionPath = path.join(root, 'supabase', 'migrations', '20260827000510_financial_canary_authority_transition.sql');
const retryCutoverPath = path.join(root, 'supabase', 'migrations', '20260827000600_retry_financial_supabase_cutover.sql');
const finalCleanupPath = path.join(root, 'supabase', 'migrations', '20260827000700_remove_financial_cutover_canary.sql');
const finalCleanupRecoveryPath = path.join(root, 'supabase', 'recovery', '20260827000700_remove_financial_cutover_canary_recovery.sql');
const mode = process.argv[2] || 'status';
const allowedModes = new Set(['dry-run', 'recovery-dry-run', 'canary-dry-run', 'retry-dry-run', 'final-cleanup-dry-run', 'final-cleanup', 'apply-model', 'stage', 'verify', 'activate', 'retry-cutover', 'recover', 'status', 'inspect-permissions', 'diagnose-runtime', 'diagnose-rest', 'shadow-rpc']);
if (!allowedModes.has(mode)) throw new Error('USAGE: dry-run|recovery-dry-run|canary-dry-run|retry-dry-run|final-cleanup-dry-run|final-cleanup|apply-model|stage|verify|activate|retry-cutover|recover|status|inspect-permissions|diagnose-runtime|diagnose-rest|shadow-rpc');

function env() {
  return Object.fromEntries(fs.readFileSync(path.join(root, 'supabase.env'), 'utf8').split(/\r?\n/)
    .map((line) => line.trim()).filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => { const index = line.indexOf('='); let value = line.slice(index + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      return [line.slice(0, index).trim(), value]; }));
}

function transactionBody(file) {
  const sql = fs.readFileSync(file, 'utf8').trim();
  if (!/^begin;/i.test(sql) || !/commit;$/i.test(sql)) throw new Error('TRANSACTION_BOUNDARY_MISSING');
  return sql.replace(/^begin;/i, '').replace(/commit;$/i, '');
}

async function db(values, sql) {
  const ref = new URL(values.SUPABASE_URL).hostname.split('.')[0];
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${values.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'SutiApp-Financial-Cutover/1.0' },
    body: JSON.stringify({ query: sql }),
  });
  const text = await response.text(); let body;
  try { body = JSON.parse(text); } catch (_) { body = { message: text.slice(0, 500) }; }
  if (!response.ok) throw new Error(`DATABASE_QUERY_${response.status}:${String(body.message || body.error || text).slice(0, 700)}`);
  return body;
}

const normalize = (value) => String(value == null ? '' : value).trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').toUpperCase();
const slug = (value) => normalize(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
const hash = (value) => crypto.createHash('sha256').update(canonical(value)).digest('hex').toUpperCase();
const sqlText = (value) => `'${String(value).replace(/'/g, "''")}'`;
const cell = (row, index) => row && Array.isArray(row.c) && row.c[index] ? (row.c[index].v ?? row.c[index].f ?? null) : null;

async function login(values) {
  const response = await fetch(`${values.SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: values.SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: values.H005_TEST_EMAIL, password: values.H005_TEST_PASSWORD }) });
  const body = await response.json();
  if (!response.ok || !body.access_token) throw new Error('CUTOVER_ADMIN_LOGIN_FAILED');
  return body.access_token;
}

async function googleSnapshot(values) {
  const token = await login(values);
  const catalogResponse = await fetch(`${values.SUPABASE_URL}/functions/v1/financial-legacy`, { method: 'POST', headers: { apikey: values.SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'catalog' }) });
  const catalogBody = await catalogResponse.json();
  if (!catalogResponse.ok || !Array.isArray(catalogBody?.data?.rules)) throw new Error('GOOGLE_CATALOG_SNAPSHOT_FAILED');
  const catalog = catalogBody.data.rules;
  assert.equal(catalog.length, 146, 'GOOGLE_RULE_COUNT_MISMATCH');
  assert.equal(catalogBody.data.source, 'GOOGLE_LEGACY', 'STAGE_REQUIRES_GOOGLE_AUTHORITY');

  const spreadsheetId = '1Vxy84N7mzbuioTmWhjRD2QFboDx--rG3iUwmLuyeY80';
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent('Criterios de fondos')}&range=${encodeURIComponent('A2:O')}`;
  const response = await fetch(url, { headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' } });
  const raw = await response.text(); const start = raw.indexOf('{'); const end = raw.lastIndexOf('}');
  if (!response.ok || start < 0 || end <= start) throw new Error('GOOGLE_GVIZ_SNAPSHOT_FAILED');
  const gvizRows = JSON.parse(raw.slice(start, end + 1))?.table?.rows || [];
  const bySheetRow = new Map(catalog.map((rule) => [Number(rule.sheet_row), rule]));
  const labels = await db(values, "select catalog_type,code,label from public.segmentation_catalog_entries where catalog_type in('union','employment_category') and enabled order by catalog_type,code");
  const unionCodes = new Map(labels.filter((entry) => entry.catalog_type === 'union').map((entry) => [normalize(entry.label), entry.code]));
  const categoryCodes = new Map(labels.filter((entry) => entry.catalog_type === 'employment_category').map((entry) => [normalize(entry.label), entry.code]));
  const draft = [];
  for (let index = 0; index < gvizRows.length; index += 1) {
    const sheetRow = index + 2; const current = bySheetRow.get(sheetRow);
    if (!current) continue;
    const source = gvizRows[index];
    const category = String(cell(source, 0) ?? '').trim(); const union = String(cell(source, 1) ?? '').trim();
    const fund = String(cell(source, 2) ?? '').trim(); const maxAmount = Number(cell(source, 3)); const rawRate = Number(cell(source, 4));
    const termLabel = String(cell(source, 5) ?? '').trim(); const sourceDateH = String(cell(source, 7) ?? ''); const sourceDateN = String(cell(source, 13) ?? '');
    const identityCanonical = [category, union, fund, String(maxAmount), String(rawRate), termLabel, current.available_on || ''].join('\u001f');
    const identity = `CRITERIA_V1:${sheetRow}:${crypto.createHash('sha256').update(JSON.stringify(identityCanonical)).digest('hex').toUpperCase()}`;
    // financial-legacy hashes canonicalJson(string), which is JSON.stringify(string).
    assert.equal(identity, current.criterion_identity, `IDENTITY_MISMATCH_ROW_${sheetRow}`);
    assert.equal(Number(current.max_amount), maxAmount, `MAX_AMOUNT_MISMATCH_ROW_${sheetRow}`);
    assert.equal(String(current.term_label), termLabel, `TERM_MISMATCH_ROW_${sheetRow}`);
    const unionCode = unionCodes.get(normalize(union)); const categoryCode = categoryCodes.get(normalize(category));
    assert(unionCode && categoryCode, `SEGMENTATION_MAPPING_MISSING_ROW_${sheetRow}`);
    const consumed = { category, union, fund, max_amount: maxAmount, raw_rate: rawRate, term_label: termLabel,
      source_date_h: sourceDateH, source_date_n: sourceDateN, available_on: current.available_on || null,
      visibility_mode: current.visibility_mode };
    const fortnightTerm = termLabel.match(/^(\d+)\s*(?:QNAS?|QUINCENAS?)/i);
    const monthTerm = termLabel.match(/^(\d+)\s*MESES?/i);
    const maxTerm = fortnightTerm ? Number(fortnightTerm[1]) : monthTerm ? Number(monthTerm[1]) : 0;
    assert(maxTerm > 0, `TERM_PARSE_FAILED_ROW_${sheetRow}`);
    draft.push({ program_id: current.program_id, fund_code: slug(fund), fund, fund_order: sheetRow,
      union_code: unionCode, union_label: union, category_code: categoryCode, category_label: category,
      max_amount: maxAmount, raw_rate: rawRate, rate_percent: Number(current.rate), term_label: termLabel, payment_count: Number(current.payment_count),
      max_term: maxTerm, source_date_h: sourceDateH, source_date_n: sourceDateN,
      available_on: current.available_on || null, visibility_mode: current.visibility_mode, legacy_sheet_row: sheetRow,
      legacy_criterion_identity: current.criterion_identity, source_snapshot_hash: hash(consumed), review_signals: [] });
  }
  assert.equal(draft.length, 146, 'JOINED_RULE_COUNT_MISMATCH');
  const groups = (keyOf) => draft.reduce((map, row) => { const key = keyOf(row); const value = map.get(key) || []; value.push(row); map.set(key, value); return map; }, new Map());
  const exactKey = (row) => [row.program_id, row.fund, row.union_label, row.category_label, row.max_amount, row.rate_percent, row.payment_count, row.term_label, row.available_on || '', row.visibility_mode].map(normalize).join('|');
  const contextKey = (row) => [row.program_id, row.fund, row.union_label, row.category_label, row.available_on || ''].map(normalize).join('|');
  const valueKey = (row) => [row.max_amount, row.rate_percent, row.payment_count, row.term_label, row.visibility_mode].map(normalize).join('|');
  const exact = groups(exactKey); const contexts = groups(contextKey);
  for (const row of draft) {
    if (exact.get(exactKey(row)).length > 1) row.review_signals.push('DUPLICATE');
    if (new Set(contexts.get(contextKey(row)).map(valueKey)).size > 1) row.review_signals.push('CONFLICT');
  }
  const duplicateGroups = [...exact.values()].filter((rows) => rows.length > 1).length;
  const conflictGroups = [...contexts.values()].filter((rows) => new Set(rows.map(valueKey)).size > 1).length;
  assert.equal(duplicateGroups, 2, 'DUPLICATE_GROUP_COUNT_MISMATCH'); assert.equal(conflictGroups, 1, 'CONFLICT_GROUP_COUNT_MISMATCH');
  return { rules: draft, sourceSnapshotHash: hash(draft.map((row) => ({ legacy_sheet_row: row.legacy_sheet_row, source_snapshot_hash: row.source_snapshot_hash }))), catalog };
}

async function modelStatus(values) {
  const exists = (await db(values, "select to_regclass('public.financial_programs') is not null as model_applied"))[0].model_applied;
  if (!exists) return { model_applied: false, authority: null, imported_rules: 0, imported_funds: 0, source_snapshot_hash: null };
  return (await db(values, `select true as model_applied,
    (select authority from public.financial_criteria_authority where id='primary') as authority,
    (select count(*) from public.financial_rules where imported_batch_id is not null)::integer as imported_rules,
    (select count(*) from public.financial_funds where imported_batch_id is not null)::integer as imported_funds,
    (select source_snapshot_hash from public.financial_criteria_import_batches order by imported_at desc limit 1) as source_snapshot_hash,
    to_regprocedure('public.get_financial_shadow_runtime_rules()') is not null as shadow_canary_applied,
    obj_description(to_regprocedure('public.get_financial_shadow_runtime_rules()'),'pg_proc') as shadow_canary_version,
    obj_description('public.stage_financial_criteria_import(jsonb,text)'::regprocedure,'pg_proc') as importer_version`))[0];
}

async function verify(values, snapshot) {
  const rows = await db(values, `select r.legacy_sheet_row,r.legacy_criterion_identity,r.source_snapshot_hash,r.program_id,f.code fund_code,f.name fund,
    r.financial_union_code union_code,r.financial_union_label union_label,r.financial_employee_category_code category_code,
    r.financial_employee_category_label category_label,r.max_amount,r.raw_rate,r.rate_factor,r.rate_percent,r.term_label,r.payment_count,
    r.max_term,coalesce(r.source_date_h,'') source_date_h,coalesce(r.source_date_n,'') source_date_n,r.available_on,r.visibility_mode,r.review_signals
    from public.financial_rules r join public.financial_funds f on f.id=r.fund_id
    join public.financial_criteria_import_batches b on b.id=r.imported_batch_id
    where b.source_snapshot_hash=${sqlText(snapshot.sourceSnapshotHash)} order by r.legacy_sheet_row`);
  assert.equal(rows.length, 146, 'SUPABASE_RULE_COUNT_MISMATCH');
  const expectedByRow = new Map(snapshot.rules.map((row) => [row.legacy_sheet_row, row]));
  for (const actual of rows) {
    const expected = expectedByRow.get(Number(actual.legacy_sheet_row)); assert(expected, `UNEXPECTED_SUPABASE_ROW_${actual.legacy_sheet_row}`);
    for (const key of ['legacy_criterion_identity','source_snapshot_hash','program_id','fund_code','fund','union_code','union_label','category_code','category_label','term_label','source_date_h','source_date_n','visibility_mode']) {
      assert.equal(String(actual[key] ?? ''), String(expected[key] ?? ''), `${key.toUpperCase()}_MISMATCH_ROW_${actual.legacy_sheet_row}`);
    }
    for (const key of ['max_amount','payment_count','max_term']) assert.equal(Number(actual[key]), Number(expected[key]), `${key.toUpperCase()}_MISMATCH_ROW_${actual.legacy_sheet_row}`);
    assert(Math.abs(Number(actual.raw_rate) - Number(expected.raw_rate)) < 1e-8, `RAW_RATE_MISMATCH_ROW_${actual.legacy_sheet_row}`);
    assert.equal(Number(actual.rate_percent), Number(expected.rate_percent), `RATE_PERCENT_MISMATCH_ROW_${actual.legacy_sheet_row}`);
    assert.equal(String(actual.available_on || ''), String(expected.available_on || ''), `DATE_MISMATCH_ROW_${actual.legacy_sheet_row}`);
    assert.deepEqual((actual.review_signals || []).slice().sort(), expected.review_signals.slice().sort(), `SIGNALS_MISMATCH_ROW_${actual.legacy_sheet_row}`);
  }
  const summary = (await db(values, `select b.id batch_id,b.rule_count,b.fund_count,b.duplicate_group_count,b.conflict_group_count,b.status,b.source_snapshot_hash,
    (select count(*) from public.financial_programs)::integer program_count,
    not has_table_privilege('authenticated','public.financial_rules','select,insert,update,delete') as authenticated_tables_denied,
    not has_table_privilege('anon','public.financial_rules','select,insert,update,delete') as anonymous_tables_denied,
    has_function_privilege('authenticated','public.get_financial_admin_catalog()','execute') as admin_rpc_executable,
    not has_function_privilege('anon','public.get_financial_admin_catalog()','execute') as anonymous_admin_rpc_denied
    from public.financial_criteria_import_batches b where b.source_snapshot_hash=${sqlText(snapshot.sourceSnapshotHash)}`))[0];
  assert.equal(Number(summary.rule_count), 146); assert.equal(Number(summary.fund_count), 35); assert.equal(Number(summary.program_count), 3);
  assert.equal(Number(summary.duplicate_group_count), 2); assert.equal(Number(summary.conflict_group_count), 1);
  assert(summary.authenticated_tables_denied && summary.anonymous_tables_denied && summary.admin_rpc_executable && summary.anonymous_admin_rpc_denied, 'SECURITY_GATE_FAILED');
  return summary;
}

(async () => {
  const values = env();
  if (mode === 'inspect-permissions') {
    const rows = await db(values, `select pg_get_constraintdef(oid) definition from pg_constraint where conrelid='public.admin_assignments'::regclass and conname='admin_assignments_permissions_check'`);
    console.log(JSON.stringify({ status: 'PASS', definition: rows[0]?.definition || null })); return;
  }
  if (mode === 'dry-run') {
    const result = await db(values, `begin;${transactionBody(migrationPath)}rollback;select true as dry_run`);
    assert.equal(result[0]?.dry_run, true); console.log(JSON.stringify({ status: 'PASS', migrationDryRun: true, persistentChanges: 0 })); return;
  }
  if (mode === 'recovery-dry-run') {
    const status = await modelStatus(values); const forward = status.model_applied ? '' : transactionBody(migrationPath);
    const result = await db(values, `begin;${forward}${transactionBody(recoveryPath)}rollback;select true as recovery_dry_run`);
    assert.equal(result[0]?.recovery_dry_run, true); console.log(JSON.stringify({ status: 'PASS', recoveryDryRun: true, persistentChanges: 0 })); return;
  }
  if (mode === 'canary-dry-run') {
    const result = await db(values, `begin;${transactionBody(shadowCanaryPatchPath)}${transactionBody(shadowCanaryRecoveryPath)}rollback;select true as canary_recovery_dry_run`);
    assert.equal(result[0]?.canary_recovery_dry_run, true); console.log(JSON.stringify({ status:'PASS', canaryRecoveryDryRun:true, persistentChanges:0 })); return;
  }
  if (mode === 'retry-dry-run') {
    const result = await db(values, `begin;${transactionBody(retryCutoverPath)}${transactionBody(recoveryPath)}rollback;select true as retry_recovery_dry_run`);
    assert.equal(result[0]?.retry_recovery_dry_run, true); console.log(JSON.stringify({ status:'PASS', retryRecoveryDryRun:true, persistentChanges:0 })); return;
  }
  if (mode === 'final-cleanup-dry-run') {
    const result = await db(values, `begin;${transactionBody(finalCleanupPath)}${transactionBody(finalCleanupRecoveryPath)}rollback;select true as final_cleanup_recovery_dry_run`);
    assert.equal(result[0]?.final_cleanup_recovery_dry_run, true);
    console.log(JSON.stringify({ status:'PASS', finalCleanupRecoveryDryRun:true, persistentChanges:0 })); return;
  }
  if (mode === 'final-cleanup') {
    const before = await modelStatus(values); assert.equal(before.authority, 'SUPABASE', 'FINAL_CLEANUP_REQUIRES_SUPABASE');
    if (before.shadow_canary_applied) await db(values, fs.readFileSync(finalCleanupPath, 'utf8'));
    const after = await modelStatus(values); assert.equal(after.authority, 'SUPABASE'); assert.equal(after.shadow_canary_applied, false);
    console.log(JSON.stringify({ status:'PASS', authority:after.authority, shadowCanaryRemoved:true, googleWrites:0 })); return;
  }
  if (mode === 'status') { console.log(JSON.stringify({ status: 'PASS', ...(await modelStatus(values)) })); return; }
  if (mode === 'diagnose-rest') {
    const endpoint = `${values.SUPABASE_URL}/rest/v1/rpc/get_financial_runtime_rules`;
    const response = await fetch(endpoint, {
      method:'POST', headers:{ apikey:values.SUPABASE_PUBLISHABLE_KEY, 'Content-Type':'application/json' }, body:'{}',
    });
    const body = await response.json().catch(() => ({}));
    const serviceResponse = await fetch(endpoint, {
      method:'POST', headers:{ apikey:values.SUPABASE_SECRET_KEY, Authorization:`Bearer ${values.SUPABASE_SECRET_KEY}`, 'Content-Type':'application/json' }, body:'{}',
    });
    const serviceBody = await serviceResponse.json().catch(() => ({}));
    console.log(JSON.stringify({ status:'PASS', anonymous:{ httpStatus:response.status, code:String(body.code || ''), message:String(body.message || '').slice(0,200) },
      service:{ httpStatus:serviceResponse.status, code:String(serviceBody.code || ''), message:String(serviceBody.message || '').slice(0,200), array:Array.isArray(serviceBody), rows:Array.isArray(serviceBody)?serviceBody.length:0 }, persistentChanges:0 })); return;
  }
  if (mode === 'shadow-rpc') {
    const response = await fetch(`${values.SUPABASE_URL}/rest/v1/rpc/get_financial_shadow_runtime_rules`, {
      method:'POST', headers:{ apikey:values.SUPABASE_SECRET_KEY, Authorization:`Bearer ${values.SUPABASE_SECRET_KEY}`, 'Content-Type':'application/json' }, body:'{}',
    });
    const body = await response.json().catch(() => ({}));
    assert.equal(response.status, 200, `SHADOW_RPC_${response.status}:${String(body.message || body.code || '').slice(0,200)}`);
    assert(Array.isArray(body), 'SHADOW_RPC_SHAPE'); assert.equal(body.length, 146, 'SHADOW_RPC_RULE_COUNT');
    console.log(JSON.stringify({ status:'PASS', edgeBoundary:'service_role->get_financial_shadow_runtime_rules', rows:body.length, persistentChanges:0 })); return;
  }
  if (mode === 'diagnose-runtime') {
    const result = await db(values, `begin;
      update public.financial_criteria_authority a set authority='SUPABASE',active_import_batch_id=b.id,
        source_snapshot_hash=b.source_snapshot_hash,changed_at=now(),changed_reason='ROLLBACK-ONLY RUNTIME DIAGNOSTIC'
      from public.financial_criteria_import_batches b
      where a.id='primary' and b.source_snapshot_hash=(select source_snapshot_hash from public.financial_criteria_import_batches order by imported_at desc limit 1);
      do $$ declare v_rules jsonb; begin
        v_rules:=public.get_financial_runtime_rules();
        if jsonb_array_length(v_rules)<>146 then raise exception 'RUNTIME_RULE_COUNT_MISMATCH:%',jsonb_array_length(v_rules); end if;
      end $$;
      rollback;
      select true as runtime_db_pass,(select authority from public.financial_criteria_authority where id='primary') as authority`);
    assert.equal(result[0]?.runtime_db_pass, true); assert.equal(result[0]?.authority, 'GOOGLE_SHADOW');
    console.log(JSON.stringify({ status:'PASS', runtimeDbRows:146, authority:result[0].authority, persistentChanges:0 })); return;
  }
  if (mode === 'recover') {
    const before = await modelStatus(values);
    if (before.authority === 'SUPABASE') await db(values, fs.readFileSync(recoveryPath, 'utf8'));
    const after = await modelStatus(values); assert.equal(after.authority, 'GOOGLE_SHADOW');
    console.log(JSON.stringify({ status: 'PASS', recovered: before.authority === 'SUPABASE', authority: after.authority, importedRulesPreserved: after.imported_rules })); return;
  }
  if (mode === 'retry-cutover') {
    const before=await modelStatus(values); assert.equal(before.authority,'GOOGLE_SHADOW','RETRY_REQUIRES_GOOGLE_SHADOW');
    await db(values,fs.readFileSync(retryCutoverPath,'utf8'));
    const after=await modelStatus(values);assert.equal(after.authority,'SUPABASE');
    console.log(JSON.stringify({status:'PASS',authority:after.authority,source_snapshot_hash:after.source_snapshot_hash,googleWrites:0}));return;
  }
  if (mode === 'apply-model') {
    const before = await modelStatus(values); if (!before.model_applied) await db(values, fs.readFileSync(migrationPath, 'utf8'));
    const afterModel = await modelStatus(values);
    if (!String(afterModel.importer_version || '').includes('Shadow importer v2') && !String(afterModel.importer_version || '').includes('Shadow importer v3') && !String(afterModel.importer_version || '').includes('Shadow importer v4')) await db(values, fs.readFileSync(importerPatchPath, 'utf8'));
    const afterImporter = await modelStatus(values);
    if (!String(afterImporter.importer_version || '').includes('Shadow importer v3') && !String(afterImporter.importer_version || '').includes('Shadow importer v4')) await db(values, fs.readFileSync(serviceBoundaryPatchPath, 'utf8'));
    const afterBoundary = await modelStatus(values);
    if (!String(afterBoundary.importer_version || '').includes('Shadow importer v4')) await db(values, fs.readFileSync(fundGroupingPatchPath, 'utf8'));
    const afterGrouping = await modelStatus(values);
    if (afterGrouping.authority !== 'SUPABASE' && !afterGrouping.shadow_canary_applied) await db(values, fs.readFileSync(shadowCanaryPatchPath, 'utf8'));
    const afterCanary = await modelStatus(values);
    if (afterCanary.authority !== 'SUPABASE' && !String(afterCanary.shadow_canary_version || '').includes('deployment canary')) await db(values,fs.readFileSync(canaryTransitionPath,'utf8'));
    console.log(JSON.stringify({ status: 'PASS', applied: !before.model_applied, ...(await modelStatus(values)) })); return;
  }
  const snapshot = await googleSnapshot(values);
  let status = await modelStatus(values); if (!status.model_applied) throw new Error('MODEL_NOT_APPLIED');
  if (mode === 'stage') {
    if (!status.source_snapshot_hash) {
      const payload = sqlText(JSON.stringify(snapshot.rules));
      const result = await db(values, `select public.stage_financial_criteria_import(${payload}::jsonb,${sqlText(snapshot.sourceSnapshotHash)}) result`);
      assert.equal(Number(result[0]?.result?.rules), 146);
    } else assert.equal(status.source_snapshot_hash, snapshot.sourceSnapshotHash, 'STAGED_SOURCE_CHANGED');
    console.log(JSON.stringify({ status: 'PASS', stage: await verify(values, snapshot), googleWrites: 0 })); return;
  }
  const evidence = await verify(values, snapshot);
  if (mode === 'verify') { console.log(JSON.stringify({ status: 'PASS', equivalence: evidence, comparedFields: ['A','B','C','D','E','F','H','N','P'], excludedFields: ['G','I','J','K','L','M','O'], googleWrites: 0 })); return; }
  if (evidence.status !== 'STAGED') throw new Error('CUTOVER_BATCH_NOT_STAGED');
  const activation = await db(values, `select public.activate_financial_criteria_import(${sqlText(evidence.batch_id)}::uuid,${sqlText(snapshot.sourceSnapshotHash)},'Owner-authorized cutover after exact 146-row equivalence') result`);
  assert.equal(activation[0]?.result?.authority, 'SUPABASE'); status = await modelStatus(values); assert.equal(status.authority, 'SUPABASE');
  console.log(JSON.stringify({ status: 'PASS', activation: activation[0].result, googleWrites: 0 }));
})().catch((error) => { console.error(JSON.stringify({ status: 'FAIL', error: error.message, googleWrites: 0 })); process.exit(1); });
