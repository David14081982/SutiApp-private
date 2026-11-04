'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const {compile,denied}=require('./build-cash-flow-projection-worker');
const artifact=fs.readFileSync(require('path').join(__dirname,'../app/cash-flow-projection-worker.js'),'utf8');
const normalized=value=>JSON.parse(JSON.stringify(value));
function worker(snapshot,id=1){
 const messages=[],self={postMessage:value=>messages.push(normalized(value)),close(){this.closed=true;}};
 for(const name of denied)self[name]=()=>{throw Error('EXTERNAL_API_USED');};
 const box={self,structuredClone};vm.createContext(box);vm.runInContext(artifact,box);
 self.onmessage({data:{id,snapshot}});return {messages,self};
}
function input(year){
 const funds=['Caja de Ahorro','Sutiexpress','Caja Chica','15/11/2026 — Aguinaldos'],loans=[[]],requests=[[]];
 funds.forEach((fund,index)=>{
  const C='TEST-'+index,r=Array(25).fill('');Object.assign(r,{0:C,1:'001',2:'Persona sintética',4:fund,7:300,8:360,9:'2026-10-01',24:'Iniciado'});requests.push(r);
  ['2026-11-04','2027-01-15','2028-01-15'].forEach((date,i)=>{const q=Array(33).fill('');Object.assign(q,{0:date,1:120,2:C,3:'001',4:'Persona sintética',6:fund,9:300,10:360,18:i+1,20:'2026-10-01',25:10,27:10,28:110,29:index===2&&i===2?'REVISAR':100});loans.push(q);});
 });
 const balances=Array.from({length:12},(_,i)=>({month:year+'-'+String(i+1).padStart(2,'0')+'-01',amount:0,known_amount:0}));
 return {version:'cash-flow-inputs-v1',modelVersion:'20261104-original-components-v1',from:year+'-01',consultedAt:'2026-11-04T16:00:00Z',source:{loans,requests},sourceErrors:{},savings:{events:[],balances,source_bases:{accounts:[],account_identities:[],account_balances:[],current_balances:[],balance_entries:[],history:[],transactions:[],historical_withdrawals:[],pending:[],scheduled:[],opening_account_balances:[]}},investors:{as_of:'2026-11-04',contracts:[],movements:[],obligations:[],reviews:[],balances:[]}};
}
test('artifact is reproduced exactly from dependency-selected original modules',()=>{
 const built=compile();assert.equal(built.code,artifact);assert.equal(built.manifest.length,8);
 assert.deepEqual(built.manifest.find(m=>m.name==='report.mjs').exports,['ReportError','fundGroup','requestStatus','sourceDate']);
 assert(!/google-auth|createReadOnlyAssertion|loadCashFlow|cashFlowInputSnapshot|TOKEN_ENDPOINT|Deno\.|https?:\/\//.test(artifact));
});
for(const year of ['2026','2027','2028'])test('worker equals original pure projection, including all references and bases, '+year,async()=>{
 const {projectCashFlowSnapshot}=await import('../supabase/functions/reports-jc/cash-flow.mjs');
 const snapshot=input(year),before=JSON.stringify(snapshot),expected=normalized(projectCashFlowSnapshot(snapshot));
 const result=worker(snapshot);
 assert.equal(result.messages.length,1);assert.deepEqual(result.messages[0],{id:1,data:expected});assert.equal(result.self.closed,true);assert.equal(JSON.stringify(snapshot),before);
 assert.equal(expected.sourceBases.tables.length,5);assert(expected.records.some(r=>r.loanId==='TEST-0'));
 const total=expected.rows.find(r=>r.id===(year==='2026'?'loans_recovered_total':'loans_scheduled_total'));
 assert.equal(total.cells.reduce((sum,c)=>sum+(c.amount||0),0),480);
 for(const api of denied)assert.equal(result.self[api],undefined);
});
test('invalid snapshot fails with a safe code and closes instead of returning stale data',()=>{
 const result=worker({version:'wrong',privateValue:'DO_NOT_ECHO'});
 assert.deepEqual(result.messages,[{id:1,error:'CASH_FLOW_SOURCE_INVALID'}]);assert.equal(result.self.closed,true);assert(!JSON.stringify(result.messages).includes('DO_NOT_ECHO'));
});
test('unexpected error details never cross the worker boundary',()=>{
 const snapshot=input('2026');snapshot.source.loans=null;
 const result=worker(snapshot);assert(result.messages[0].error);assert(!result.messages[0].data);assert.equal(result.self.closed,true);
});
test('builder rejects a privileged report export even if its helper exists',()=>{
 assert.throws(()=>compile({sources:{'cash-flow.mjs':"import {WORKBOOK} from './report.mjs'; export function projectCashFlowSnapshot(){return WORKBOOK;}"}}),/WORKER_REPORT_EXPORT_FORBIDDEN:WORKBOOK/);
});
test('builder rejects newly introduced network, storage and dynamic import dependencies',()=>{
 for(const expr of ["fetch('private')","localStorage.getItem('private')","Deno.env.get('SECRET')","import('./other.mjs')"]){assert.throws(()=>compile({sources:{'cash-flow.mjs':'export function projectCashFlowSnapshot(){return '+expr+';}'}}),/WORKER_(?:GLOBAL|DYNAMIC_IMPORT)_FORBIDDEN/);}
});