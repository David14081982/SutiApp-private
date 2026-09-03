'use strict';
const crypto=require('crypto'),fs=require('fs'),path=require('path'),child=require('child_process');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const sha=file=>crypto.createHash('sha256').update(read(file).replace(/\r\n/g,'\n')).digest('hex').toUpperCase();
const must=(value,label)=>{if(!value)throw new Error(label);};
const contains=(source,value,label)=>must(source.includes(value),label||`missing ${value}`);

const protectedSha='c5e0647922a8fdd9e34bf0c09cfa670dc41f2527';
const migration='supabase/migrations/20260903000140_finance_request_workflow_ux_correction.sql';
const migrationSha='59A68797AB302DC94608E93119C6C95A56F79084B1E5798D18F7A3ECAA02C117';
must(sha(migration)===migrationSha,`PROTECTED_MIGRATION_CHANGED: ${migration}`);

const contract=read('docs/FINANCE_REQUESTS_FLOW_PROTECTED_CONTRACT.md');
const source=read('docs/SOURCE_OF_TRUTH.md');
const invariants=read('docs/INVARIANTS.md');
const decisions=read('docs/DECISIONS.md');
const evidence=read('docs/qa/H-FINANCE-REQUESTS-FLOW-UX-CORRECTION-001-EVIDENCE.md');
for(const doc of [contract,source,invariants,decisions,evidence])contains(doc,protectedSha,'approved production SHA missing');
for(const value of [
  'program_requests','workflow_snapshot','operational_workflows','operational_workflow_stages',
  'operational_request_tracking','program_request_admin_events','request_documents','affiliate_documents',
  'private_assets','private-assets','document-access','resolve_program_request_workflow_state'
])contains(contract,value,`protected authority missing: ${value}`);
for(let id=202;id<=206;id++)contains(invariants,`INV-${id}:`,`protected invariant missing: INV-${id}`);
contains(decisions,'ADR-100 — Protección del flujo Admin Finanzas · Solicitudes');
contains(contract,'PROTECTED / CLOSED CONTRACT');

for(const test of [
  'scripts/test-admin-financial-requests-workbench.js',
  'scripts/test-financial-request-admin-events.js',
  'scripts/test-request-workflow-timeline-cutover.js',
  'scripts/test-admin-requests-workbench.js'
]){
  const result=child.spawnSync(process.execPath,[path.join(root,test)],{cwd:root,encoding:'utf8'});
  must(result.status===0,`FOCUSED_REGRESSION_FAILED: ${test}\n${result.stderr||result.stdout}`);
}

const browser=JSON.parse(read('docs/qa/evidence/finance-request-workflow-ux-20260903/browser-result.json'));
must(browser.status==='PASS'&&browser.mode==='PRODUCTION_FOCAL','production browser evidence is not PASS');
for(const type of ['loan','membership','quote','benefit']){
  const flow=browser.types&&browser.types[type],documents=browser.documents&&browser.documents[type];
  must(flow&&flow.flow&&flow.current&&flow.stages&&flow.actions&&flow.history,`production flow evidence missing: ${type}`);
  must(documents&&documents.automatic&&documents.failed===0&&!documents.manualPrepare,`automatic preview evidence missing: ${type}`);
}

console.log(JSON.stringify({status:'PASS',protected_contract:true,protected_sha:protectedSha,migration_sha:migrationSha,invariants:5,types:4,focused_tests:4,production_browser_evidence:true,global_suites:'NOT_EXECUTED',functional_change:false,production_data_change:false}));
