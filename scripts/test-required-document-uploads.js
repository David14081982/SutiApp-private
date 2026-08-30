'use strict';
const assert=require('assert').strict,fs=require('fs'),path=require('path'),vm=require('vm'),root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const membership=read('app/screens-membership-application.jsx'),loan=read('app/screens-loan.jsx'),workflow=read('app/document-workflow-repository.js');[membership,loan,workflow].forEach(x=>new vm.Script(x));
assert.match(membership,/requirements\('membership',offering\.id\)/);assert.match(membership,/Promise\.allSettled/);assert.match(membership,/DocumentRequirementList/);assert.match(membership,/phase==='ready'/);
assert.match(loan,/requirements\('prestamo'\)/);assert.match(loan,/Promise\.allSettled/);assert.match(loan,/StepDocuments/);assert.match(loan,/phase:documentState\.phase/);assert.match(loan,/Reintentar/);
assert.match(workflow,/previewUnavailable/);assert.doesNotMatch(workflow,/if\(s\.error\)throw s\.error/);assert.match(read('app/screens-documentos.jsx'),/canUpload/);
assert.match(workflow,/selfPreview/);assert.match(workflow,/list_effective_affiliate_documents/);
assert.match(read('app/screens-documentos.jsx'),/Subir archivo/);assert.match(read('app/screens-documentos.jsx'),/Tomar foto/);assert.match(read('app/screens-documentos.jsx'),/capture','environment/);
console.log('Required document upload resilience PASS');
