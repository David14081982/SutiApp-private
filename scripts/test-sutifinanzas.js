'use strict';
// Single contractual suite. Synthetic input only; no network or production writes.
const assert=require('assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path');
async function main(){
 const {HEADERS,projectSheet,loadReport,readGoogle}=await import('../supabase/functions/sutifinanzas/report.mjs');
 const fields=Object.keys(HEADERS),headers=Object.values(HEADERS),row=o=>fields.map(k=>o[k]??null);
 const base={id:'p1',requisitionId:'r1',requisition:'REQ 1',secretariat:'Secretaría A',expenseType:'Operación',concept:'Servicio',amount:10.12,date:46023,project:'Proyecto',item:'Partida',status:' Aprobado ',year:2026,payment:'Transferencia'};
 const values=[headers,row(base),row({...base,id:'p2',amount:20.03}),row({...base,id:'p3',requisitionId:'r2',year:2025,secretariat:null,requisition:null,amount:3}),row({...base,id:'p4',year:null,date:null,status:null,amount:0})];
 const data=projectSheet(values);assert.equal(data.records.length,4);assert.equal(data.records[0].amount,10.12);
 assert.deepEqual(projectSheet(values.map(r=>r.slice().reverse())).records,data.records,'column movement');
 assert.equal(HEADERS.expenseType,'TIPO DE GASTOS');assert.equal(projectSheet(values.map(r=>r.slice().reverse())).records[0].expenseType,'Operación','expense type follows its exact header after column movement');
 const expenseTypeIndex=headers.indexOf('TIPO DE GASTOS');
 assert.throws(()=>projectSheet(values.map(r=>r.filter((_,index)=>index!==expenseTypeIndex))),e=>e.message==='MISSING_HEADERS'&&e.details.missing.includes('TIPO DE GASTOS'),'missing expense-type header fails closed');
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
 const pivotRecord=patch=>({...data.records[0],...patch}),pivotRecords=[
  pivotRecord({id:'a',secretariat:'Secretaría A',expenseType:'Viáticos',requisitionId:'req-a',requisition:'Igual',project:'Compartido',amount:0.004,date:'2025-01-10',year:2026}),
  pivotRecord({id:'b',secretariat:'Secretaría A',expenseType:'Viáticos',requisitionId:'req-a',requisition:'Igual',project:'Compartido',amount:0.004,date:'2026-01-10',year:2026}),
  pivotRecord({id:'c',secretariat:'Secretaría A',expenseType:'Material',requisitionId:'req-b',requisition:'Igual',project:'Compartido',amount:10,date:'2026-02-10',year:2025}),
  pivotRecord({id:'d',secretariat:'Secretaría B',expenseType:'Viáticos',requisitionId:'req-c',requisition:'Igual',project:'Compartido',amount:20,date:'2026-01-10',year:2026}),
  pivotRecord({id:'e',secretariat:null,expenseType:null,project:null,item:null,status:null,payment:null,requisitionId:null,requisition:null,amount:3,date:null,year:null}),
  pivotRecord({id:'f',secretariat:'Secretaría B',expenseType:'Viáticos',requisitionId:'req-d',requisition:'Igual',project:'Compartido',amount:5,date:'2026-01-10',year:2026})
 ];
 const plain=value=>JSON.parse(JSON.stringify(value)),walk=nodes=>nodes.flatMap(node=>[node,...walk(node.children)]),beforePivot=JSON.stringify(pivotRecords);
 const expenseSearch=model.filter(pivotRecords,{year:'2026',status:'APROBADO',month:'all',search:'  viáticos  '});
 assert.deepEqual(expenseSearch.map(r=>r.id),['a','b','d','f'],'search includes normalized expense type and respects the other filters');
 assert.equal(model.summarize(expenseSearch).requisitions,3);
 assert.equal(model.filter(pivotRecords,{year:'2026',status:'APROBADO',month:'all',search:'Material'}).length,0,'expense search does not bypass the year filter');
 assert.deepEqual(Array.from(model.fields,f=>f.key),['secretariat','expenseType','project','item','requisition','product','status','payment','year']);
 const pivot=model.pivot(pivotRecords,['secretariat','expenseType','project','requisition','product']);
 assert.equal(pivot.count,6);assert.equal(pivot.summary.amountCents,3800.8);
 assert.deepEqual(plain(pivot.columns.map(c=>c.key)),['2025-01','2026-01','2026-02','missing']);
 assert.deepEqual(plain(pivot.columns.map(c=>c.label)),['Enero 2025','Enero 2026','Febrero 2026','Sin fecha']);
 assert.deepEqual(plain(pivot.amounts),{'2025-01':0.4,'2026-01':2500.4,'2026-02':1000,missing:300});
 assert.equal(pivot.roots[0].key,'Secretaría B','default order by amount');
 const allNodes=walk(pivot.roots);assert.equal(new Set(allNodes.map(n=>n.id)).size,allNodes.length,'each path has a unique stable identity');
 for(const node of allNodes){
  assert.equal(node.count,node.records.length);assert.deepEqual(plain(node.summary),plain(model.summarize(node.records)));
  if(node.children.length){
   const childRecords=node.children.flatMap(child=>child.records);
   assert.deepEqual(childRecords.map(r=>r.id).sort(),node.records.map(r=>r.id).sort(),'children partition their parent without duplicate rows');
   assert.equal(new Set(childRecords.map(r=>r.id)).size,node.count);
   assert.equal(model.summarize(childRecords).amountCents,node.summary.amountCents,'expanded nodes preserve their total');
  }
 }
 const reqNodes=allNodes.filter(n=>n.field==='requisition');
 assert.equal(reqNodes.find(n=>n.key==='req-a').summary.amountCents,0.8,'fractional cents are summed before presentation');
 assert.equal(reqNodes.filter(n=>n.label==='Igual').length,4,'requisition labels never replace requisition IDs');
 assert.equal(reqNodes.find(n=>n.key==='product:e').label,'Sin requisición');
 const sharedProjects=allNodes.filter(n=>n.field==='project'&&n.label==='Compartido');assert.equal(sharedProjects.length,3,'same project label in different parents stays separate');
 assert.equal(new Set(sharedProjects.map(n=>n.id)).size,3);
 const reordered=model.pivot(pivotRecords,['expenseType','secretariat','requisition'],{sort:'name',columnField:'year'});
 assert.equal(reordered.roots.find(n=>n.key==='Viáticos').children.length,2);
 assert.equal(reordered.summary.amountCents,pivot.summary.amountCents,'dimension order never changes the total');
 assert.deepEqual(plain(reordered.columns),[{key:'2025',label:'2025'},{key:'2026',label:'2026'},{key:'missing',label:'Sin año'}]);
 assert.equal(reordered.amounts['2025'],1000);assert.equal(reordered.amounts.missing,300);assert(Math.abs(reordered.amounts['2026']-2500.8)<1e-9,'column year comes from AÑO, independently of the expense date');
 assert.equal(reordered.roots.find(n=>n.key===null).label,'Sin tipo de gastos');
 for(const field of model.fields.filter(f=>['secretariat','expenseType','project','item','status','payment','year'].includes(f.key)))assert.equal(model.pivot([pivotRecords[4]],[field.key]).roots[0].label,field.missing);
 const products=model.pivot(pivotRecords,['product'],{columnField:'none'});assert.equal(products.roots.length,6,'same concept does not merge distinct products');
 assert(products.roots.every(n=>n.label==='Servicio'));assert.deepEqual(plain(products.columns),[]);assert.deepEqual(plain(products.amounts),{});
 assert.equal(model.pivot([pivotRecord({id:'only-id',concept:null})],['product']).roots[0].label,'only-id');
 assert.deepEqual(plain(model.pivot(pivotRecords,['secretariat'],{sort:'amount-asc'}).roots.map(n=>n.key)),[null,'Secretaría A','Secretaría B']);
 assert.deepEqual(plain(model.pivot(pivotRecords,['secretariat'],{sort:'name'}).roots.map(n=>n.key)),['Secretaría A','Secretaría B',null]);
 const reverse=model.pivot(pivotRecords.slice().reverse(),['secretariat','expenseType','project','requisition','product']);
 assert.deepEqual(walk(reverse.roots).map(n=>n.id).sort(),allNodes.map(n=>n.id).sort(),'identities do not depend on input row position');
 const totalOnly=model.pivot(pivotRecords,[]);assert.deepEqual(plain(totalOnly.roots),[]);assert.equal(totalOnly.count,6);assert.equal(totalOnly.summary.amountCents,3800.8);assert.deepEqual(plain(totalOnly.amounts),plain(pivot.amounts));
 const emptyPivot=model.pivot([],['secretariat']);assert.deepEqual(plain(emptyPivot.roots),[]);assert.equal(emptyPivot.summary.amountCents,0);assert.equal(emptyPivot.count,0);
 for(const dimensions of [['secretariat','secretariat'],['unknown'],'secretariat',null])assert.throws(()=>model.pivot(pivotRecords,dimensions),/PIVOT_DIMENSIONS_INVALID/);
 assert.throws(()=>model.pivot(pivotRecords,[],{columnField:'date'}),/PIVOT_COLUMN_INVALID/);assert.throws(()=>model.pivot(pivotRecords,[],{sort:'random'}),/PIVOT_SORT_INVALID/);
 assert.equal(JSON.stringify(pivotRecords),beforePivot,'pivot never mutates source data');
 let sourceReads=0;const read=async()=>{sourceReads++;return data;};
 const client=(auth,permission,boundary)=>({auth:{getUser:async()=>({data:{user:auth?{id:'actor'}:null}})},rpc:async(name)=>({data:name==='has_admin_permission'?permission:boundary})});
 await assert.rejects(loadReport({action:'LOAD'},client(false,true,true),read),/AUTH_REQUIRED/);
 await assert.rejects(loadReport({action:'LOAD'},client(true,false,true),read),/ADMIN_DENIED/);
 await assert.rejects(loadReport({action:'LOAD'},client(true,true,false),read),/ADMIN_DENIED/);
 await assert.rejects(loadReport({action:'LOAD',sheet:'other'},client(true,true,true),read),/REQUEST_INVALID/);assert.equal(sourceReads,0);
 await loadReport({action:'LOAD'},client(true,true,true),read);assert.equal(sourceReads,1);
 const crypto=require('crypto'),{privateKey,publicKey}=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
 const credential=JSON.stringify({type:'service_account',client_email:'sutifinanzas-reader@test-only.iam.gserviceaccount.com',private_key:privateKey.export({type:'pkcs8',format:'pem'}),token_uri:'https://untrusted.invalid'});
 const envReads=[],env=key=>{envReads.push(key);assert.equal(key,'SUTIFINANZAS_GOOGLE_SERVICE_ACCOUNT_JSON');return credential;};
 const calls=[];await readGoogle(env,async(url,options)=>{calls.push({url,options});return{ok:true,json:async()=>url.includes('oauth2')?{access_token:'token'}:{values}};});
 assert.equal(calls.length,2);assert.equal(calls.filter(c=>c.url.includes('sheets.googleapis.com')).length,1);assert.equal(calls[1].options.method,undefined);assert(calls[1].url.includes('UNFORMATTED_VALUE'));
 await assert.rejects(readGoogle(env,async(url)=>url.includes('oauth2')?{ok:true,json:async()=>({access_token:'private-token'})}:{ok:false,status:403,json:async()=>({error:{status:'PERMISSION_DENIED',message:'not exposed'}})}),e=>e.message==='GOOGLE_ACCESS_DENIED'&&e.details.googleStatus===403&&e.details.googleReason==='PERMISSION_DENIED'&&!JSON.stringify(e.details).includes('private-token'));
 const [jwtHeader,jwtClaims,jwtSignature]=calls[0].options.body.get('assertion').split('.');
 assert.equal(calls[0].url,'https://oauth2.googleapis.com/token','credential cannot override token destination');
 assert.equal(calls[0].options.body.get('grant_type'),'urn:ietf:params:oauth:grant-type:jwt-bearer');
 assert(crypto.verify('RSA-SHA256',Buffer.from(jwtHeader+'.'+jwtClaims),publicKey,Buffer.from(jwtSignature,'base64url')),'valid server signature');
 const claims=JSON.parse(Buffer.from(jwtClaims,'base64url'));
 assert.equal(claims.scope,'https://www.googleapis.com/auth/spreadsheets.readonly');assert.equal(claims.exp-claims.iat,900);assert(!claims.sub,'no user impersonation');
 let invalidFetches=0;for(const bad of ['', '{', '{}', JSON.stringify({type:'service_account',client_email:'invalid',private_key:'secret'}), JSON.stringify({...JSON.parse(credential),client_email:'bot-sheets@whatsapp-bot-sutiapp.iam.gserviceaccount.com'})])await assert.rejects(readGoogle(()=>bad,async()=>{invalidFetches++;}),/GOOGLE_NOT_CONFIGURED/);
 assert.equal(invalidFetches,0,'invalid credentials fail before network');
 await assert.rejects(readGoogle(env,async()=>({ok:false,json:async()=>({error:'private-google-detail'})})),e=>e.message==='GOOGLE_AUTH_FAILED'&&!JSON.stringify(e).includes('private-google-detail'));
 for(const file of ['app/sutifinanzas-repository.js','app/sutifinanzas-admin.jsx','supabase/functions/sutifinanzas/report.mjs'])assert(!/localStorage|sessionStorage|indexedDB|\.from\(/.test(fs.readFileSync(path.join(__dirname,'..',file),'utf8').replaceAll('Uint8Array.from(', 'byteConversion(')));
 console.log('PASS: header movement/missing/ambiguity, exact date field, numeric amounts, duplicates, configurable pivot/order/columns/identities/totals, missing dimensions, year/status, drill-down totals, permissions, one Google values GET, no persistence.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
