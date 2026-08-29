'use strict';

const assert=require('assert').strict;
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const root=path.resolve(__dirname,'..');
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const loan=read('app/screens-loan.jsx');
const success=read('app/request-submission-success.jsx');
const catalog=read('app/screens-catalogo.jsx');
const marketplace=read('app/screens-marketplace.jsx');
const membership=read('app/screens-membership-application.jsx');
const bundle=read('app/bundle.js');

new vm.Script(loan);
new vm.Script(success);

for(const marker of [
  'data-loan-submission-success',
  'data-loan-success-confetti',
  'three-pass',
  '¡Solicitud enviada!',
  'Tu préstamo',
  'ya está en revisión',
  '¿Qué sigue?',
  'Solicitud enviada',
  'Justo ahora',
  'Revisión de documentos',
  'EN CURSO',
  'Autorización',
  'Depósito vía nómina',
  'Seguir mi solicitud',
  'Volver al inicio',
]) assert.ok((loan+'\n'+success).includes(marker),'loan success contract missing: '+marker);

assert.match(loan,/setSubmission\(\{folio:request\.folio\|\|request\.request_id,amount:result\.amount\}\)/);
assert.match(loan,/Success, \{ app, folio:submission\.folio, amount:submission\.amount \}/);
assert.match(success,/app&&app\.setTab&&app\.setTab\('historial'\)/);
assert.match(success,/app&&app\.setTab&&app\.setTab\('home'\)/);
assert.match(success,/window\.MOTION\.reduced\(\)\|\|window\.MOTION\.frozen\(\)/);
assert.match(success,/Array\.from\(\{length:42\}/);
assert.doesNotMatch(loan,/setSubmission\([^\n]*(?:total|interest|paymentPerPeriod)\s*[:+\-*\/]/);
assert.match(loan,/PENDING_REVIEW.*UNDER_REVIEW.*VERIFIED/);
assert.match(loan,/const freshDocumentState=await loadDocuments\(\)/);
assert.match(loan,/freshDocuments\.missing\.length/);
assert.match(loan,/code === 'REQUIRED_DOCUMENTS_MISSING'/);
assert.match(loan,/setStep\(2\)/);
assert.match(loan,/data-loan-submission-error/);
for(const source of [catalog,marketplace,membership]) assert.match(source,/RequestSubmissionSuccess/);
assert.match(catalog,/kind:'benefit'/);
assert.match(marketplace,/kind:'quote'/);
assert.match(membership,/kind:'membership'/);

for(const marker of ['data-loan-submission-success','¿Qué sigue?','data-loan-success-confetti','Volver al inicio']) {
  assert.ok(bundle.includes(marker),'generated bundle missing: '+marker);
}
for(const marker of ['REQUIRED_DOCUMENTS_MISSING','data-loan-submission-error','Antes de enviar, adjunta:']) {
  assert.ok(bundle.includes(marker),'generated bundle missing document preflight: '+marker);
}

console.log('Loan submission success static verification PASS: full confirmation, dynamic amount and folio, document preflight, four-stage timeline, three-pass confetti, history/home actions.');
