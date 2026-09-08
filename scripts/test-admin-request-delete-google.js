'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert').strict,crypto=require('crypto');
const {fixture,payload}=require('./test-requests-workflow-google-sync-bridge');
const cases=[],out=path.resolve(__dirname,'../docs/qa/evidence/admin-request-delete-20260908');fs.mkdirSync(out,{recursive:true});
function setup(){const f=fixture(),p={...payload('membership'),request_folio:'SR-2026-900001',contract_version:'REQUEST_REGISTER_V2'};assert(f.send(p).ok);const q={action:'delete_request',secret:p.secret,contract_version:'REQUEST_DELETE_V1',program_request_id:p.program_request_id,request_folio:p.request_folio,numero_control:p.numero_control,request_created_at:p.request_created_at,initial_sha256:p.payload_sha256,operation_id:crypto.randomUUID()};return{f,p,q};}
function run(name,fn){fn();cases.push({name,status:'PASS'});}
run('exact request cleared, dossier references not followed, AH+ and adjacent request preserved',()=>{
 const{f,p,q}=setup(),second={...payload('membership'),request_folio:'SR-2026-900002',contract_version:'REQUEST_REGISTER_V2'};assert(f.send(second).ok);f.target.rows[1][33]='=PROTECTED_AH';const neighbor=f.target.rows[2].slice(),formats=JSON.stringify(f.target.formats),before=JSON.stringify(f.target.rows);
 const inspected=f.send({...q,mode:'inspect'});assert(inspected.ok);assert.equal(JSON.stringify(f.target.rows),before);f.writes.length=0;
 assert(f.send({...q,mode:'apply',fingerprint:inspected.fingerprint}).deleted);assert(f.target.rows[1].slice(0,33).every(v=>v===''));assert.equal(f.target.rows[1][33],'=PROTECTED_AH');assert.deepEqual(f.target.rows[2],neighbor);assert.equal(JSON.stringify(f.target.formats),formats);assert(f.writes.filter(x=>x.sheet===f.target.name).every(x=>x.row===2&&x.col===1&&x.width===33));
 assert(f.send({...q,mode:'apply',fingerprint:inspected.fingerprint}).idempotent);assert.equal(f.send({...p,revision:99}).error,'REQUEST_DELETED');assert(f.target.rows[1].slice(0,33).every(v=>v===''));
});
run('duplicates, changed identity/date, formula, bad secret and changed fingerprint fail before writes',()=>{
 for(const kind of ['duplicate','control','date','formula','secret','fingerprint']){const{f,q}=setup();const inspected=f.send({...q,mode:'inspect'});assert(inspected.ok);if(kind==='duplicate'){f.target.rows.push(f.target.rows[1].slice());f.target.maxRows++;}if(kind==='control')f.target.rows[1][1]='OTHER';if(kind==='date')f.target.rows[1][9]='1900';if(kind==='formula')f.target.formulas['2:8']='=1';if(kind==='secret')q.secret='wrong';if(kind==='fingerprint')f.target.rows[1][25]='changed';f.writes.length=0;assert(!f.send({...q,mode:'apply',fingerprint:inspected.fingerprint}).ok,kind);assert.equal(f.writes.length,0,kind);}
});
run('interruption after tombstone safely retries without recreating request',()=>{
 const{f,p,q}=setup();const inspected=f.send({...q,mode:'inspect'});f.interrupt(c=>c.sheet===f.target.name);assert(!f.send({...q,mode:'apply',fingerprint:inspected.fingerprint}).ok);assert.equal(f.send(p).error,'REQUEST_DELETED');assert(f.send({...q,mode:'apply',fingerprint:inspected.fingerprint}).deleted);assert(f.target.rows[1].slice(0,33).every(v=>v===''));
});
run('confirmed absent request marks tombstone without touching reused row or creating business row',()=>{
 const{f,q}=setup();f.target.rows[1][0]='UNRELATED';const before=JSON.stringify(f.target.rows),inspected=f.send({...q,mode:'inspect'});assert(inspected.ok);assert(f.send({...q,mode:'apply',fingerprint:inspected.fingerprint}).deleted);assert.equal(JSON.stringify(f.target.rows),before);
});
run('interruption after clearing and before acknowledgement resumes from the original backup',()=>{
 const{f,p,q}=setup(),inspected=f.send({...q,mode:'inspect'});let calls=0;
 f.interrupt(c=>c.sheet===f.registry.name&&++calls===2);
 assert(!f.send({...q,mode:'apply',fingerprint:inspected.fingerprint}).ok);
 assert(f.target.rows[1].slice(0,33).every(v=>v===''));
 assert.equal(f.send({...p,revision:99}).error,'REQUEST_DELETED');
 assert(f.send({...q,mode:'apply',fingerprint:inspected.fingerprint}).deleted);
});
const proof={status:'PASS',cases,externalWrites:0};fs.writeFileSync(path.join(out,'google-tests.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
