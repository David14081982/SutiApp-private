'use strict';

const assert=require('assert').strict;
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'..');
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const screen=read('app/screens-admin-finanzas.jsx');
const repository=read('app/program-request-repository.js');
const financeStore=read('app/finance-store.jsx');
const financialRepository=read('app/financial-legacy-repository.js');
const bundle=read('app/bundle.js');
const html=read('SutiApp.html');
const serviceWorker=read('sw.js');
const requestMigration=read('supabase/migrations/20260822000200_create_unified_program_requests.sql');
const approvalMigration=read('supabase/migrations/20260823000100_final_approved_loan_export_writer.sql');
const snapshotMigration=read('supabase/migrations/20260825000400_personalized_financial_session_snapshots.sql');
const documentMigration=read('supabase/migrations/20260825000100_complete_documents_credentials_membership_requests.sql');
const readModelMigration=read('supabase/migrations/20260826000200_admin_financial_requests_read_model.sql');
const readModelRecovery=read('supabase/recovery/20260826000200_admin_financial_requests_read_model_recovery.sql');
const readModelApply=read('scripts/apply-admin-financial-requests-read-model.py');
const adminEventsMigration=read('supabase/migrations/20260829000200_financial_request_admin_events.sql');
const adminEventsRecovery=read('supabase/recovery/20260829000200_financial_request_admin_events_recovery.sql');
const financialEdge=read('supabase/functions/financial-legacy/index.ts');

new vm.Script(screen);
new vm.Script(repository);
new vm.Script(financeStore);

[
  'data-admin-financial-workbench','data-financial-queue-toolbar','data-financial-queue',
  'data-financial-request-detail','data-financial-timeline','data-financial-documents','data-financial-current-documents',
  'data-financial-terms','data-financial-safe-action-bar','Guardar y siguiente',
  'Buscar solicitudes financieras','Filtrar por estado financiero','Filtrar por programa financiero',
  'Filtrar por etapa financiera','Filtrar por antigüedad financiera','Filtrar por fecha financiera',
  'Ordenar solicitudes financieras','Anterior','Siguiente'
].forEach((contract)=>assert.ok(screen.includes(contract),contract));

['Enviada','Pendiente de revisión','En revisión','Aprobada','Rechazada','Cancelada'].forEach((label)=>assert.ok(screen.includes(label),label));
['Validación financiera','Pendiente de envío','Enviando a gestión','Entregada a gestión','Envío con error'].forEach((label)=>assert.ok(screen.includes(label),label));
assert.match(screen,/ArrowDown/);
assert.match(screen,/ArrowUp/);
assert.match(screen,/event\.key === 'Enter'/);
assert.match(screen,/Guardando…/);
assert.match(screen,/Actualizado y verificado/);
assert.match(screen,/Aprobar y enviar a gestión/);
assert.match(screen,/Cancelar solicitud/);
assert.match(screen,/Documentos enviados con esta solicitud/);
assert.match(screen,/Expediente actual del afiliado/);
assert.match(screen,/no demuestra qué documentos acompañaron esta solicitud/);
assert.match(screen,/No es posible reconstruir qué archivos fueron enviados/);
assert.match(screen,/Nota del solicitante/);
assert.match(screen,/Se verificó el estado persistido/);
assert.match(screen,/@media\(max-width:1279px\)/);
assert.match(screen,/@media\(min-width:1280px\)/);
assert.match(screen,/min-width: 1024px/);

const desktopSource=screen.slice(screen.indexOf('function DesktopFinancialWorkbench'),screen.indexOf('function FinanzasModule'));
assert.match(desktopSource,/ProgramRequestRepository\.listFinancialQueue\(\)/);
assert.match(desktopSource,/ProgramRequestRepository\.financialDetail\(selectedId\)/);
assert.match(desktopSource,/DocumentWorkflowRepository\.adminPreview\(document\.affiliate_document_id \|\| document\.id,detail\.affiliate_id,'ADMIN_FINANCIAL_REQUEST'\)/);
assert.match(desktopSource,/FinancialLegacyRepository\.approveRequest/);
assert.match(desktopSource,/FinancialLegacyRepository\.handoffRequest/);
assert.match(desktopSource,/ProgramRequestRepository\.recordAdminAction/);
assert.doesNotMatch(desktopSource,/ProgramRequestRepository\.update\(/);
assert.match(desktopSource,/window\.confirm/);
assert.match(desktopSource,/app\.admin\.has\('program_requests\.write'\)/);
assert.doesNotMatch(desktopSource,/resolveEligibility|resolveAvailableFunds|resolveSimulation|requestQuote|loanSessionOpen|listCriteriaCatalog/);
assert.doesNotMatch(desktopSource,/localStorage|sessionStorage|IndexedDB|\bDATA\b|\bMOCKS?\b|mockData/);
assert.doesNotMatch(desktopSource,/Asignar responsable|Filtrar por responsable|selectAll|selectedIds|data-financial-bulk/);
assert.doesNotMatch(desktopSource,/['"](?:program_id|criterion_identity|financial_union_code|raw status|UUID)['"]/);

assert.match(screen,/desktop \? \(tab === 'cots'/);
assert.match(screen,/!desktop && openId/);
assert.match(screen,/useStore\(!desktop\)/);
assert.match(screen,/function CotizacionesAdmin/);
assert.match(screen,/window\.FINANZAS\.ESTADOS\.map/);
assert.match(financeStore,/ProgramRequestRepository\.listFinancialMobile\(\)/);
assert.match(financeStore,/FinancialLegacyRepository\.approveRequest\(row\.id/);
assert.match(financeStore,/ProgramRequestRepository\.recordAdminAction\(row\.id,action/);
assert.match(financeStore,/ProgramRequestRepository\.recordAdminAction\(row\.id,'COMMENT'/);
assert.match(financeStore,/loadDetail:async\(id\).*financialDetail\(id\)/s);
assert.doesNotMatch(financeStore,/ProgramRequestRepository\.update\(/);
assert.doesNotMatch(financeStore,/mapStatus=\{[^}]*aprobada:'approved'/);

assert.match(repository,/async function listFinancialQueue\(\)/);
assert.match(repository,/rpc\('list_admin_financial_request_queue'\)/);
assert.match(repository,/rpc\('list_admin_financial_requests_mobile'\)/);
assert.match(repository,/rpc\('get_admin_financial_request_detail',\{p_request_id:id\}\)/);
const queueMethod=repository.slice(repository.indexOf('async function listFinancialQueue'),repository.indexOf('async function detail'));
assert.doesNotMatch(queueMethod,/financial_submission_snapshot|financial_approval_snapshot|financial_profile_snapshot/);
assert.match(repository,/async function financialDetail\(id\)/);
assert.match(repository,/from\('request_documents'\)/);
assert.match(repository,/DocumentWorkflowRepository\.listAdminDocuments\(row\.affiliate_id,'ADMIN_FINANCIAL_REQUEST'\)/);
assert.match(repository,/from\('program_terms_versions'\)/);
assert.match(repository,/rpc\('get_program_request_admin_events'/);
assert.match(repository,/rpc\('record_program_request_admin_action'/);
assert.match(repository,/Promise\.all\(\[documents,terms,currentDocuments,adminEvents\]\)/);
assert.match(repository,/listFinancialMobile,listFinancialQueue,detail,financialDetail,update,recordAdminAction/);

assert.match(requestMigration,/program_requests_status_check check \(status in \('submitted','in_review','approved','rejected','cancelled','requires_financial_processing'\)\)/);
assert.match(requestMigration,/public\.has_admin_permission\('program_requests\.write'\)/);
assert.match(approvalMigration,/if coalesce\(auth\.role\(\),''\)<>'service_role'/);
assert.match(approvalMigration,/financial_approval_snapshot is not null/);
assert.match(approvalMigration,/APPROVED_FINANCIAL_REQUEST_STATUS_IMMUTABLE/);
assert.match(approvalMigration,/begin_financial_request_export/);
assert.match(approvalMigration,/financial_request_export_audit/);
assert.match(snapshotMigration,/FINANCIAL_SUBMISSION_SNAPSHOT_IMMUTABLE/);
assert.match(snapshotMigration,/financial_submission_snapshot/);
assert.match(documentMigration,/create policy request_documents_read/);
assert.match(financialRepository,/approveRequest\(requestId, comment\).*action: 'approve'.*comment:/s);
assert.match(financialRepository,/handoffRequest\(requestId\).*action: 'handoff'/s);
assert.match(financialEdge,/approve: new Set\(\["action", "request_id", "comment"\]\)/);
assert.match(financialEdge,/p_comment: typeof body\.comment === "string" \? body\.comment : ""/);

assert.match(adminEventsMigration,/create table public\.program_request_admin_events/);
assert.match(adminEventsMigration,/action in \('COMMENT','MARK_IN_REVIEW','REJECT','CANCEL','APPROVE'\)/);
assert.match(adminEventsMigration,/create function public\.record_program_request_admin_action/);
assert.match(adminEventsMigration,/create function public\.get_program_request_admin_events/);
assert.match(adminEventsMigration,/has_admin_permission\('program_requests\.write'\)/);
assert.match(adminEventsMigration,/has_admin_permission\('program_requests\.read'\)/);
assert.match(adminEventsMigration,/alter table public\.program_request_admin_events force row level security/);
assert.match(adminEventsMigration,/revoke all on public\.program_request_admin_events from public,anon,authenticated/);
assert.match(adminEventsMigration,/p_client_action_id uuid/);
assert.match(adminEventsMigration,/v_action<>'COMMENT'.*APPROVED_FINANCIAL_REQUEST_STATUS_IMMUTABLE/s);
assert.match(adminEventsMigration,/update public\.program_requests set status=v_to_status,updated_at=now\(\)/);
assert.doesNotMatch(adminEventsMigration,/update public\.program_requests set[^;]*notes=/s);
assert.match(adminEventsMigration,/approve_financial_program_request\(p_request_id,p_snapshot,p_approved_by\)/);
assert.match(adminEventsRecovery,/RECOVERY_BLOCKED_PROGRAM_REQUEST_ADMIN_HISTORY_EXISTS/);
assert.match(adminEventsRecovery,/drop function public\.approve_financial_program_request\(uuid,jsonb,uuid,text\)/);
assert.match(adminEventsRecovery,/drop table public\.program_request_admin_events/);

['list_admin_financial_request_queue','get_admin_financial_request_detail','list_admin_financial_requests_mobile'].forEach((name)=>{
  assert.match(readModelMigration,new RegExp('create function public\\.'+name.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')));
  assert.match(readModelRecovery,new RegExp('drop function if exists public\\.'+name.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')));
});
assert.match(readModelMigration,/has_admin_permission\('program_requests\.read'\)/);
assert.match(readModelMigration,/where r\.financial_processing_status is not null[\s\S]*limit 250/);
assert.match(readModelMigration,/financial_submission_snapshot'[\s\S]*'confirmed_at'[\s\S]*'financialResult'/);
assert.match(readModelMigration,/financial_approval_snapshot'[\s\S]*'financialResult'/);
const mobileReadModel=readModelMigration.slice(readModelMigration.indexOf('create function public.list_admin_financial_requests_mobile'),readModelMigration.indexOf('revoke all on function public.list_admin_financial_request_queue'));
assert.doesNotMatch(mobileReadModel,/get_admin_financial_request_detail\(/);
assert.match(mobileReadModel,/jsonb_agg\(q\.payload/);
assert.doesNotMatch(readModelMigration,/'signature_data'|'financial_profile_snapshot'|'google_export'|'legacy_reference'/);
assert.match(readModelMigration,/revoke all on function public\.list_admin_financial_request_queue\(\) from public,anon/);
assert.match(readModelMigration,/grant execute on function public\.list_admin_financial_request_queue\(\) to authenticated/);
assert.match(readModelApply,/--dry-run/);
assert.match(readModelApply,/--recovery-dry-run/);
assert.match(readModelApply,/--apply/);
assert.match(readModelApply,/EXPLICIT_MODE_REQUIRED/);
assert.match(readModelApply,/PROTECTED_DATA_CHANGED/);

assert.ok(bundle.includes('data-admin-financial-workbench'),'bundle missing financial workbench');
assert.ok(bundle.includes('listFinancialQueue'),'bundle missing financial queue projection');
assert.ok(html.includes('app/bundle.js?v=174'),'HTML cachebuster missing');
assert.ok(serviceWorker.includes("sutiapp-v118")&&serviceWorker.includes('app/bundle.js?v=174'),'service worker cache cutover missing');

console.log('Admin financial requests workbench static contract PASS');
