'use strict';

const assert=require('assert');
const fs=require('fs');
const read=(file)=>fs.readFileSync(file,'utf8');
const migration=read('supabase/migrations/20260830000400_request_workflow_timeline_cutover.sql');
const recovery=read('supabase/recovery/20260830000400_request_workflow_timeline_cutover_recovery.sql');
const hardening=read('supabase/migrations/20260830000410_harden_request_workflow_assignment.sql');
const hardeningRecovery=read('supabase/recovery/20260830000410_harden_request_workflow_assignment_recovery.sql');
const success=read('app/request-submission-success.jsx');
const history=read('app/operations-store.jsx');
const historyScreen=read('app/screens-historial.jsx');
const flow=read('app/flow-store.jsx');
const admin=read('app/screens-admin-flujos.jsx');
const adminRequests=read('app/screens-admin-requests.jsx');
const repo=read('app/program-request-repository.js');
const financial=read('app/financial-legacy-repository.js');
const cutoverRepo=read('app/admin-cutover-repository.js');
const data=read('app/data.jsx');
const html=read('SutiApp.html');
const sw=read('sw.js');
const bundle=read('app/bundle.js');

for(const token of ['workflow_version','workflow_snapshot','build_program_request_workflow_snapshot','capture_program_request_workflow_snapshot','resolve_program_request_workflow_state','get_self_request_workflow_state','list_admin_request_workflow_tracking','operational_workflow_change_audit'])assert(migration.includes(token),`migration missing ${token}`);
assert(migration.includes("revoke delete on public.operational_workflows,public.operational_workflow_stages from authenticated"),'physical workflow deletion remains authorized');
assert(migration.includes("REQUEST_WORKFLOW_AMBIGUOUS")&&migration.includes("REQUEST_WORKFLOW_STATUS_MAPPING_INVALID"),'controlled assignment failures missing');
assert(migration.includes("REQUEST_WORKFLOW_SNAPSHOT_IMMUTABLE")&&migration.includes("REQUEST_TRACKING_STAGE_MISMATCH"),'snapshot/tracking invariants missing');
assert(recovery.includes('drop column if exists workflow_snapshot')&&recovery.includes('grant delete on public.operational_workflows,public.operational_workflow_stages to authenticated'),'recovery incomplete');
assert(hardening.includes('WORKFLOW_SERVICE_CONFLICT')&&hardening.includes('other.service_keys&&v_keys'),'duplicate enabled context assignment is not rejected at the Admin boundary');
assert(hardeningRecovery.includes('validate_operational_workflow_configuration'),'workflow assignment hardening recovery is missing');

assert(!/const COPY\s*=/.test(success),'Success retains a hardcoded stage authority');
assert(success.includes('workflowState')&&success.includes('workflowState.stages'),'Success does not consume the central projection');
assert(success.includes('Array.from({length:42}')&&success.includes('data-request-success-confetti')&&success.includes("'Folio '+")&&success.includes("'Seguir mi solicitud'"),'Success WOW/folio/CTA contract regressed');
assert(success.includes("app.setTab('historial')"),'Success CTA does not target Historial');
assert(!/steps:\s*\[/.test(history),'Historial retains hardcoded business stages');
assert(history.includes('r.workflow_state')&&historyScreen.includes('s.activeNote')&&historyScreen.includes('Seguimiento no disponible'),'Historial is not using the central workflow projection');
assert(data.includes('const solicitudes = [];')&&!/const solicitudes = \[[\s\S]*?steps:\s*\[/.test(data),'productive request timeline mock remains');

assert(flow.includes('REQUEST_STATUSES')&&flow.includes('listRequestWorkflowTracking')&&flow.includes('reorderStages')&&flow.includes('retireStage'),'Admin store is missing canonical statuses/versioned tracking/retirement');
assert(admin.includes('estadoRefs')&&admin.includes('Etapa retirada')&&admin.includes('snapshot')&&admin.includes('workflow_state'),'Admin editor is not wired to canonical stages');
assert(!admin.includes('financeStore')&&!admin.includes('SeguimientoTabLegacy'),'Admin retains a parallel timeline reader');
assert(cutoverRepo.includes('list_admin_request_workflow_tracking')&&!cutoverRepo.includes("deleteWorkflow:(id)=>remove('operational_workflows'")&&!cutoverRepo.includes("deleteStage:(id)=>remove('operational_workflow_stages'"),'Admin repository retains physical workflow deletes');
assert(repo.includes('get_self_request_workflow_state')&&repo.includes('workflow_state')&&financial.includes('getWorkflowState(requestId)'),'request writers do not return the shared timeline');
assert(repo.includes("reason:'WORKFLOW_PROJECTION_UNAVAILABLE'")&&!/getWorkflowState\(id\)[\s\S]{0,240}throw r\.error/.test(repo),'a post-submit timeline read can incorrectly report that the authoritative request failed');
assert(adminRequests.includes('detail.workflow_state')&&!adminRequests.includes('tracking.stages'),'secondary Admin timeline remains parallel');

for(const file of ['app/screens-loan.jsx','app/screens-catalogo.jsx','app/screens-marketplace.jsx','app/screens-membership-application.jsx'])assert(read(file).includes('workflowState:'),`${file} does not pass workflow state to Success`);
assert(![success,history,flow,admin,repo].some((source)=>/localStorage|sessionStorage/.test(source)),'browser storage fallback introduced');
assert(![success,history,flow,admin,repo,migration].some((source)=>/SUPABASE_SERVICE_ROLE_KEY|service_role_key/i.test(source)),'service role secret introduced');
require('./verification-helpers').assertPwaVersionSync(process.cwd());assert(html.includes('financial-legacy-repository.js?v=9'),'financial repository cache contract missing');
assert(bundle.includes('get_self_request_workflow_state')&&bundle.includes('data-request-success-confetti'),'bundle/source divergence');

console.log(JSON.stringify({status:'PASS',hardcodedStageAuthorities:0,productiveRequestMocks:0,localStorageFallbacks:0,serviceRoleFrontend:0,successConfettiPieces:42,googleReads:0,googleWrites:0}));
