'use strict';

const assert=require('assert').strict;
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'..');
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const screen=read('app/screens-admin-requests.jsx');
const repository=read('app/program-request-repository.js');
const bundle=read('app/bundle.js');
const html=read('SutiApp.html');
const serviceWorker=read('sw.js');
const requestMigration=read('supabase/migrations/20260822000200_create_unified_program_requests.sql');
const documentMigration=read('supabase/migrations/20260825000100_complete_documents_credentials_membership_requests.sql');
const workflowMigration=read('supabase/migrations/20260822000400_admin_decisions_cutover.sql');
const history=read('app/screens-historial.jsx');
const operations=read('app/operations-store.jsx');

new vm.Script(screen);
new vm.Script(repository);

[
  'data-admin-requests-workbench','data-request-toolbar','data-request-queue',
  'data-request-detail-panel','data-request-timeline','data-request-safe-action-bar',
  'Guardar y siguiente','Buscar solicitudes','Filtrar por estado','Filtrar por tipo',
  'Filtrar por antigüedad','Filtrar por fecha',
  'Anterior','Siguiente','Pendientes','En revisión'
].forEach((contract)=>assert.ok(screen.includes(contract),contract));

['Pendiente','En revisión','Aprobada','Rechazada','Cancelada'].forEach((label)=>assert.ok(screen.includes(label),label));
['PENDING_REVIEW','UNDER_REVIEW','VERIFIED','REUPLOAD_REQUIRED','REJECTED'].forEach((state)=>assert.ok(screen.includes(state),state));
assert.match(screen,/ArrowDown/);
assert.match(screen,/ArrowUp/);
assert.match(screen,/event\.key==='Enter'/);
assert.match(screen,/data-request-inline-feedback/);
assert.match(screen,/data-request-action-feedback/);
assert.match(screen,/Guardando…/);
assert.match(screen,/Estado actualizado y verificado/);
assert.match(screen,/Conservamos tu selección y filtros/);
assert.match(screen,/@media\(max-width:1279px\)/);
assert.match(screen,/@media\(min-width:1280px\)/);
assert.match(screen,/min-width: 1024px/);
assert.match(screen,/Bandeja de solicitudes generales/);
assert.match(screen,/Finanzas · Solicitudes/);

const desktopSource=screen.slice(screen.indexOf('function DesktopRequests'),screen.indexOf('function MobileRequests'));
const mobileSource=screen.slice(screen.indexOf('function MobileRequests'),screen.indexOf('function RequestsModule'));
assert.doesNotMatch(desktopSource,/FinancialLegacyRepository|handoffRequest|approveRequest/);
assert.match(mobileSource,/FinancialLegacyRepository\.approveRequest/);
assert.match(mobileSource,/FinancialLegacyRepository\.handoffRequest/);
assert.match(screen,/desktop\?await window\.ProgramRequestRepository\.listGeneralQueue\(\):await window\.ProgramRequestRepository\.listMobile\(\)/);
assert.doesNotMatch(desktopSource,/bulk|selectAll|selectedIds|massive/i);
assert.doesNotMatch(desktopSource,/sla|deadline|vencimiento/i);
assert.doesNotMatch(screen,/Asignar responsable|Cambiar responsable/);
assert.doesNotMatch(screen,/Filtrar por responsable/);

const queueFields=(repository.match(/const queueFields=`([^`]+)`/)||[])[1]||'';
const detailFields=(repository.match(/const detailFields=`([^`]+)`/)||[])[1]||'';
assert(queueFields&&detailFields,'request projections missing');
['applicant_profile_snapshot','financial_profile_snapshot','financial_submission_snapshot','financial_approval_snapshot','signature_data','legacy_reference'].forEach((field)=>assert(!queueFields.includes(field),'queue leaks '+field));
assert(!detailFields.includes('financial_profile_snapshot'),'detail must not cross the financial boundary');
['membership_offering_id','terms_version_id','operational_request_tracking'].forEach((field)=>assert(!queueFields.includes(field),'queue uses ungranted or non-request ownership field '+field));
['membership_offering_id','terms_version_id'].forEach((field)=>assert(!detailFields.includes(field),'detail uses ungranted field '+field));
assert.match(repository,/async function listGeneralQueue\(\)/);
assert.match(repository,/async function listHistory\(\)/);
assert.match(repository,/async function listMobile\(\)/);
assert.match(repository,/\.is\('financial_processing_status',null\)\.order\('created_at'/);
const queueMethod=repository.slice(repository.indexOf('async function listGeneralQueue'),repository.indexOf('async function listHistory'));
const historyMethod=repository.slice(repository.indexOf('async function listHistory'),repository.indexOf('async function listMobile'));
const mobileMethod=repository.slice(repository.indexOf('async function listMobile'),repository.indexOf('async function detail'));
assert.match(queueMethod,/\.limit\(250\)/);
assert.doesNotMatch(historyMethod+mobileMethod,/\.limit\(/);
assert.match(repository,/async function detail\(id\)/);
['request_documents','operational_request_tracking'].forEach((table)=>assert.ok(repository.includes(`from('${table}')`),table));
assert.match(repository,/document_requirements_snapshot/);
assert.match(repository,/operational_workflows!workflow_id/);
assert.match(repository,/Promise\.all\(\[documents,requirements,tracking\]\)/);
assert.match(repository,/documents_available:!parts\[0\]\.error/);
assert.match(repository,/tracking_available:!parts\[2\]\.error/);
assert.match(screen,/data-request-tracking-unavailable/);
assert.match(repository,/listGeneralQueue,listHistory,listMobile,listFinancialMobile,listFinancialQueue,detail,financialDetail,update/);
assert.match(screen,/ProgramRequestRepository\.update\(selected\.id,status,detail\.notes\|\|''\)/);

assert.match(requestMigration,/status text not null default 'submitted'/);
assert.match(requestMigration,/program_requests_status_check check \(status in \('submitted','in_review','approved','rejected','cancelled','requires_financial_processing'\)\)/);
assert.match(requestMigration,/if not \(public\.has_admin_permission\('program_requests\.write'\)/);
assert.match(requestMigration,/raise exception 'REQUEST_DENIED' using errcode='42501'/);
assert.match(requestMigration,/revoke execute on function public\.update_program_request\(uuid,text,text\) from public,anon/);
assert.match(documentMigration,/create policy request_documents_read[\s\S]*program_requests r/);
assert.match(workflowMigration,/responsible text not null default 'Sindicato'/);
assert.match(workflowMigration,/stage_dates jsonb not null default '\{\}'/);
assert.match(history,/window\.useOperationsStore\(\)/);
assert.match(operations,/window\.ProgramRequestRepository\.listHistory\(\)/);
assert.doesNotMatch(operations,/Promise\.all\(\[window\.MarketplaceRepository\.listRequests/);

assert.ok(bundle.includes('data-admin-requests-workbench'),'bundle missing requests workbench');
assert.ok(bundle.includes('listGeneralQueue'),'bundle missing queue repository');
assert.ok(html.includes('app/bundle.js?v=170'),'HTML cachebuster missing');
assert.ok(serviceWorker.includes("sutiapp-v114")&&serviceWorker.includes('app/bundle.js?v=170'),'service worker cache cutover missing');
assert.doesNotMatch(screen+'\n'+repository,/localStorage|sessionStorage|IndexedDB/);
assert.doesNotMatch(screen+'\n'+repository,/\bDATA\b|\bMOCKS?\b|\bmockData\b/);

console.log('Admin requests workbench static contract PASS');
