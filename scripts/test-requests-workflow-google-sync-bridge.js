'use strict';
// Isolated transport tests: execute the actual Apps Script receiver against an in-memory sheet.
// No Google, Supabase or personal data is used.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert').strict,crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const {buildRequestRegisterRow,REQUEST_REGISTER_HEADERS}=require(path.join(root,'supabase/functions/financial-legacy/request-google-sync.js'));
const sha=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').toUpperCase();
const receipts=[];
function fixture(){
  const writes=[];let failWhen=null;
  class Range{
    constructor(sheet,row,col,height=1,width=1){Object.assign(this,{sheet,row,col,height,width});assert(row>=1&&row+height-1<=sheet.maxRows,'RANGE_OUT_OF_GRID');}
    getValues(){return Array.from({length:this.height},(_,r)=>Array.from({length:this.width},(_,c)=>this.sheet.rows[this.row+r-1]?.[this.col+c-1]??''));}
    getDisplayValues(){return this.getValues().map((row,r)=>row.map((v,c)=>{if(typeof v==='number'&&this.sheet.formats[(this.row+r)+':'+(this.col+c)]==='dd/MM/yyyy'){const d=new Date((v-25569)*86400000).toISOString().slice(0,10).split('-');return d[2]+'/'+d[1]+'/'+d[0];}return String(v);}));}
    getValue(){return this.getValues()[0][0];}getDisplayValue(){return this.getDisplayValues()[0][0];}
    getFormula(){return this.sheet.formulas[this.row+':'+this.col]||'';}
    getFormulas(){return Array.from({length:this.height},(_,r)=>Array.from({length:this.width},(_,c)=>this.sheet.formulas[(this.row+r)+':'+(this.col+c)]||''));}
    setNumberFormat(format){for(let r=0;r<this.height;r++)for(let c=0;c<this.width;c++)this.sheet.formats[(this.row+r)+':'+(this.col+c)]=format;return this;}
    setValue(value){return this.setValues([[value]]);}
    setValues(rows){
      const call={sheet:this.sheet.name,row:this.row,col:this.col,height:this.height,width:this.width};
      if(failWhen&&failWhen(call)){failWhen=null;throw Error('ISOLATED_INTERRUPTION');}
      writes.push(call);
      rows.forEach((row,r)=>row.forEach((value,c)=>{const target=this.sheet.rows[this.row+r-1]||(this.sheet.rows[this.row+r-1]=[]);target[this.col+c-1]=typeof value==='string'&&/^'[=+@]/.test(value)?value.slice(1):value;}));return this;
    }
    getRow(){return this.row;}
    createTextFinder(text){return {matchEntireCell:()=>({findAll:()=>{const found=[];for(let r=this.row;r<this.row+this.height;r++)if(String(this.sheet.rows[r-1]?.[this.col-1]??'')===text)found.push(new Range(this.sheet,r,this.col));return found;}})};}
  }
  class Sheet{
    constructor(name,id,header){Object.assign(this,{name,id,rows:[header],maxRows:2,formulas:{},formats:{}});}
    getSheetId(){return this.id;}getLastRow(){let last=this.rows.length;while(last>0&&!(this.rows[last-1]||[]).some(v=>v!==''&&v!=null))last--;return last;}
    getMaxRows(){return this.maxRows;}insertRowsAfter(_row,count){this.maxRows+=count;}
    getRange(...args){return new Range(this,...args);}
  }
  const registryHeader=['program_request_id','affiliate_id','numero_control','program','product_id','request_type','request_status','requested_amount','request_created_at','received_at','processing_status','legacy_reference','legacy_result_status','last_processed_at','error_code','error_message'];
  const target=new Sheet('Historial de solicitudes',10616270,REQUEST_REGISTER_HEADERS.slice()),registry=new Sheet('SutiApp Financial Handoff',2026082207,registryHeader);
  let held=false;
  const context={console,ContentService:{MimeType:{JSON:'JSON'},createTextOutput:text=>({text,setMimeType(){return this;}})},
    PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'isolated-server-secret'})},
    LockService:{getScriptLock:()=>({tryLock:()=>{if(held)return false;held=true;return true;},releaseLock:()=>{held=false;}})},
    Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(_a,s)=>Array.from(crypto.createHash('sha256').update(s).digest())},
    SpreadsheetApp:{openById:()=>({getId:()=> '1Vxy84N7mzbuioTmWhjRD2QFboDx--rG3iUwmLuyeY80',getSheetByName:name=>name===target.name?target:registry}),flush:()=>{}}
  };
  vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'google-apps-script/financial-handoff/Code.gs'),'utf8'),context);
  return {target,registry,writes,interrupt:fn=>{failWhen=fn;},send:payload=>JSON.parse(context.doPost({postData:{contents:JSON.stringify(payload)}}).text)};
}
function payload(family){
  const id=crypto.randomUUID(),request={id,affiliate_id:crypto.randomUUID(),numero_control:'QA-001',program_id:family,request_type:family==='prestamo'?'quote':'benefit',created_at:'2026-09-08T12:00:00.000Z',terms_accepted:true,notes:'=Literal applicant text',applicant_profile_snapshot:{full_name:'Persona de prueba',phone:'0000000000'},financial_profile_snapshot:{financial_employee_category:'BASE',financial_union:'SUTISSSTESON'}};
  if(family==='prestamo')request.financial_submission_snapshot={financialResult:{fund:'Fondo de prueba',amount:5000,total:5300,interest:300,rate:6,paymentCount:2,paymentPeriod:'quincenal'}};
  const row=buildRequestRegisterRow(request,[],null,null);
  return {action:'sync_request',secret:'isolated-server-secret',contract_version:'REQUEST_REGISTER_V1',program_request_id:id,affiliate_id:request.affiliate_id,numero_control:request.numero_control,program:family,product_id:null,request_type:request.request_type,request_status:'submitted',requested_amount:request.financial_submission_snapshot?.financialResult?.amount??null,request_created_at:request.created_at,revision:1,desired_status:'PENDIENTE',row,payload_sha256:sha(row)};
}
function run(name,fn){fn();receipts.push({test:name,result:'PASS'});}
module.exports={fixture,payload,sha};
if(require.main===module){
for(const family of ['prestamo','membership','puertas'])run(family+': create, review, approve, reject/cancel, same A/Y and no duplicates',()=>{
  const f=fixture(),p=payload(family);let result=f.send(p);assert(result.ok);const row=result.google_row;
  assert.equal(f.target.rows[row-1][0],p.program_request_id);assert.equal(f.target.rows[row-1][24],'PENDIENTE');assert.deepEqual(f.target.rows[row-1],p.row);
  const original=f.target.rows[row-1].slice();f.writes.length=0;
  const review={...p,revision:2,request_status:'in_review'};assert(f.send(review).ok);assert(f.send(review).ok);
  const approved={...p,revision:3,request_status:'approved',desired_status:'APROBADO'};assert(f.send(approved).ok);assert(f.send(approved).ok);assert.equal(f.target.rows[row-1][24],'Aprobado');
  // A delayed review cannot regress a newer final decision.
  result=f.send(review);assert.equal(result.revision,3);assert.equal(f.target.rows[row-1][24],'Aprobado');
  assert(f.writes.filter(x=>x.sheet===f.target.name).every(x=>x.row===row&&x.col===25&&x.width===1&&x.height===1),'UPDATE_OUTSIDE_Y');
  assert.deepEqual(f.target.rows[row-1].filter((_,i)=>i!==24),original.filter((_,i)=>i!==24));
  assert.equal(f.target.rows.filter(r=>r[0]===p.program_request_id).length,1);
  // Separate real workflow branches: never reject an already approved test request.
  for(const status of ['rejected','cancelled']){const branch=payload(family);assert(f.send(branch).ok);const res=f.send({...branch,revision:2,request_status:status,desired_status:'Rechazado'});assert(res.ok);assert.equal(f.target.rows[res.google_row-1][24],'Rechazado');assert(f.send(branch).ok);assert.equal(f.target.rows[res.google_row-1][24],'Rechazado');assert.equal(f.target.rows.filter(r=>r[0]===branch.program_request_id).length,1);}
});
run('owner exclusion: AH onward is never mapped or written, including existing formulas',()=>{
  const row=buildRequestRegisterRow({financial_submission_snapshot:{financialResult:{administrativeFeePerPayment:15,administrativeFeeTotal:30,interest:300}}},[],null);
  assert.equal(row.length,33);assert.equal(row[33],undefined);
  const f=fixture(),p=payload('prestamo');f.target.rows[1]=Array(38).fill('');f.target.rows[1][33]='=OWNER_FORMULA';
  const result=f.send(p);assert(result.ok);assert.equal(f.target.rows[1][33],'=OWNER_FORMULA');
  assert(f.writes.filter(x=>x.sheet===f.target.name).every(x=>x.col+x.width-1<=33));
});
run('interrupted first insert recovers reserved row without duplicate',()=>{
  const f=fixture(),p=payload('membership');f.interrupt(c=>c.sheet===f.target.name);assert(!f.send(p).ok);assert.equal(f.target.getLastRow(),1);const result=f.send(p);assert(result.ok);assert.equal(result.google_row,2);assert.equal(f.registry.getLastRow(),2);assert.equal(f.target.getLastRow(),2);
});
run('new reserved row inherits unchecked terms checkbox; recovery preserves other cells',()=>{
  const f=fixture(),p=payload('membership');f.interrupt(c=>c.sheet===f.target.name);assert(!f.send(p).ok);
  f.target.rows[1]=Array(38).fill('');f.target.rows[1][23]=false;f.target.rows[1][33]='=EXCLUDED';
  const result=f.send(p);assert(result.ok);assert.equal(result.google_row,2);assert.deepEqual(f.target.rows[1].slice(0,33),p.row);assert.equal(f.target.rows[1][33],'=EXCLUDED');
  assert.equal(f.target.rows.filter(r=>r[0]===p.program_request_id).length,1);
});
run('crash after Y write and before registry update recovers and remains monotonic',()=>{
  const f=fixture(),p=payload('prestamo');assert(f.send(p).ok);const approved={...p,revision:2,request_status:'approved',desired_status:'APROBADO'};
  f.interrupt(c=>c.sheet===f.registry.name&&c.col===11);assert(!f.send(approved).ok);assert(f.send(approved).ok);assert(f.send(p).ok);assert.equal(f.target.rows[1][24],'Aprobado');
});
run('duplicate UUID, header drift, formula in Y, wrong identity and unauthorized calls are denied',()=>{
  for(const problem of ['duplicate','header','formula','identity','auth']){
    const f=fixture(),p=payload('puertas');assert(f.send(p).ok);const next={...p,revision:2,request_status:'approved',desired_status:'APROBADO'};
    if(problem==='duplicate'){f.target.rows.push(f.target.rows[1].slice());f.target.maxRows++;}
    if(problem==='header')f.target.rows[0][1]='Changed';
    if(problem==='formula')f.target.formulas['2:25']='=1';
    if(problem==='identity')f.target.rows[1][1]='someone-else';
    if(problem==='auth')next.secret='wrong';
    f.writes.length=0;assert(!f.send(next).ok,problem);assert.equal(f.writes.length,0,problem+' mutated data');
  }
});
run('reserved row at grid boundary recovers before append',()=>{
  const f=fixture(),first=payload('membership');assert(f.send(first).ok);const p=payload('puertas');f.interrupt(c=>c.sheet===f.target.name);assert(!f.send(p).ok);f.target.maxRows=2;assert(f.send(p).ok);assert.equal(f.target.getLastRow(),3);
});
const proof={status:'PASS',environment:'isolated; no external writes',tests:receipts,duplicates:0,ownerColumnBoundary:'A:AG; AH onward excluded'};
fs.writeFileSync(process.env.REQUEST_BRIDGE_EVIDENCE||path.join(root,'docs/qa/evidence/requests-workflow-google-sync-20260908/candidate-bridge.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
}
