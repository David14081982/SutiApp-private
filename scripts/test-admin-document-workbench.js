'use strict';

const assert=require('assert').strict;
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'..');
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const screen=read('app/screens-admin-documents.jsx');
const repository=read('app/document-workflow-repository.js');
const migration=read('supabase/migrations/20260825000100_complete_documents_credentials_membership_requests.sql');

new vm.Script(screen);
new vm.Script(repository);

[
  'data-admin-document-workbench','data-document-review-queue','data-document-persistent-preview',
  'data-document-decision-panel','data-document-queue-navigator','Guardar y siguiente',
  'Buscar en la cola documental','Filtrar por estado','Filtrar por documento',
  'Filtrar por afiliado','Más antiguos primero','Pendiente hace '
].forEach((contract)=>assert.ok(screen.includes(contract),contract));

assert.match(screen,/Bandeja de revisión/);
assert.match(screen,/Configuración documental/);
assert.match(screen,/\['catalog','Catálogo'\].*\['requirements','Requisitos'\].*\['terms','Términos'\].*\['qr','QR'\]/s);
assert.match(screen,/docwb-grid.*grid-template-columns:minmax\(265px,.82fr\) minmax\(360px,1.35fr\)/s);
assert.match(screen,/@media\(min-width:1280px\).*grid-template-columns:minmax\(255px,.82fr\) minmax\(370px,1.35fr\) minmax\(260px,.82fr\)/s);
assert.match(screen,/ArrowDown/);
assert.match(screen,/ArrowUp/);
assert.match(screen,/event\.key==='Enter'/);

['Pendiente','En revisión','Verificado','Requiere nueva carga','Rechazado'].forEach((label)=>assert.ok(screen.includes(label),label));
assert.match(screen,/data-document-inline-feedback/);
assert.match(screen,/Guardando…/);
assert.match(screen,/✓ Verificado/);
assert.match(screen,/! Requiere nueva carga/);
assert.match(screen,/Error al guardar · Reintentar/);

assert.match(screen,/data-document-business-label/);
assert.match(screen,/data-document-technical-code':'secondary/);
assert.match(screen,/INE Reverso/);
assert.match(screen,/Hoja Tribunal/);
assert.match(screen,/Talón Última Quincena/);
assert.match(screen,/draggable:canWrite/);
assert.match(screen,/aria-label':'Posición de '/);
assert.match(screen,/data-document-camera/);
assert.match(screen,/data-document-file/);
assert.match(screen,/Impacto antes de guardar/);

assert.match(screen,/function MobileDocuments/);
assert.match(screen,/\[\['review','Revisión'\],\['catalog','Catálogo'\],\['requirements','Requisitos'\],\['terms','Términos'\],\['qr','QR'\]\]/);
assert.match(screen,/DocumentWorkflowRepository\.adminPreview\(document\.id,document\.affiliate_id,'ADMIN_DOCUMENT_REVIEW'\)/);
assert.match(screen,/mobileReview\(d\.id,'VERIFIED'\)/);
assert.match(screen,/mobileReview\(d\.id,'REUPLOAD_REQUIRED'\)/);
assert.doesNotMatch(screen,/includePreviews/);

const queueFields=(repository.match(/const reviewFields='([^']+)'/)||[])[1]||'';
assert(queueFields,'reviewFields missing');
assert(!queueFields.includes('storage_path'),'queue metadata must not expose or sign storage paths');
assert.match(repository,/async function adminPreview\(documentId,targetAffiliateId,purpose\)/);
assert.match(repository,/mode:'ADMIN',purpose,document_id:documentId,target_affiliate_id:targetAffiliateId/);
assert.doesNotMatch(repository,/createSignedUrl|createSignedUrls/);
assert.match(repository,/selfPreview,adminPreview/);
assert.match(repository,/review,reviewQueue/);

assert.match(migration,/if not public\.has_admin_permission\('documents\.write'\) then raise exception 'DOCUMENT_REVIEW_DENIED'/);
assert.match(migration,/create policy affiliate_documents_read[\s\S]*public\.has_admin_permission\('documents\.read'\)/);
assert.match(migration,/bucket_id='private-assets' and \(public\.has_admin_permission\('assets\.read'\)/);
assert.match(migration,/insert into public\.sensitive_change_audit[\s\S]*'affiliate_documents','REVIEW'/);

assert.doesNotMatch(screen+'\n'+repository,/localStorage|sessionStorage|IndexedDB|\bDATA\b/);
assert.doesNotMatch(screen,/FinancialLegacyRepository|Google|Apps Script|Tu Sindicato|CompaniesRepository/);
assert.doesNotMatch(screen,/data-admin-historical-gallery|HISTORICAL_NON_DOCUMENT/);

console.log('Admin document workbench static contract PASS');
