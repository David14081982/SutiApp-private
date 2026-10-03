'use strict';
// Real existing Auth sessions; allowlisted reads only. No financial writers or fixtures.
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { query } = require('./savings-admin-review-db');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'docs/qa/evidence/sicof');
const tables = ['savings_transactions', 'savings_requests', 'savings_participants', 'savings_enrollments', 'savings_holds', 'savings_yield_periods', 'savings_yield_allocations'];
const allowedRpc = new Set(['has_admin_permission', 'get_self_savings_live_readonly', 'get_admin_sicof_context', 'get_admin_savings_period_composition', 'get_admin_sicof_report_template', 'get_admin_sicof_behavior_context']);
const aliases = ['H005_TEST', 'H005_TEST2', 'H005_TEST3'];
const hash = value => crypto.createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const same = (a, b, code) => assert(hash(stable(a)) === hash(stable(b)), code);
const readEnv = () => Object.fromEntries(fs.readFileSync(path.join(root, 'supabase.env'), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).map(line => line.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map(m => [m[1], m[2].trim().replace(/^['"]|['"]$/g, '')]));
async function database(sql) { return query('begin read only;set local statement_timeout=\'60s\';' + sql + ';commit;'); }
async function ledger() {
  return database(tables.map(name => `select '${name}' resource,count(*)::int count,md5(coalesce(string_agg(to_jsonb(t)::text,'|' order by id),'')) fingerprint from public.${name} t`).join(' union all '));
}
async function main() {
  const pre = process.argv.includes('--pre'), post = process.argv.includes('--post'), edge = process.argv.includes('--edge');
  assert(pre !== post && (!edge || post), 'USE_PRE_OR_POST_WITH_OPTIONAL_EDGE');
  const mode = pre ? 'pre' : 'post', file = path.join(out, 'live-' + mode + '.json');
  assert(!pre || !fs.existsSync(file), 'PRE_BASELINE_ALREADY_EXISTS_DO_NOT_OVERWRITE');
  const env = readEnv(), base = env.SUPABASE_URL.replace(/\/$/, '');
  const proof = { status: 'FAIL', mode: 'LIVE_READ_ONLY_' + mode.toUpperCase(), at: new Date().toISOString(), businessWrites: 0, syntheticRows: 0, credentialsLogged: false, checks: [] };
  const fail = code => { throw Error(code); };
  async function request(route, token, body) {
    const r = await fetch(base + route, { method: 'POST', headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body), signal: AbortSignal.timeout(180000) });
    return { ok: r.ok, status: r.status, data: await r.json().catch(() => null) };
  }
  async function rpc(name, body, token) { assert(allowedRpc.has(name), 'UNAPPROVED_RPC'); return request('/rest/v1/rpc/' + name, token, body); }
  async function edgeRead(body, token) { assert(['LOAD', 'BEHAVIOR', 'EXPORT'].includes(body.action), 'UNAPPROVED_EDGE_ACTION'); return request('/functions/v1/sicof', token, body); }
  function good(result, code) { if (!result.ok) fail(code + '_HTTP_' + result.status); return result.data; }
  function denied(result, code) { assert([401, 403].includes(result.status), code + '_HTTP_' + result.status); }
  async function test(name, run) { await run(); proof.checks.push({ name, status: 'PASS' }); console.log('PASS ' + name); }
  try {
    proof.ledgerBefore = await ledger();
    const sessions = {};
    for (const alias of aliases.filter(alias => env[alias + '_EMAIL'] && env[alias + '_PASSWORD'])) {
      sessions[alias] = good(await request('/auth/v1/token?grant_type=password', null, { email: env[alias + '_EMAIL'], password: env[alias + '_PASSWORD'] }), alias + '_LOGIN');
    }
    assert(sessions.H005_TEST, 'ADMIN_CREDENTIALS_REQUIRED');
    const admin = sessions.H005_TEST.access_token, ordinary = sessions.H005_TEST2?.access_token;
    proof.ordinaryAuthenticatedCoverage = Boolean(ordinary);
    if (!ordinary) proof.limitations = ['No existing ordinary-user credentials were available; ordinary-user authenticated denial not executed. No account or password was created/changed.'];
    const deniedOrdinary = async (run, code) => { if (ordinary) denied(await run(), code); };
    await test(ordinary ? 'existing admin and ordinary sessions retain distinct backend permissions' : 'existing admin session has the backend read permission', async () => {
      assert.equal(good(await rpc('has_admin_permission', { required_permission: 'savings.read' }, admin), 'ADMIN_PERMISSION'), true);
      if (ordinary) assert.equal(good(await rpc('has_admin_permission', { required_permission: 'savings.read' }, ordinary), 'ORDINARY_PERMISSION'), false);
    });
    const self = {}, selfRaw = {};
    await test('existing self readers authenticate and expose only their own account', async () => {
      for (const alias of Object.keys(sessions)) {
        const data = good(await rpc('get_self_savings_live_readonly', {}, sessions[alias].access_token), alias + '_SELF');
        const { period_balances, ...beforeFields } = data;
        self[alias] = { previousDtoHash: hash(stable(beforeFields)), previousBalanceHash: hash(stable(data.balances)), hasParticipant: Boolean(data.participant) };
        selfRaw[alias] = data;
      }
      const ids = Object.values(selfRaw).map(v => v.participant?.id).filter(Boolean);
      assert.equal(new Set(ids).size, ids.length, 'SELF_IDENTITIES_NOT_DISTINCT'); proof.selfAccountsWithSavings = ids.length;
      denied(await rpc('get_self_savings_live_readonly', {}, null), 'ANONYMOUS_SELF_ALLOWED');
    });
    proof.self = self;
    if (post) {
      const before = JSON.parse(fs.readFileSync(path.join(out, 'live-pre.json'), 'utf8'));
      await test('seven canonical tables and every original self field remain identical to pre-deployment', async () => {
        same(proof.ledgerBefore, before.ledgerBefore, 'CANONICAL_TABLE_CHANGED_SINCE_PRE');
        same(self, before.self, 'SELF_DTO_CHANGED_SINCE_PRE');
      });
      await test('private schemas, tables and functions are closed; RLS forced and service writers remain service-only', async () => {
        const rows = await database(`select n.nspname schema,c.relname name,c.relrowsecurity rls,c.relforcerowsecurity forced,
          (select bool_and(not has_schema_privilege(r,n.oid,'USAGE') and not has_table_privilege(r,c.oid,'SELECT,INSERT,UPDATE,DELETE')) from unnest(array['anon','authenticated','service_role'])r) closed
          from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('savings_period_private','sicof_private') and c.relkind='r' order by 1,2`);
        assert.equal(rows.length, 9, 'PRIVATE_TABLE_COUNT_CHANGED'); assert(rows.every(r => r.rls && r.forced && r.closed), 'PRIVATE_TABLE_EXPOSED');
        const f = await database(`select bool_and(not has_function_privilege(r,p.oid,'EXECUTE')) closed from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join unnest(array['anon','authenticated','service_role'])r where n.nspname in ('savings_period_private','sicof_private')`);
        assert.equal(f[0].closed, true, 'PRIVATE_HELPER_EXPOSED');
        const writers = await database(`select p.proname name,has_function_privilege('service_role',p.oid,'EXECUTE') service,
          not has_function_privilege('anon',p.oid,'EXECUTE') and not has_function_privilege('authenticated',p.oid,'EXECUTE') browser_denied
          from pg_proc p where p.oid in ('public.service_save_sicof_scenario(uuid,uuid,uuid,uuid,text,jsonb,jsonb,text,text)'::regprocedure,'public.service_import_sicof_report(uuid,uuid,uuid,uuid,text,text,text,jsonb,jsonb)'::regprocedure)`);
        assert.equal(writers.length, 2); assert(writers.every(w => w.service && w.browser_denied), 'SERVICE_WRITER_EXPOSED'); proof.privateTables = rows.length;
      });
      if (!ordinary) await test('ordinary existing session is denied by SQL backend in READ ONLY with authenticated role', async () => {
        const result = await database(`do $verify$ declare candidate record; ordinary_found boolean:=false; target uuid; report_id uuid; subject uuid; self_data jsonb;
          begin
           for candidate in select distinct on(a.id) a.id affiliate_id,u.id auth_id,s.id session_id
            from public.affiliates a join auth.users u on u.id=a.auth_user_id join auth.sessions s on s.user_id=u.id
            where not coalesce(a.is_archived,false) and u.email_confirmed_at is not null and (s.not_after is null or s.not_after>now())
            order by a.id,s.created_at desc loop
            perform set_config('request.jwt.claims',jsonb_build_object('sub',candidate.auth_id,'session_id',candidate.session_id,'role','authenticated')::text,true);
            if public.get_effective_affiliate_id()=candidate.affiliate_id and not public.has_admin_permission('savings.read')
             and not public.has_admin_permission('savings.reports') and not public.has_admin_permission('program_requests.read')
            then ordinary_found:=true;exit;end if;
           end loop;
           if not ordinary_found then raise exception 'ORDINARY_EXISTING_SESSION_REQUIRED';end if;
           select id into target from public.savings_participants where affiliate_id<>candidate.affiliate_id and identity_status='RESOLVED' and certification_status='CERTIFIED' limit 1;
           select id into report_id from sicof_private.historical_reports order by created_at desc limit 1;
           select affiliate_id into subject from public.program_requests where affiliate_id is not null limit 1;
           if target is null or report_id is null or subject is null then raise exception 'ORDINARY_READ_TEST_TARGET_REQUIRED';end if;
           perform set_config('role','authenticated',true);
           begin perform public.get_admin_sicof_context(public.savings_operation_today()-30,public.savings_operation_today());raise exception 'ORDINARY_CONTEXT_ALLOWED';exception when insufficient_privilege then null;end;
           begin perform public.get_admin_savings_period_composition(target);raise exception 'ORDINARY_COMPOSITION_ALLOWED';exception when insufficient_privilege then null;end;
           begin perform public.get_admin_sicof_report_template(report_id);raise exception 'ORDINARY_TEMPLATE_ALLOWED';exception when insufficient_privilege then null;end;
           begin perform public.get_admin_sicof_behavior_context(array[subject]);raise exception 'ORDINARY_BEHAVIOR_ALLOWED';exception when insufficient_privilege then null;end;
           self_data:=public.get_self_savings_live_readonly();
           if self_data#>>'{participant,id}'=target::text then raise exception 'ORDINARY_SELF_CROSSED_ACCOUNT';end if;
           perform set_config('sicof.verification.ordinary_denied','true',true);
          end $verify$;
          select current_setting('sicof.verification.ordinary_denied')='true' verified`);
        assert.equal(result[0].verified, true, 'ORDINARY_BACKEND_DENIAL_UNVERIFIED');
        proof.ordinarySqlCoverage = true; proof.ordinarySqlAssertions = 5;
      });
      const [{ today }] = await database('select public.savings_operation_today()::text today'), range = { p_from: today.slice(0, 4) + '-01-01', p_to: today };
      const context = good(await rpc('get_admin_sicof_context', range, admin), 'ADMIN_CONTEXT');
      await test('SICOF context admin access and anonymous denial work through PostgREST', async () => {
        assert.equal(context.context.actor, sessions.H005_TEST.user.id); assert(context.context.session && context.can_export && context.can_configure);
        assert(Array.isArray(context.participants) && context.participants.length > 0); assert.equal(context.report?.template_base64, undefined);
        await deniedOrdinary(() => rpc('get_admin_sicof_context', range, ordinary), 'ORDINARY_CONTEXT_ALLOWED'); denied(await rpc('get_admin_sicof_context', range, null), 'ANON_CONTEXT_ALLOWED');
        proof.participants = context.participants.length;
        const performanceBaseline = JSON.parse(fs.readFileSync(path.join(root, '.tmp/sicof/context-performance-before.json'), 'utf8'));
        assert.equal(context.fingerprint, performanceBaseline.proof.fingerprint, 'INSTALLED_CONTEXT_FINGERPRINT_CHANGED'); proof.contextFingerprint = context.fingerprint;
      });
      await test('same canonical composition reaches admin and self without exposing administrative journal', async () => {
        for (const data of Object.values(selfRaw).filter(v => v.participant)) {
          const comp = good(await rpc('get_admin_savings_period_composition', { p_participant_id: data.participant.id }, admin), 'ADMIN_COMPOSITION');
          const { movements, version, can_attribute, ...publicComposition } = comp;
          same(data.period_balances, publicComposition, 'SELF_COMPOSITION_DIFFERENT');
          assert.equal(data.period_balances.movements, undefined); assert.equal(data.period_balances.version, undefined);
          same(data.balances.total, comp.balances.total, 'SELF_TOTAL_DIFFERENT');
        }
        const person = context.participants.find(p => p.identity_resolved && p.certified); assert(person, 'CERTIFIED_PERSON_REQUIRED');
        const proofRows = await database(`with projected as materialized(select public.savings_canonical_user_projection(p.id) current_projection,savings_period_private.projection_before(p.id) original_projection,
          savings_period_private.composition(p.id,null) composition
          from public.savings_participants p join public.affiliates a on a.id=p.affiliate_id and a.numero_control=p.legacy_folio and not coalesce(a.is_archived,false)
          where p.certification_status='CERTIFIED' and p.identity_status='RESOLVED' and p.data_classification='CANONICAL'
          and (select count(*) from public.affiliates b where b.numero_control=p.legacy_folio and not coalesce(b.is_archived,false))=1)
          select count(*)::int checked,bool_and(current_projection-'period_balances'=original_projection) originals_preserved,
          bool_and(current_projection->'period_balances'=composition-array['movements','version']) same_composition from projected`);
        assert(proofRows[0].checked > 0 && proofRows[0].originals_preserved && proofRows[0].same_composition, 'ALL_SELF_PROJECTIONS_NOT_PRESERVED'); proof.selfProjectionsCompared = proofRows[0].checked;
        await deniedOrdinary(() => rpc('get_admin_savings_period_composition', { p_participant_id: person.id }, ordinary), 'ORDINARY_COMPOSITION_ALLOWED');
        denied(await rpc('get_admin_savings_period_composition', { p_participant_id: person.id }, null), 'ANON_COMPOSITION_ALLOWED');
      });
      await test('private Excel download preserves original bytes and all 214 historical rows', async () => {
        const source = JSON.parse(fs.readFileSync(path.join(root, '.tmp/sicof/historical-report.json'), 'utf8'));
        assert(context.report?.id, 'HISTORICAL_REPORT_NOT_IMPORTED');
        const template = good(await rpc('get_admin_sicof_report_template', { p_report_id: context.report.id }, admin), 'TEMPLATE_DOWNLOAD');
        assert.equal(template.sha256, source.sha256); assert.equal(hash(Buffer.from(template.template_base64, 'base64')), source.sha256);
        assert.equal(template.rows.length, 214); same(template.rows, source.rows, 'HISTORICAL_ROWS_CHANGED'); same(context.report.rows, source.rows, 'CONTEXT_HISTORICAL_ROWS_CHANGED');
        await deniedOrdinary(() => rpc('get_admin_sicof_report_template', { p_report_id: context.report.id }, ordinary), 'ORDINARY_TEMPLATE_ALLOWED');
        denied(await rpc('get_admin_sicof_report_template', { p_report_id: context.report.id }, null), 'ANON_TEMPLATE_ALLOWED');
        proof.historicalRows = template.rows.length; proof.historicalSha256 = template.sha256;
      });
      const subjects = await database(`select distinct a.id affiliate_id,a.numero_control folio from public.program_requests pr join public.affiliates a on a.id=pr.affiliate_id
        where not coalesce(a.is_archived,false) and nullif(a.numero_control,'') is not null and (select count(*) from public.affiliates b where b.numero_control=a.numero_control and not coalesce(b.is_archived,false))=1 order by a.id limit 3`);
      const behaviorArgs = { p_affiliate_ids: subjects.map(s => s.affiliate_id) };
      await test('loan behavior reader resolves only exact existing applicants and exposes no savings data', async () => {
        assert(subjects.length > 0, 'EXISTING_FINANCE_APPLICANTS_REQUIRED');
        const result = good(await rpc('get_admin_sicof_behavior_context', behaviorArgs, admin), 'BEHAVIOR_CONTEXT');
        same(result.subjects, subjects, 'BEHAVIOR_IDENTITY_CHANGED'); assert.equal(result.participants, undefined); assert.equal(result.balances, undefined);
        await deniedOrdinary(() => rpc('get_admin_sicof_behavior_context', behaviorArgs, ordinary), 'ORDINARY_BEHAVIOR_ALLOWED'); denied(await rpc('get_admin_sicof_behavior_context', behaviorArgs, null), 'ANON_BEHAVIOR_ALLOWED');
        proof.behaviorSubjects = subjects.length;
      });
      if (edge) await test('deployed Edge LOAD, exact behavior and Excel export operate with real admin session and deny anon', async () => {
        const load = { action: 'LOAD', from: range.p_from, to: range.p_to };
        const result = good(await edgeRead(load, admin), 'EDGE_LOAD'); assert.equal(result.context.actor, sessions.H005_TEST.user.id); assert(result.data);
        assert.equal(result.data.source?.status, 'READY', 'EDGE_LOAN_SOURCE_UNAVAILABLE');
        assert(Array.isArray(result.data.payments) && Array.isArray(result.data.loans), 'EDGE_LOAN_SOURCE_ARRAYS_REQUIRED');
        proof.edgeSource = { status: result.data.source.status, observed_at: result.data.source.observed_at, payments: result.data.payments.length, loans: result.data.loans.length };
        const behavior = good(await edgeRead({ action: 'BEHAVIOR', affiliate_ids: behaviorArgs.p_affiliate_ids }, admin), 'EDGE_BEHAVIOR');
        same(Object.keys(behavior.data).sort(), behaviorArgs.p_affiliate_ids.slice().sort(), 'EDGE_BEHAVIOR_SUBJECTS_CHANGED');
        const report = good(await edgeRead({ action: 'EXPORT', kind: 'final_ahorro', from: range.p_from, to: range.p_to }, admin), 'EDGE_REPORT');
        assert(Buffer.from(report.data.base64, 'base64').subarray(0, 2).equals(Buffer.from('PK')), 'EDGE_REPORT_NOT_XLSX');
        await deniedOrdinary(() => edgeRead(load, ordinary), 'ORDINARY_EDGE_ALLOWED'); denied(await edgeRead(load, null), 'ANON_EDGE_ALLOWED');
      });
    }
    proof.ledgerAfter = await ledger(); same(proof.ledgerAfter, proof.ledgerBefore, 'CANONICAL_ROWS_CHANGED_DURING_VERIFICATION');
    proof.status = 'PASS';
  } catch (error) { proof.error = /^[A-Z0-9_]+$/.test(error.message) ? error.message : 'VERIFICATION_FAILED_DETAILS_NOT_LOGGED'; throw error; }
  finally {
    fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(file, JSON.stringify(proof, null, 2) + '\n');
    console.log(JSON.stringify({ status: proof.status, mode: proof.mode, checks: proof.checks.length, businessWrites: 0, error: proof.error }));
  }
}
main().catch(error => { console.error(/^[A-Z0-9_]+$/.test(error.message) ? error.message : 'VERIFICATION_FAILED_DETAILS_NOT_LOGGED'); process.exitCode = 1; });
