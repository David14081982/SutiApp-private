'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');

const migration=read('supabase/migrations/20260830000300_request_submission_e2e_remediation.sql');
const recovery=read('supabase/recovery/20260830000300_request_submission_e2e_remediation_recovery.sql');
const edge=read('supabase/functions/financial-legacy/index.ts');
const repository=read('app/program-request-repository.js');
const operations=read('app/operations-store.jsx');
const success=read('app/request-submission-success.jsx');
const loan=read('app/screens-loan.jsx');
const financial=read('app/financial-legacy-repository.js');

assert.match(migration,/auth\.uid\(\) is null and coalesce\(auth\.role\(\),''\)<>'service_role'/);
assert.match(migration,/create or replace function public\.list_self_program_request_history\(\)/);
assert.match(migration,/v_affiliate_id:=public\.get_effective_affiliate_id\(\)/);
assert.match(migration,/where r\.affiliate_id=v_affiliate_id/);
assert.match(migration,/revoke all on function public\.list_self_program_request_history\(\) from public,anon,authenticated,service_role/);
assert.match(migration,/grant execute on function public\.list_self_program_request_history\(\) to authenticated/);
for(const forbidden of ['affiliate_id','signature_data','terms_accepted','financial_submission_snapshot','applicant_profile_snapshot','numero_control','actor_real_auth_user_id','impersonation_reason','idempotency_key']) {
  const projection=migration.slice(migration.indexOf('create or replace function public.list_self_program_request_history'),migration.indexOf('revoke all on function public.list_self_program_request_history'));
  assert(!projection.includes(`'${forbidden}'`),`history exposes ${forbidden}`);
}
assert.match(recovery,/drop function if exists public\.list_self_program_request_history\(\)/);
assert.match(recovery,/if auth\.uid\(\) is null then raise exception 'AUTH_REQUIRED'/);

assert.match(repository,/rpc\('list_self_program_request_history'\)/);
assert.doesNotMatch(repository,/function listHistory\(\)[\s\S]{0,180}from\('program_requests'\)/);
assert.match(repository,/row\.financial_processing_status!=null&&row\.requested_amount!=null/);
assert.match(operations,/r\.program_id==='prestamo'\?loanRow\(r\)/);
assert.match(operations,/common\(r,'loan'\)/);
assert.match(operations,/invalidate:\(\)=>\{promise=null;rows=\[\];phase='idle'/);
assert.match(success,/operationsStore\.invalidate/);
assert.match(success,/data-request-success-confetti/);
assert.match(success,/Seguir mi solicitud/);

assert.match(edge,/correlation_id/);
assert.match(edge,/stage, internal_code: failure\.internalCode, postgres_code: failure\.postgresCode/);
assert.match(edge,/confirmed_amount: Number\(request\.requested_amount\)/);
assert.match(edge,/status: request\.status/);
assert.match(edge,/googleResolutionCount: 0/);
const confirmBoundary=edge.slice(edge.indexOf('async function confirmPersonalizedLoanSession'),edge.indexOf('async function approveRequest'));
assert.doesNotMatch(confirmBoundary,/body: \{ error: error instanceof Error \? error\.message/);
assert.match(financial,/failure\.correlationId = payload\.correlation_id/);
assert.doesNotMatch(loan,/No pudimos enviar tu solicitud\. Revisa la información e intenta nuevamente\./);
assert.match(loan,/falla temporal del servicio/);

for(const source of [migration,recovery,edge,repository,operations,success,loan,financial]) {
  assert(!/SUPABASE_(?:SERVICE_ROLE|SECRET|ACCESS)_KEY\s*=/.test(source),'secret embedded');
  assert(!/localStorage|window\.DATA|GOOGLE_SHEETS_FALLBACK/.test(source),'unauthorized authority or fallback');
}

console.log(JSON.stringify({status:'PASS',rootCauseFix:true,selfHistoryProjection:true,correlation:true,uiPreserved:true,googleWrites:0}));
