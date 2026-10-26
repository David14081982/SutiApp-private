'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const source=fs.readFileSync('google-apps-script/financial-handoff/Code.gs','utf8');
function fixture(){
 const l=[Array(35).fill(''),...Array.from({length:3},()=>Array(35).fill(''))],r=[Array(25).fill(''),Array(25).fill(''),Array(25).fill('')];
 Object.assign(l[0],{0:'Fecha',1:'Cuotas',2:'ID',3:'Folio',23:'Estatus del prestamo'});Object.assign(r[0],{0:'ID',1:'Número de control',24:'Estado'});
 const d=new Date('2026-10-25T07:00:00Z');
 for(let i=1;i<4;i++)Object.assign(l[i],{0:d,1:i*10,2:i,3:i===3?'OTHER':'0007',6:'Caja',8:12,9:50,10:60,14:30,16:2,18:new Date('1899-12-31T19:00:00Z'),21:30,22:30,23:'AL CORRIENTE',34:d});
 Object.assign(r[1],{0:1,1:'0007',4:'Caja',6:2,7:50,8:60,9:d,24:'Iniciado'});Object.assign(r[2],{0:'SR-OTHER',1:'OTHER',24:'Pendiente'});
 const receipt='SUTI_LOAN_TRANSFER_V1:'+JSON.stringify({id:1,identity:'SR-2026-000001',sourceHash:'a'.repeat(64)});
 let opens=0,writes=0,changed=false,reads=0;
 function sheet(values,id){return{getSheetId:()=>id,getLastRow:()=>values.length,getRange:(row,col,n,w)=>({
  getValues:()=>{const copy=values.slice(row-1,row-1+n).map(r=>r.slice(col-1,col-1+w));if(row>1&&w>1){reads++;if(changed&&reads===2)copy[0][1]=999;}return copy;},
  getDisplayValues:()=>values.slice(row-1,row-1+n).map(r=>r.slice(col-1,col-1+w).map(v=>String(v))),
  getNotes:()=>values.slice(row-1,row-1+n).map((_,i)=>[row-1+i===1?receipt:'']),
  setValues:()=>{writes++;throw Error('WRITE_FORBIDDEN');}
 })};}
 const book={getSpreadsheetTimeZone:()=> 'America/Hermosillo',getSheetByName:n=>n==='HISTORIAL P V2'?sheet(l,1245291756):sheet(r,10616270)};
 const format=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Hermosillo',year:'numeric',month:'2-digit',day:'2-digit'});
 const context={PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'test-secret'})},SpreadsheetApp:{openById:()=>{opens++;return book;}},Utilities:{
  formatDate:v=>format.format(v),DigestAlgorithm:{SHA_256:'SHA_256'},Charset:{UTF_8:'UTF_8'},computeDigest:(a,v)=>[...crypto.createHash('sha256').update(v).digest()]},ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({text,setMimeType(){return this;}})}};
 vm.createContext(context);vm.runInContext(source,context);
 return {send:p=>JSON.parse(context.doPost({postData:{contents:JSON.stringify(p)}}).text),get opens(){return opens;},get writes(){return writes;},change:()=>changed=true};
}
const p={action:'read_self_history',contract_version:'SELF_HISTORY_READ_V1',secret:'test-secret',folio:'0007'},f=fixture();
assert.equal(f.send({...p,secret:'wrong'}).error,'UNAUTHORIZED');assert.equal(f.opens,0);
for(const extra of [{range:'A:Z'},{folio:'0'},{folio:' 0007'},{folio:7}])assert.equal(f.send({...p,...extra}).error,'INVALID_REQUEST');assert.equal(f.opens,0);
const data=f.send(p);assert(data.ok);assert.equal(data.loans.length,2);assert.equal(data.requests.length,1);assert.equal(data.requests[0].receipt.identity,'SR-2026-000001');
assert(data.loans.every(r=>r.owner==='0007'));assert.equal(data.loans[0].number,1);assert.equal(data.loans[0].date,'2026-10-25');assert.equal(f.writes,0);
assert.equal(data.loans[0].term,2,'payment count comes from Q, not ambiguous term I');
assert.equal(f.send({...p,folio:'7'}).loans.length,0);
const changed=fixture();changed.change();assert.equal(changed.send(p).ok,false);
const inverse=source.replace(/\r/g,'').replace(/\/\/ Focal self-history read\.[\s\S]*?(?=function doPost\(event\))/,'').replace("    if(payload.action==='read_self_history')return readSelfHistory_(payload);\n",'')
 .replace("    if(payload.action==='read_history_snapshot')return readHistorySnapshot_(payload);\n",'');
assert.equal(crypto.createHash('sha256').update(inverse).digest('hex'),'1ccfa39e6c43546692528aa87c98cdb5fa93f323f26900585c1355da5cd6d0f0','all existing receiver code/writers preserved byte-for-byte');
const out=process.env.SUTI_HISTORY_EVIDENCE_DIR||'docs/qa/evidence/history-loan-payments';fs.mkdirSync(out,{recursive:true});
const proof={status:'PASS',checks:['secret checked before opening','fixed sources','exact leading-zero Folio','other users excluded in receiver','receipt linkage','quota serial read','source-change rejection','existing code exact inverse'],sheetWrites:0};
fs.writeFileSync(out+'/receiver.json',JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
