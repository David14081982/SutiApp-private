'use strict';
const assert=require('assert').strict,fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..'),read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const documents=read('app/screens-documentos.jsx'),viewer=read('app/image-viewer.jsx'),repository=read('app/document-workflow-repository.js');
const loan=read('app/screens-loan.jsx'),membership=read('app/screens-membership-application.jsx'),productPayment=read('app/screens-program-product-payment.jsx');
const adminDocuments=read('app/screens-admin-documents.jsx'),adminIdentity=read('app/screens-admin-identity.jsx');
const migration=read('supabase/migrations/20260830000200_document_requirements_platform_unified_ui.sql');
const edge=read('supabase/functions/document-access/index.ts');

for(const source of [documents,viewer,repository,loan,membership,productPayment,adminDocuments,adminIdentity])new vm.Script(source);

// One self-service component and one uploader contract serve every current request consumer.
for(const source of [loan,membership,productPayment])assert.match(source,/window\.UnifiedDocumentPhase/);
assert.match(documents,/function DocumentRequirementList/);
assert.match(documents,/sourceCapabilities/);
assert.match(documents,/type\.camera_allowed!==false/);
assert.match(documents,/type\.file_upload_allowed!==false/);
assert.match(documents,/title:originType\?\(origin\.replacing\?'Reemplazar '/);
assert.match(documents,/documento actual permanecerá intacto hasta completar la nueva carga/);
assert.match(documents,/data-document-origin':'camera'/);
assert.match(documents,/data-document-origin':'file'/);
assert.match(repository,/DocumentWorkflowRepository/);
assert.match(repository,/register_affiliate_document/);
assert.match(repository,/upsert:false/);
assert.match(migration,/replaces_document_id/);
assert.match(migration,/REPLACEMENT_UPLOAD/);
assert.match(migration,/where affiliate_id=v_affiliate and document_type_id=p_document_type_id and status in\('PENDING_REVIEW','UNDER_REVIEW','REUPLOAD_REQUIRED'\)/);
assert.doesNotMatch(migration,/update public\.affiliate_documents[\s\S]{0,260}status='VERIFIED'/);

// Every image consumer receives the global safe viewer behavior without per-screen z-indexes.
assert.match(viewer,/const MEDIA_VIEWER_LAYER = 10000/);
assert.match(viewer,/function useMediaViewerDialog/);
assert.match(viewer,/position: 'fixed'/);
assert.match(viewer,/env\(safe-area-inset-top\)/);
assert.match(viewer,/env\(safe-area-inset-left\)/);
assert.match(viewer,/env\(safe-area-inset-right\)/);
assert.match(viewer,/event\.target === event\.currentTarget/);
assert.match(viewer,/startedOnBackdrop\.current/);
assert.match(viewer,/event\.key === 'Escape'/);
assert.match(viewer,/body\.style\.overflow = 'hidden'/);
assert.match(viewer,/body\.style\.overflow = previous\.bodyOverflow/);
assert.match(viewer,/opener\.focus\(\{ preventScroll: true \}\)/);
assert.match(viewer,/width: 48, height: 48/);
assert.match(viewer,/role: 'dialog', 'aria-modal': 'true'/);
assert.match(viewer,/focus-visible/);

// Administrative document previews stay internal and reuse the same modal behavior.
assert.match(adminDocuments,/h\(window\.DocumentViewer/);
assert.match(adminDocuments,/setMobilePreview/);
assert.match(adminIdentity,/window\.useMediaViewerDialog/);
assert.doesNotMatch([documents,adminDocuments,adminIdentity].join('\n'),/window\.open\('about:blank'|popup\.location\.replace|Abrir original en otra pestaña/);

// Private preview and cross-user authorization remain backend-bound and unchanged.
assert.match(repository,/functions\.invoke\('document-access'/);
assert.doesNotMatch(repository,/createSignedUrls?/);
assert.match(edge,/authorize_self_document_preview/);
assert.match(edge,/authorize_admin_document_preview/);
assert.match(edge,/createSignedUrl\(authorized\.storage_path, TTL_SECONDS\)/);
assert.doesNotMatch([documents,viewer,repository].join('\n'),/localStorage|sessionStorage|data:image\/|service_role/);

console.log(JSON.stringify({status:'PASS',sharedReplace:true,consumers:['Documentos','Suti Prestamo','Membresias','Program Product Payment'],viewerConsumers:'GLOBAL',safeArea:true,overlayTargetGuard:true,scrollRestore:true,rawDocumentNavigation:false,backendChanged:false}));
