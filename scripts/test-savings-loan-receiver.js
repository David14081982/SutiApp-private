'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const {readLoanSource,evaluateLoans,WORKBOOK,SHEET_ID}=require('../supabase/functions/savings-settlement/loan-status.js');
const source=fs.readFileSync('google-apps-script/financial-handoff/Code.gs','utf8');
function fixture(){
 const rows=Array.from({length:15082},()=>Array(24).fill(''));
 Object.assign(rows[0],{0:'Fecha',2:'ID',3:'Folio',6:'Fondo',23:'ESTATUS DEL PRESTAMO'});
 Object.assign(rows[1],{2:'L1',3:'00123',6:'Caja Chica',23:'AL CORRIENTE'});
 Object.assign(rows[15081],{2:'L2',3:'00123',6:'Caja Chica',23:'SALDO ATRASADO'});
 let reads=0;const sheet={getSheetId:()=>SHEET_ID,getLastRow:()=>rows.length,getRange:(r,c,h,w)=>{reads++;assert.deepEqual([r,c,h,w],[1,1,15082,24]);return{getDisplayValues:()=>rows};}};
 const context={PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'isolated'})},SpreadsheetApp:{openById:id=>{assert.equal(id,WORKBOOK);return{getId:()=>WORKBOOK,getSheetByName:()=>sheet};}},ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({text,setMimeType(){return this;}})}};
 vm.createContext(context);vm.runInContext(source,context);
 return{rows,sheet,get reads(){return reads;},send:p=>JSON.parse(context.doPost({postData:{contents:JSON.stringify(p)}}).text)};
}
(async()=>{
 const f=fixture(),payload={action:'read_loan_status',secret:'isolated',contract_version:'LOAN_STATUS_READ_V1'};
 assert.equal(f.send({...payload,secret:'invalid'}).error,'UNAUTHORIZED');assert.equal(f.reads,0);
 assert.equal(f.send({...payload,range:'A:ZZ'}).error,'INVALID_REQUEST');assert.equal(f.reads,0);
 const body=f.send(payload);assert(body.ok);assert.equal(f.reads,1);assert.equal(body.valueRanges[0].values.length,15082);
 assert.equal(body.valueRanges[0].values[15081][3],'00123');assert.equal(body.valueRanges[2].values[15081][0],'SALDO ATRASADO');
 let upstream=body,calls=[],envReads=[];
 const env=n=>{envReads.push(n);return n==='FINANCIAL_LEGACY_API_URL'?'https://receiver.invalid':'isolated';};
 const fetcher=async(url,options)=>{calls.push(url);if(url.includes('oauth2')){assert(options.body.get('scope').includes('script.webapp.deploy'));return{ok:true,json:async()=>({access_token:'isolated'})};}assert.equal(url,'https://receiver.invalid');assert.deepEqual(JSON.parse(options.body),payload);return{ok:true,status:200,json:async()=>upstream};};
 const result=await readLoanSource(env,fetcher);assert.equal(result.scanned_rows,15081);assert.equal(evaluateLoans(result.rows,'00123').length,2);assert.equal(evaluateLoans(result.rows,'123').length,0);
 assert.equal(evaluateLoans(result.rows,'00123').filter(l=>l.status==='SALDO ATRASADO').length,1);
 assert(!envReads.some(n=>n.startsWith('GOOGLE_VISIBILITY_')));assert.equal(calls.length,2);
 for(const patch of [{sheet_id:1},{workbook_id:'other'},{ok:false},{contract_version:'wrong'},{valueRanges:[]}]){upstream={...body,...patch};await assert.rejects(()=>readLoanSource(env,fetcher),/SAVINGS_LOAN_VERIFICATION_UNAVAILABLE/);}
 upstream=JSON.parse(JSON.stringify(body));upstream.valueRanges[0].values[0][3]='wrong';await assert.rejects(()=>readLoanSource(env,fetcher),/SAVINGS_LOAN_VERIFICATION_UNAVAILABLE/);
 let rejectedCalls=0;await assert.rejects(()=>readLoanSource(env,async()=>{rejectedCalls++;return{ok:false,status:400,json:async()=>({error:'invalid_grant'})};}),/SAVINGS_LOAN_VERIFICATION_UNAVAILABLE/);assert.equal(rejectedCalls,1);
 const ambiguous=result.rows.map(r=>r.slice());ambiguous[15080][3]=' 00123';assert.throws(()=>evaluateLoans(ambiguous,'00123'),/LOAN_STATUS_DATA_INCONSISTENCY/);
 console.log(JSON.stringify({status:'PASS',checks:['invalid secret/selector denied before read','fixed source and one read','no row cap; preserves leading zero Folio','overdue/exact-identity evaluator unchanged','wrong source/header/contract fail closed','OAuth failure has no fallback'],externalWrites:0}));
})().catch(e=>{console.error(e);process.exitCode=1;});
