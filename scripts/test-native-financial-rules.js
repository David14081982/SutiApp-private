'use strict';
// Isolated PostgreSQL only. Schema/functions are production definitions; every row is synthetic.
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const { PGlite } = require(process.env.SUTIAPP_PGLITE_PATH || path.join(root, '.tmp/savings-loan-eligibility/node_modules/@electric-sql/pglite'));
const baseline = JSON.parse(read('scripts/fixtures/native-financial-rules-baseline.json'));
const migration = read('supabase/migrations/20261020000100_native_financial_rules.sql');
const recovery = read('supabase/recovery/20261020000100_native_financial_rules.sql');
const operation = read('scripts/operations/20261020-loan-january-funds.sql');
const actor = '10000000-0000-0000-0000-000000000001';
const batch = '20000000-0000-0000-0000-000000000001';
const unions = ['SUTISSSTESON', 'SUEISSSTESON', 'SITISSSTESON'];
const permissions = ['financial_programs.read', 'financial_programs.write', 'financial_rules.read', 'financial_rules.write',
  'financial_rates.write', 'financial_rules.publish', 'financial_criteria.visibility.read', 'financial_criteria.visibility.write'];
const reason = 'Isolated native financial rule verification';
const ident = name => '"' + name.replaceAll('"', '""') + '"';

async function main() {
  const db = new PGlite();
  let assertions = 0;
  const scalar = async (sql, params = []) => (await db.query(sql, params)).rows[0].v;
  const check = (actual, expected, label) => { assert.deepEqual(actual, expected, label); assertions++; };
  const reject = async (work, pattern) => { await assert.rejects(work, pattern); assertions++; };
  const runtime = () => scalar('select public.get_financial_runtime_rules() v');
  const auditCount = () => scalar('select count(*)::integer v from financial_configuration_audit');
  const definitions = async () => (await db.query(`select p.proname name, p.oid::regprocedure::text signature,
    pg_get_functiondef(p.oid) definition, p.proacl::text acl, pg_get_userbyid(p.proowner) owner
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname=any($1::text[]) order by p.proname`, [baseline.functions.map(f => f.name)])).rows;
  const savedLegacy = () => scalar('select jsonb_agg(to_jsonb(r) order by legacy_sheet_row) v from financial_rules r where legacy_sheet_row is not null');
  const setPermissions = values => scalar("select set_config('test.permissions',$1,false) v", [values.join(',')]);
  const freshSnapshot = () => db.exec('insert into financial_session_snapshots default values');
  const invalidations = () => scalar("select jsonb_agg(invalidation_reason order by created_at,id) v from financial_session_snapshots where invalidated_at is not null");
  const visibility = (identity, mode) => scalar('select public.set_financial_rule_visibility($1,$2,$3) v', [identity, mode, reason]);
  const saveFund = (fund, enabled = true) => scalar('select public.save_financial_fund($1,$2,$3,$4,$5,$6,$7,$8,$9) v',
    [fund.id || null, 'prestamo', fund.code, fund.name, enabled, 'PUBLISHED', 900, reason, 'CONFIRMAR']);
  const rollbackRejectedScript = async (script, pattern) => {
    try { await reject(db.exec(script), pattern); } finally { await db.exec('rollback'); }
  };
  try {
    await db.exec(`create schema extensions; create schema auth;
      create role anon; create role authenticated; create role service_role;
      create function extensions.gen_random_uuid() returns uuid language sql as $$select pg_catalog.gen_random_uuid()$$;
      create table auth.users(id uuid primary key);
      create table private_assets(id uuid primary key);
      create table segmentation_catalog_entries(catalog_type text,code text,label text,enabled boolean,
        primary key(catalog_type,code));
      create table financial_session_snapshots(id uuid primary key default gen_random_uuid(),
        created_at timestamptz not null default clock_timestamp(),invalidated_at timestamptz,invalidation_reason text);
      create table program_requests(id uuid primary key default gen_random_uuid(), financial_submission_snapshot jsonb);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
      create function auth.role() returns text language sql stable as $$select current_setting('test.role',true)$$;
      create function public.has_admin_permission(p_permission text) returns boolean language sql stable as
        $$select coalesce(p_permission=any(string_to_array(current_setting('test.permissions',true),',')),false)$$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    // Reproduce all column types/defaults/generated expressions and constraints from the captured schema.
    for (const table of baseline.tables) {
      const columns = table.columns.map(c => `${ident(c.name)} ${c.type}${c.generated
        ? ` generated always as (${c.default}) stored`
        : c.default === null ? '' : ` default ${c.default}`}${c.notnull ? ' not null' : ''}`);
      await db.exec(`create table public.${ident(table.name)}(${columns.join(',')})`);
    }
    for (const type of ['p', 'u', 'c', 'f']) for (const table of baseline.tables) {
      for (const constraint of table.constraints.filter(c => c.type === type)) {
        await db.exec(`alter table public.${ident(table.name)} add constraint ${ident(constraint.name)} ${constraint.definition}`);
      }
    }
    for (const table of baseline.tables) {
      for (const index of table.indexes || []) {
        const indexName = index.match(/^CREATE (?:UNIQUE )?INDEX (\S+)/)[1];
        if (!table.constraints.some(c => c.name === indexName)) await db.exec(index);
      }
      for (const trigger of table.triggers || []) { await db.exec(trigger.function); await db.exec(trigger.definition); }
      if (table.rls) await db.exec(`alter table public.${ident(table.name)} enable row level security`);
      if (table.force) await db.exec(`alter table public.${ident(table.name)} force row level security`);
    }
    for (const fn of baseline.functions) {
      await db.exec(fn.definition);
      await db.exec(`revoke all on function public.${fn.signature} from public,anon,authenticated,service_role`);
      // Captured grants have EXECUTE only. Fail rather than approximate an unexpected ACL.
      const entries = fn.acl.slice(1, -1).split(',');
      for (const entry of entries) {
        assert.match(entry, /^(postgres|authenticated|service_role)=X\/postgres$/);
        await db.exec(`grant execute on function public.${fn.signature} to ${entry.split('=')[0]}`);
      }
      check(await scalar('select md5(pg_get_functiondef($1::regprocedure)) v', ['public.' + fn.signature]), fn.md5, fn.name + ' exact baseline definition');
    }
    await db.query('insert into auth.users(id) values($1)', [actor]);
    await scalar("select set_config('test.actor',$1,false) v", [actor]);
    await scalar("select set_config('test.role','authenticated',false) v");
    await setPermissions(permissions);
    await db.query(`insert into financial_criteria_import_batches(id,source,source_snapshot_hash,rule_count,
      fund_count,duplicate_group_count,conflict_group_count,status) values($1,'GOOGLE_CRITERIA_DE_FONDOS',$2,146,35,2,1,'ACTIVE')`, [batch, 'A'.repeat(64)]);
    await db.query(`insert into financial_criteria_authority(id,authority,active_import_batch_id,source_snapshot_hash,changed_reason)
      values('primary','SUPABASE',$1,$2,$3)`, [batch, 'A'.repeat(64), reason]);
    for (const union of unions) await db.query("insert into segmentation_catalog_entries values('union',$1,$1,true)", [union]);
    await db.exec("insert into segmentation_catalog_entries values('employment_category','BASE','Base',true)");
    const programIds = ['prestamo', 'caja', 'nomina'];
    for (const id of programIds) await db.query('insert into financial_programs(id,name) values($1,$2)', [id, 'Isolated ' + id]);
    const legacyFunds = [];
    for (let i = 0; i < 35; i++) legacyFunds.push(await scalar(`insert into financial_funds(program_id,code,name,imported_batch_id)
      values($1,$2,$3,$4) returning to_jsonb(financial_funds) v`, [programIds[i % 3], 'legacy-' + i, 'Isolated legacy fund ' + i, batch]));
    for (let i = 0; i < 146; i++) {
      // Live has 141 imported projections and five previously created native rules.
      // Two prior natives share fund/version, reproducing their old projected-id collision.
      const priorNative = i >= 141;
      const fund = legacyFunds[priorNative ? [1, 1, 4, 7, 10][i - 141] : i % 35];
      const union = unions[i % 3], row = priorNative ? null : i + 2;
      await db.query(`insert into financial_rules(program_id,fund_id,financial_union_code,financial_union_label,
        financial_employee_category_code,financial_employee_category_label,max_amount,raw_rate,term_label,payment_count,
        max_term,available_on,lifecycle_status,legacy_sheet_row,legacy_criterion_identity,source_snapshot_hash,imported_batch_id)
        values($1,$2,$3,$3,'BASE','Base',$4,6,'1 Qnas',1,1,'2026-12-15','PUBLISHED',$5,$6,$7,$8)`,
      [fund.program_id, fund.id, union, 5000 + i, row, priorNative ? null : 'CRITERIA_V1:' + row + ':' + 'B'.repeat(64),
        priorNative ? null : 'A'.repeat(64), batch]);
    }
    await db.query('insert into program_requests(financial_submission_snapshot) values($1)', [{ synthetic: true, total: 6150, rule: 'historical-untouched' }]);
    const history = await scalar('select jsonb_agg(to_jsonb(r) order by id) v from program_requests r');
    const beforeDefinitions = await definitions(), beforeRuntime = await runtime(), beforeLegacy = await savedLegacy();
    const beforeNative = beforeRuntime.filter(r => !r.sheet_row);
    const priorNativeIds = beforeNative.map(r => r.rule_id);
    const priorNativeRows = await scalar('select jsonb_agg(to_jsonb(r) order by id) v from financial_rules r where id=any($1::uuid[])', [priorNativeIds]);
    const migratedBaseline = beforeRuntime.map(r => r.sheet_row ? r : { ...r, id: r.id.replace(/--r\d+$/, '--r' + r.rule_id) });
    const beforeFunds = await scalar('select jsonb_agg(to_jsonb(f) order by id) v from financial_funds f');
    const beforePrograms = await scalar('select jsonb_agg(to_jsonb(p) order by id) v from financial_programs p');
    const beforeAuthority = await scalar('select jsonb_agg(to_jsonb(a)) v from financial_criteria_authority a');
    const beforeBatch = await scalar('select jsonb_agg(to_jsonb(b)) v from financial_criteria_import_batches b');
    check(beforeRuntime.length, 146, '146 original projected rules');
    check(beforeLegacy.length, 141, '141 original live imported rules');
    check(beforeNative.length, 5, 'five previously created native rules included in baseline');
    check(new Set(beforeNative.map(r => r.id)).size, 4, 'reproduce prior native projected-id collision');
    await db.exec(migration);
    const migratedDefinitions = await definitions();
    const migratedRuntime = await runtime();
    check(migratedRuntime, migratedBaseline, 'migration changes only technical id of prior native projections');
    check(migratedRuntime.filter(r => r.sheet_row), beforeRuntime.filter(r => r.sheet_row), '141 legacy projections exactly unchanged');
    const migratedPriorNative = migratedRuntime.filter(r => !r.sheet_row);
    check(new Set(migratedPriorNative.map(r => r.id)).size, 5, 'five prior native ids become unique');
    for (let i = 0; i < beforeNative.length; i++) {
      const { id: oldId, ...oldFields } = beforeNative[i], { id: newId, ...newFields } = migratedPriorNative[i];
      check(newFields, oldFields, 'prior native financial fields, criteria identity, audience and order unchanged');
      check(newId, oldId.replace(/--r\d+$/, '--r' + oldFields.rule_id), 'prior native technical id derives from stable rule UUID');
    }
    check(await scalar('select jsonb_agg(to_jsonb(r) order by id) v from financial_rules r where id=any($1::uuid[])', [priorNativeIds]),
      priorNativeRows, 'migration does not rewrite prior native database rows');
    check(migratedDefinitions.map(({ definition, ...rest }) => rest), beforeDefinitions.map(({ definition, ...rest }) => rest), 'all signatures/owners/ACLs preserved');
    await db.exec(migration);
    check(await definitions(), migratedDefinitions, 'migration idempotent');
    // A changed definition must stop migration and recovery before any replacement.
    const altered = migratedDefinitions.find(f => f.name === 'get_financial_runtime_rules').definition.replace('declare v_authority', 'declare /* unexpected drift */ v_authority');
    await db.exec(altered);
    const drifted = await definitions();
    await rollbackRejectedScript(migration, /NATIVE_FINANCIAL_RULES_SCHEMA_DRIFT/);
    check(await definitions(), drifted, 'migration drift guard is atomic');
    await rollbackRejectedScript(recovery, /NATIVE_FINANCIAL_RULES_SCHEMA_DRIFT/);
    check(await definitions(), drifted, 'recovery drift guard is atomic');
    await db.exec(migratedDefinitions.find(f => f.name === 'get_financial_runtime_rules').definition);

    await db.exec("begin; update segmentation_catalog_entries set enabled=false where catalog_type='union' and code='SUEISSSTESON'");
    await reject(db.exec(operation), /JANUARY_UNION_UNAVAILABLE/); await db.exec('rollback');
    check(await auditCount(), 0, 'operation rolls back initial fund/rule/audit when a later union is missing');
    check(await scalar('select count(*)::integer v from financial_funds'), 35, 'failed operation leaves no new fund');
    check(await runtime(), migratedBaseline, 'failed operation leaves runtime unchanged');
    await setPermissions([]);
    await reject(db.exec(operation), /JANUARY_AUTHORIZED_ADMIN_REQUIRED/);
    await setPermissions(permissions);
    await freshSnapshot();
    await db.exec('begin');
    await db.exec(operation);
    check(await scalar("select current_setting('sutiapp.january_result')::jsonb v"),
      { created_funds: 2, created_rules: 6, preserved_existing: true }, 'actual operation creates exactly authorized two funds/six rules');
    await db.exec('commit');
    const newFunds = (await db.query("select * from financial_funds where code in('15-01-2027-incentivos-trimestrales','15-01-2028-incentivos-trimestrales') order by code")).rows;
    const newRules = (await db.query('select * from financial_rules where fund_id=any($1::uuid[])', [newFunds.map(f => f.id)])).rows;
    const operationRows = await scalar('select jsonb_agg(to_jsonb(r) order by id) v from financial_rules r');
    await db.exec('begin');
    await db.exec(operation);
    check(await scalar("select current_setting('sutiapp.january_result')::jsonb v"),
      { created_funds: 0, created_rules: 0, preserved_existing: true }, 'actual operation rerun creates no duplicate');
    await db.exec('commit');
    check(await scalar('select jsonb_agg(to_jsonb(r) order by id) v from financial_rules r'), operationRows, 'idempotent operation preserves every rule field');
    const after = await runtime(), native = after.filter(r => newRules.some(n => n.id === r.rule_id));
    check(after.length, 152, '152 runtime rules after two funds/six published rules');
    check(after.filter(r => r.sheet_row), beforeRuntime.filter(r => r.sheet_row), 'all 141 legacy projections exactly unchanged');
    check(after.filter(r => priorNativeIds.includes(r.rule_id)), migratedPriorNative, 'five prior native projections stable during January addition');
    check(new Set(after.filter(r => !r.sheet_row).map(r => r.id)).size, 11, 'all eleven native rules have distinct ids');
    check(await scalar('select jsonb_agg(to_jsonb(r) order by id) v from financial_rules r where id=any($1::uuid[])', [priorNativeIds]),
      priorNativeRows, 'January addition preserves every prior native row field');
    check(await savedLegacy(), beforeLegacy, 'all imported row fields exactly unchanged');
    check(await scalar('select jsonb_agg(to_jsonb(f) order by id) v from financial_funds f where id<>all($1::uuid[])', [newFunds.map(f => f.id)]), beforeFunds, 'all 35 original funds exactly unchanged');
    check(native.length, 6, 'six native projected rules');
    check(new Set(native.map(r => r.id)).size, 6, 'six distinct native runtime ids despite identical version=1');
    check(new Set(native.map(r => r.criterion_identity)).size, 6, 'six distinct writable criterion identities');
    for (const rule of native) {
      check(rule.id.endsWith('--r' + rule.rule_id), true, 'native runtime identity uses rule UUID');
      check(rule.criterion_identity, 'SUPABASE_RULE:' + rule.rule_id, 'native criterion identity');
      check([rule.max_amount, rule.rate_factor, rule.rate, rule.payment_count, rule.max_term, rule.term_label,
        rule.payment_period, rule.category, rule.financial_employee_category_code, rule.visibility_mode],
      [10000, 0.06, 6, 1, 1, '1 Qnas', 'quincenal', 'Base', 'BASE', 'AUTO'], 'exact new financial conditions');
      check(['2027-01-15', '2028-01-15'].includes(rule.available_on), true, 'exact January dates');
      check(unions.includes(rule.union) && rule.financial_union_code === rule.union, true, 'exact authorized union');
      check([rule.sheet_row, rule.source_snapshot_hash], [null, null], 'native rules do not forge imported provenance');
    }
    for (const union of unions) check(native.filter(r => r.union === union && r.category === 'Base').map(r => r.available_on).sort(),
      ['2027-01-15', '2028-01-15'], 'one rule per authorized year/union/category');
    const catalog = await scalar('select public.get_financial_admin_catalog() v');
    check([catalog.authority, catalog.programs.length, catalog.funds.length, catalog.rules.length], ['SUPABASE', 3, 37, 152], 'admin sees 37 funds and 152 rules');
    check(await auditCount(), 14, 'two fund creates, six drafts, six publications audited');
    check(await invalidations(), ['FINANCIAL_FUND_CHANGED'], 'fund writer invalidates existing sessions');
    check(await scalar('select bool_and(actor_auth_user_id=$1::uuid) v from financial_configuration_audit', [actor]), true, 'audit records actual authenticated actor');
    await reject(saveFund({ code: newFunds[0].code, name: 'Different name duplicate code' }), /duplicate key/);
    await reject(saveFund({ code: 'different-code', name: newFunds[0].name }), /duplicate key/);
    check(await auditCount(), 14, 'duplicate fund rejection leaves no partial audit');
    await db.exec('begin');
    await db.query('update financial_rules set max_amount=9999 where id=$1', [newRules[0].id]);
    await reject(db.exec(operation), /JANUARY_EXISTING_RULE_CONFLICT/); await db.exec('rollback');
    await db.exec('begin');
    await db.query("update financial_rules set lifecycle_status='EXPIRED' where id=$1", [newRules[0].id]);
    await reject(db.exec(operation), /JANUARY_HISTORICAL_RULE_REQUIRES_REVIEW/); await db.exec('rollback');
    await db.exec('begin');
    await saveFund({ code: 'normalized-name-duplicate', name: '15 / 01 / 2027 - Incentivos trimestrales' });
    await reject(db.exec(operation), /JANUARY_DUPLICATE_FUND/); await db.exec('rollback');
    await db.exec('begin');
    await scalar('select public.save_financial_rule_draft($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) v',
      [null, newFunds[0].id, unions[0], 'BASE', 10000, 6, '1 Qnas', 1, 1, '2027-01-15', 'AUTO', reason, 'CONFIRMAR']);
    await reject(db.exec(operation), /JANUARY_DUPLICATE_RULE/); await db.exec('rollback');
    check(await auditCount(), 14, 'conflicting/duplicate/historical operation tests leave no persistent audit or row');
    check(await runtime(), after, 'conflict checks preserve all valid catalog objects');
    await freshSnapshot();
    const target = native[0];
    for (const mode of ['OCULTAR', 'MOSTRAR', 'AUTO']) {
      await db.exec('set role authenticated');
      const changed = await visibility(target.criterion_identity, mode);
      await db.exec('reset role');
      check([changed.criterion_identity, changed.visibility_mode], [target.criterion_identity, mode], 'native visibility writer returns correct identity/mode');
      const projected = await runtime();
      check(projected.find(r => r.rule_id === target.rule_id).visibility_mode, mode, 'native visibility applied to selected rule');
      check(projected.filter(r => r.rule_id !== target.rule_id), after.filter(r => r.rule_id !== target.rule_id), 'visibility never changes another rule');
      check(await savedLegacy(), beforeLegacy, 'native visibility does not write legacy rules');
    }
    check((await invalidations()).at(-1), 'FINANCIAL_VISIBILITY_CHANGED', 'visibility invalidates snapshots');
    const auditBeforeRejections = await auditCount();
    await reject(visibility('SUPABASE_RULE:00000000-0000-0000-0000-000000000000', 'AUTO'), /CRITERION_FINGERPRINT_MISMATCH/);
    await reject(visibility('SUPABASE_RULE:not-a-uuid', 'AUTO'), /CRITERION_FINGERPRINT_MISMATCH/);
    await reject(visibility(target.criterion_identity, 'INVALID'), /VISIBILITY_CHANGE_INVALID/);
    await setPermissions([]);
    await db.exec('set role authenticated');
    await reject(visibility(target.criterion_identity, 'OCULTAR'), /VISIBILITY_WRITE_REQUIRED/);
    await reject(saveFund({ code: 'denied-fund', name: 'Denied new fund' }), /FINANCIAL_PROGRAMS_WRITE_REQUIRED/);
    await reject(runtime(), /permission denied for function get_financial_runtime_rules/);
    await db.exec('reset role');
    await setPermissions(permissions);
    await db.exec('set role anon');
    await reject(visibility(target.criterion_identity, 'OCULTAR'), /permission denied for function set_financial_rule_visibility/);
    await reject(runtime(), /permission denied for function get_financial_runtime_rules/);
    await db.exec('reset role');
    for (const role of ['anon', 'authenticated', 'service_role']) {
      check(await scalar("select has_function_privilege($1,'financial_runtime_rules_for_batch(uuid)','EXECUTE') v", [role]), false, 'private projection denied to ' + role);
      for (const table of baseline.tables) check(await scalar("select has_table_privilege($1,$2,'INSERT,UPDATE,DELETE') v", [role, table.name]), false, 'direct catalog mutation denied to ' + role + '/' + table.name);
    }
    await db.exec('set role service_role');
    check((await runtime()).length, 152, 'service runtime ACL retained');
    await db.exec('reset role');
    check(await auditCount(), auditBeforeRejections, 'denied actions create no audit or partial writes');
    check(await runtime(), after, 'denied actions leave runtime unchanged');
    // No catalog authority or empty selection must fail closed, with no legacy fallback.
    await db.exec('begin; delete from financial_criteria_authority');
    await reject(runtime(), /FINANCIAL_CRITERIA_NOT_CONFIGURED/); await db.exec('rollback');
    await db.exec("begin; update financial_criteria_authority set authority='GOOGLE_SHADOW',active_import_batch_id=null");
    await reject(runtime(), /FINANCIAL_CRITERIA_NOT_CONFIGURED/); await db.exec('rollback');
    await db.exec('begin; update financial_programs set enabled=false');
    await reject(runtime(), /FINANCIAL_CRITERIA_NOT_CONFIGURED/); await db.exec('rollback');
    // Restoring the fixed-size gate before withdrawing new offerings must be refused atomically.
    await rollbackRejectedScript(recovery, /NATIVE_FINANCIAL_RULES_RECOVERY_REQUIRES_WITHDRAWAL/);
    check(await definitions(), migratedDefinitions, 'premature recovery replaces no definition');
    check((await runtime()).length, 152, 'premature recovery does not hide any offering');
    for (const fund of newFunds) await saveFund(fund, false);
    await reject(db.exec(operation), /JANUARY_EXISTING_FUND_CONFLICT/);
    check(await runtime(), migratedBaseline, 'audited withdrawal returns 146 baseline objects with corrected native ids');
    check(await scalar('select count(*)::integer v from financial_rules'), 152, 'withdrawal preserves all rule history');
    check(await scalar('select count(*)::integer v from financial_funds'), 37, 'withdrawal preserves all fund history');
    check(await auditCount(), auditBeforeRejections + 2, 'withdrawal creates two audit updates');
    await db.exec(recovery);
    check(await definitions(), beforeDefinitions, 'recovery restores exact original function bodies/ACLs/owners');
    check(await runtime(), beforeRuntime, 'recovered runtime is exact original runtime');
    await db.exec(recovery);
    check(await definitions(), beforeDefinitions, 'recovery idempotent');
    check(await savedLegacy(), beforeLegacy, 'all 141 imported complete rows preserved after recovery');
    check(await scalar('select jsonb_agg(to_jsonb(r) order by id) v from financial_rules r where id=any($1::uuid[])', [priorNativeIds]),
      priorNativeRows, 'five prior native complete rows preserved after recovery');
    check(await scalar('select jsonb_agg(to_jsonb(r) order by id) v from program_requests r'), history, 'historical requests never rewritten');
    check(await scalar('select jsonb_agg(to_jsonb(p) order by id) v from financial_programs p'), beforePrograms, 'programs unchanged');
    check(await scalar('select jsonb_agg(to_jsonb(a)) v from financial_criteria_authority a'), beforeAuthority, 'authority unchanged');
    check(await scalar('select jsonb_agg(to_jsonb(b)) v from financial_criteria_import_batches b'), beforeBatch, 'original import provenance unchanged');
    console.log(JSON.stringify({ status: 'PASS', assertions, runtimeBefore: 146, runtimeAfter: 152, newFunds: newFunds.length,
      newRules: newRules.length, priorNativeIdsCorrected: 5, recovery: 'EXACT', legacyRows: 'UNCHANGED', priorNativeRows: 'UNCHANGED', externalWrites: 0,
      limits: 'Synthetic rows and auth/permission stubs in isolated PGlite; no live Auth/RLS-policy or UI coverage.' }, null, 2));
  } finally { await db.close(); }
}
main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
