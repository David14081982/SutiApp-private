'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function env() {
  const values = {};
  const lines = fs.readFileSync(path.join(root, 'supabase.env'), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    const at = line.indexOf('=');
    if (at > 0 && !line.startsWith('#')) values[line.slice(0, at).trim()] = line.slice(at + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  return values;
}

async function management(values, query) {
  const ref = new URL(values.SUPABASE_URL).hostname.split('.')[0];
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${values.SUPABASE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'SutiApp-Request-Workflow-Audit/1.0',
    },
    body: JSON.stringify({ query }),
  });
  const data = await response.json().catch(() => null);
  assert(response.ok, `MANAGEMENT_${response.status}`);
  return data;
}

async function main() {
  const values = env();
  assert(values.SUPABASE_URL && values.SUPABASE_ACCESS_TOKEN, 'Supabase management configuration missing');
  const controlled = ['H005_TEST_AFFILIATE_ID', 'H005_TEST2_AFFILIATE_ID', 'H005_TEST3_AFFILIATE_ID']
    .map((key) => values[key])
    .filter((value) => /^[0-9a-f-]{36}$/i.test(String(value)));
  assert(controlled.length === 3, 'Controlled affiliate IDs missing');
  const ids = controlled.map((value) => `'${value}'::uuid`).join(',');
  const rows = await management(values, `
    select jsonb_build_object(
      'workflow_count',(select count(*) from public.operational_workflows),
      'enabled_workflow_count',(select count(*) from public.operational_workflows where enabled),
      'stage_count',(select count(*) from public.operational_workflow_stages),
      'tracking_count',(select count(*) from public.operational_request_tracking),
      'request_count',(select count(*) from public.program_requests),
      'controlled_request_count',(select count(*) from public.program_requests where affiliate_id in (${ids})),
      'outside_controlled_request_count',(select count(*) from public.program_requests where affiliate_id not in (${ids})),
      'request_document_count',(select count(*) from public.request_documents),
      'requests_by_status',(select coalesce(jsonb_object_agg(status,total),'{}'::jsonb) from (select status,count(*) total from public.program_requests group by status order by status) q),
      'requests_by_kind',(select coalesce(jsonb_object_agg(kind,total),'{}'::jsonb) from (select concat_ws(':',program_id,request_type) kind,count(*) total from public.program_requests group by program_id,request_type order by program_id,request_type) q),
      'workflows',(select coalesce(jsonb_agg(jsonb_build_object(
        'id',w.id,'name',w.name,'type',w.workflow_type,'enabled',w.enabled,'service_keys',w.service_keys,
        'stages',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'outcome',s.outcome,'status_reference',s.status_reference,'service_keys',s.service_keys,'sort_order',s.sort_order) order by s.sort_order,s.id),'[]'::jsonb) from public.operational_workflow_stages s where s.workflow_id=w.id)
      ) order by w.sort_order,w.id),'[]'::jsonb) from public.operational_workflows w)
    ) as audit;
  `);
  const audit = rows && rows[0] && rows[0].audit;
  assert(audit, 'Audit result missing');
  console.log(JSON.stringify({ status: 'PASS', piiPrinted: false, googleReads: 0, googleWrites: 0, ...audit }));
}

main().catch((error) => {
  console.error(JSON.stringify({ status: 'FAIL', error: error.message }));
  process.exitCode = 1;
});
