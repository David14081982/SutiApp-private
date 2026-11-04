// H-CASH-FLOW-PV2-SOURCE-20261104: synthetic fixtures; no network or financial writes.
import assert from 'node:assert/strict';
import test from 'node:test';
import {generateKeyPairSync} from 'node:crypto';
import {buildCashFlow,loadCashFlow,validFrom,projectCashFlowSnapshot} from '../supabase/functions/reports-jc/cash-flow.mjs';
import {consolidateCashFlow} from '../supabase/functions/reports-jc/cash-flow-consolidated.mjs';
import {readCashFlowGoogle,readConsolidatedCashFlowGoogle,CASH_FLOW_RANGES,CONSOLIDATED_CASH_FLOW_RANGES} from '../supabase/functions/reports-jc/cash-flow-google.mjs';
import {WORKBOOK} from '../supabase/functions/reports-jc/report.mjs';
import {READER_EMAIL,READER_PROJECT,READER_SECRET,TOKEN_ENDPOINT,READ_ONLY_SCOPE} from '../supabase/functions/reports-jc/google-auth.mjs';

const NOW='2026-10-30T12:00:00.000Z';
const HEADERS=Array(33).fill('');
Object.assign(HEADERS,{0:'Fecha',1:'Cuotas',2:'ID',3:'Folio',6:'Fondo',8:'Plazo',9:'Cantidad Prestamo',10:'Total a pagar',18:'X',20:'Autorizado',25:'Administracion',27:'Interes',28:'Capital e interes',29:'Capital',32:'Fecha original'});
const serial=d=>(Date.parse(d+'T00:00:00Z')-Date.UTC(1899,11,30))/86400000;
function loan({id='1',folio='100',fund='Caja de Ahorro',date='2026-10-15',paid=100,installment=1,principal=1000,total=1200,origin='2026-01-05',...extra}={}){
 const r=Array(33).fill('');Object.assign(r,{0:date?serial(date):'',1:paid,2:id,3:folio,6:fund,8:12,9:principal,10:total,18:installment,20:origin?serial(origin):'',25:5,27:15,28:95,29:80,32:origin?serial(origin):'',...extra});return r;
}
function request({id='1',folio='100',fund='Caja de Ahorro',date='2026-01-05',principal=1000,total=1200,status='Aprobado'}={}){
 const r=Array(25).fill('');Object.assign(r,{0:id,1:folio,4:fund,7:principal,8:total,9:date?serial(date):'',24:status});return r;
}
function savings(events=[],extra={}){return {events,balances:Array.from({length:12},(_,i)=>({month:`2026-${String(i+1).padStart(2,'0')}`,amount:0})),...extra};}
function report(loans=[],events=[],extra={}){return buildCashFlow({from:'2026-01',loans:[HEADERS,...loans],savings:savings(events),consultedAt:NOW,...extra});}
function cell(r,kind,month='2026-10'){const i=r.months.findIndex(m=>m.key===month);assert(i>=0);return r.rows.find(row=>row.id===kind).cells[i];}
const codes=r=>r.issues.map(i=>i.code);
const event=(id,kind,amount,date='2026-10-15',extra={})=>({id,kind,amount,date,source:'synthetic_fixture',sourceId:id,...extra});

function projected(loans=[],requests=[],extra={}){
 return consolidateCashFlow({base:report([],[],extra),loans:[HEADERS,...loans],requests:[[],...requests]});
}
test('Savings builder leaves loan calculations to the original-source projection',()=>{
 const r=report([loan(),loan({id:'2',fund:'Caja Chica'})]);
 assert.equal(r.coverage.loanCount,0);assert.equal(cell(r,'loan_recovered').amount,0);assert.equal(r.records.length,0);
 const combined=projected([loan(),loan({id:'2',fund:'Caja Chica',paid:900}),loan({id:'3',fund:'Vales y membresias',paid:700})]);
 assert.equal(cell(combined,'loan_recovered').amount,100);assert.equal(cell(combined,'fund_pettyCash_recovered').amount,900);
 assert.equal(combined.coverage.financialWrites,0);assert.equal(combined.coverage.amortizationEngineActive,false);
});
test('Repeated capital is counted once per C, while each quota B remains in its month',()=>{
 const r=projected([loan(),loan({date:'2026-11-15',installment:2})],[request({date:'2026-04-05'})]);
 assert.equal(cell(r,'loan_placed','2026-04').amount,1000);assert.equal(cell(r,'loan_count','2026-04').amount,1);
 assert.equal(cell(r,'loan_recovered').amount,100);assert.equal(cell(r,'loan_scheduled','2026-11').amount,100);
 assert.equal(cell(r,'loan_placed','2026-01').amount,0);
});
test('C remains unique across folios; a contradictory capital is not chosen silently',()=>{
 const r=projected([loan(),loan({folio:'101',principal:2000,total:2400,paid:200})],[request(),request({folio:'101',principal:2000,total:2400})]);
 assert.equal(r.loanContracts.length,1);assert.equal(cell(r,'loan_count','2026-01').amount,1);
 assert.equal(cell(r,'loan_placed','2026-01').amount,null);assert.equal(cell(r,'loan_recovered').amount,300);
});
test('Repeated installment labels do not erase legitimate original quota rows',()=>{
 const r=projected([loan(),loan({date:'2026-10-20'})]);
 assert.equal(cell(r,'loan_recovered').amount,200);assert.equal(cell(r,'loan_placed','2026-01').amount,1000);
});
test('Conflicting program identity preserves B in its recorded G and flags the relation',()=>{
 const r=projected([loan(),loan({fund:'Caja Chica',installment:2})]);
 assert.equal(cell(r,'loan_recovered').amount,100);assert.equal(cell(r,'fund_pettyCash_recovered').amount,100);
 assert(r.loanContracts[0].issues.includes('PROGRAMA_AMBIGUO'));
});
test('Authorized request date is placement authority even when calendar origin is absent',()=>{
 const r=projected([loan({origin:null})],[request({date:'2026-04-05'})]);
 assert.equal(cell(r,'loan_placed','2026-04').amount,1000);assert.equal(cell(r,'loan_count','2026-04').amount,1);
});
test('Conflicting request dates never choose a convenient placement month',()=>{
 const r=projected([loan()],[request(),request({date:'2026-02-01'})]);
 assert.equal(r.records.filter(x=>x.kind==='loan_placed').length,0);assert.equal(r.loanContracts[0].placementDate,null);
 assert(r.loanContracts[0].issues.includes('FECHA_COLOCACION_AMBIGUA'));
});
test('A/B uses Hermosillo boundary, including same-day payment',()=>{
 const r=projected([loan({date:'2026-10-31',paid:200}),loan({date:'2026-11-01',paid:300,installment:2})],[],{consultedAt:'2026-11-01T06:59:59.000Z'});
 assert.equal(r.asOf,'2026-10-31');assert.equal(cell(r,'loan_recovered').amount,200);assert.equal(cell(r,'loan_scheduled','2026-11').amount,300);
 const next=projected([loan({date:'2026-11-01',paid:300})],[],{consultedAt:'2026-11-01T07:00:00.000Z'});
 assert.equal(next.asOf,'2026-11-01');assert.equal(cell(next,'loan_recovered','2026-11').amount,300);assert.equal(cell(next,'loan_scheduled','2026-11').amount,0);
});
test('Editing B replaces a source value without accumulating corrections or mutating inputs',()=>{
 const original=[loan({paid:950})],copy=structuredClone(original),a=projected(original);
 assert.deepEqual(original,copy);original[0][1]=500;const b=projected(original);
 assert.equal(cell(a,'loan_recovered').amount,950);assert.equal(cell(b,'loan_recovered').amount,500);assert.equal(b.records.filter(x=>x.kind==='loan_recovered').length,1);
});
test('Original Z, AB, AC and AD determine components without a new amortization calculation',()=>{
 const r=projected([loan()]);
 assert.equal(cell(r,'loan_principal').amount,80);assert.equal(cell(r,'loan_interest').amount,15);assert.equal(cell(r,'loan_admin').amount,5);
 assert.equal(cell(r,'loan_pending').amount,920);assert.equal(cell(r,'loan_unallocated').amount,0);
});
test('An explicit zero quota and zero original components remain known zero',()=>{
 const r=projected([loan({paid:0,25:0,27:0,28:0,29:0})]);
 for(const id of ['loan_recovered','loan_principal','loan_interest','loan_admin'])assert.equal(cell(r,id).amount,0,id);
 assert.equal(cell(r,'loan_pending').amount,1000);
});
test('Invalid quota date or subcent value stays visible without fabricated recovery',()=>{
 const r=projected([loan({date:null}),loan({id:'2',paid:100.001})]);
 assert(codes(r).includes('LOAN_QUOTA_INVALID'));assert.equal(r.unassigned.filter(x=>x.id.startsWith('pv2:')).length,2);
 assert.equal(cell(r,'loan_recovered').amount,null);assert.equal(cell(r,'loan_pending').amount,null);
});
test('Identical savings event IDs deduplicate and conflicting versions remain unknown',()=>{
 const e=event('a','contribution',100),r=report([],[e,structuredClone(e)]);
 assert.equal(cell(r,'contribution').amount,100);assert.equal(r.records.length,1);
 const conflict=report([],[e,{...e,amount:200}]);assert.equal(cell(conflict,'contribution').amount,null);
 assert(codes(conflict).includes('SAVINGS_EVENT_CONFLICT'));assert.equal(conflict.records.length,0);
});
test('Net canonical correction remains separate from contributions',()=>{
 const r=report([],[event('a','contribution',1000),event('adjust','adjustment',-50)]);
 assert.equal(cell(r,'contribution').amount,1000);assert.equal(cell(r,'adjustment').amount,-50);
});
test('Mixed historical contribution/yield is retained without inventing a split',()=>{
 const r=report([],[event('mixed','contribution_mixed',1250),event('known','contribution',100)]);
 assert.equal(cell(r,'contribution_mixed').amount,1250);assert.equal(cell(r,'contribution').amount,null);assert.equal(cell(r,'contribution').knownAmount,100);
 assert.equal(cell(r,'yield_credited').amount,null);assert(codes(r).includes('SAVINGS_MIXED_HISTORY'));
});
test('Authorized pending withdrawals remain obligations, never paid cash',()=>{
 const r=report([],[event('future','withdrawal_pending',80,'2026-11-15'),event('undated','withdrawal_pending',40,null),event('overdue','withdrawal_pending',20,'2026-10-01')]);
 assert.equal(cell(r,'withdrawal_pending','2026-11').amount,80);assert.equal(cell(r,'withdrawal_total').amount,0);assert.equal(cell(r,'withdrawal_partial').amount,0);
 assert.equal(r.unassigned.reduce((sum,e)=>sum+e.amount,0),60);assert.equal(r.unassigned.find(e=>e.id==='overdue').overdue,true);
});
test('Missing savings date marks the monthly figure unknown and retains unassigned value',()=>{
 const r=report([],[event('undated','contribution',125,null)]);
 assert(codes(r).includes('SAVINGS_DATE_MISSING'));assert.equal(cell(r,'contribution').amount,null);
 assert.equal(r.unassigned[0].amount,125);assert.equal(r.unassigned[0].date,null);
});
test('Unclassified withdrawal is counted once without assuming partial or total',()=>{
 const r=report([],[event('withdraw','withdrawal_unspecified',150)]);
 assert.equal(cell(r,'withdrawal_unspecified').amount,150);assert.equal(cell(r,'withdrawal_partial').amount,0);assert.equal(cell(r,'withdrawal_total').amount,0);assert(codes(r).includes('SAVINGS_WITHDRAWAL_KIND_MISSING'));
});
test('Scheduled contributions are future only; future credited yields are rejected as recovered',()=>{
 const r=report([],[event('past','contribution_scheduled',500,'2026-10-01'),event('future','contribution_scheduled',600,'2026-11-01'),event('badcredit','yield_credited',100,'2026-10-31')]);
 assert.equal(cell(r,'contribution_scheduled').amount,0);assert.equal(cell(r,'contribution_scheduled','2026-11').amount,600);
 assert.equal(cell(r,'yield_credited').amount,null);assert(codes(r).includes('SAVINGS_FUTURE_RECORDED'));
});
test('Historical balance omissions stay unknown; future balance is not accumulated cash',()=>{
 const r=report([],[],{savings:savings([],{balances:[{month:'2026-10',amount:null,known_amount:300,unknown_count:1}]})});
 assert.equal(cell(r,'savings_balance').amount,null);assert.equal(cell(r,'savings_balance').knownAmount,300);
 assert.equal(cell(r,'savings_balance','2026-11').amount,null);assert.equal(cell(r,'savings_balance','2026-11').status,'NOT_APPLICABLE');
});
test('Rolling view always has twelve chronological month columns',()=>{
 const r=report([],[],{from:'2026-10'});assert.equal(r.months.length,12);assert.equal(r.months[0].key,'2026-10');assert.equal(r.months[11].key,'2027-09');
 assert.equal(validFrom('2026-00'),false);assert.equal(validFrom('2026-13'),false);assert.equal(validFrom('2026-10'),true);
});

function client({authenticated=true,authorized=true,changed=false,savingsError=false,investorsError=false}={}){
 let contexts=0;return {auth:{getUser:async()=>({data:{user:authenticated?{id:'actor'}:null},error:null})},rpc:async(name,args)=>{
  if(name==='get_admin_reports_jc_context'){contexts++;return {data:authorized?{actor:'actor',session:changed&&contexts>1?'new-context':null}:null,error:null};}
  assert.deepEqual(args,{p_from:'2026-01-01'});
  if(name==='get_admin_reports_jc_cash_flow')return {data:savings(),error:savingsError?{message:'Unavailable'}:null};
  assert.equal(name,'get_admin_reports_jc_cash_flow_investors');
  return {data:{contracts:[],movements:[],obligations:[],reviews:[],balances:[]},error:investorsError?{message:'Unavailable'}:null};
 }};
}
const source=rows=>({loans:[HEADERS,...rows],requests:[[]]});
test('Unauthenticated or unauthorized requests fail before Google is queried',async()=>{
 for(const [options,error]of [[{authenticated:false},'AUTH_REQUIRED'],[{authorized:false},'ADMIN_DENIED']]){
  let google=0;await assert.rejects(loadCashFlow({action:'CASH_FLOW',from:'2026-01'},client(options),async()=>{google++;return source([]);},()=>NOW),new RegExp(error));assert.equal(google,0);
 }
});
test('Context change after data read rejects the result',async()=>{
 let google=0;await assert.rejects(loadCashFlow({action:'CASH_FLOW',from:'2026-01'},client({changed:true}),async()=>{google++;return source([]);},()=>NOW),/CONTEXT_CHANGED/);assert.equal(google,1);
});
test('Valid request returns the actor context and read-only projection from the same inputs',async()=>{
 const original=source([loan()]),before=structuredClone(original);
 const r=await loadCashFlow({action:'CASH_FLOW',from:'2026-01'},client(),async()=>original,()=>NOW);
 assert.deepEqual(r.context,{actor:'actor',session:null});assert.equal(cell(r.data,'loan_recovered').amount,100);assert.deepEqual(original,before);
 assert.equal(r.data.coverage.financialWrites,0);assert(r.data.sourceBases);
});
test('Malformed source payload or unavailable savings fail explicitly',async()=>{
 for(const invalid of [null,[],{loans:[]},{loans:[],requests:null}]){
  await assert.rejects(loadCashFlow({action:'CASH_FLOW',from:'2026-01'},client(),async()=>invalid,()=>NOW),/CASH_FLOW_SOURCE_INVALID/);
 }
 await assert.rejects(loadCashFlow({action:'CASH_FLOW',from:'2026-01'},client({savingsError:true}),async()=>source([]),()=>NOW),/SAVINGS_SOURCE_UNAVAILABLE/);
});
test('Unavailable investors are visible while valid loan receipts are retained',async()=>{
 const r=await loadCashFlow({action:'CASH_FLOW',from:'2026-01'},client({investorsError:true}),async()=>source([loan()]),()=>NOW);
 assert.equal(cell(r.data,'loan_recovered').amount,100);assert(codes(r.data).includes('INVESTOR_SOURCE_UNAVAILABLE'));
 assert.equal(cell(r.data,'investor_contribution').amount,null);
});
test('Unexpected selectors and invalid period fail before authorization/source calls',async()=>{
 for(const body of [{action:'CASH_FLOW',from:'2026-01',sheet:'Ahorro'},{action:'CASH_FLOW',from:'2026-13'},{action:'LOAD',from:'2026-01'}])
  await assert.rejects(loadCashFlow(body,null,()=>assert.fail('No source read allowed')),/REQUEST_INVALID/);
});

test('authorized source snapshot preserves projection and cannot bypass context checks',async()=>{
 const data=source([loan()]),body={action:'CASH_FLOW',from:'2026-01'};
 const direct=await loadCashFlow(body,client(),async()=>data,()=>NOW);
 const transported=await loadCashFlow(body,client(),async()=>data,()=>NOW,{sourceSnapshot:true});
 assert.equal(transported.data.version,'cash-flow-inputs-v1');
 assert.equal(transported.data.consultedAt,NOW);
 assert.equal(transported.data.rows,undefined);
 assert.equal(transported.data.source.loans[1][30],null);
 assert.deepEqual(projectCashFlowSnapshot(transported.data),direct.data);
 assert.throws(()=>projectCashFlowSnapshot({...transported.data,modelVersion:'other'}),/CASH_FLOW_SOURCE_INVALID/);
 await assert.rejects(loadCashFlow({...body,sourceSnapshot:true},null,()=>assert.fail('No read allowed'),()=>NOW,{sourceSnapshot:true}),/REQUEST_INVALID/);
});

// Ephemeral synthetic RSA key: never reads credentials, filesystem snapshots or network.
const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const account={type:'service_account',client_email:READER_EMAIL,project_id:READER_PROJECT,private_key:privateKey.export({type:'pkcs8',format:'pem'})};
const env=name=>name===READER_SECRET?JSON.stringify(account):undefined;
function response(body,status=200){return {ok:status>=200&&status<300,status,json:async()=>body};}
function googlePayload(){const data=loan();return {spreadsheetId:WORKBOOK,valueRanges:[
 {values:[HEADERS.slice(0,21),data.slice(0,21)]},
 {values:[HEADERS.slice(25,30),data.slice(25,30)]},
 {values:[HEADERS.slice(32,33),data.slice(32,33)]}
]};}
test('Google reader uses fixed ranges, unformatted serials and the existing read-only identity',async()=>{
 const calls=[];const rows=await readCashFlowGoogle(env,async(url,options)=>{
  calls.push({url,options});if(url===TOKEN_ENDPOINT){assert.equal(options.method,'POST');const jwt=options.body.get('assertion'),claim=JSON.parse(Buffer.from(jwt.split('.')[1],'base64url').toString());assert.equal(claim.scope,READ_ONLY_SCOPE);assert.equal(claim.iss,READER_EMAIL);return response({access_token:'synthetic-test-token'});}
  assert.equal(options.method,'GET');const u=new URL(url);assert.equal(u.pathname,`/v4/spreadsheets/${WORKBOOK}/values:batchGet`);
  assert.deepEqual(u.searchParams.getAll('ranges'),CASH_FLOW_RANGES);assert.equal(u.searchParams.get('valueRenderOption'),'UNFORMATTED_VALUE');assert.equal(u.searchParams.get('dateTimeRenderOption'),'SERIAL_NUMBER');return response(googlePayload());
 });
 assert.equal(calls.length,2);assert.equal(rows[1][18],1);assert.equal(rows[1][25],5);assert.equal(rows[1][27],15);assert.equal(rows[1][29],80);assert.equal(rows[1][32],serial('2026-01-05'));assert.equal(rows[1][30],undefined);
 const r=consolidateCashFlow({base:report(),loans:rows});assert.equal(cell(r,'loan_placed','2026-01').amount,1000);
});
test('Google denied access stops without a fallback or a write',async()=>{
 let calls=0;await assert.rejects(readCashFlowGoogle(env,async(url,options)=>{calls++;if(url===TOKEN_ENDPOINT)return response({access_token:'synthetic-test-token'});assert.equal(options.method,'GET');return response({},403);}),/GOOGLE_ACCESS_DENIED/);assert.equal(calls,2);
});
test('Malformed Google workbook or ranges fail visibly',async()=>{
 for(const broken of [{...googlePayload(),spreadsheetId:'wrong-book'},{...googlePayload(),valueRanges:[]},{...googlePayload(),valueRanges:googlePayload().valueRanges.map((r,i)=>i===2?{values:'invalid'}:r)}])
  await assert.rejects(readCashFlowGoogle(env,async url=>url===TOKEN_ENDPOINT?response({access_token:'synthetic-test-token'}):response(broken)),/GOOGLE_RESPONSE_INVALID/);
});
test('Missing reader configuration cannot query any endpoint',async()=>{
 await assert.rejects(readCashFlowGoogle(()=>undefined,()=>assert.fail('No endpoint allowed')),/GOOGLE_NOT_CONFIGURED/);
});

test('Consolidated Google reader merges only approved ranges and never fetches transfer data',async()=>{
 const requestRow=request({date:'2026-04-05'}),payload=googlePayload();payload.valueRanges.push({values:[[],requestRow.slice(0,11)]},{values:[['Estatus'],requestRow.slice(24,25)]});
 const read=await readConsolidatedCashFlowGoogle(env,async(url,options)=>{
  if(url===TOKEN_ENDPOINT)return response({access_token:'synthetic-test-token'});
  assert.equal(options.method,'GET');const query=new URL(url).searchParams;
  assert.deepEqual(query.getAll('ranges'),CONSOLIDATED_CASH_FLOW_RANGES);
  assert(query.getAll('ranges').every(r=>!r.includes('AE')));
  return response(payload);
 });
 assert.equal(read.requests[1][24],'Aprobado');assert.equal(read.requests[1][9],serial('2026-04-05'));
 assert.equal(read.loans[1][29],80);assert.equal(read.loans[1][30],undefined);
 const r=consolidateCashFlow({base:report(),...read});assert.equal(cell(r,'loan_placed','2026-04').amount,1000);
});
