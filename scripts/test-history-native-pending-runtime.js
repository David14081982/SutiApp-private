'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),checks=[],plain=value=>JSON.parse(JSON.stringify(value));
const check=async(name,fn)=>{await fn();checks.push(name);console.log('PASS '+name);};
const freeze=value=>{if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;};
async function main(){
 const {projectHistory,projectApprovals}=await import('../supabase/functions/loan-history/history.mjs');
 const now='2026-10-27T00:00:00.000Z',publication='2026-10-26T22:00:00.000Z',calls=[];
 const base={id:'00000000-0000-4000-8000-000000000101',folio:'SR-SYNTHETIC-PENDING',affiliate_id:'00000000-0000-4000-8000-000000000001',numero_control:'0007',program_id:'prestamo',status:'submitted',financial_processing_status:'pending',requested_amount:100,requested_term:2,requested_term_semantics:'quincenas',created_at:'2026-10-26T23:00:00.000Z',workflow_state:{available:true,stages:[{id:'submitted',label:'Solicitud enviada',state:'done'}]}};
 let nativeRows=[base];
 const window={SutiSupabase:{getClient:()=>({rpc:async(name,args)=>{calls.push({name,args});assert.equal(name,'list_self_program_request_history');assert.equal(args,undefined);return {data:nativeRows};}})},PrivateResourceDemand:{context:()=>1,run:async(key,fn)=>{assert.equal(key,'self-native-history');return fn();}}};
 const sandbox=vm.createContext({window,React:{useState:()=>{},useEffect:()=>{}},Intl,Date,Map,Set,Error,setInterval:()=>{throw Error('Unexpected timer');},fetch:()=>{throw Error('Unexpected network');}});
 for(const file of ['app/program-request-repository.js','app/operations-store.jsx'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),sandbox,{filename:file});
 const mergeFile=process.env.SUTI_HISTORY_MERGE_SOURCE||path.join(root,'app/history-loans-repository.js');
 vm.runInContext(fs.readFileSync(mergeFile,'utf8'),sandbox,{filename:'app/history-loans-repository.js'});
 const history=window.LoanHistory,store=window.operationsStore;
 const load=async(rows)=>{nativeRows=rows;await store.load(true);assert.equal(store.state().phase,'loaded');return store.all();};
 const context={actor:'00000000-0000-4000-8000-000000000099',affiliate_id:base.affiliate_id,folio:base.numero_control,server_now:now,requests:[{id:base.id,folio:base.folio,status:base.status,financial:true,approved_at:null}]};
 const emptySource={folio:base.numero_control,loans:[],requests:[],issues:[]};
 const published=(source=emptySource,ctx=context)=>({...projectHistory(source,ctx,now),source_updated_at:publication,sync_version:'synthetic-publication',sync_state:{status:'READY'},approvals:projectApprovals(ctx),approval_revision:null});
 const missing=published(),before=await load([base]),native=before[0];
 const filters=rows=>({Todas:rows.length,'En proceso':rows.filter(row=>row.estado==='revision').length});
 await check('real own native RPC/store pending appears immediately in Todas and En proceso',()=>{
  assert.equal(native.kind,'loan');assert.equal(native.financial,true);assert.equal(native.estado,'revision');assert.equal(native.requestStatus,'submitted');
  const rows=history.merge(before,missing,0);assert.equal(rows.length,1,'New native pending must not disappear while its published Google row is absent');
  assert.deepEqual(filters(rows),{Todas:1,'En proceso':1});assert.strictEqual(rows[0],native);assert.equal(rows[0].sourceId,base.id);assert.equal(rows[0].id,base.folio);assert.equal(rows[0].historyKey,undefined);assert.deepEqual(plain(rows[0].steps),plain(native.steps));
 });
 await check('all explicit pending states survive stale financial ID lists and any publication cutoff',async()=>{
  for(const status of ['submitted','requires_financial_processing','in_review'])for(const created_at of ['2026-10-01T12:00:00Z',base.created_at]){
   const rows=await load([{...base,status,created_at}]);
   for(const financial_request_ids of [[],[base.id]])for(const source_updated_at of ['2026-10-01T00:00:00Z','2026-10-28T00:00:00Z']){
    const result=history.merge(rows,{...missing,financial_request_ids,source_updated_at},0);assert.equal(result.length,1);assert.equal(result[0].requestStatus,status);assert.equal(result[0].sourceId,base.id);
   }
  }
 });
 await check('cold loading or unavailable independent observation still permits own native pending',()=>{
  assert.strictEqual(history.merge([native],null,0)[0],native);
  assert.strictEqual(history.merge([native],undefined,0)[0],native);
  assert.strictEqual(history.merge([native],{...missing,sync_state:{status:'FAILED'}},0)[0],native);
 });
 await check('unknown/missing/terminal canonical states never inherit the generic revision default',async()=>{
  for(const status of [undefined,null,'','unknown','pending','Pendiente','SUBMITTED','submitted ','approved','completed','rejected','cancelled']){
   const own=await load([{...base,status}]);assert.equal(own.length,1);
   assert.equal(history.merge(own,missing,0).length,0,String(status));assert.equal(history.merge(own,null,0).length,0,String(status));
  }
 });
 await check('financial pending requires explicit eligibility, real source identity, SR and revision',()=>{
  for(const patch of [{sourceId:null},{sourceId:undefined},{sourceId:''},{sourceId:' '},{sourceId:42},{sourceId:{}},{id:null},{id:42},{id:''},{id:'123'},{id:'sr-test'},{id:' SR-TEST'},{estado:'aprobado'},{estado:'rechazado'},{estado:null}]){
   const row={...native,...patch};assert.equal(history.merge([row],missing,0).length,0,JSON.stringify(patch));assert.equal(history.merge([row],null,0).length,0);
  }
  assert.equal(history.merge([{...native,kind:'benefit',financial:true}],missing,0).length,1);
  for(const financial of ['true',1,{}])assert.equal(history.merge([{...native,kind:'benefit',financial}],missing,0).length,0);
  assert.equal(history.merge([{...native,financial:false}],missing,0).length,1,'A native loan is explicitly eligible even before a financial marker');
 });
 const sourcePending={...emptySource,requests:[{id:base.folio,owner:base.numero_control,status:'Pendiente',fund:'Synthetic loan',principal:100,total:120,term:2,date:'2026-10-26'}]};
 await check('later published pending replaces the native card once and preserves native tracking',()=>{
  const rows=history.merge([native],published(sourcePending),0);assert.equal(rows.length,1);assert.equal(rows[0].kind,'history');assert.equal(rows[0].estado,'revision');assert.equal(rows[0].sourceId,base.id);assert.equal(rows[0].monto,100);assert.equal(rows[0].history.total,120);assert.deepEqual(plain(rows[0].steps),plain(native.steps));
  assert.deepEqual(filters(rows),{Todas:1,'En proceso':1});
 });
 await check('covered and projected identities suppress native duplicates by sourceId only',()=>{
  assert.equal(history.merge([native],{...missing,covered_request_ids:[base.id]},0).length,0);
  const projected=published(sourcePending);projected.covered_request_ids=[];
  const collidingNative={...native,id:'SR-SYNTHETIC-OTHER'};
  const rows=history.merge([collidingNative],projected,0);assert.equal(rows.length,1);assert.equal(rows[0].id,base.folio);assert.equal(rows[0].sourceId,base.id);
  const distinctNative={...native,sourceId:'00000000-0000-4000-8000-000000000102'};
  const distinct=history.merge([distinctNative],projected,0);assert.equal(distinct.length,2);assert.equal(new Set(distinct.map(row=>row.sourceId)).size,2,'Never join by text folio, amount or timestamp');
 });
 const approval=approved_at=>({id:base.folio,sourceId:base.id,approved_at,expires_at:new Date(Date.parse(approved_at)+86400000).toISOString(),fund:'Synthetic loan',principal:100,total:120,term:2,date:'2026-10-26'});
 await check('all confirmed approval IDs suppress stale pending including old nonrendered approvals',()=>{
  const recent=approval('2026-10-26T23:00:00Z'),old=approval('2026-10-24T00:00:00Z');
  const active=history.merge([native],{...missing,approvals:[recent]},0);assert.equal(active.length,1);assert.equal(active[0].estado,'aprobado');assert.equal(active[0].history.preparing,true);assert.deepEqual(plain(active[0].history.schedule),[]);
  const expired=history.merge([native],{...missing,approvals:[recent]},86400000);assert.equal(expired.length,1);assert.equal(expired[0].estado,'por_revisar');
  assert.equal(history.project({...missing,approvals:[old]},0).length,0);assert.equal(history.merge([native],{...missing,approvals:[old]},0).length,0);
  const other={...old,id:'SR-SYNTHETIC-OTHER',sourceId:'00000000-0000-4000-8000-000000000102'};assert.equal(history.merge([native],{...missing,approvals:[other]},0).length,1);
 });
 await check('latest native cancellation, rejection and removal withdraw eligibility without resurrection',async()=>{
  assert.equal(history.merge(await load([base]),missing,0).length,1);
  for(const status of ['cancelled','rejected'])assert.equal(history.merge(await load([{...base,status}]),missing,0).length,0);
  assert.equal(history.merge(await load([]),missing,0).length,0);
  assert.equal(history.merge([],published(sourcePending),0).length,1);assert.equal(history.merge([],missing,0).length,0,'A source-only row removed from a complete observation cannot return');
 });
 await check('nonfinancial benefits and quotations retain their original behavior and identity',async()=>{
  for(const request_type of [undefined,'quote'])for(const status of ['submitted','approved','rejected']){
   const own=await load([{...base,program_id:'synthetic-benefit',request_type,status,financial_processing_status:null}]);
   const snapshot={...missing,financial_request_ids:[]};assert.strictEqual(history.merge(own,snapshot,0)[0],own[0]);assert.strictEqual(history.merge(own,null,0)[0],own[0]);
  }
 });
 await check('loan financial projection, exact decimal total and source values stay unchanged',()=>{
  const loan={key:'loan:synthetic',kind:'loan',id:'synthetic',sourceId:null,category:'En pago',status:'AL CORRIENTE',principal:0.3,total:0.3,paid_to_date:999,expected_to_date:0.3,date:'2026-10-01',schedule:[{date:'2026-10-15',amount:0.1,number:1},{date:'2026-10-26',amount:0.2,number:2},{date:'2026-11-01',amount:0.5,number:3}]};
  const source=freeze({...missing,entries:[loan]}),saved=JSON.stringify(source),nativeSaved=JSON.stringify(native);
  const without=history.merge([],source,0),withPending=history.merge([native],source,0);assert.equal(withPending.length,2);
  const financial=withPending.find(row=>row.historyKey===loan.key);assert.deepEqual(plain(financial),plain(without[0]));assert.equal(financial.history.paid_to_date,0.3);assert.deepEqual(plain(history.metrics(financial.history)),{progress:100,balance:0,overpaid:0});
  assert.equal(JSON.stringify(source),saved);assert.equal(JSON.stringify(native),nativeSaved);
 });
 await check('merging causes no additional RPC, network call, timer or source mutation',()=>{
  const count=calls.length,source=freeze(published(sourcePending)),saved=JSON.stringify(source),own=freeze([native]);
  for(let i=0;i<100;i++){history.merge(own,missing,i);history.merge(own,source,i);history.merge(own,null,i);}
  assert.equal(calls.length,count);assert.equal(JSON.stringify(source),saved);assert(calls.every(call=>call.name==='list_self_program_request_history'&&call.args===undefined));
 });
 const evidence={status:'PASS',syntheticOnly:true,checks,modules:['app/program-request-repository.js','app/operations-store.jsx','app/history-loans-repository.js','supabase/functions/loan-history/history.mjs'],nativeReader:'list_self_program_request_history',ownerSelectors:false,additionalMergeCalls:0,googleCalls:0,productionCalls:0,financialMutation:false,sourceMutation:false,contextGuards:'Covered separately by the real browser suite; no auth code changed'};
 const dir=process.env.SUTI_HISTORY_EVIDENCE_DIR||path.join(root,'.tmp/history-native-pending/evidence');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'runtime.json'),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify({status:'PASS',checks:checks.length}));
}
main().catch(error=>{console.error(error.stack||error.message);process.exitCode=1;});
