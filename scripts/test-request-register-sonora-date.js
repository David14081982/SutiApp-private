'use strict';
// H-REQUEST-DATE-SONORA-001: J («Fecha solicitud») is the Sonora calendar day of the
// request instant. Executes the real Apps Script receiver against in-memory sheets.
// No Google, Supabase or personal data is used.
const assert=require('assert').strict,fs=require('fs'),path=require('path'),crypto=require('crypto');
const {fixture,payload,sha}=require('./test-requests-workflow-google-sync-bridge');
const root=path.resolve(__dirname,'..'),evidence=path.join(root,'docs/qa/evidence/request-date-sonora-20261123');
const receipts=[];
function run(name,fn){fn();receipts.push({test:name,status:'PASS'});}
const serial=day=>Date.parse(day+'T00:00:00Z')/86400000+25569;
function v2(iso,folio='SR-2026-000954'){const p={...payload('prestamo'),contract_version:'REQUEST_REGISTER_V2',request_folio:folio};p.row[9]=iso;p.request_created_at=iso;p.payload_sha256=sha(p.row);return p;}
const approved=p=>({...p,revision:2,request_status:'approved',desired_status:'APROBADO'});
const j=f=>f.target.getRange(2,10).getDisplayValue();

run('evening requests keep the Sonora day; the raw ISO transport and hash stay unchanged',()=>{
  for(const [iso,display] of [
    ['2026-11-14T00:55:12.345678+00:00','13/11/2026'], // 13 nov 17:55 en Sonora
    ['2026-11-14T06:59:59Z','13/11/2026'],             // 23:59:59 en Sonora
    ['2026-11-14T07:00:00Z','14/11/2026'],             // medianoche en Sonora
    ['2026-11-13T16:59:00Z','13/11/2026'],             // mañana: no cambia
    ['2026-11-13T17:55:00-07:00','13/11/2026'],
    ['2026-12-01T03:00:00+00:00','30/11/2026'],        // cruza de mes
    ['2027-01-01T06:30:00Z','31/12/2026'],             // cruza de año
  ]){
    const f=fixture(),p=v2(iso),raw=JSON.stringify(p.row);
    const res=f.send(p);assert(res.ok,iso+' '+JSON.stringify(res));
    assert.equal(j(f),display,iso);assert.equal(f.target.rows[1][9],serial(display.split('/').reverse().join('-')),iso);
    assert.equal(JSON.stringify(p.row),raw);assert.equal(f.registry.rows[1][8],iso);
    assert.equal(JSON.parse(f.registry.rows[1][12].slice(16)).initial_sha256,p.payload_sha256);
  }
});

run('a row written with the old UTC day is recognized and corrected to Sonora on its next sync',()=>{
  const f=fixture(),p=v2('2026-11-14T00:55:12.345678+00:00');assert(f.send(p).ok);
  f.target.rows[1][9]=serial('2026-11-14');assert.equal(j(f),'14/11/2026');
  f.writes.length=0;const res=f.send(approved(p));assert(res.ok,JSON.stringify(res));
  assert.equal(j(f),'13/11/2026');assert.equal(f.target.rows[1][24],'Aprobado');
  assert(f.writes.some(w=>w.sheet===f.target.name&&w.col===10&&w.width===1));
});

run('a row already corrected by hand to the Sonora day syncs without touching J',()=>{
  const f=fixture(),p=v2('2026-11-20T00:49:00.000000+00:00','SR-2026-001010');assert(f.send(p).ok);assert.equal(j(f),'19/11/2026');
  f.writes.length=0;assert(f.send(approved(p)).ok);assert.equal(j(f),'19/11/2026');
  assert(!f.writes.some(w=>w.sheet===f.target.name&&w.col===10));
});

run('any other date in J still fails closed before writes',()=>{
  for(const wrong of ['2026-11-12','2026-11-15']){
    const f=fixture(),p=v2('2026-11-14T00:55:12.345678+00:00');assert(f.send(p).ok);
    f.target.rows[1][9]=serial(wrong);f.writes.length=0;
    assert.equal(f.send(approved(p)).error,'REQUEST_SYNC_DATE_INVALID',wrong);assert.equal(f.writes.length,0,wrong);
  }
});

run('transferred loans (numeric ID + receipt) accept the legacy or Sonora J and never rewrite it',()=>{
  for(const [day,ok] of [['2026-11-14',true],['2026-11-13',true],['2026-11-12',false]]){
    const f=fixture(),p=v2('2026-11-14T00:55:12.345678+00:00');assert(f.send(p).ok);
    f.target.rows[1][0]=3094;f.target.rows[1][24]='Iniciado';f.target.rows[1][9]=serial(day);
    f.target.notes['2:1']='SUTI_LOAN_TRANSFER_V1:'+JSON.stringify({id:3094,identity:p.request_folio,sourceHash:'a'.repeat(64)});
    f.writes.length=0;const res=f.send(approved(p));
    if(ok){assert(res.ok,day+' '+JSON.stringify(res));assert.equal(f.target.rows[1][9],serial(day));assert.equal(f.target.rows[1][0],3094);
      assert.equal(f.target.rows[1][24],'Iniciado');assert(!f.writes.some(w=>w.sheet===f.target.name));}
    else{assert.equal(res.error,'REQUEST_SYNC_DATE_INVALID');assert.equal(f.writes.length,0);}
  }
});

run('request removal recognizes legacy and Sonora J and rejects any other day',()=>{
  for(const [day,ok] of [['2026-11-14',true],['2026-11-13',true],['2026-11-11',false]]){
    const f=fixture(),p=v2('2026-11-14T00:55:12.345678+00:00');assert(f.send(p).ok);f.target.rows[1][9]=serial(day);
    const q={action:'delete_request',secret:p.secret,contract_version:'REQUEST_DELETE_V1',program_request_id:p.program_request_id,request_folio:p.request_folio,
      numero_control:p.numero_control,request_created_at:p.request_created_at,initial_sha256:p.payload_sha256,operation_id:crypto.randomUUID(),mode:'inspect'};
    const res=f.send(q);
    if(ok)assert(res.ok&&res.fingerprint,day+' '+JSON.stringify(res));else assert.equal(res.error,'REQUEST_SYNC_DATE_INVALID');
  }
});

run('timestamps without an explicit offset are rejected (never guessed)',()=>{
  for(const bad of ['2026-11-13T17:55:00','2026-11-13T17:55:00.000','2026-11-13 17:55:00+00:00']){
    const f=fixture(),p=v2(bad);assert.equal(f.send(p).error,'REQUEST_SYNC_DATE_INVALID',bad);assert.equal(f.writes.length,0,bad);
  }
});

fs.mkdirSync(evidence,{recursive:true});
const proof={status:'PASS',tests:receipts,timeZone:'America/Hermosillo',externalWrites:0};
fs.writeFileSync(path.join(evidence,'gas-tests.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
