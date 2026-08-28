'use strict';

const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const membership = read('app/screens-membership-application.jsx');
const documents = read('app/screens-documentos.jsx');
const requests = read('app/program-request-repository.js');
const workflow = read('app/document-workflow-repository.js');
const app = read('app/app.jsx');
const bundle = read('app/bundle.js');

new vm.Script(membership);
new vm.Script(documents);

assert.doesNotMatch([membership, documents].join('\n'), /localStorage|sessionStorage|IndexedDB|FileReader|data:image|Sams Club|\$350|\$175/);
assert.match(membership, /requirements\('membership',offering\.id\)/);
assert.match(membership, /ProgramTermsRepository\.current\('membership',offering\.id\)/);
assert.match(membership, /DocumentWorkflowRepository\.list\(\)/);
assert.match(membership, /ProgramRequestRepository\.createMembership/);
assert.match(requests, /rpc\('create_membership_request'/);
assert.match(workflow, /from\('program_document_requirements'\)/);
assert.match(workflow, /from\('affiliate_documents'\)/);
assert.match(workflow, /createSignedUrl\(a\.storage_path,300\)/);

assert.match(membership, /requirements\.filter\(\(requirement\)=>requirement\.required===true\)/);
assert.match(membership, /requiredRequirements\.length\+FIELDS\.length/);
assert.match(membership, /requiredDocumentState\.filter\(\(entry\)=>!entry\.document\)/);
assert.match(membership, /FIELDS\.filter\(\(field\)=>!fieldValidity\[field\.id\]\)/);
assert.match(membership, /data-requirement-count/);
assert.match(membership, /data-requirement-missing/);
assert.match(membership, /data-missing-kind/);
assert.match(membership, /goToMissing/);
assert.match(membership, /data-document-action=\"upload\"/);

assert.match(membership, /affiliate\.phone_raw\|\|user\.phone/);
assert.match(membership, /affiliate\.rfc_raw\|\|user\.rfc/);
assert.match(membership, /affiliate\.curp_raw\|\|user\.curp/);
assert.match(membership, /\^\[0-9\]\{10\}\$/);
assert.match(membership, /\^\[A-ZÑ&\]\{3,4\}\[0-9\]\{6\}\[A-Z0-9\]\{3\}\$/);
assert.match(membership, /\^\[A-Z\]\{4\}\[0-9\]\{6\}\[HM\]\[A-Z\]\{5\}\[A-Z0-9\]\[0-9\]\$/);

assert.match(membership, /offering\.empresa/);
assert.match(membership, /offering\.concepto/);
assert.match(membership, /money\(offering\.monto\)/);
assert.match(membership, /offering\.pagos\+' pagos'/);
assert.match(membership, /Number\(offering\.monto\)\/Math\.max\(1,Number\(offering\.pagos\)\)/);
assert.match(membership, /window\.SutiSeal/);
assert.match(membership, /mr-hero/);
assert.match(membership, /mr-tracker/);
assert.match(membership, /mr-doc-grid/);
assert.match(membership, /grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/);
assert.match(membership, /mr-privacy/);
assert.match(membership, /mr-footer/);
assert.match(membership, /Solicitar · faltan/);
assert.match(membership, /variant:'tiles'/);
assert.match(membership, /@media\(max-width:340px\)/);

assert.match(documents, /variant==='tiles'/);
assert.match(documents, /data-document-grid/);
assert.match(documents, /data-document-type-id/);
assert.match(documents, /data-document-status/);
assert.match(documents, /DocumentWorkflowRepository\.upload\(fileType,file\)/);
assert.match(documents, /\['REJECTED','REUPLOAD_REQUIRED'\]\.includes\(doc\.status\)/);
assert.match(documents, /doc\.signedUrl/);
assert.doesNotMatch(documents, /Quitar|\.remove\(|storage\.from\([^)]*\)\.remove/);

assert.match(membership, /phase==='ready'&&missing===0&&!!terms/);
assert.match(membership, /ready&&h\('div',\{className:'mr-ready'\}/);
assert.match(membership, /Términos pendientes de publicación/);
assert.match(membership, /documentIds:selectedDocuments\.map/);
assert.match(membership, /idempotencyKey:idem\.current/);
assert.match(membership, /Seguir mi solicitud/);
assert.match(membership, /app\.setTab\('historial'\)/);
assert.doesNotMatch(app, /window\.TextEditBar|window\.LiveText/);
assert.match(bundle, /@@file screens-membership-application\.jsx/);
assert.match(bundle, /@@file screens-documentos\.jsx/);

console.log('Membership request UI cutover contract PASS');
