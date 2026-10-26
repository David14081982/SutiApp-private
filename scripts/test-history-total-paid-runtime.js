'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const checks=[],check=async(name,fn)=>{await fn();checks.push(name);console.log('PASS '+name);};
const freeze=value=>{if(value&&typeof value==='object'){Object.freeze(value);for(const v of Object.values(value))freeze(v);}return value;};
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
async function main(){
 const {paidThrough,projectHistory,businessDay}=await import('../supabase/functions/loan-history/history.mjs');
 const {loadPublishedHistory}=await import('../supabase/functions/loan-history/snapshot.mjs');
 const {groupHistorySnapshot}=await import('../supabase/functions/loan-history/snapshot-source.mjs');
 const now='2026-10-26T19:00:00.000Z',today='2026-10-26';
 const context={actor:'synthetic-actor',affiliate_id:'synthetic-affiliate',folio:'0007',server_now:now,requests:[]};
 const row=(source_row,date,amount,extra={})=>({source_row,id:'10',owner:'0007',date,amount,fund:'Synthetic fund',term:4,principal:400,total:500,scheduled:125,number:source_row-1,paid_to_date:9999,expected_to_date:175,status:'AL CORRIENTE',authorized:'2026-10-01',...extra});
 const rows=[row(2,'2026-10-15',100.25),row(3,today,50.5),row(4,'2026-11-15',125.75),row(5,'2026-10-20',0)];
 const source={folio:'0007',loans:rows,requests:[],issues:[]};
 const entry=(loans,time=now,ctx=context)=>projectHistory({folio:ctx.folio,loans,requests:[],issues:[]},ctx,time).entries[0];
 await check('paid total uses past/today A/B once, never repeated V or future rows',()=>{
  const e=projectHistory(source,context,now).entries[0];
  assert.equal(e.paid_to_date,150.75,'Total pagado must sum eligible A/B instead of column V');
  assert.equal(e.expected_to_date,175);assert.equal(e.principal,400);assert.equal(e.total,500);assert.equal(e.term,4);assert.equal(e.category,'En pago');
  assert.deepEqual(e.schedule.map(r=>r.state),['Pagada','No se descontó','Pagada','Pendiente']);
  assert.deepEqual(e.schedule.map(r=>r.amount),[100.25,0,50.5,125.75]);
 });
 await check('helper validates the entire schedule and preserves literal decimal precision',()=>{
  assert.equal(typeof paidThrough,'function');
  const fractional=freeze([{date:'2026-10-01',amount:0.105},{date:today,amount:0.205},{date:'2026-11-01',amount:0.999}]);
  assert.equal(paidThrough(fractional,today),0.31);assert.notEqual(paidThrough(fractional,today),0.11+0.21);
  assert.equal(paidThrough([{date:today,amount:0.1},{date:today,amount:0.2}],today),0.3);
  assert.equal(paidThrough([{date:today,amount:-0}],today),0);
 });
 await check('exact decimal sum equals K without a phantom overpayment and preserves sub-cent values',()=>{
  const e=entry([row(2,today,0.1,{total:0.3}),row(3,today,0.2,{total:0.3})]);
  assert.equal(e.paid_to_date,0.3);assert.equal(Math.max(0,e.paid_to_date-e.total),0);assert.equal(Math.max(0,e.total-e.paid_to_date),0);assert.equal(e.paid_to_date/e.total*100,100);
  assert.equal(paidThrough([{date:today,amount:0.123456789},{date:today,amount:0.000000001}],today),0.12345679);
  assert.equal(paidThrough(Array.from({length:100},()=>({date:today,amount:0.01})),today),1);
 });
 await check('decimal exponent notation, tiny values and large values use one final Number conversion',()=>{
  const sum=amounts=>paidThrough(amounts.map(amount=>({date:today,amount})),today);
  assert.equal(sum([1e-7,2e-7]),3e-7);assert.equal(sum([1e6,1e-7]),1000000.0000001);
  assert.equal(sum([Number.MIN_VALUE,Number.MIN_VALUE]),1e-323);
  assert.equal(sum([1e308,1e-7]),1e308);assert.equal(sum([1e-7,1e308]),1e308);
  assert.equal(sum([Number.MAX_VALUE]),Number.MAX_VALUE);assert.equal(sum([1e308,1e308]),null);
  assert.equal(sum([0.1,0.2,0.3]),0.6);assert.equal(sum([0.3,0.2,0.1]),0.6);
 });
 await check('complete future-only schedules and valid zero quotas yield zero',()=>{
  assert.equal(entry([row(2,'2026-10-27',125),row(3,'2026-11-15',0)]).paid_to_date,0);
  assert.equal(entry([row(2,'2026-10-25',0),row(3,today,0)]).paid_to_date,0);
  assert.equal(entry([row(2,'2026-10-27',0)]).schedule[0].state,'Pendiente');
 });
 await check('missing, malformed and impossible dates anywhere make the paid total unavailable',()=>{
  for(const bad of [null,undefined,'','2026-2-01','2026-02-29','2026-04-31','2026-13-01','2026-00-10','2026-10-00','2026-10-32','1900-02-29','2026-10-26T00:00:00Z',' 2026-10-26',20261026]){
   assert.equal(entry([row(2,'2026-10-15',10),row(3,bad,25)]).paid_to_date,null,String(bad));
   assert.equal(paidThrough([{date:today,amount:10},{date:bad,amount:25}],today),null,String(bad));
  }
  assert.equal(paidThrough([{date:'2000-02-29',amount:5},{date:'2024-02-29',amount:6}],today),11);
  for(const bad of [null,undefined,'','2026-02-29','bad'])assert.equal(paidThrough([{date:today,amount:5}],bad),null);
 });
 await check('missing, negative, nonnumeric and nonfinite amounts invalidate past and future rows',()=>{
  for(const bad of [null,undefined,'',false,true,'25',-1,NaN,Infinity,-Infinity,{},[]])for(const date of ['2026-10-15','2026-11-15']){
   assert.equal(entry([row(2,today,10),row(3,date,bad)]).paid_to_date,null,String(bad));
   assert.equal(paidThrough([{date:today,amount:10},{date,amount:bad}],today),null,String(bad));
  }
  for(const bad of [null,undefined,{},[],[null],[undefined],Array(1)])assert.equal(paidThrough(bad,today),null);
 });
 await check('aggregate overflow is unavailable while uncounted finite future amounts remain valid',()=>{
  assert.equal(entry([row(2,today,Number.MAX_VALUE),row(3,today,Number.MAX_VALUE)]).paid_to_date,null);
  assert.equal(paidThrough([{date:today,amount:Number.MAX_VALUE},{date:today,amount:Number.MAX_VALUE}],today),null);
  assert.equal(entry([row(2,'2026-10-27',Number.MAX_VALUE),row(3,'2026-11-15',Number.MAX_VALUE)]).paid_to_date,0);
 });
 await check('Hermosillo calendar midnight includes today immediately, without changing the schedule',()=>{
  const midnightRows=[row(2,'2026-10-25',7),row(3,today,13)],before='2026-10-26T06:59:59.999Z',after='2026-10-26T07:00:00.000Z';
  assert.equal(businessDay(before),'2026-10-25');assert.equal(businessDay(after),today);
  assert.equal(entry(midnightRows,before).paid_to_date,7);assert.equal(entry(midnightRows,after).paid_to_date,20);
  assert.deepEqual(midnightRows,[row(2,'2026-10-25',7),row(3,today,13)]);
 });
 await check('conflicting or missing V cannot override valid A/B; W, source values and order remain intact',()=>{
  const varied=rows.map((r,i)=>({...r,paid_to_date:[null,'invalid',99999,-200][i]})),original=structuredClone(varied);
  freeze(varied);const e=entry(varied);assert.equal(e.paid_to_date,150.75);assert.equal(e.expected_to_date,175);assert.deepEqual(varied,original);
  const principalConflict=varied.map((r,i)=>({...r,principal:i?400:401}));assert.equal(entry(principalConflict).principal,null);assert.equal(entry(principalConflict).paid_to_date,150.75);
  const wConflict=varied.map((r,i)=>({...r,expected_to_date:i?175:1}));assert.equal(entry(wConflict).expected_to_date,null);assert.equal(entry(wConflict).paid_to_date,150.75);
 });
 await check('each exact loan ID is independent; equal dates, amounts and quota numbers are not merged',()=>{
  const many=[row(2,today,25,{number:1}),row(3,today,25,{number:1}),row(4,today,90,{id:'010',number:1}),row(5,'2026-10-27',1000,{id:'010',number:1})];
  const e=projectHistory({...source,loans:many},context,now).entries;
  assert.equal(e.length,2);assert.equal(e.find(r=>r.id==='10').paid_to_date,50);assert.equal(e.find(r=>r.id==='010').paid_to_date,90);
  assert.deepEqual(e.find(r=>r.id==='10').schedule.map(r=>r.number),[1,1]);assert.equal(e.find(r=>r.id==='10').schedule.length,2);
 });
 await check('foreign owners and source Folio mismatches still fail before a total is exposed',()=>{
  for(const owner of ['7',' 0007','0007 ',null])assert.throws(()=>entry([row(2,today,10),row(3,today,999,{owner})]),/SOURCE_IDENTITY_MISMATCH/);
  assert.throws(()=>projectHistory({...source,folio:'7'},context,now),/SOURCE_INVALID/);
  assert.throws(()=>projectHistory({...source,requests:[{id:'SR-FOREIGN',owner:'7',status:'Pendiente'}]},context,now),/SOURCE_IDENTITY_MISMATCH/);
 });
 async function envelope(loans){const requests=[],issues=[],counts={loan_rows:loans.length,request_rows:0,folios:new Set(loans.map(r=>r.owner)).size,issues:0,loan_source_rows:loans.length,request_source_rows:0,ignored_blank_loan_rows:0,ignored_blank_request_rows:0,unaddressable_owner_rows:0,unaddressable_owner_groups:0};return {ok:true,action:'read_history_snapshot',contract_version:'HISTORY_SNAPSHOT_READ_V1',workbook_id:'1Vxy84N7mzbuioTmWhjRD2QFboDx--rG3iUwmLuyeY80',loan_sheet_id:1245291756,request_sheet_id:10616270,observed_at:now,loans,requests,issues,counts,fingerprints:{loans:hash(JSON.stringify(loans)),requests:hash('[]'),issues:hash('[]'),content:hash(JSON.stringify({loans,requests,issues}))}};}
 await check('existing snapshot boundary rejects duplicate source rows and isolates owners sharing a loan ID',async()=>{
  const input=await envelope([row(2,today,10),row(3,today,20,{owner:'7'}),row(4,today,5),row(5,today,30,{owner:'7'})]);
  const original=JSON.stringify(input),groups=await groupHistorySnapshot(input);assert.equal(groups.length,2);
  for(const group of groups){const ownContext={...context,folio:group.folio};const result=projectHistory({...JSON.parse(group.source_text),folio:group.folio},ownContext,now);assert.equal(result.entries[0].paid_to_date,group.folio==='0007'?15:50);}
  assert.equal(JSON.stringify(input),original);
  const duplicate=await envelope([row(2,today,10),row(2,today,10)]);await assert.rejects(groupHistorySnapshot(duplicate),/HISTORY_SNAPSHOT_SOURCE_INVALID/);
 });
 await check('preparing loans have no paid total and approvals remain independent of amortization',()=>{
  const request={id:'native-request',folio:'SR-SYNTHETIC',status:'approved',financial:true,approved_at:'2026-10-26T18:00:00Z'};
  const preparingSource={folio:'0007',loans:[],requests:[{id:'10',owner:'0007',status:'Iniciado',fund:'Synthetic fund',principal:400,total:500,term:4,date:'2026-10-26',receipt:{id:10,identity:request.folio,sourceHash:'a'.repeat(64)}}]};
  const e=projectHistory(preparingSource,{...context,requests:[request]},now).entries[0];assert.equal(e.preparing,true);assert.equal(e.paid_to_date,null);assert.equal(e.category,'Aprobadas');assert.deepEqual(e.schedule,[]);
 });
 await check('owned LOAD and DETAIL share the derived total through the same single snapshot RPC',async()=>{
  const saved=JSON.stringify(source);let calls=0;const client={rpc:async(name,args)=>{calls++;assert.equal(name,'get_self_loan_history_snapshot');assert.equal(args,undefined);return {data:{context,source,source_updated_at:now,sync_version:'synthetic-version',sync_state:{status:'READY'}}};}};
  const loaded=await loadPublishedHistory({action:'LOAD'},client),detail=await loadPublishedHistory({action:'DETAIL',key:'loan:10'},client);
  assert.equal(loaded.entries[0].paid_to_date,150.75);assert.equal(detail.entries[0].paid_to_date,150.75);assert.equal(calls,2);assert.equal(JSON.stringify(source),saved);
  await assert.rejects(loadPublishedHistory({action:'LOAD',folio:'7'},client),/REQUEST_INVALID/);assert.equal(calls,2);
 });
 const evidence={status:'PASS',checks,authority:'Published own Google A/B rows grouped by exact Folio D and loan ID C',algorithm:'Validate all date/amount rows; add decimal String(B) coefficients/scales exactly with BigInt for A <= Hermosillo today; convert to Number only at the end; no per-row rounding or fixed decimal restriction; unavailable for incomplete/empty/final overflow',noGoogleCalls:true,noDatabaseWrites:true,noNewRequests:true,noSourceMutation:true,noLoanOrQuotaRenumbering:true};
 const dir=process.env.SUTI_HISTORY_EVIDENCE_DIR||path.resolve('.tmp/history-total-paid/evidence');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'runtime.json'),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify({status:'PASS',checks:checks.length,evidence:path.join(dir,'runtime.json')}));
}
main().catch(error=>{console.error(error.stack||error.message);process.exitCode=1;});
