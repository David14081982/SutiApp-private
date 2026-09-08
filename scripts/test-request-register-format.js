'use strict';
const assert=require('assert').strict,fs=require('fs'),path=require('path');
const {fixture,payload,sha}=require('./test-requests-workflow-google-sync-bridge');
const root=path.resolve(__dirname,'..'),evidence=path.join(root,'docs/qa/evidence/register-format-20260908');
fs.mkdirSync(evidence,{recursive:true});
const receipts=[];
function run(name,fn){fn();receipts.push({test:name,status:'PASS'});}
function v2(){return {...payload('prestamo'),contract_version:'REQUEST_REGISTER_V2',request_folio:'SR-2026-000121'};}
run('V2 renders folio/native date/Aprobado; UUID/hash and raw ISO remain immutable',()=>{
  const f=fixture(),p=v2(),raw=JSON.stringify(p.row);p.row[9]='2026-09-07T04:35:41.511697+00:00';p.payload_sha256=sha(p.row);
  const res=f.send(p);assert(res.ok,JSON.stringify(res));assert.equal(f.target.rows[1][0],p.request_folio);assert.equal(f.target.getRange(2,10).getDisplayValue(),'07/09/2026');assert.equal(typeof f.target.rows[1][9],'number');
  assert.equal(f.registry.rows[1][0],p.program_request_id);assert.equal(JSON.parse(f.registry.rows[1][12].slice(16)).initial_sha256,p.payload_sha256);
  const approved={...p,revision:2,request_status:'approved',desired_status:'APROBADO'};assert(f.send(approved).ok);assert.equal(f.target.rows[1][24],'Aprobado');
  f.writes.length=0;assert(f.send(approved).ok);assert(f.send({...p,contract_version:'REQUEST_REGISTER_V1',request_folio:undefined}).ok);assert.equal(f.writes.length,0);assert.equal(f.target.rows[1][24],'Aprobado');assert.equal(f.target.getLastRow(),2);
  assert.equal(p.row[0],p.program_request_id);assert.equal(p.row[9],'2026-09-07T04:35:41.511697+00:00');assert.equal(sha(p.row),p.payload_sha256);
});
run('V1 row upgrades in place; interrupted folio write recovers without duplicate or raw hash change',()=>{
  for(const interruptedColumn of [1,10]){
    const f=fixture(),p=payload('membership');assert(f.send(p).ok);const old=f.target.rows[1].slice(),next={...p,contract_version:'REQUEST_REGISTER_V2',request_folio:'SR-2026-000170'};
    f.interrupt(c=>c.sheet===f.target.name&&c.col===interruptedColumn);assert(!f.send(next).ok);assert(f.send(next).ok);
    assert.equal(f.target.getLastRow(),2);assert.equal(f.target.rows[1][0],next.request_folio);assert.deepEqual(f.target.rows[1].filter((_,i)=>![0,9].includes(i)),old.filter((_,i)=>![0,9].includes(i)));
    assert(f.writes.filter(w=>w.sheet===f.target.name&&w.width!==33).every(w=>[1,10,25].includes(w.col)));
  }
});
run('valid leap date and ISO calendar day preserved; malformed dates/folios fail before writes',()=>{
  for(const [iso,display] of [['2024-02-29T01:00:00Z','29/02/2024'],['2026-01-01T00:01:00+14:00','01/01/2026']]){const f=fixture(),p=v2();p.row[9]=iso;p.payload_sha256=sha(p.row);assert(f.send(p).ok);assert.equal(f.target.getRange(2,10).getDisplayValue(),display);}
  for(const bad of ['2026-02-29T00:00:00Z','2026-13-01T00:00:00Z','not-date']){const f=fixture(),p=v2();p.row[9]=bad;p.payload_sha256=sha(p.row);assert.equal(f.send(p).error,'REQUEST_SYNC_DATE_INVALID');assert.equal(f.writes.length,0);}
  for(const bad of ['',undefined,'=formula','SR-2026-1']){const f=fixture(),p=v2();p.request_folio=bad;assert.equal(f.send(p).error,'REQUEST_SYNC_FOLIO_INVALID');assert.equal(f.writes.length,0);}
});
run('folio collision, changed folio, identity/date formula and relocated row fail closed',()=>{
  for(const problem of ['collision','changed-folio','identity-formula','date-formula','moved']){
    const f=fixture(),p=v2();assert(f.send(p).ok);
    if(problem==='collision'){f.target.rows.push(f.target.rows[1].slice());f.target.maxRows++;}
    if(problem==='changed-folio')p.request_folio='SR-2026-000999';
    if(problem==='identity-formula')f.target.formulas['2:1']='="SR-2026-000121"';
    if(problem==='date-formula')f.target.formulas['2:10']='=TODAY()';
    if(problem==='moved'){f.target.rows.splice(1,0,[]);f.target.maxRows++;}
    f.writes.length=0;assert(!f.send(p).ok,problem);assert.equal(f.writes.length,0,problem);
  }
});
run('V2 never writes AH onward; later legacy state Iniciado survives an equal/stale revision',()=>{
  const f=fixture(),p=v2();f.target.rows[1]=Array(38).fill('');f.target.rows[1][23]=false;f.target.rows[1][33]='=EXCLUDED';assert(f.send(p).ok);
  f.target.rows[1][24]='Iniciado';assert(f.send(p).ok);assert.equal(f.target.rows[1][24],'Iniciado');assert.equal(f.target.rows[1][33],'=EXCLUDED');assert(f.writes.filter(w=>w.sheet===f.target.name).every(w=>w.col+w.width-1<=33));
});
const proof={status:'PASS',tests:receipts,externalWrites:0};fs.writeFileSync(path.join(evidence,'format-tests.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
