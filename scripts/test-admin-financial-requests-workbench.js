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

new vm.Script(screen);
new vm.Script(repository);
new vm.Script(financeStore);

[
  'data-admin-financial-workbench','data-financial-queue-toolbar','data-financial-queue',
  'data-financial-request-detail','data-financial-timeline','data-financial-documents',
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
assert.match(screen,/Se verificó el estado persistido/);
assert.match(screen,/@media\(max-width:1279px\)/);
assert.match(screen,/@media\(min-width:1280px\)/);
assert.match(screen,/min-width: 1024px/);

const desktopSource=screen.slice(screen.indexOf('function DesktopFinancialWorkbench'),screen.indexOf('function FinanzasModule'));
assert.match(desktopSource,/ProgramRequestRepository\.listFinancialQueue\(\)/);
assert.match(desktopSource,/ProgramRequestRepository\.financialDetail\(selectedId\)/);
assert.match(desktopSource,/DocumentWorkflowRepository\.reviewPreview/);
assert.match(desktopSource,/FinancialLegacyRepository\.approveRequest/);
assert.match(desktopSource,/FinancialLegacyRepository\.handoffRequest/);
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
assert.match(financeStore,/FinancialLegacyRepository\.approveRequest\(row\.id\)/);
assert.doesNotMatch(financeStore,/mapStatus=\{[^}]*aprobada:'approved'/);

assert.match(repository,/async function listFinancialQueue\(\)/);
assert.match(repository,/rpc\('list_admin_financial_request_queue'\)/);
assert.match(repository,/rpc\('list_admin_financial_requests_mobile'\)/);
assert.match(repository,/rpc\('get_admin_financial_request_detail',\{p_request_id:id\}\)/);
const queueMethod=repository.slice(repository.indexOf('async function listFinancialQueue'),repository.indexOf('async function detail'));
assert.doesNotMatch(queueMethod,/financial_submission_snapshot|financial_approval_snapshot|financial_profile_snapshot/);
assert.match(repository,/async function financialDetail\(id\)/);
assert.match(repository,/from\('request_documents'\)/);
assert.match(repository,/from\('program_terms_versions'\)/);
assert.match(repository,/Promise\.all\(\[documents,terms\]\)/);
assert.match(repository,/listFinancialMobile,listFinancialQueue,detail,financialDetail/);

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
assert.match(financialRepository,/approveRequest\(requestId\).*action: 'approve'/s);
assert.match(financialRepository,/handoffRequest\(requestId\).*action: 'handoff'/s);

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
assert.ok(html.includes('app/bundle.js?v=157'),'HTML cachebuster missing');
assert.ok(serviceWorker.includes("sutiapp-v101")&&serviceWorker.includes('app/bundle.js?v=157'),'service worker cache cutover missing');

console.log('Admin financial requests workbench static contract PASS');
