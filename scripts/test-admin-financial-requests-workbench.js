'use strict';

const assert=require('assert').strict;
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'..');
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const screen=read('app/screens-admin-finanzas.jsx');
const repository=read('app/program-request-repository.js');
const migration=read('supabase/migrations/20260903000140_finance_request_workflow_ux_correction.sql');
const recovery=read('supabase/recovery/20260903000140_finance_request_workflow_ux_correction_recovery.sql');
const applyScript=read('scripts/apply-finance-request-workflow-ux-correction.js');
const bundle=read('app/bundle.js');

new vm.Script(screen);
new vm.Script(repository);

[
  'data-admin-financial-workbench','data-financial-queue-toolbar','data-financial-queue',
  'data-financial-request-detail','data-financial-workflow','data-financial-timeline',
  'data-financial-documents','data-financial-current-documents','data-financial-safe-action-bar',
  'ETAPA ACTUAL','Flujo completo','Siguiente acción','Aprobar etapa','Rechazar etapa',
  'Avanzar a siguiente etapa','Responsable siguiente','Documentos enviados con esta solicitud',
  'Expediente actual del afiliado','Guardando…','Admin y afiliado ya muestran la etapa vigente'
].forEach((contract)=>assert.ok(screen.includes(contract),contract));

const workbench=screen.slice(screen.indexOf('function DesktopFinancialWorkbench'),screen.indexOf('function FinanzasModule'));
assert.match(workbench,/ProgramRequestRepository\.listAdminFlowQueue\(\)/);
assert.match(workbench,/ProgramRequestRepository\.adminFlowDetail\(selectedId\)/);
assert.match(workbench,/ProgramRequestRepository\.transitionWorkflow/);
assert.match(workbench,/detail\.request_type===['"]quote['"] && detail\.financial_processing_status==null/);
assert.match(workbench,/FinancialLegacyRepository\.approveRequest/);
assert.match(workbench,/FinancialLegacyRepository\.handoffRequest/);
assert.match(workbench,/workflowOf\(detail\)\.stages/);
assert.match(workbench,/currentStage\(detail\)/);
assert.match(workbench,/nextStage\(detail\)/);
assert.match(screen,/const requestTypeLabel = \(row\) => row && row\.program_id === 'prestamo' \? 'Préstamo'/);
assert.match(workbench,/useEffect\(\(\)=>\{if\(!detail\|\|detailPhase!==['"]loaded['"]/);
assert.match(workbench,/DocumentWorkflowRepository\.adminPreview/);
assert.match(workbench,/mime\.startsWith\('image\/'\)/);
assert.match(workbench,/mime===['"]application\/pdf['"]/);
assert.match(workbench,/Vista no disponible/);
assert.doesNotMatch(workbench,/>Preparar vista</);
assert.doesNotMatch(workbench,/localStorage|sessionStorage|IndexedDB|\bDATA\b|\bMOCKS?\b|mockData/);

assert.match(repository,/rpc\('list_admin_finance_request_flow_queue'\)/);
assert.match(repository,/rpc\('get_admin_finance_request_flow_detail'/);
assert.match(repository,/rpc\('transition_program_request_workflow'/);
assert.match(repository,/async function hydrateAdminDetail/);
assert.match(repository,/DocumentWorkflowRepository\.listAdminDocuments/);
assert.match(repository,/admin_events_available/);

assert.match(migration,/create function public\.transition_program_request_workflow/);
assert.match(migration,/resolve_program_request_workflow_state\(r\.id\)/);
assert.match(migration,/jsonb_array_elements\(v_request\.workflow_snapshot->'stages'\)/);
assert.match(migration,/program_requests_sync_workflow_tracking/);
assert.match(migration,/SPECIALIZED_FINANCIAL_APPROVAL_REQUIRED/);
assert.match(migration,/financial_processing_status is not null then[\s\S]*SPECIALIZED_FINANCIAL_APPROVAL_REQUIRED[\s\S]*elsif v_request\.request_type='quote'/);
assert.match(migration,/from_stage_id uuid null references public\.operational_workflow_stages/);
assert.match(migration,/to_stage_id uuid null references public\.operational_workflow_stages/);
assert.match(migration,/has_admin_permission\('program_requests\.write'\)/);
assert.match(migration,/revoke all on function public\.list_admin_finance_request_flow_queue\(\)/);
assert.doesNotMatch(migration,/service_role.*frontend|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY/i);
assert.match(recovery,/RECOVERY_BLOCKED_REQUEST_WORKFLOW_TRANSITION_HISTORY_EXISTS/);
assert.match(recovery,/create or replace function public\.record_program_request_admin_action/);
assert.match(recovery,/drop column to_stage_id/);

['--dry-run','--matrix-dry-run','--matrix-live-rollback','--recovery-live-rollback','--apply','--status','persistentChanges:0'].forEach((contract)=>assert.ok(applyScript.includes(contract),contract));
assert.ok(bundle.includes('data-admin-financial-workbench'),'bundle missing financial workbench');
assert.ok(bundle.includes('listAdminFlowQueue'),'bundle missing workflow queue projection');

console.log('Admin finance request workflow UX contract PASS');
