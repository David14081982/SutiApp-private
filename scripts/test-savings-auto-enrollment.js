'use strict';
// Isolated PostgreSQL/WASM only. No credentials, network, live SQL or disk evidence.
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const root = path.resolve(__dirname, '..'), read = p => fs.readFileSync(path.join(root, p), 'utf8');
const { PGlite } = require(process.env.SUTIAPP_PGLITE_PATH || path.join(root, '.tmp/savings-loan-eligibility/node_modules/@electric-sql/pglite'));
const schema = JSON.parse(read('scripts/fixtures/savings-individual-withdrawal-schema.json'));
const uid = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
function definition(source, name) {
  const pattern = new RegExp('create (?:or replace )?function public\\.' + name + '\\(', 'i');
  const start = source.search(pattern); assert(start >= 0, name);
  const end = source.indexOf('$$;', start); assert(end > start, name + ' end');
  return source.slice(start, end + 3);
}
async function main() {
  const db = new PGlite(); let serial = 1000;
  const query = async (sql, args = []) => (await db.query(sql, args)).rows;
  const scalar = async (sql, args = []) => (await query(sql, args))[0].v;
  const owner = () => db.exec('reset role');
  const actor = async (person, permissions = '', principal = person) => {
    await owner();
    await query("select set_config('test.uid',$1,false),set_config('test.affiliate',$2,false),set_config('test.permissions',$3,false)", [principal ? uid(principal) : '', person ? uid(person) : '', permissions]);
    await db.exec('set role authenticated');
  };
  const submit = (person, amount = 500, key = uid(serial++), note = '') => scalar('select public.submit_self_savings_join($1,$2,$3,$4) v', [amount, uid(person), note, key]);
  const context = () => scalar('select public.get_self_savings_join_context(500) v');
  const admin = command => scalar('select public.admin_save_savings_operation($1,$2) v', [JSON.stringify(command), uid(serial++)]);
  const person = async (id, category = 'BASE') => {
    await owner();
    await query('insert into auth.users values($1)', [uid(id)]);
    await query('insert into affiliates(id,auth_user_id,numero_control,full_name,financial_employee_category_code) values($1,$1,$2,$3,$4)', [uid(id), '00' + id, 'PERSONA SINTÉTICA ' + id, category]);
  };
  const check = async (name, body) => { await body(); console.log('PASS ' + name); };
  const migration = read('supabase/migrations/20261001000100_savings_auto_enrollment.sql');
  const recovery = read('supabase/recovery/20261001000100_savings_auto_enrollment.sql');
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;
      create schema auth;create schema extensions;create table auth.users(id uuid primary key);
      create function extensions.gen_random_uuid() returns uuid language sql volatile as $$select gen_random_uuid()$$;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
      create function public.has_admin_permission(text) returns boolean language sql stable as $$select coalesce($1=any(string_to_array(current_setting('test.permissions',true),',')),false)$$;
      create function public.get_effective_affiliate_id() returns uuid language sql stable as $$select nullif(current_setting('test.affiliate',true),'')::uuid$$;
      create table affiliates(id uuid primary key,auth_user_id uuid,numero_control text,full_name text,is_archived boolean default false,financial_employee_category_code text,financial_union_code text,unit_raw text);
      create table affiliate_documents(id uuid primary key,affiliate_id uuid references affiliates(id));
      create table savings_import_batches(id uuid primary key);
      create table savings_review_records(id uuid primary key default gen_random_uuid(),source_sheet text,source_folio text);
      create table savings_publication_state(id boolean primary key,mode text);insert into savings_publication_state values(true,'PUBLISHED');
      grant usage on schema public,auth to anon,authenticated,service_role;
    `);
    const foundation = read('supabase/migrations/20260902000100_savings_shadow_foundation.sql');
    for (const table of ['savings_participants', 'savings_enrollments', 'savings_contribution_plans', 'savings_contribution_overrides', 'savings_transactions', 'savings_action_availability', 'savings_holds', 'savings_requests', 'savings_audit_events']) {
      const start = foundation.indexOf('create table public.' + table + '('), end = foundation.indexOf('\n);', start);
      assert(start >= 0 && end > start, table);
      await db.exec(foundation.slice(start, end + 3));
      for (const index of foundation.matchAll(new RegExp('create (?:unique )?index [^;]+ on public\\.' + table + '\\([^;]+;', 'g'))) await db.exec(index[0]);
      await db.exec(`alter table public.${table} enable row level security;alter table public.${table} force row level security;`);
    }
    const settings = schema.columns.filter(c => c.table_name === 'savings_operation_settings').map(c => '"' + c.column_name + '" ' + c.type + (c.default_value ? ' default ' + c.default_value : '') + (c.required ? ' not null' : ''));
    await db.exec('create table savings_operation_settings(' + settings.join(',') + ')');
    await db.exec(definition(foundation, 'savings_participant_balance'));
    const operations = read('supabase/migrations/20260906000100_savings_operations.sql');
    for (const name of ['savings_operation_today', 'savings_next_contribution_date', 'generate_savings_schedule', 'savings_next_enrollment_date']) await db.exec(definition(operations, name));
    await db.exec(schema.definitions.find(x => x.name === 'savings_effective_action').definition);
    await db.exec(read('supabase/migrations/20260913000300_savings_requests_runtime.sql'));
    await db.exec(read('supabase/migrations/20260914000100_savings_self_join.sql'));
    // The real installed document trigger consumes the approval event. Only its
    // unrelated layout resolver and storage tables are isolated dependency contracts.
    await db.exec(`create schema document_private;create table document_private.installation(enabled boolean);insert into document_private.installation values(true);
      create function document_private.resolve_scoped_layout(text,text,timestamptz,jsonb) returns jsonb language sql as $$select '{}'::jsonb$$;
      create table document_private.records(domain text,operation_id uuid,final_event_id text,document_type text,affiliate_id uuid,program text,folio text,occurred_at timestamptz,source_snapshot jsonb,document_snapshot jsonb,status text,error_code text,business_version int default 1,unique(domain,operation_id,final_event_id,document_type,business_version));`);
    for (const trigger of schema.triggers) { await db.exec(trigger.function); await db.exec(trigger.definition); }
    await person(1); await person(2);
    await actor(1, 'savings.write,savings.approve,savings.read');
    const pending = await admin({ kind: 'SUBMIT', type: 'JOIN', folio: '002', new_amount: 300, process: 'PROCESS_1', observation: '' });
    assert.equal(pending.status, 'SUBMITTED');
    await owner();
    const pendingBefore = await scalar('select to_jsonb(r) v from savings_requests r where id=$1', [pending.id]);
    const functionState = () => scalar("select jsonb_object_agg(oid::regprocedure::text,jsonb_build_object('definition',pg_get_functiondef(oid),'acl',proacl)) v from pg_proc where pronamespace='public'::regnamespace and proname in ('savings_runtime_submit','admin_save_savings_operation','get_self_savings_join_context','get_admin_savings_runtime_requests')");
    const before = await functionState();
    await check('forward and exact empty recovery; existing request unchanged', async () => {
      await db.exec(migration); await db.exec(recovery); assert.deepEqual(await functionState(), before);
      assert.deepEqual(await scalar('select to_jsonb(r) v from savings_requests r where id=$1', [pending.id]), pendingBefore);
      await db.exec(migration);
    });
    await check('six categories: automatic enrollment, calendar, no receipt/money and document event', async () => {
      const categories = ['BASE', 'EVENTUALES', 'SUPLENTES_FIJOS', 'CONFIANZA', 'SUPLENTES_VARIABLES', 'JUBILADOS_PENSIONADOS'];
      for (let index = 0; index < categories.length; index++) {
        const id = 10 + index, process = index === 5 ? 'JUB' : index === 4 ? 'PROCESS_3' : 'PROCESS_1';
        await person(id, categories[index]); await actor(id);
        assert.equal((await context()).auto_join_enabled, true);
        const key = uid(serial++), result = await submit(id, 500, key);
        assert.equal(result.status, 'APPROVED'); assert.equal(result.automatic_join, true);
        assert.equal(result.actor_real_auth_user_id, uid(id)); assert.equal(result.usuario_contexto_affiliate_id, uid(id));
        assert.equal(result.metadata.registration_mode, 'SELF_SERVICE_AUTOMATIC');
        assert.deepEqual(await submit(id, 500, key), result, 'identical idempotent replay');
        await assert.rejects(submit(id, 600, key), /IDEMPOTENCY_CONFLICT/);
        await assert.rejects(submit(id), /ENROLLMENT_ALREADY_OPEN/);
        assert.equal((await context()).reason, 'ALREADY_SAVING');
        await owner();
        assert.equal(result.effective_from, await scalar('select public.savings_next_contribution_date(public.savings_operation_today()+30,$1)::text v', [process]));
        const enrollment = (await query('select * from savings_enrollments where id=$1', [result.enrollment_id]))[0];
        assert.equal(enrollment.first_actual_contribution_date, null);
        assert.equal(new Date(enrollment.first_expected_contribution_date).toISOString().slice(0, 10), result.effective_from);
        assert.equal(await scalar("select (enrollment_started_at at time zone 'America/Hermosillo')::date::text v from savings_enrollments where id=$1", [result.enrollment_id]), result.effective_from, 'tenure contract preserved');
        assert.equal(await scalar('select count(*)::int v from savings_contribution_plans where source_request_id=$1', [result.id]), 1);
        assert.equal(await scalar('select count(*)::int v from savings_transactions'), 0);
        assert.equal(await scalar('select count(*)::int v from savings_contribution_overrides'), 0);
        const events = await query('select action,actor_real_auth_user_id,after_data from savings_audit_events where target_id=$1 order by id', [result.id]);
        assert.deepEqual(events.map(e => e.action), ['SUBMIT', 'APPROVE']);
        assert(events.every(e => e.actor_real_auth_user_id === uid(id)));
        const docs = await query('select * from document_private.records where operation_id=$1', [result.id]);
        assert.equal(docs.length, 1); assert.equal(docs[0].document_type, 'SAVINGS_ENROLLMENT_APPROVAL'); assert.equal(docs[0].status, 'PENDING');
        assert.equal(docs[0].source_snapshot.operation.new_contribution_amount, 500);
      }
    });
    await check('ACL, no approval privilege, direct helper/table denial and context isolation', async () => {
      await actor(10);
      await assert.rejects(admin({ kind: 'REVIEW', request_id: pending.id, decision: 'APPROVE' }), /APPROVE_DENIED/);
      await assert.rejects(query('select savings_activate_join($1,$2,current_date+30)', [pending.id, 'PROCESS_1']), /permission denied/);
      await assert.rejects(query('select * from savings_requests'), /permission denied/);
      await assert.rejects(submit(11), /CONTEXT_CHANGED/);
      await actor(10, '', null); await assert.rejects(submit(10), /CONTEXT_CHANGED/);
      await owner(); await db.exec('set role anon'); await assert.rejects(submit(10), /permission denied/);
      await owner();
      assert.equal(await scalar("select has_function_privilege('service_role','savings_activate_join(uuid,text,date)','execute') v"), false);
      assert.equal(await scalar("select has_table_privilege('authenticated','savings_auto_enrollment_backup','select') v"), false);
    });
    await check('minimum, malformed amount, missing category and exact identity fail closed', async () => {
      await person(30); await actor(30);
      for (const amount of [199, 200.001, 'NaN', 'Infinity']) await assert.rejects(submit(30, amount), /MINIMUM_200|CONTRIBUTION_AMOUNT_REQUIRED|numeric field overflow/);
      await owner(); await query('update affiliates set financial_employee_category_code=null where id=$1', [uid(30)]); await actor(30);
      assert.equal((await context()).reason, 'CATEGORY_REQUIRED'); await assert.rejects(submit(30), /CALENDAR_INPUT_INVALID/);
      await owner(); await query("update affiliates set financial_employee_category_code='BASE' where id=$1", [uid(30)]);
      await query("insert into affiliates(id,numero_control,is_archived) values($1,'0030',true)", [uid(31)]); await actor(30);
      await assert.rejects(submit(30), /EXACT_IDENTITY_REQUIRED/);
      await owner(); await query('delete from affiliates where id=$1', [uid(31)]);
    });
    await check('closed intake and unconfirmed historical opening preserved', async () => {
      await owner(); await query("insert into savings_action_availability(action_code,scope_type,enabled,reason,configured_by_auth_user_id) values('JOIN','GLOBAL',false,'Isolated closed intake',$1)", [uid(1)]);
      await actor(30); assert.equal((await context()).reason, 'INTAKE_CLOSED'); await assert.rejects(submit(30), /ACTION_DISABLED/);
      await owner(); await db.exec('delete from savings_action_availability');
      await query("insert into savings_review_records(source_sheet,source_folio) values('Ahorro','0030')"); await actor(30);
      assert.equal((await context()).reason, 'OPENING_REVIEW'); await assert.rejects(submit(30), /OPENING_CONFIRMATION_REQUIRED/);
      await owner(); await db.exec("delete from savings_review_records where source_folio='0030'");
    });
    await check('previous pending is not auto-processed; administrative helper creates exactly one plan', async () => {
      await actor(2); await assert.rejects(submit(2), /PENDING_REQUEST_EXISTS/);
      await owner(); assert.deepEqual(await scalar('select to_jsonb(r) v from savings_requests r where id=$1', [pending.id]), pendingBefore);
      await actor(1, 'savings.read,savings.write,savings.approve');
      const approved = await admin({ kind: 'REVIEW', request_id: pending.id, decision: 'APPROVE', observation: '' });
      assert.equal(approved.status, 'APPROVED'); assert.equal(approved.metadata.registration_mode, undefined);
      assert.equal((await scalar('select get_admin_savings_runtime_requests(null) v')).auto_join_enabled, true);
      await owner(); assert.equal(await scalar('select count(*)::int v from savings_contribution_plans where source_request_id=$1', [pending.id]), 1);
    });
    await check('audit failure rolls back participant, request, enrollment, plan and documents', async () => {
      await person(40); await db.exec("alter table savings_audit_events add constraint isolated_approval_failure check(action<>'APPROVE') not valid");
      await actor(40); await assert.rejects(submit(40), /isolated_approval_failure/);
      await owner(); assert.equal(await scalar('select count(*)::int v from savings_participants where affiliate_id=$1', [uid(40)]), 0);
      assert.equal(await scalar('select count(*)::int v from savings_requests where usuario_contexto_affiliate_id=$1', [uid(40)]), 0);
      assert.equal(await scalar('select count(*)::int v from document_private.records where affiliate_id=$1', [uid(40)]), 0);
      await db.exec('alter table savings_audit_events drop constraint isolated_approval_failure');
    });
    await check('manual registration remains manual; renewal preserves old enrollment and zero cash', async () => {
      await person(50); await actor(1, 'savings.write,savings.approve,savings.read');
      assert.equal((await admin({ kind: 'SUBMIT', type: 'JOIN', folio: '0050', new_amount: 200, process: 'PROCESS_1' })).status, 'SUBMITTED');
      await owner(); await query("update savings_enrollments set status='TERMINATED',terminated_at=now()-interval '1 day',continue_saving=false where participant_id=(select id from savings_participants where affiliate_id=$1)", [uid(10)]);
      const historical = await scalar('select to_jsonb(e) v from savings_enrollments e where participant_id=(select id from savings_participants where affiliate_id=$1)', [uid(10)]);
      await actor(10); const renewed = await submit(10, 200);
      await owner(); assert.deepEqual(await scalar('select to_jsonb(e) v from savings_enrollments e where id=$1', [historical.id]), historical);
      assert.equal(await scalar('select sequence_number v from savings_enrollments where id=$1', [renewed.enrollment_id]), 2);
      assert.equal(await scalar('select count(*)::int v from savings_transactions'), 0);
    });
    await check('CHANGE_AMOUNT, WITHDRAW and TERMINATE stay manual; shared review keeps change-plan behavior', async () => {
      await owner();
      await query("insert into savings_action_availability(action_code,scope_type,enabled,reason,configured_by_auth_user_id) select x,'GLOBAL',true,'Isolated operation access',$1 from unnest(array['CHANGE_AMOUNT','WITHDRAW']) x", [uid(1)]);
      const enrollment = (await query('select e.* from savings_enrollments e join savings_participants p on p.id=e.participant_id where p.affiliate_id=$1', [uid(11)]))[0];
      await query("update savings_enrollments set first_expected_contribution_date=public.savings_operation_today()-60 where id=$1", [enrollment.id]);
      await query('update savings_contribution_plans set effective_from=public.savings_operation_today()-60 where enrollment_id=$1', [enrollment.id]);
      await query("insert into savings_transactions(participant_id,enrollment_id,transaction_type,component,direction,amount,effective_date,idempotency_key,data_classification) values($1,$2,'CONTRIBUTION','CAPITAL','CREDIT',1000,public.savings_operation_today()-60,'ISOLATED_EXISTING_RECEIPT','CANONICAL')", [enrollment.participant_id, enrollment.id]);
      await actor(11);
      const request = (type, amount, contribution) => scalar('select submit_self_savings_request($1,$2,null,null,$3,$4,null,$5,null,$6) v', [type, amount, contribution, type !== 'TERMINATE', '', uid(serial++)]);
      const change = await request('CHANGE_AMOUNT', null, 600), withdrawal = await request('WITHDRAW', 100, null), terminate = await request('TERMINATE', 0, null);
      for (const result of [change, withdrawal, terminate]) { assert.equal(result.status, 'SUBMITTED'); assert.equal(result.automatic_join, undefined); }
      await owner(); assert.equal(await scalar('select status v from savings_enrollments where id=$1', [enrollment.id]), 'ACTIVE');
      const moneyBefore = await scalar('select jsonb_agg(to_jsonb(t) order by id) v from savings_transactions t');
      await actor(1, 'savings.read,savings.approve');
      const reviewed = await admin({ kind: 'REVIEW', request_id: change.id, decision: 'APPROVE', observation: '' });
      assert.equal(reviewed.status, 'APPROVED');
      await owner();
      assert.equal(await scalar('select count(*)::int v from savings_contribution_plans where source_request_id=$1 and amount=600', [change.id]), 1);
      assert.equal(await scalar('select count(*)::int v from savings_contribution_plans where enrollment_id=$1', [enrollment.id]), 2);
      assert.deepEqual(await scalar('select jsonb_agg(to_jsonb(t) order by id) v from savings_transactions t'), moneyBefore);
    });
    await check('recovery refuses installed definition drift', async () => {
      await owner();
      const installed = await scalar("select pg_get_functiondef('savings_runtime_submit(uuid,jsonb,uuid,boolean)'::regprocedure) v");
      await db.exec("alter function savings_runtime_submit(uuid,jsonb,uuid,boolean) set statement_timeout='30s'");
      await assert.rejects(db.exec(recovery), /RECOVERY_DEFINITION_DRIFT/); await db.exec('rollback');
      await db.exec(installed);
    });
    await check('recovery after use restores exact definitions/ACL and preserves all financial/documentary history', async () => {
      await owner();
      const history = () => scalar("select jsonb_build_object('participants',(select jsonb_agg(to_jsonb(t) order by id) from savings_participants t),'requests',(select jsonb_agg(to_jsonb(t) order by id) from savings_requests t),'enrollments',(select jsonb_agg(to_jsonb(t) order by id) from savings_enrollments t),'plans',(select jsonb_agg(to_jsonb(t) order by id) from savings_contribution_plans t),'ledger',(select jsonb_agg(to_jsonb(t) order by id) from savings_transactions t),'receipts',(select jsonb_agg(to_jsonb(t) order by id) from savings_contribution_overrides t),'audit',(select jsonb_agg(to_jsonb(t) order by id) from savings_audit_events t),'documents',(select jsonb_agg(to_jsonb(t) order by operation_id) from document_private.records t)) v");
      const after = await history(); await db.exec(recovery);
      assert.deepEqual(await history(), after); assert.deepEqual(await functionState(), before);
      assert.equal(await scalar("select to_regprocedure('public.savings_activate_join(uuid,text,date)') is null v"), true);
    });
    console.log('PASS isolated automatic JOIN; production writes 0; permanent evidence files 0; Auth/permission/layout providers are isolated contracts.');
  } finally { await db.close(); }
}
main().catch(error => { console.error(error.stack || error.message, error.where || ''); process.exitCode = 1; });
