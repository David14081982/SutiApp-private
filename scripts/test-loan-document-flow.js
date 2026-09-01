'use strict';
const assert=require('assert').strict,fs=require('fs'),path=require('path'),vm=require('vm'),root=path.resolve(__dirname,'..'),read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const repository=read('app/document-workflow-repository.js'),documents=read('app/screens-documentos.jsx'),loan=read('app/screens-loan.jsx'),migration=read('supabase/migrations/20260829000100_loan_document_flow_recovery.sql'),recovery=read('supabase/recovery/20260829000100_loan_document_flow_recovery_recovery.sql');
[repository,documents,loan].forEach((source)=>new vm.Script(source));

// Cases 1, 2 and 10: every click uses the auth-bound Edge authorization and signs one object.
assert.match(repository,/async function selfPreview\(document,purpose\)/);
assert.match(repository,/mode:'SELF_SERVICE',purpose,document_id:document\.id/);
assert.doesNotMatch(repository,/createSignedUrl|createSignedUrls/);
assert.doesNotMatch(documents,/window\.open\(doc\.signedUrl/);
assert.match(documents,/DocumentWorkflowRepository\.selfPreview\(doc,accessPurpose\|\|'SELF_SERVICE_EXPEDIENTE'\)/);

// Case 3: DB metadata is not treated as physical availability.
assert.match(migration,/left join storage\.objects/);
assert.match(migration,/OBJECT_MISSING/);
assert.match(migration,/request_documents_require_available_object/);
assert.match(documents,/este documento ya no está disponible\. Puedes cargarlo nuevamente\./);

// Cases 4 and 5: camera and gallery/file are separate user intents.
assert.match(documents,/setAttribute\('capture','environment'\)/);
assert.match(documents,/source==='camera'\?'image\/\*'/);
assert.match(documents,/Tomar foto/);
assert.match(documents,/Adjuntar archivo/);

// Case 6: replacement creates a new linked row and never updates VERIFIED.
assert.match(migration,/add column replaces_document_id/);
assert.match(migration,/REPLACEMENT_UPLOAD/);
assert.doesNotMatch(migration,/update public\.affiliate_documents[\s\S]{0,300}status='VERIFIED'/);
assert.match(migration,/affiliate_documents_latest_type_idx/);

// Cases 7 and 8: exact missing list, recovery action, and physical availability gate.
assert.match(loan,/data-loan-missing-documents/);
assert.match(loan,/Corregir documentos/);
assert.match(loan,/document\.available === true/);
assert.match(loan,/document\.availability === 'AVAILABLE'/);
assert.match(loan,/newestLoanDocument/);

// Case 9: a verified existing row remains reusable when it is newest and exists.
assert.match(loan,/ACCEPTED_LOAN_DOCUMENT_STATUSES/);
assert.match(migration,/where status in \('PENDING_REVIEW','UNDER_REVIEW','REUPLOAD_REQUIRED'\)/);

// Upload hygiene and security remain bounded.
assert.match(repository,/MAX_SOURCE=25\*1024\*1024/);
assert.match(repository,/IMAGE_MAX_DIMENSION=2400/);
assert.match(repository,/imageOrientation:'from-image'/);
assert.match(repository,/upsert:false/);
assert.match(migration,/security definer set search_path=''/);
assert.match(read('supabase/migrations/20260830000100_loan_document_context_isolation.sql'),/revoke all on function[\s\S]*public\.authorize_self_document_preview\(uuid,text\)[\s\S]*from public,anon,authenticated/);
assert.match(recovery,/RECOVERY_BLOCKED_REPLACEMENT_HISTORY_EXISTS/);
assert.doesNotMatch(repository,/localStorage|sessionStorage|service_role|SUPABASE_SERVICE_ROLE/);

console.log(JSON.stringify({status:'PASS',cases:10,fresh_signing:true,physical_availability:true,replacement_history:true,camera:true,upload:true,exact_missing_list:true}));
