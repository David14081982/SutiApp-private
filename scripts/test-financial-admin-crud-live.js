'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function env() {
  return Object.fromEntries(fs.readFileSync(path.join(root, 'supabase.env'), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)
    .map((line) => line.trim()).filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => { const at = line.indexOf('='); return [line.slice(0, at).trim(), line.slice(at + 1).trim().replace(/^['"]|['"]$/g, '')]; }));
}

async function request(url, options = {}) {
  const response = await fetch(url, options); const text = await response.text(); let data;
  try { data = JSON.parse(text); } catch (_) { data = text; }
  return { status: response.status, data };
}

async function login(values, alias) {
  return request(`${values.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method:'POST', headers:{ apikey:values.SUPABASE_PUBLISHABLE_KEY, 'Content-Type':'application/json' },
    body:JSON.stringify({ email:values[`${alias}_EMAIL`], password:values[`${alias}_PASSWORD`] }),
  });
}

async function rpc(values, token, name, body) {
  const headers = { apikey:values.SUPABASE_PUBLISHABLE_KEY, 'Content-Type':'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return request(`${values.SUPABASE_URL}/rest/v1/rpc/${name}`, { method:'POST', headers, body:JSON.stringify(body) });
}

async function db(values, query) {
  const ref = new URL(values.SUPABASE_URL).hostname.split('.')[0];
  const response = await request(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method:'POST', headers:{ Authorization:`Bearer ${values.SUPABASE_ACCESS_TOKEN}`, 'Content-Type':'application/json', Accept:'application/json', 'User-Agent':'SutiApp-Financial-Admin-CRUD-Test/1.0' },
    body:JSON.stringify({ query }),
  });
  if (response.status < 200 || response.status >= 300) throw new Error(`DATABASE_QUERY_${response.status}:${JSON.stringify(response.data).slice(0, 500)}`);
  return response.data;
}

(async () => {
  const values = env();
  for (const key of ['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_ACCESS_TOKEN','H005_TEST_EMAIL','H005_TEST_PASSWORD','H005_TEST2_EMAIL','H005_TEST2_PASSWORD','H005_TEST3_EMAIL','H005_TEST3_PASSWORD']) assert(values[key], `${key} missing`);
  const [admin, responsible, normal] = await Promise.all([login(values, 'H005_TEST'), login(values, 'H005_TEST2'), login(values, 'H005_TEST3')]);
  assert.equal(admin.status, 200); assert.equal(responsible.status, 200); assert.equal(normal.status, 200);

  const deniedPayload = { p_id:'qa_financial_denied', p_name:'QA denied', p_description:'', p_enabled:false, p_publication_status:'DRAFT', p_sort_order:9999, p_reason:'Validación QA sin escritura', p_confirmation:'CONFIRMAR' };
  const [responsibleDenied, normalDenied, anonymousDenied] = await Promise.all([
    rpc(values, responsible.data.access_token, 'save_financial_program', deniedPayload),
    rpc(values, normal.data.access_token, 'save_financial_program', deniedPayload),
    rpc(values, null, 'save_financial_program', deniedPayload),
  ]);
  assert([401,403].includes(responsibleDenied.status), `responsible write allowed:${responsibleDenied.status}`);
  assert([401,403].includes(normalDenied.status), `normal write allowed:${normalDenied.status}`);
  assert([401,403,404].includes(anonymousDenied.status), `anonymous write allowed:${anonymousDenied.status}`);

  const invalidAdmin = await rpc(values, admin.data.access_token, 'save_financial_program', { ...deniedPayload, p_confirmation:'NO' });
  assert.equal(invalidAdmin.status, 400, `admin validation boundary missing:${invalidAdmin.status}`);

  const sql = `
begin;
do $$
declare
  v_actor uuid;
  v_program jsonb;
  v_fund jsonb;
  v_rule jsonb;
  v_published jsonb;
  v_union text;
  v_category text;
  v_programs integer;
  v_funds integer;
  v_rules integer;
  v_audit integer;
begin
  select a.auth_user_id into v_actor
  from public.admin_assignments a
  join public.admin_roles ar on ar.id=a.role_id and ar.enabled
  join public.admin_role_permissions rp on rp.role_id=ar.id
  where a.enabled and rp.permission in('financial_programs.write','financial_rules.write','financial_rates.write','financial_rules.publish')
  group by a.auth_user_id,a.created_at
  having count(distinct rp.permission)=4
  order by a.created_at limit 1;
  if v_actor is null then raise exception 'QA_AUTHORIZED_FINANCIAL_ADMIN_MISSING'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_actor,'role','authenticated')::text,true);
  select count(*) into v_programs from public.financial_programs;
  select count(*) into v_funds from public.financial_funds;
  select count(*) into v_rules from public.financial_rules;
  select count(*) into v_audit from public.financial_configuration_audit;
  select code into v_union from public.segmentation_catalog_entries where catalog_type='union' and enabled order by sort_order,code limit 1;
  select code into v_category from public.segmentation_catalog_entries where catalog_type='employment_category' and enabled order by sort_order,code limit 1;

  v_program := public.save_financial_program('qa_financial_cutover','QA Financial Cutover','Fixture transaccional',false,'DRAFT',9998,'Prueba CRUD transaccional','CONFIRMAR');
  v_program := public.save_financial_program('qa_financial_cutover','QA Financial Cutover editado','Fixture transaccional',false,'DRAFT',9997,'Prueba edición transaccional','CONFIRMAR');
  if (v_program->>'name') <> 'QA Financial Cutover editado' or (v_program->>'version')::integer <> 2 then raise exception 'QA_PROGRAM_UPDATE_FAILED'; end if;

  v_fund := public.save_financial_fund(null,'qa_financial_cutover','qa_financial_fund','QA Financial Fund',true,'DRAFT',9998,'Prueba fondo transaccional','CONFIRMAR');
  if v_fund->>'program_id' <> 'qa_financial_cutover' then raise exception 'QA_FUND_CREATE_FAILED'; end if;
  v_rule := public.save_financial_rule_draft(null,(v_fund->>'id')::uuid,v_union,v_category,12345,1.25,'12 QNAS',12,12,null,'AUTO','Prueba regla transaccional','CONFIRMAR');
  if v_rule->>'lifecycle_status' <> 'DRAFT' then raise exception 'QA_RULE_DRAFT_FAILED'; end if;
  v_published := public.publish_financial_rule((v_rule->>'id')::uuid,'Prueba publicación transaccional','PUBLICAR');
  if v_published->>'lifecycle_status' <> 'PUBLISHED' then raise exception 'QA_RULE_PUBLISH_FAILED'; end if;
  if (public.preview_financial_rule_impact((v_rule->>'id')::uuid)->>'source') <> 'SUPABASE_AFFILIATES' then raise exception 'QA_IMPACT_PREVIEW_FAILED'; end if;

  if (select count(*) from public.financial_programs) <> v_programs + 1 then raise exception 'QA_PROGRAM_COUNT_FAILED'; end if;
  if (select count(*) from public.financial_funds) <> v_funds + 1 then raise exception 'QA_FUND_COUNT_FAILED'; end if;
  if (select count(*) from public.financial_rules) <> v_rules + 1 then raise exception 'QA_RULE_COUNT_FAILED'; end if;
  if (select count(*) from public.financial_configuration_audit) < v_audit + 5 then raise exception 'QA_AUDIT_FAILED'; end if;
end $$;
rollback;
select
  not exists(select 1 from public.financial_programs where id='qa_financial_cutover') as program_restored,
  not exists(select 1 from public.financial_funds where code='qa_financial_fund') as fund_restored,
  not exists(select 1 from public.financial_rules where created_by is not null and max_amount=12345 and term_label='12 QNAS') as rule_restored,
  (select authority='SUPABASE' from public.financial_criteria_authority where id='primary') as authority_preserved;
`;
  const result = await db(values, sql); const restored = result[0] || {};
  assert(restored.program_restored && restored.fund_restored && restored.rule_restored && restored.authority_preserved, `rollback failed:${JSON.stringify(restored)}`);
  console.log(JSON.stringify({ status:'PASS', admin:{ validationBoundary:'PASS', programCreate:'PASS', programEdit:'PASS', fundCreate:'PASS', ruleDraft:'PASS', rulePublish:'PASS', impactPreview:'PASS', audit:'PASS' }, permissions:{ authorizedAdmin:'ALLOWED', responsible:'DENIED', normalUser:'DENIED', anonymous:'DENIED' }, recovery:{ transactionRollback:'PASS', persistentBusinessRows:0, authority:'SUPABASE' }, googleWrites:0, appsScriptChanges:0, piiReported:false }));
})().catch((error) => { console.error(JSON.stringify({ status:'FAIL', error:error.message })); process.exitCode = 1; });
