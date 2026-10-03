'use strict';
// Isolated PostgreSQL. Never uses credentials, network, Excel PII or productive money.
const fs = require('fs'), path = require('path'), assert = require('assert/strict'), crypto = require('crypto');
const { fixture } = require('./test-savings-period-composition');
const root = path.resolve(__dirname, '..'), read = p => fs.readFileSync(path.join(root, p), 'utf8');
const file = '20261003000200_sicof_workspace.sql';
const schema = JSON.parse(read('scripts/fixtures/sicof-workspace-schema.json'));
const uid = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
async function main() {
  const f = await fixture(), { db, q, value, as, tx, next } = f; const checks = [];
  const test = async (name, run) => { await run(); checks.push(name); console.log('PASS ' + name); };
  const context = () => value("select public.get_admin_sicof_context('2026-09-01','2026-10-03') v");
  const actor = async (n = 1, permissions = 'savings.read,savings.config,savings.reports', modules = 'sicof') => {
    await as(n, permissions); await q("select set_config('request.jwt.claims','',false),set_config('test.modules',$1,false)", [modules]);
  };
  const service = async () => { await db.exec('reset role'); await q("select set_config('request.jwt.claims','{\"role\":\"service_role\"}',false)"); await db.exec('set role service_role'); };
  const scenario = (ctx, key = next(), actorId = uid(1), session = uid(99), title = 'Synthetic scenario') => value('select public.service_save_sicof_scenario($1,$2,$1,$3,$4,$5,$6,$7,$8) v',
    [actorId, session, key, title, JSON.stringify({ from: '2026-09-01', to: '2026-10-03', yieldMode: 'CAPITAL_ONLY' }), JSON.stringify({ rate: 1, classification: 'SIMULATION' }), ctx.fingerprint, 'f'.repeat(64)]);
  try {
    await db.exec('reset role');
    await db.exec(`create schema admin_support_private;
      create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);
      insert into auth.sessions values('${uid(99)}','${uid(1)}',now()+interval '1 day');
      create or replace function auth.uid() returns uuid language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub',nullif(current_setting('test.actor',true),''))::uuid$$;
      create or replace function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,jsonb_build_object('session_id','${uid(99)}'))$$;
      create function auth.role() returns text language sql stable as $$select coalesce(auth.jwt()->>'role','authenticated')$$;
      create function public.admin_module_boundary(text[],text default 'read') returns boolean language sql stable as $$select coalesce($1&&string_to_array(current_setting('test.modules',true),','),false)$$;
      create function admin_support_private.has_admin_permission(uuid,text) returns boolean language sql stable as $$select coalesce($2=any(string_to_array(current_setting('test.permissions',true),',')),false)$$;
      create function admin_support_private.context() returns table(subject_auth_user_id uuid) language sql stable as $$select null::uuid where false$$;
      create function public.is_module_admin() returns boolean language sql stable as $$select true$$;
      create function public.has_admin_module(text,text) returns boolean language sql stable as $$select coalesce($1=any(string_to_array(current_setting('test.modules',true),',')),false)$$;
      create function public.admin_request_module_boundary(uuid) returns boolean language sql stable as $$select public.admin_module_boundary(array['finanzas'])$$;
      create table public.program_requests(id uuid primary key,affiliate_id uuid);
      create table public.admin_section_definitions(section_key text primary key,display_name text,data_boundary text,allowed_actions text[],enforcement_status text,module_key text,
       module_read_permissions text[],module_write_permissions text[],module_sections text[],module_total_only boolean,module_order integer);`);
    await db.exec(schema.visibility.definition);
    await db.exec('revoke all on function admin_support_private.module_visible(uuid,text) from public,anon,authenticated,service_role');
    for (const fn of schema.definitions) await db.exec(fn.definition);
    for (const fn of schema.authorization) {
      await db.exec(fn.definition);
      await db.exec('revoke all on function public.' + fn.signature + ' from public,anon,authenticated,service_role');
      await db.exec('grant execute on function public.' + fn.signature + ' to authenticated' + (fn.signature === 'has_admin_permission(text)' ? ',service_role' : ''));
    }
    const visibilityBefore = await value("select pg_get_functiondef('admin_support_private.module_visible(uuid,text)'::regprocedure) v");
    await db.exec(read('supabase/migrations/20261003000100_savings_period_composition.sql'));
    await test('installation rejects visibility and permission-helper definition, ACL and owner drift before catalog mutation', async () => {
      for (const signature of ['admin_support_private.module_visible(uuid,text)', 'public.has_admin_permission(text)', 'public.admin_module_boundary(text[],text)']) {
        for (const mutation of ['alter function ' + signature + " set search_path='public'", 'grant execute on function ' + signature + ' to anon', 'alter function ' + signature + ' owner to authenticated']) {
          await db.exec('begin'); await db.exec(mutation);
          await assert.rejects(db.exec(read('supabase/migrations/' + file).replace(/^begin;/, '').replace(/commit;\s*$/, '')), /INSTALL_BASELINE_DRIFT/);
          await db.exec('rollback'); assert.equal(await value("select to_regnamespace('sicof_private')::text v"), null);
          assert.equal(await value("select count(*)::int v from public.admin_section_definitions where module_key='sicof'"), 0);
          assert.equal(await value("select pg_get_functiondef('admin_support_private.module_visible(uuid,text)'::regprocedure) v"), visibilityBefore);
        }
      }
    });
    await db.exec(read('supabase/migrations/' + file));
    await tx({ amount: 1000 }); await tx({ component: 'YIELD', amount: 200 });
    await tx({ type: 'CONTRIBUTION', amount: 300, contribution: '2026-09-05', day: '2026-09-05' });
    await actor();
    await test('catalog registration and exact single visibility mapping preserve old function body', async () => {
      await db.exec('reset role');
      const after = await value("select pg_get_functiondef('admin_support_private.module_visible(uuid,text)'::regprocedure) v");
      assert.equal(after.replace(",('sicof','savings.read',array[]::text[])", ''), visibilityBefore);
      await db.exec('reset role');
      const row = (await q("select * from public.admin_section_definitions where module_key='sicof'"))[0];
      assert.deepEqual(row.module_read_permissions, ['savings.read', 'savings.reports']); assert.deepEqual(row.module_write_permissions, ['savings.config']); await actor();
    });
    await test('canonical context has exact identity, ledger, per-origin balances, no invented receipt completeness', async () => {
      const c = await context(), p = c.participants.find(p => p.id === uid(1));
      assert.equal(p.folio, '001'); assert.equal(p.composition.balances.total, 1500); assert.equal(p.transactions.length, 3);
      assert.equal(p.enrollment.frequency, 'MONTHLY'); assert.equal(p.eligibility.complete, true); assert.equal(p.eligibility.status, 'EVIDENCE_READY');
      assert.equal(c.participants.find(p => p.id === uid(2)).eligibility.complete, false);
      assert.equal(c.report, null); assert.equal(c.scenarios.length, 0); assert.equal(c.can_configure, true);
    });
    await test('read/config permission never bypasses missing module; normal and anonymous users denied', async () => {
      await actor(1, 'savings.read,savings.config,savings.reports', 'finanzas'); await assert.rejects(context(), /SICOF_ADMIN_DENIED/);
      await actor(2, '', 'sicof'); await assert.rejects(context(), /SICOF_ADMIN_DENIED/);
      await actor(0, 'savings.read', 'sicof'); await assert.rejects(context(), /SICOF_ADMIN_DENIED/); await actor();
      await assert.rejects(q('select * from sicof_private.scenarios'), /permission denied/);
    });
    await test('service-only scenario save rechecks session, fingerprint, retry; no ledger mutation', async () => {
      const c = await context(), key = next();
      await assert.rejects(scenario(c), /permission denied/);
      await service(); await assert.rejects(scenario(c, next(), uid(1), uid(999)), /SERVICE_CONTEXT_REQUIRED/);
      await assert.rejects(scenario({ ...c, fingerprint: '0'.repeat(32) }), /SOURCE_CHANGED/);
      const saved = await scenario(c, key); assert.equal(saved.classification, 'SIMULATION'); assert.deepEqual(await scenario(c, key), saved);
      await assert.rejects(scenario(c, key, uid(1), uid(99), 'Changed'), /IDEMPOTENCY_CONFLICT/);
      await actor(); const after = await context(); assert.equal(after.scenarios.length, 1); assert.equal(after.participants[0].composition.balances.total, 1500);
      await value('select public.admin_archive_sicof_scenario($1,$2) v', [saved.id, next()]); assert.equal((await context()).scenarios.length, 0);
      await db.exec('reset role'); assert.equal(await value('select count(*)::int v from sicof_private.scenarios'), 1); await actor();
    });
    await test('presentation preferences are durable, idempotent and cannot define a financial policy', async () => {
      const key = next(), pref = { tab_order: ['summary', 'payments'], labels: { summary: 'Resumen' } };
      const call = () => value('select public.admin_save_sicof_preferences($1,$2) v', [JSON.stringify(pref), key]);
      const saved = await call(); assert.deepEqual(await call(), saved); assert.deepEqual((await context()).preferences, pref);
      await assert.rejects(value('select public.admin_save_sicof_preferences($1,$2) v', [JSON.stringify({ rate: 25 }), next()]), /PREFERENCES_INVALID/);
    });
    await test('finance behavior access reads only requested exact applicant identities, no savings access', async () => {
      await db.exec('reset role'); await q('insert into public.program_requests values($1,$2)', [uid(500), uid(1)]);
      await actor(1, 'program_requests.read', 'finanzas');
      const data = await value('select public.get_admin_sicof_behavior_context($1) v', [[uid(1)]]);
      assert.deepEqual(data.subjects, [{ affiliate_id: uid(1), folio: '001' }]); assert.equal(data.participants, undefined);
      await assert.rejects(value('select public.get_admin_sicof_behavior_context($1) v', [[uid(2)]]), /SUBJECT_UNAVAILABLE/);
      await assert.rejects(context(), /ADMIN_DENIED/); await actor();
    });
    await test('existing policy exclusions and accepted historical evidence remain separate from guessed eligibility', async () => {
      await tx({ type: 'ADJUSTMENT', direction: 'DEBIT', amount: 250, day: '2026-10-03', contribution: '2026-09-05' });
      const actualContext = await context(), p = actualContext.participants.find(p => p.id === uid(1));
      assert.equal(p.eligibility.complete, true); assert(p.eligibility.policy_reasons.includes('SHORT_CONTRIBUTION'));
      const { makeReports } = await import(require('url').pathToFileURL(path.join(root, 'supabase/functions/sicof/projection.mjs')).href);
      const projected = makeReports(actualContext).finalReport.rows.find(row => row.folio === '001');
      assert(p.transactions.every(t => t.enrollment_id === uid(1)), 'real DTO preserves enrollment proof for receipt corrections');
      assert.deepEqual(projected.report_reviews, []); assert.equal(projected.F, 50); assert.equal(projected.M, 1250);
      await tx({ type: 'ADJUSTMENT', amount: 250, day: '2026-10-03', contribution: '2026-09-05' });
      await db.exec('reset role');
      // Narrow dependency contract: source-review flag supplied by the separately
      // tested financial-account RPC. History below uses the real workspace reader.
      await db.exec(`create function public.get_admin_savings_financial_account(p_record_id uuid,p_until date default null)
        returns jsonb language sql stable as $$select jsonb_build_object('source_changed',current_setting('test.source_changed',true)='true')$$`);
      await q(`insert into public.savings_review_records(id,batch_id,source_sheet,source_row,source_folio,source_data,field_defs,raw_source)
        values($1,$1,'Ahorro',2,'002','{"A":"002","D":"JUB","AA":100,"DP":1000,"DQ":408}',
        '[{"key":"AA","label":"2026-09-05 Descuento registrado"}]','{}')`, [uid(700)]);
      await q(`insert into public.savings_balance_certifications(record_id,participant_id,enrollment_id,cutoff_on,source_version,source_snapshot,command,capital,yield_amount,actor_real_auth_user_id,client_action_id)
        values($1,$2,$2,'2026-09-06',0,'{"source":{"A":"002","D":"JUB","AA":100,"DP":1000,"DQ":408},"proposal":{}}','{"process":"JUB"}',0,0,$3,$1)`, [uid(700), uid(2), uid(1)]);
      await actor(); await q("select set_config('test.source_changed','true',false)");
      const historical = (await context()).participants.find(p => p.id === uid(2));
      assert.equal(historical.history.find(h => h.source === 'CERTIFIED_HISTORY').amount, 100);
      assert(historical.eligibility.reasons.includes('HISTORICAL_EXPECTATION_UNVERIFIED'));
      assert(historical.eligibility.reasons.includes('SOURCE_REVIEW_REQUIRED'));
      assert.equal(historical.eligibility.complete, false); assert.equal(historical.composition.balances.total, 0);
      await q("select set_config('test.source_changed','false',false)");
    });
    await test('historical template import is private hash-verified reference; load never returns template or creates money', async () => {
      const bytes = Buffer.from('PK synthetic isolated xlsx fixture'), hash = crypto.createHash('sha256').update(bytes).digest('hex'), key = next();
      const rows = [{ source_row: 92, folio: '001', cells: { C: 1000, D: 408, E: 1408, J: 0 } }];
      const args = [uid(1), uid(99), uid(1), key, 'synthetic.xlsx', hash, bytes.toString('base64'), JSON.stringify(rows), JSON.stringify({ columns: [{ key: 'D', label: 'Rendimiento 2025' }] })];
      await service(); await assert.rejects(value('select public.service_import_sicof_report($1,$2,$3,$4,$5,$6,$7,$8,$9) v', args.map((v, i) => i === 5 ? '0'.repeat(64) : v)), /HASH_MISMATCH/);
      const imported = await value('select public.service_import_sicof_report($1,$2,$3,$4,$5,$6,$7,$8,$9) v', args);
      assert.deepEqual(await value('select public.service_import_sicof_report($1,$2,$3,$4,$5,$6,$7,$8,$9) v', args), imported);
      await actor(); const c = await context(); assert.deepEqual(c.report.rows, rows); assert.equal(c.report.template_base64, undefined);
      assert.equal(c.participants[0].composition.balances.total, 1500);
      const template = await value('select public.get_admin_sicof_report_template($1) v', [imported.id]); assert.equal(template.template_base64.replace(/\s/g, ''), bytes.toString('base64'));
      await actor(1, 'savings.read', 'sicof'); await assert.rejects(value('select public.get_admin_sicof_report_template($1) v', [imported.id]), /ADMIN_DENIED/); assert.equal((await context()).report, null); await actor();
    });
    await test('recovery restores visibility and revokes capabilities while retaining scenarios/reference/ledger', async () => {
      await db.exec('reset role'); const counts = () => value(`select jsonb_build_array((select count(*) from sicof_private.scenarios),(select count(*) from sicof_private.historical_reports),(select count(*) from public.savings_transactions)) v`);
      await db.exec("begin; create or replace function admin_support_private.module_visible(p_subject uuid,p_module text) returns boolean language sql stable security definer set search_path='' as $$select false$$");
      await assert.rejects(db.exec(read('supabase/recovery/' + file).replace(/^begin;/, '').replace(/commit;\s*$/, '')), /RECOVERY_DRIFT/);
      await db.exec('rollback');
      const before = await counts(); await db.exec(read('supabase/recovery/' + file)); assert.deepEqual(await counts(), before);
      assert.equal(await value("select pg_get_functiondef('admin_support_private.module_visible(uuid,text)'::regprocedure) v"), visibilityBefore);
      await actor(); await assert.rejects(context(), /permission denied/);
    });
    console.log(JSON.stringify({ status: 'PASS', environment: 'isolated PostgreSQL / PGlite', checks, productionMutations: 0 }));
  } finally { await db.close(); }
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
