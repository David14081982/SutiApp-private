'use strict';
// Isolated PostgreSQL only. Real schema metadata; synthetic delegation fixture; no network.
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const { PGlite } = require(process.env.SUTIAPP_PGLITE_PATH || path.join(root, '.tmp/savings-loan-eligibility/node_modules/@electric-sql/pglite'));
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const fixture = JSON.parse(read('scripts/fixtures/savings-summary-boundary-20261002.json'));
const migration = '20261002000200_savings_private_summary_acl.sql';
const forward = read('supabase/migrations/' + migration);
const recovery = read('supabase/recovery/' + migration);
const apiRoles = ['anon', 'authenticated', 'service_role'];
const checks = [];
const semanticCatalog = catalog => catalog.map(row => ({...row, acl:row.acl.slice(1, -1).split(',').sort()}));
const calls = [
  'select public.savings_admin_current_summary()',
  'select public.savings_admin_current_summary(null::jsonb)',
  "select public.savings_admin_current_summary('[]'::jsonb)",
  'select public.savings_panel_before_current_summary()',
  "select public.savings_panel_before_current_summary('padron','','todos',0,20)",
  "select public.savings_panel_before_current_summary('padron','','todos',0,20,'[]'::jsonb)",
];

async function main() {
  const db = new PGlite();
  const rows = async (sql, params = []) => (await db.query(sql, params)).rows;
  const value = async (sql, params = []) => (await rows(sql, params))[0].value;
  const owner = () => db.exec('reset role');
  const snapshot = () => rows(`select oid, oid::regprocedure::text signature,
    pg_get_userbyid(proowner) owner, proacl::text acl, prosecdef,
    md5(pg_get_functiondef(oid)) definition_md5 from pg_proc
    where oid = any($1::regprocedure[]) order by oid::regprocedure::text`, [fixture.functions.map(f => 'public.' + f.signature)]);
  const bodySnapshot = async () => (await snapshot()).map(({ acl, ...other }) => other);
  const test = async (name, fn) => { await fn(); checks.push(name); console.log('PASS ' + name); };
  const denied = async fn => assert.rejects(fn, error => error.code === '42501');
  const failedTransaction = async (sql, pattern) => {
    try { await assert.rejects(() => db.exec(sql), error => pattern.test(error.message)); }
    finally { await db.exec('rollback'); }
  };

  try {
    assert.equal(fixture.classification, 'ISOLATED_SCHEMA_ONLY_FIXTURE');
    assert.equal(fixture.production_rows, false);
    assert.equal(fixture.functions.length, 2);
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create role boundary_drift_owner;
      grant usage on schema public to anon, authenticated, service_role;
      set check_function_bodies = off;`);
    // Disabled body validation permits the exact functions without any financial schema/data.
    for (const f of fixture.functions) {
      assert.equal(f.owner, 'postgres');
      assert.equal(f.security_definer, true);
      await db.exec(f.definition);
      await db.exec(`grant execute on function public.${f.signature} to anon, authenticated, service_role`);
    }
    const before = await snapshot();
    const bodiesBefore = await bodySnapshot();
    await test('actual function definitions, owners and exposed ACL baseline reproduced', async () => {
      for (const f of fixture.functions) {
        const installed = before.find(row => row.signature === f.signature);
        assert(installed, f.signature);
        assert.equal(installed.owner, f.owner);
        assert.equal(installed.definition_md5, f.definition_md5);
        assert.equal(installed.acl, f.acl);
        for (const role of apiRoles) assert.equal(await value('select has_function_privilege($1,$2,\'execute\') value', [role, 'public.' + f.signature]), true);
      }
    });

    await test('forward revokes only two ACLs while preserving OIDs and exact bodies', async () => {
      await db.exec(forward);
      assert.deepEqual(await bodySnapshot(), bodiesBefore);
      for (const f of await snapshot()) assert.equal(f.acl, '{postgres=X/postgres}');
      for (const f of fixture.functions) {
        assert.equal(await value('select has_function_privilege(\'postgres\',$1,\'execute\') value', ['public.' + f.signature]), true);
        for (const role of apiRoles) assert.equal(await value('select has_function_privilege($1,$2,\'execute\') value', [role, 'public.' + f.signature]), false);
      }
    });
    const secured = await snapshot();

    for (const role of apiRoles) await test(role + ' denied on both actual helpers with default and supplied arguments', async () => {
      await db.exec('set role ' + role);
      try { for (const sql of calls) await denied(() => rows(sql)); }
      finally { await owner(); }
    });

    await test('idempotent application preserves secured catalog', async () => {
      await db.exec(forward);
      assert.deepEqual(await snapshot(), secured);
    });

    // Explicitly synthetic: this proves PostgreSQL ACL delegation mechanics, not financial output.
    await db.exec(`create schema boundary_fixture;
      grant usage on schema boundary_fixture to anon, authenticated, service_role;
      create function boundary_fixture.summary(p_people jsonb default null) returns jsonb
      language sql stable security definer set search_path='' as $$
        select jsonb_build_object('fixture','synthetic summary','executor',current_user::text,'people',p_people) $$;
      create function boundary_fixture.panel_before(p_tab text default 'padron', p_search text default '',
        p_filter text default 'todos',p_offset int default 0,p_limit int default 20,p_people jsonb default null)
      returns jsonb language sql stable security definer set search_path='' as $$
        select jsonb_build_object('fixture','synthetic panel','executor',current_user::text,'people',p_people) $$;
      revoke all on function boundary_fixture.summary(jsonb),boundary_fixture.panel_before(text,text,text,int,int,jsonb)
        from public,anon,authenticated,service_role;
      create function boundary_fixture.guarded_panel() returns jsonb language plpgsql stable security definer set search_path='' as $$
      begin
        if current_setting('boundary_fixture.authorized',true) is distinct from 'on' then
          raise exception 'SYNTHETIC_ADMIN_DENIED' using errcode='42501';
        end if;
        return jsonb_build_object('summary',boundary_fixture.summary(), 'panel',boundary_fixture.panel_before());
      end $$;
      revoke all on function boundary_fixture.guarded_panel() from public,anon,authenticated,service_role;
      grant execute on function boundary_fixture.guarded_panel() to authenticated;`);
    await test('synthetic guarded SECURITY DEFINER wrapper delegates to both owner-only helpers', async () => {
      await db.exec('set role authenticated');
      try {
        await denied(() => rows('select boundary_fixture.summary()'));
        await denied(() => rows('select boundary_fixture.panel_before()'));
        await denied(() => rows('select boundary_fixture.guarded_panel()'));
        await rows("select set_config('boundary_fixture.authorized','on',false)");
        const result = await value('select boundary_fixture.guarded_panel() value');
        assert.equal(result.summary.executor, 'postgres');
        assert.equal(result.panel.executor, 'postgres');
        assert.equal(result.summary.fixture, 'synthetic summary');
        assert.equal(result.panel.fixture, 'synthetic panel');
      } finally {
        await owner();
        await rows("select set_config('boundary_fixture.authorized','off',false)");
      }
      assert.deepEqual(await snapshot(), secured);
    });

    await test('recovery requires explicit insecure-ACL acknowledgement and leaves state intact', async () => {
      await failedTransaction(recovery, /RECOVERY|ACKNOWLEDGE|INSECURE/i);
      assert.deepEqual(await snapshot(), secured);
    });

    await test('acknowledged isolated recovery restores exact ACLs and reapply closes them', async () => {
      await rows("select set_config('sutiapp.allow_insecure_savings_acl_recovery','on',false)");
      await db.exec(recovery);
      assert.deepEqual(semanticCatalog(await snapshot()), semanticCatalog(before));
      await rows("select set_config('sutiapp.allow_insecure_savings_acl_recovery','off',false)");
      await db.exec(forward);
      assert.deepEqual(await snapshot(), secured);
    });

    await test('body drift aborts forward and acknowledged recovery atomically', async () => {
      const original = fixture.functions.find(f => f.name === 'savings_admin_current_summary');
      await db.exec(`create or replace function public.savings_admin_current_summary(p_people jsonb default null)
        returns jsonb language sql stable security definer set search_path='' as $$select '{}'::jsonb$$`);
      const drift = await snapshot();
      await failedTransaction(forward, /DRIFT|BASELINE|DEFINITION/i);
      assert.deepEqual(await snapshot(), drift);
      await rows("select set_config('sutiapp.allow_insecure_savings_acl_recovery','on',false)");
      await failedTransaction(recovery, /DRIFT|BASELINE|DEFINITION/i);
      assert.deepEqual(await snapshot(), drift);
      await rows("select set_config('sutiapp.allow_insecure_savings_acl_recovery','off',false)");
      await db.exec(original.definition);
      assert.deepEqual(await snapshot(), secured);
    });

    await test('unexpected ACL drift is rejected without silently discarding permissions', async () => {
      await db.exec('grant execute on function public.savings_admin_current_summary(jsonb) to authenticated');
      const drift = await snapshot();
      await failedTransaction(forward, /DRIFT|BASELINE|ACL/i);
      assert.deepEqual(await snapshot(), drift);
      await db.exec('revoke execute on function public.savings_admin_current_summary(jsonb) from authenticated');
      assert.deepEqual(await snapshot(), secured);
    });

    await test('unexpected owner drift is rejected atomically', async () => {
      await db.exec('alter function public.savings_admin_current_summary(jsonb) owner to boundary_drift_owner');
      const drift = await snapshot();
      await failedTransaction(forward, /DRIFT|BASELINE|OWNER/i);
      assert.deepEqual(await snapshot(), drift);
      await db.exec('alter function public.savings_admin_current_summary(jsonb) owner to postgres');
      assert.deepEqual(await snapshot(), secured);
    });

    console.log(JSON.stringify({status:'PASS',checks,productionTraffic:false,productionWrites:false,
      limits:'Exact installed function metadata and ACL behavior; dependencies and financial schema intentionally absent. Positive nested-call mechanics use separate synthetic functions. Actual authorized output equivalence requires read-only live verification.'}, null, 2));
  } finally { await db.close(); }
}

main().catch(error => { console.error(error.stack); process.exitCode = 1; });
