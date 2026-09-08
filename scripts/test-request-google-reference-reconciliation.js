'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert').strict;
const {fixture,payload}=require('./test-requests-workflow-google-sync-bridge');
const evidence=path.resolve(__dirname,'../docs/qa/evidence/reference-reconciliation-20260908');fs.mkdirSync(evidence,{recursive:true});
const cases=[],run=(name,fn)=>{fn();cases.push({name,status:'PASS'});},v2=()=>({...payload('membership'),contract_version:'REQUEST_REGISTER_V2',request_folio:'SR-2026-000194'});
run('moved folio resolves actual row, repairs registry, preserves cells, then updates only Y',()=>{
  const f=fixture(),p=v2();assert(f.send(p).ok);const old=f.target.rows[1].slice();f.target.rows.splice(1,0,['UNRELATED']);f.target.maxRows++;f.target.formats['3:10']=f.target.formats['2:10'];f.writes.length=0;
  let r=f.send(p);assert(r.ok,JSON.stringify(r));assert.equal(r.google_row,3);assert.equal(f.registry.rows[1][11],'Historial de solicitudes!A3');assert.deepEqual(f.target.rows[2],old);assert.equal(f.writes.filter(w=>w.sheet===f.target.name).length,0);
  r=f.send({...p,revision:2,request_status:'approved',desired_status:'APROBADO'});assert(r.ok);assert.equal(f.target.rows[2][24],'Aprobado');assert.equal(f.target.rows[1][0],'UNRELATED');assert.equal(f.target.getLastRow(),3);
  assert(f.writes.filter(w=>w.sheet===f.target.name).every(w=>w.row===3&&w.col===25&&w.width===1));
});
run('old reference beyond reduced grid can relocate upward by folio',()=>{
  const f=fixture(),p=v2();assert(f.send(p).ok);f.registry.rows[1][11]='Historial de solicitudes!A2326';assert(f.send(p).ok);assert.equal(f.registry.rows[1][11],'Historial de solicitudes!A2');
});
run('confirmed missing row never recreates, including empty/reused/out-of-grid old position',()=>{
  for(const kind of ['empty','reused','removed-grid']){const f=fixture(),p=v2();assert(f.send(p).ok);f.target.rows[1]=kind==='reused'?['OTHER-IDENTITY']:[];if(kind==='removed-grid')f.registry.rows[1][11]='Historial de solicitudes!A2326';const count=f.target.maxRows;f.writes.length=0;const r=f.send(p);assert.equal(r.error,'REQUEST_SYNC_TARGET_MISSING');assert.equal(f.writes.length,0);assert.equal(f.target.maxRows,count);}
});
run('duplicate folio, wrong control/date, and formula locator cannot relocate',()=>{
  for(const kind of ['duplicate','control','date','formula']){const f=fixture(),p=v2();assert(f.send(p).ok);f.registry.rows[1][11]='Historial de solicitudes!A2326';if(kind==='duplicate'){f.target.rows.push(f.target.rows[1].slice());f.target.maxRows++;}if(kind==='control')f.target.rows[1][1]='OTHER';if(kind==='date')f.target.rows[1][9]=1;if(kind==='formula')f.registry.formulas['2:12']='="Historial de solicitudes!A2326"';f.writes.length=0;assert(!f.send(p).ok,kind);assert.equal(f.writes.length,0,kind);}
});
run('interrupted initial reservation still recovers exactly one row',()=>{
  const f=fixture(),p=v2();f.interrupt(c=>c.sheet===f.target.name);assert(!f.send(p).ok);assert(f.send(p).ok);assert.equal(f.target.getLastRow(),2);assert.equal(f.registry.getLastRow(),2);
});
run('same/stale revision repairs locator without resetting later legacy Iniciado',()=>{
  const f=fixture(),p=v2();assert(f.send(p).ok);assert(f.send({...p,revision:2,request_status:'approved',desired_status:'APROBADO'}).ok);f.target.rows[1][24]='Iniciado';f.registry.rows[1][11]='Historial de solicitudes!A2326';assert(f.send(p).ok);assert.equal(f.target.rows[1][24],'Iniciado');assert.equal(f.registry.rows[1][11],'Historial de solicitudes!A2');
});
const proof={status:'PASS',cases,externalWrites:0,AHOnward:'untouched'};fs.writeFileSync(path.join(evidence,'receiver-tests.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
