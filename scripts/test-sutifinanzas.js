'use strict';
// Single contractual suite. Synthetic input only; no network or production writes.
const assert=require('assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path');
async function main(){
 const {HEADERS,projectSheet,loadReport,readGoogle}=await import('../supabase/functions/sutifinanzas/report.mjs');
 const fields=Object.keys(HEADERS),headers=Object.values(HEADERS),row=o=>fields.map(k=>o[k]??null);
 const base={id:'p1',requisitionId:'r1',requisition:'REQ 1',secretariat:'Secretaría A',concept:'Servicio',amount:10.12,date:46023,project:'Proyecto',item:'Partida',status:' Aprobado ',year:2026,payment:'Transferencia'};
 const values=[headers,row(base),row({...base,id:'p2',amount:20.03}),row({...base,id:'p3',requisitionId:'r2',year:2025,secretariat:null,requisition:null,amount:3}),row({...base,id:'p4',year:null,date:null,status:null,amount:0})];
 const data=projectSheet(values);assert.equal(data.records.length,4);assert.equal(data.records[0].amount,10.12);
 assert.deepEqual(projectSheet(values.map(r=>r.slice().reverse())).records,data.records,'column movement');
 assert.equal(projectSheet([['Report title'],...values]).source.headerRow,2);
 assert.throws(()=>projectSheet(values.map(r=>r.slice(1))),e=>e.message==='MISSING_HEADERS'&&e.details.missing.includes(HEADERS.requisitionId));
 assert.throws(()=>projectSheet([[...headers,HEADERS.amount],...values.slice(1)]),/AMBIGUOUS_HEADERS/);
 assert.throws(()=>projectSheet([headers,row({...base,amount:'10.12'})]),/INVALID_AMOUNT/);
 assert.equal(projectSheet([headers,row({...base,amount:1.001})]).records[0].amount,1.001);
 assert.equal(projectSheet([headers,row({...base,year:''})]).records[0].year,null,'empty year stays an explicit missing value');
 assert.throws(()=>projectSheet([headers,row(base),row(base)]),/DUPLICATE_PRODUCT_ID/);
 assert.throws(()=>projectSheet([headers,row({...base,id:null})]),/ROW_WITHOUT_PRODUCT_ID/);
 assert.throws(()=>projectSheet([headers,row({...base,date:'01/02/2026'})]),/INVALID_DATE/);
 assert.equal(projectSheet([[...headers,'Fecha del gasto'],[...row(base),null]]).records[0].date,data.records[0].date);
 const window={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../app/sutifinanzas-repository.js'),'utf8'),{window,Intl});const model=window.SutifinanzasModel;
 const filtered=model.filter(data.records,{year:'2026',status:'APROBADO',month:'all',search:''});assert.equal(filtered.length,2);assert.equal(model.summarize(filtered).amountCents,3015);assert.equal(model.summarize(filtered).requisitions,1);
 assert.equal(model.summarize([{amount:0.004},{amount:0.004}]).amountCents,0.8,'no per-row rounding');
 let p=[];for(let i=0;i<4;i++){const v=model.explore(filtered,p);assert.equal(v.groups.length,1);assert.equal(v.groups[0].percentage,100);p.push({key:v.groups[0].key});}assert.equal(model.explore(filtered,p).records.length,2);
 assert.equal(model.filter(data.records,{year:'missing',status:'missing',month:'missing',search:''}).length,1);
 assert.equal(model.explore(data.records,[]).groups.find(g=>g.key===null).label,'Sin secretaría');
 let sourceReads=0;const read=async()=>{sourceReads++;return data;};
 const client=(auth,permission,boundary)=>({auth:{getUser:async()=>({data:{user:auth?{id:'actor'}:null}})},rpc:async(name)=>({data:name==='has_admin_permission'?permission:boundary})});
 await assert.rejects(loadReport({action:'LOAD'},client(false,true,true),read),/AUTH_REQUIRED/);
 await assert.rejects(loadReport({action:'LOAD'},client(true,false,true),read),/ADMIN_DENIED/);
 await assert.rejects(loadReport({action:'LOAD'},client(true,true,false),read),/ADMIN_DENIED/);
 await assert.rejects(loadReport({action:'LOAD',sheet:'other'},client(true,true,true),read),/REQUEST_INVALID/);assert.equal(sourceReads,0);
 await loadReport({action:'LOAD'},client(true,true,true),read);assert.equal(sourceReads,1);
 const calls=[];await readGoogle(()=> 'secret',async(url,options)=>{calls.push({url,options});return{ok:true,json:async()=>url.includes('oauth2')?{access_token:'token'}:{values}};});
 assert.equal(calls.length,2);assert.equal(calls.filter(c=>c.url.includes('sheets.googleapis.com')).length,1);assert.equal(calls[1].options.method,undefined);assert(calls[1].url.includes('UNFORMATTED_VALUE'));
 for(const file of ['app/sutifinanzas-repository.js','app/sutifinanzas-admin.jsx','supabase/functions/sutifinanzas/report.mjs'])assert(!/localStorage|sessionStorage|indexedDB|\.from\(/.test(fs.readFileSync(path.join(__dirname,'..',file),'utf8')));
 console.log('PASS: header movement/missing/ambiguity, exact date field, numeric amounts, duplicates, missing dimensions, year/status, drill-down totals, permissions, one Google values GET, no persistence.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
