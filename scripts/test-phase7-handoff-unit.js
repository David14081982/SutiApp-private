'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'google-apps-script','financial-handoff','Code.gs'),'utf8');
const registryHeaders=['program_request_id','affiliate_id','numero_control','program','product_id','request_type','request_status','requested_amount','request_created_at','received_at','processing_status','legacy_reference','legacy_result_status','last_processed_at','error_code','error_message'];
const targetHeaders=['ID','Número de control','Nombre','Proceso','Fondo','Tasa','Plazo','Monto a solicitar','Total a Pagar','Fecha solicitud','CATEGORIA EMPLEADO','SINDICATO','AFILIADO NO AFILIADO','Monto Maximo','Fotografía rostro','INE Frente','INE Reverso','Talón Penultima quincena','Talón Ultima quincena','Foto aval','INE Frente (aval)','INE Reverso (aval)','Talón última quincena aval','Acepta Términos y condiciones','Estado','Observaciones','PDF','Comprobante de transferencia','Comprobante de transferencia copy','Constancia de no adeudo','Folio Interbancario','Firma del solicitante','Whatsapp Bot','Interes Quincenal','Tota Intereses a Pagar','Monto capital + Interes','Gasto Admon','TGA'];
const registryRows=[registryHeaders.slice()],targetRows=[targetHeaders.slice()];
let locked=false,workbookId='1Vxy84N7mzbuioTmWhjRD2QFboDx--rG3iUwmLuyeY80',targetSheetId=10616270,flushCount=0,failFlushAt=0;
function output(value){return{value,setMimeType(){return this;},getContent(){return this.value;}};}
function makeRange(rows,row,column,rowCount=1,columnCount=1){return{
  getDisplayValues(){return Array.from({length:rowCount},(_,r)=>Array.from({length:columnCount},(_,c)=>String((rows[row-1+r]||[])[column-1+c]??'')));},
  getDisplayValue(){return String((rows[row-1]||[])[column-1]??'');},
  getValues(){return Array.from({length:rowCount},(_,r)=>Array.from({length:columnCount},(_,c)=>(rows[row-1+r]||[])[column-1+c]??''));},
  setValues(values){values.forEach((valuesRow,offset)=>{const index=row-1+offset;rows[index]=rows[index]||[];valuesRow.forEach((value,c)=>{rows[index][column-1+c]=value;});});return this;},
  setNumberFormat(){return this;},
  createTextFinder(needle){return{matchEntireCell(){return this;},findNext(){for(let index=row-1;index<row-1+rowCount;index++)if(String((rows[index]||[])[column-1]||'')===needle)return{getRow:()=>index+1};return null;}};}
};}
function sheet(rows,id){return{getRange:(...args)=>makeRange(rows,...args),getLastRow:()=>rows.length,getSheetId:()=>id};}
const registrySheet=sheet(registryRows,2026082207),targetSheet=sheet(targetRows,targetSheetId);
const sandbox={Date,JSON,Math,Object,Set,String,Number,RegExp,isFinite,isNaN,Array,
  ContentService:{MimeType:{JSON:'application/json'},createTextOutput:output},
  PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'test-secret'})},
  LockService:{getScriptLock:()=>({tryLock(){if(locked)return false;locked=true;return true;},releaseLock(){locked=false;}})},
  SpreadsheetApp:{openById:()=>({getId:()=>workbookId,getSheetByName:name=>name==='SutiApp Financial Handoff'?registrySheet:name==='Historial de solicitudes'?Object.assign(targetSheet,{getSheetId:()=>targetSheetId}):null}),flush(){flushCount++;if(failFlushAt===flushCount)throw new Error('SIMULATED_TIMEOUT');}}
};
vm.createContext(sandbox);vm.runInContext(source,sandbox,{filename:'Code.gs'});
const uuid1='11111111-1111-4111-8111-111111111111',uuid2='22222222-2222-4222-8222-222222222222';
const doc=n=>`supabase-private-asset:${String(n).padStart(8,'0')}-1111-4111-8111-111111111111:${'A'.repeat(64)}`;
function row(control='000123'){return['',control,'Nombre de prueba','1','Fondo prueba',0.03,12,2500,3040,'2026-08-23T12:00:00.000Z','BASE','SUTISSSTESON','AFILIADO',10000,doc(1),doc(2),doc(3),doc(4),doc(5),'','','','',true,'Iniciado','','','','','','',`supabase-request-signature:${uuid1}:${'B'.repeat(64)}`,'6620000000','','','','',''];}
function request(id=uuid1,control='000123'){return{action:'handoff',secret:'test-secret',contract_version:'FINAL_APPROVED_LOAN_EXPORT_V1',program_request_id:id,affiliate_id:uuid2,numero_control:control,program:'prestamo',product_id:null,request_type:'benefit',request_status:'approved',requested_amount:2500,request_created_at:'2026-08-23T12:00:00.000Z',payload_sha256:'C'.repeat(64),row:row(control)};}
const send=payload=>JSON.parse(sandbox.doPost({postData:{contents:JSON.stringify(payload)}}).getContent());

const a=send(request());assert(a.ok&&!a.idempotent&&a.processing_status==='exported');
const b=send(request());assert(b.ok&&b.idempotent&&targetRows.length===2);
const c=send({...request('33333333-3333-4333-8333-333333333333','000124'),row:row('000124').map((v,i)=>i===4?'UNKNOWN':v)});assert.equal(c.error,'UNRESOLVED_VALUE');
const d=send({...request('44444444-4444-4444-8444-444444444444','000125'),row:row('000125').slice(0,37)});assert.equal(d.error,'INVALID_ROW_LENGTH');
const missing=row('000126');missing[14]='';const e=send({...request('55555555-5555-4555-8555-555555555555','000126'),row:missing});assert.equal(e.error,'REQUIRED_PRIVATE_DOCUMENT_MISSING');
const f=send({...request(),program_request_id:'wrong'});assert.equal(f.error,'INVALID_UUID');
workbookId='wrong';const g=send(request('66666666-6666-4666-8666-666666666666','000127'));assert.equal(g.error,'WORKBOOK_ID_MISMATCH');workbookId='1Vxy84N7mzbuioTmWhjRD2QFboDx--rG3iUwmLuyeY80';
const timeoutRequest=request('77777777-7777-4777-8777-777777777777','000128');timeoutRequest.row[31]=`supabase-request-signature:77777777-7777-4777-8777-777777777777:${'B'.repeat(64)}`;flushCount=0;failFlushAt=2;const h1=send(timeoutRequest);assert.equal(h1.error,'INVALID_REQUEST');failFlushAt=0;const h2=send(timeoutRequest);assert(h2.ok&&h2.idempotent&&targetRows.length===3);
const i=send({...request(),secret:'wrong'});assert.equal(i.error,'UNAUTHORIZED');
locked=true;const j=send(request('88888888-8888-4888-8888-888888888888','000129'));locked=false;assert.equal(j.error,'HANDOFF_BUSY');
assert.equal(registryRows.length,3);assert.equal(targetRows.length,3);assert.equal(targetRows[1].length,38);assert.equal(targetRows[2].length,38);
console.log(JSON.stringify({status:'PASS',A:'append_verified',B:'duplicate_zero',C:'unknown_denied',D:'incomplete_denied',E:'critical_document_denied',F:'uuid_denied',G:'workbook_denied',H:'timeout_recovered',I:'unauthorized_denied',J:'concurrency_locked',target_writes:2,duplicate_rows:0}));
