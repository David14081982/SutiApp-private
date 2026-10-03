'use strict';
// Isolated PostgreSQL/WASM. Captured schema/function definitions, synthetic rows only.
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const root = path.resolve(__dirname, '..');
const { PGlite } = require(process.env.SUTIAPP_PGLITE_PATH || path.join(root, '.tmp/savings-loan-eligibility/node_modules/@electric-sql/pglite'));
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const schema = JSON.parse(read('scripts/fixtures/savings-period-composition-schema.json'));
const file = '20261003000100_savings_period_composition.sql';
const uid = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');

async function fixture() {
  const db = new PGlite(); let sequence = 1000;
  const q = async (sql, params = []) => (await db.query(sql, params)).rows;
  const value = async (sql, params = []) => (await q(sql, params))[0]?.v;
  const as = async (actor = 1, permissions = 'savings.read,savings.approve') => {
    await db.exec('reset role');
    await q("select set_config('test.actor',$1,false),set_config('test.affiliate',$1,false),set_config('test.permissions',$2,false)", [actor ? uid(actor) : '', permissions]);
    await db.exec('set role authenticated');
  };
  await db.exec(`create role anon;create role authenticated;create role service_role;
    create schema auth;create schema extensions;create table auth.users(id uuid primary key);
    create function extensions.gen_random_uuid() returns uuid language sql volatile as $$select gen_random_uuid()$$;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('session_id','isolated-session')$$;
    create function public.get_effective_affiliate_id() returns uuid language sql stable as $$select nullif(current_setting('test.affiliate',true),'')::uuid$$;
    create function public.has_admin_permission(text) returns boolean language sql stable as $$select coalesce($1=any(string_to_array(current_setting('test.permissions',true),',')),false)$$;
    create function public.savings_operation_today() returns date language sql stable as $$select date '2026-10-03'$$;
    create table public.affiliates(id uuid primary key,numero_control text,full_name text,is_archived boolean default false);
    grant usage on schema public,auth to anon,authenticated,service_role;
    set check_function_bodies=off;`);
  for (const table of new Set(schema.columns.map(c => c.table_name))) {
    const cols = schema.columns.filter(c => c.table_name === table).map(c => '"' + c.column_name + '" ' + c.type +
      (table === 'savings_audit_events' && c.column_name === 'id' ? ' generated always as identity' : c.default_value ? ' default ' + c.default_value : '') + (c.required ? ' not null' : ''));
    await db.exec('create table public.' + table + '(' + cols.join(',') + ')');
  }
  for (const c of schema.constraints) await db.exec('alter table public.' + c.table_name + ' add constraint ' + c.conname + ' ' + c.definition);
  for (const f of schema.definitions) {
    await db.exec(f.definition);
    await db.exec('revoke all on function public.' + f.signature + ' from public,anon,authenticated,service_role');
  }
  await db.exec(`grant execute on function public.admin_save_savings_operation(jsonb,uuid) to authenticated;
    insert into public.savings_publication_state(id,mode,version,published_at,actor_real_auth_user_id) values(true,'PUBLISHED',1,now(),'${uid(1)}');`);
  for (const n of [1, 2]) {
    await q('insert into auth.users values($1)', [uid(n)]);
    await q('insert into public.affiliates values($1,$2,$3,false)', [uid(n), '00' + n, 'Synthetic saver ' + n]);
    await q(`insert into public.savings_participants(id,affiliate_id,legacy_folio,display_name,participant_type,identity_status,certification_status,data_classification,current_process)
      values($1,$1,$2,$3,'AFFILIATE','RESOLVED','CERTIFIED','CANONICAL','JUB')`, [uid(n), '00' + n, 'Synthetic saver ' + n]);
    await q(`insert into public.savings_enrollments(id,participant_id,sequence_number,status,enrollment_started_at,approved_at,first_expected_contribution_date,first_actual_contribution_date,process_snapshot,data_classification)
      values($1,$1,1,'ACTIVE','2026-01-05',now(),'2026-01-05','2026-01-05','JUB','CANONICAL')`, [uid(n)]);
    await q(`insert into public.savings_contribution_plans(enrollment_id,amount,process_snapshot,effective_from,data_classification) values($1,100,'JUB','2026-01-05','CANONICAL')`, [uid(n)]);
  }
  await q(`insert into public.savings_action_availability(action_code,scope_type,enabled,reason,configured_by_auth_user_id)
    values('WITHDRAW','GLOBAL',true,'Isolated test availability',$1)`, [uid(1)]);
  const tx = async ({ person = 1, type = 'REGULARIZATION', component = 'CAPITAL', direction = 'CREDIT', amount, day = '2026-09-06', contribution = null, key = null, reversalOf = null }) => {
    await db.exec('reset role'); const id = uid(sequence++);
    await q(`insert into public.savings_transactions(id,participant_id,enrollment_id,transaction_type,component,direction,amount,effective_date,contribution_date,idempotency_key,reversal_of_transaction_id,data_classification)
      values($1,$2,$2,$3,$4,$5,$6,$7,$8,$9,$10,'CANONICAL')`, [id, uid(person), type, component, direction, amount, day, contribution, key || id, reversalOf]);
    await as(); return id;
  };
  const request = async (capital, yieldAmount = 0, person = 1) => {
    await db.exec('reset role'); const id = uid(sequence++);
    await q(`insert into public.savings_requests(id,folio,participant_id,enrollment_id,request_type,withdrawal_kind,requested_amount,continue_saving,status,actor_real_auth_user_id,usuario_contexto_affiliate_id,idempotency_key,data_classification,metadata)
      values($1,$2,$3,$3,'WITHDRAW','PARTIAL',$4,true,'APPROVED',$5,$3,$1,'CANONICAL','{"origin":"SAVINGS_RUNTIME_V1"}')`, [id, 'REQ-' + sequence, uid(person), capital + yieldAmount, uid(1)]);
    await as(); return id;
  };
  const observation = async (id, person = 1, status = null) => {
    const loans = status ? [{ id: 'synthetic-loan', fund: 'Synthetic', rows: 1, status }] : [];
    await q(`select set_config('suti.savings_settlement_attestation',jsonb_build_object('actor',$1::text,'participant_id',$2::text,'request_id',$3::text,'observation',
      jsonb_build_object('source','1Vxy84N7mzbuioTmWhjRD2QFboDx--rG3iUwmLuyeY80:1245291756','folio',$4::text,'observed_at',clock_timestamp(),'scanned_rows',1,'loans',$5::jsonb))::text,false)`, [uid(1), uid(person), id, '00' + person, JSON.stringify(loans)]);
  };
  const report = person => value('select public.get_admin_savings_period_composition($1) v', [uid(person || 1)]);
  const attribute = (kind, id, slices, version, key = uid(sequence++)) => value('select public.admin_attribute_savings_' + kind + '($1,$2,$3,$4,$5) v', [id, JSON.stringify(slices), version, 'Synthetic explicit origin decision', key]);
  const settle = (command, key = uid(sequence++)) => value('select public.admin_save_savings_operation($1,$2) v', [JSON.stringify(command), key]);
  return { db, q, value, as, tx, request, observation, report, attribute, settle, next: () => uid(sequence++) };
}

async function main() {
  assert.equal(schema.production_rows, false);
  const f = await fixture(), { db, q, value, as, tx, request, observation, report, attribute, settle, next } = f;
  const checks = [];
  const test = async (name, run) => { await run(); checks.push(name); console.log('PASS ' + name); };
  const baseline = () => value(`select jsonb_object_agg(proname,jsonb_build_object('definition',pg_get_functiondef(oid),'acl',proacl,'oid',oid)) v
    from pg_proc where oid in ('public.admin_save_savings_operation(jsonb,uuid)'::regprocedure,'public.savings_canonical_user_projection(uuid)'::regprocedure)`);
  try {
    const openingCapital = await tx({ amount: 1000 }), openingYield = await tx({ component: 'YIELD', amount: 100 });
    await tx({ type: 'CONTRIBUTION', amount: 500, day: '2026-09-15', contribution: '2026-09-15' });
    await tx({ person: 2, amount: 700 });
    await db.exec('reset role'); const before = await baseline();
    await test('installation rejects audited definition, ACL and owner drift before creating journal or wrapping writer', async () => {
      for (const signature of ['public.admin_save_savings_operation(jsonb,uuid)', 'public.savings_canonical_user_projection(uuid)']) {
        for (const mutation of ['alter function ' + signature + " set search_path='public'", 'grant execute on function ' + signature + ' to anon', 'alter function ' + signature + ' owner to authenticated']) {
          await db.exec('begin'); await db.exec(mutation);
          await assert.rejects(db.exec(read('supabase/migrations/' + file).replace(/^begin;/, '').replace(/commit;\s*$/, '')), /INSTALL_BASELINE_DRIFT/);
          await db.exec('rollback'); assert.equal(await value("select to_regnamespace('savings_period_private')::text v"), null);
          assert.deepEqual(await baseline(), before);
        }
      }
    });
    await db.exec(read('supabase/migrations/' + file));
    await as();
    await test('real writer OID/ACL preserved; opening and contributions separated without double-credit', async () => {
      const after = await baseline(); for (const name of Object.keys(before)) { assert.equal(after[name].oid, before[name].oid); assert.deepEqual(after[name].acl, before[name].acl); }
      const r = await report(); assert.equal(r.balances.total, 1600); assert.equal(r.periods.find(p => p.origin_key === '2026-S2').remaining, 500);
      assert.equal(r.periods.find(p => p.origin_key === 'OPENING' && p.component === 'YIELD').remaining, 100);
    });
    await test('ordinary user/anonymous denied; private schema and immutable journal closed', async () => {
      await as(2, ''); await assert.rejects(report(), /SAVINGS_READ_DENIED/);
      await assert.rejects(q('select * from savings_period_private.attribution_events'), /permission denied/);
      await as(0, 'savings.read'); await assert.rejects(report(), /SAVINGS_READ_DENIED/); await as();
      for (const role of ['anon', 'authenticated', 'service_role']) assert.equal(await value("select has_schema_privilege($1,'savings_period_private','usage') v", [role]), false);
    });
    await test('explicit opening classification preserves money, 2025 year only, exact cents and retry', async () => {
      const r = await report(), key = next(), slices = [{ origin_key: '2025', amount: 600 }, { origin_key: '2026-S1', amount: 400 }];
      const a = await attribute('opening', openingCapital, slices, r.version, key);
      assert.deepEqual(await attribute('opening', openingCapital, slices, r.version, key), a);
      await assert.rejects(attribute('opening', openingCapital, [{ origin_key: '2025', amount: 1000 }], r.version, key), /IDEMPOTENCY_CONFLICT/);
      const after = await report(); assert.equal(after.balances.total, 1600); assert.equal(after.periods.find(p => p.origin_key === '2025').semester, null);
      await assert.rejects(attribute('opening', openingYield, [{ origin_key: '2025', amount: 99 }], after.version), /BREAKDOWN_MISMATCH/);
      await assert.rejects(attribute('opening', openingYield, [{ origin_key: '2027', amount: 100 }], after.version), /FUTURE_ORIGIN/);
      await assert.rejects(attribute('opening', openingYield, [{ origin_key: '2025', amount: 100.001 }], after.version), /SLICE_INVALID/);
      await attribute('opening', openingYield, [{ origin_key: '2025', amount: 100 }], after.version);
    });
    await test('original loan attestation remains mandatory; overdue rejection leaves ledger unchanged', async () => {
      const id = await request(100), r = await report();
      const cmd = { kind: 'SETTLE', request_id: id, capital: 100, yield: 0, origin_allocations: [{ component: 'CAPITAL', origin_key: '2025', amount: 100 }], allocation_version: r.version };
      await q("select set_config('suti.savings_settlement_attestation','',false)");
      await assert.rejects(settle(cmd), /LOAN_VERIFICATION_UNAVAILABLE/);
      await observation(id, 1, 'SALDO ATRASADO'); await assert.rejects(settle(cmd), /WITHDRAWAL_BLOCKED_BY_OVERDUE_LOAN/);
      assert.equal((await report()).balances.total, 1600);
    });
    await test('multi-origin/component payout atomic, visible in period and canonical balance, idempotent', async () => {
      const id = await request(700, 40), r = await report(), key = next(); await observation(id);
      const cmd = { kind: 'SETTLE', request_id: id, capital: 700, yield: 40, origin_allocations: [
        { component: 'CAPITAL', origin_key: '2025', amount: 600 }, { component: 'CAPITAL', origin_key: '2026-S2', amount: 100 }, { component: 'YIELD', origin_key: '2025', amount: 40 }], allocation_version: r.version };
      const result = await settle(cmd, key); assert.equal(result.status, 'SETTLED'); assert.deepEqual(await settle(cmd, key), result);
      await assert.rejects(settle({ ...cmd, capital: 699 }, key), /IDEMPOTENCY_CONFLICT/);
      const after = await report(); assert.equal(after.balances.total, 860); assert.equal(after.complete, true);
      assert.equal(after.periods.find(p => p.origin_key === '2025' && p.component === 'CAPITAL').remaining, 0);
      assert.equal(after.periods.find(p => p.origin_key === '2025' && p.component === 'YIELD').remaining, 60);
      assert.equal(after.periods.reduce((s, p) => s + p.remaining, 0), after.balances.total);
    });
    await test('invalid origin rolls back original writer, request state and both component debits', async () => {
      const id = await request(100), r = await report(); await observation(id);
      const cmd = { kind: 'SETTLE', request_id: id, capital: 100, yield: 0, origin_allocations: [{ component: 'CAPITAL', origin_key: '2025', amount: 100 }], allocation_version: r.version };
      await assert.rejects(settle(cmd), /ORIGIN_EXCEEDED/); assert.equal((await report()).balances.total, 860);
      await db.exec('reset role'); assert.equal(await value('select status v from public.savings_requests where id=$1', [id]), 'APPROVED'); await as();
      await assert.rejects(settle({ ...cmd, allocation_version: 'stale' }), /VERSION_CHANGED/);
    });
    await test('old payout call works; attribution later changes no money and never silently assumes FIFO', async () => {
      const id = await request(150), key = next(); await observation(id);
      await settle({ kind: 'SETTLE', request_id: id, capital: 150, yield: 0 }, key);
      const r = await report(); assert.equal(r.balances.total, 710); assert.equal(r.complete, false);
      assert.equal(r.periods.find(p => p.origin_key === '2026-S1').remaining, null);
      const debit = r.movements.find(m => m.type === 'WITHDRAWAL' && m.origins[0].origin_key === 'UNALLOCATED_WITHDRAWAL');
      await attribute('withdrawal', debit.transaction_id, [{ origin_key: '2026-S1', amount: 150 }], r.version);
      const after = await report(); assert.equal(after.balances.total, 710); assert.equal(after.complete, true);
      assert.equal(after.periods.find(p => p.origin_key === '2026-S1').remaining, 250);
    });
    await test('real self projection preserves prior DTO and adds exact same period balance data', async () => {
      await db.exec('reset role');
      const original = await value('select savings_period_private.projection_before($1) v', [uid(1)]);
      const extended = await value('select public.savings_canonical_user_projection($1) v', [uid(1)]);
      const addition = extended.period_balances; delete extended.period_balances; assert.deepEqual(extended, original);
      assert.equal(addition.balances.total, 710); assert.equal(addition.movements, undefined); assert.equal(addition.version, undefined); await as();
    });
    await test('yield uses its approved period, receipt corrections remain in origin, holds stay component-level', async () => {
      await db.exec('reset role'); const period = next(), allocation = next();
      await q(`insert into public.savings_yield_periods(id,period_year,semester,starts_on,ends_on,rate,status,productive_enabled)
        values($1,2026,1,'2026-01-01','2026-06-30',1,'CREDITED',true)`, [period]);
      await q(`insert into public.savings_yield_allocations(id,yield_period_id,participant_id,eligible,calculation_basis,calculated_amount,approved_amount,status)
        values($1,$2,$3,true,2500,25,25,'CREDITED')`, [allocation, period, uid(1)]);
      await tx({ type: 'YIELD_CREDIT', component: 'YIELD', amount: 25, day: '2026-10-03', key: 'PERIOD_YIELD:' + period + ':' + uid(1) });
      await tx({ type: 'ADJUSTMENT', direction: 'DEBIT', amount: 50, contribution: '2026-09-15', day: '2026-10-03' });
      await db.exec('reset role'); await q(`insert into public.savings_holds(participant_id,component,amount,reason,created_by_auth_user_id)
        values($1,'CAPITAL',100,'Synthetic hold',$1)`, [uid(1)]); await as();
      const r = await report(); assert.equal(r.balances.total, 685); assert.equal(r.balances.available, 585);
      assert.equal(r.periods.find(p => p.origin_key === '2026-S1' && p.component === 'YIELD').recognized, 25);
      assert.equal(r.periods.find(p => p.origin_key === '2026-S2').adjustments, 50);
      assert(r.periods.every(p => p.available === undefined), 'no invented distribution of component holds');
      const prior = await value("select public.get_admin_savings_period_composition($1,'2026-09-30') v", [uid(1)]);
      assert.equal(prior.as_of_balance.total, 1600); assert.equal(prior.as_of_balance.capital, 1500);
      const unknown = await value("select public.get_admin_savings_period_composition($1,'2025-12-31') v", [uid(1)]);
      assert.equal(unknown.as_of_complete, false); assert.equal(unknown.as_of_balance.total, null);
    });
    await test('historical withdrawal cannot consume later money in the same origin', async () => {
      const old = await tx({ person: 2, type: 'WITHDRAWAL', direction: 'DEBIT', amount: 20, day: '2026-09-10' });
      await tx({ person: 2, type: 'CONTRIBUTION', amount: 50, day: '2026-09-15', contribution: '2026-09-15' });
      const r = await report(2);
      await assert.rejects(attribute('withdrawal', old, [{ origin_key: '2026-S2', amount: 20 }], r.version), /ORIGIN_NOT_AVAILABLE_AT_PAYMENT/);
      await attribute('withdrawal', old, [{ origin_key: 'OPENING', amount: 20 }], r.version);
      assert.equal((await report(2)).balances.total, 730);
    });
    await test('full reversal restores every attributed origin exactly and nets withdrawn without new recognition', async () => {
      await db.exec('reset role;begin');
      try {
        const before = await report(), original = before.movements.find(m => m.type === 'WITHDRAWAL' && m.amount === 700);
        await tx({ type: 'REVERSAL', amount: 700, day: '2026-10-03', reversalOf: original.transaction_id });
        const after = await report(), year = after.periods.find(p => p.origin_key === '2025' && p.component === 'CAPITAL');
        assert.equal(after.balances.total, before.balances.total + 700); assert.equal(after.complete, true);
        assert.equal(year.recognized, 600); assert.equal(year.withdrawn, 0); assert.equal(year.remaining, 600);
        assert.equal(after.periods.find(p => p.origin_key === '2026-S2').withdrawn, 0);
      } finally { await db.exec('rollback'); await as(); }
    });
    await test('partial single-origin reversal is exact; multi-origin partial stays uncertain without proportional allocation', async () => {
      await db.exec('reset role;begin');
      try {
        const before = await report(), mono = before.movements.find(m => m.type === 'WITHDRAWAL' && m.component === 'YIELD');
        await tx({ type: 'REVERSAL', component: 'YIELD', amount: 10, day: '2026-10-03', reversalOf: mono.transaction_id });
        let after = await report(), year = after.periods.find(p => p.origin_key === '2025' && p.component === 'YIELD');
        assert.equal(year.recognized, 100); assert.equal(year.withdrawn, 30); assert.equal(year.remaining, 70); assert.equal(after.complete, true);
        const multi = before.movements.find(m => m.type === 'WITHDRAWAL' && m.amount === 700);
        await tx({ type: 'REVERSAL', amount: 50, day: '2026-10-03', reversalOf: multi.transaction_id });
        after = await report(); assert.equal(after.complete, false);
        assert.equal(after.periods.find(p => p.origin_key === '2025' && p.component === 'CAPITAL').remaining, null);
        assert.equal(after.periods.find(p => p.origin_key === 'UNALLOCATED_REVERSAL').recognized, 50);
      } finally { await db.exec('rollback'); await as(); }
    });
    await test('cross-semester reversal preserves original period and respects the report cutoff', async () => {
      await db.exec('reset role;begin');
      try {
        const credit = await tx({ type: 'CONTRIBUTION', amount: 100, day: '2026-01-05', contribution: '2026-01-05' });
        await tx({ type: 'REVERSAL', direction: 'DEBIT', amount: 40, day: '2026-07-01', contribution: '2026-07-01', reversalOf: credit });
        const june = await value("select public.get_admin_savings_period_composition($1,'2026-06-30') v", [uid(1)]);
        const july = await value("select public.get_admin_savings_period_composition($1,'2026-07-01') v", [uid(1)]);
        assert.equal(june.periods.find(p => p.origin_key === '2026-S1').remaining, 100);
        assert.equal(july.periods.find(p => p.origin_key === '2026-S1').remaining, 60);
        assert.equal(july.periods.some(p => p.origin_key === '2026-S2'), false, 'reversal supplied date cannot replace the linked original date');
      } finally { await db.exec('rollback'); await as(); }
    });
    await test('orphan dated adjustment and invalid cross-account or over-reversal remain explicit uncertainty', async () => {
      await db.exec('reset role;begin');
      try {
        await tx({ type: 'ADJUSTMENT', amount: 10, day: '2026-10-03', contribution: '2026-08-15' });
        let current = await report(); assert(current.unresolved.some(p => p.origin_key === 'UNALLOCATED_CREDIT'));
        const otherOriginal = (await report(2)).movements.find(m => m.type === 'WITHDRAWAL');
        await tx({ type: 'REVERSAL', amount: 10, day: '2026-10-03', reversalOf: otherOriginal.transaction_id });
        current = await report(); assert(current.unresolved.some(p => p.origin_key === 'UNALLOCATED_REVERSAL'));
        const original = current.movements.find(m => m.type === 'WITHDRAWAL' && m.component === 'YIELD');
        await tx({ type: 'REVERSAL', component: 'YIELD', amount: 41, day: '2026-10-03', reversalOf: original.transaction_id });
        current = await report(); assert.equal(current.periods.find(p => p.origin_key === '2025' && p.component === 'YIELD').remaining, null);
      } finally { await db.exec('rollback'); await as(); }
    });
    await test('unknown credits do not cancel uncertainty about the origin of unknown withdrawals', async () => {
      await tx({ person: 2, type: 'ADJUSTMENT', amount: 100, day: '2026-10-03' });
      await tx({ person: 2, type: 'WITHDRAWAL', direction: 'DEBIT', amount: 50, day: '2026-10-03' });
      const r = await report(2);
      assert.equal(r.balances.total, 780); assert.equal(r.complete, false);
      assert.equal(r.periods.find(p => p.origin_key === 'UNALLOCATED_CREDIT').recognized, 100);
      assert.equal(r.periods.find(p => p.origin_key === 'UNALLOCATED_WITHDRAWAL').withdrawn, 50);
      assert.equal(r.periods.find(p => p.origin_key === '2026-S2').remaining_before_unallocated, 50);
      assert.equal(r.periods.find(p => p.origin_key === '2026-S2').remaining, null);
      assert.equal(r.periods.find(p => p.origin_key === 'OPENING').remaining, null);
    });
    await test('immutable history and recovery retain all ledger and journal rows', async () => {
      await db.exec('reset role');
      await assert.rejects(q("update savings_period_private.attribution_events set reason='changed'"), /APPEND_ONLY_HISTORY/);
      await db.exec('begin');
      await db.exec("create or replace function public.savings_canonical_user_projection(p_participant_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$begin return '{}'::jsonb;end$$");
      await assert.rejects(db.exec(read('supabase/recovery/' + file).replace(/^begin;/, '').replace(/commit;\s*$/, '')), /RECOVERY_DRIFT/);
      await db.exec('rollback');
      const counts = () => value(`select jsonb_build_array((select count(*) from public.savings_transactions),(select count(*) from savings_period_private.attribution_events)) v`);
      const rowsBefore = await counts(); await db.exec(read('supabase/recovery/' + file)); assert.deepEqual(await counts(), rowsBefore); assert.deepEqual(await baseline(), before);
      assert.equal(await value("select has_function_privilege('authenticated','public.admin_attribute_savings_opening(uuid,jsonb,text,text,uuid)','execute') v"), false);
    });
    console.log(JSON.stringify({ status: 'PASS', environment: 'isolated PostgreSQL / PGlite', checks, productionMutations: 0 }));
  } finally { await db.close(); }
}
module.exports = { fixture };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
