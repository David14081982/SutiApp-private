// H-FLUJO-EFECTIVO-AHORRO-CAJA-001: synthetic fixtures, read-only dependencies.
import assert from 'node:assert/strict';
import test from 'node:test';
import {generateKeyPairSync} from 'node:crypto';
import {buildCashFlow,loadCashFlow,validFrom} from '../supabase/functions/reports-jc/cash-flow.mjs';
import {readCashFlowGoogle,CASH_FLOW_RANGES} from '../supabase/functions/reports-jc/cash-flow-google.mjs';
import {WORKBOOK} from '../supabase/functions/reports-jc/report.mjs';
import {READER_EMAIL,READER_PROJECT,READER_SECRET,TOKEN_ENDPOINT,READ_ONLY_SCOPE} from '../supabase/functions/reports-jc/google-auth.mjs';

const NOW='2026-10-30T12:00:00.000Z';
const HEADERS=Array(31).fill('');
Object.assign(HEADERS,{0:'Fecha',1:'Cuotas',2:'ID',3:'Folio',6:'Fondo',8:'Plazo',9:'Cantidad Prestamo',10:'Total a pagar',18:'X',30:'Fecha Transferencia'});
const serial=d=>(Date.parse(d+'T00:00:00Z')-Date.UTC(1899,11,30))/86400000;
function loan({id='1',folio='100',fund='Caja de Ahorro',date='2026-10-15',paid=100,installment=1,principal=1000,total=1200,transfer='2026-01-05',...extra}={}){
 const r=Array(31).fill('');Object.assign(r,{0:date?serial(date):'',1:paid,2:id,3:folio,6:fund,8:12,9:principal,10:total,18:installment,30:transfer?serial(transfer):'',...extra});return r;
}
function savings(events=[],extra={}){return {events,balances:Array.from({length:12},(_,i)=>({month:`2026-${String(i+1).padStart(2,'0')}`,amount:0})),...extra};}
function report(loans=[],events=[],extra={}){return buildCashFlow({from:'2026-01',loans:[HEADERS,...loans],savings:savings(events),consultedAt:NOW,...extra});}
function cell(r,kind,month='2026-10'){const i=r.months.findIndex(m=>m.key===month);assert(i>=0);return r.rows.find(row=>row.id===kind).cells[i];}
const codes=r=>r.issues.map(i=>i.code);
const event=(id,kind,amount,date='2026-10-15',extra={})=>({id,kind,amount,date,source:'synthetic_fixture',sourceId:id,...extra});

test('Caja de Ahorro only: exclude Caja Chica, investors and memberships',()=>{
 const r=report([loan(),loan({id:'2',fund:'Caja Chica',paid:90000}),loan({id:'3',fund:'Inversores',paid:80000}),loan({id:'4',fund:'Vales y membresias',paid:70000})]);
 assert.equal(r.coverage.loanCount,1);assert.equal(cell(r,'loan_recovered').amount,100);assert.equal(cell(r,'loan_placed','2026-01').amount,1000);
 assert(r.records.every(x=>x.loanId==='1'));assert.equal(r.coverage.financialWrites,0);assert.equal(r.coverage.amortizationEngineActive,false);
});
test('Repeated J capital is counted once per C/D and transfer month',()=>{
 const r=report([loan(),loan({date:'2026-11-15',installment:2})]);
 assert.equal(cell(r,'loan_placed','2026-01').amount,1000);assert.equal(r.records.filter(x=>x.kind==='loan_placed').length,1);
 assert.equal(cell(r,'loan_recovered').amount,100);assert.equal(cell(r,'loan_scheduled','2026-11').amount,100);
});
test('Same ID with different Folio preserves separate contracts',()=>{
 const r=report([loan(),loan({folio:'101',principal:2000,total:2400,paid:200})]);
 assert.equal(r.coverage.loanCount,2);assert.equal(cell(r,'loan_placed','2026-01').amount,3000);assert.equal(cell(r,'loan_recovered').amount,300);
});
test('Duplicate installment S protects the loan instead of doubling receipts',()=>{
 const r=report([loan(),loan({date:'2026-10-20'})]);
 assert(codes(r).includes('LOAN_INSTALLMENT_AMBIGUOUS'));assert.equal(cell(r,'loan_recovered').amount,null);
 assert.equal(cell(r,'loan_recovered').knownAmount,0);assert.equal(cell(r,'loan_placed','2026-01').amount,null);assert.equal(r.records.length,0);
});
test('One identity with contradictory funds is excluded visibly',()=>{
 const r=report([loan(),loan({fund:'Caja Chica',installment:2})]);
 assert(codes(r).includes('LOAN_FUND_CONFLICT'));assert.equal(cell(r,'loan_recovered').amount,null);assert.equal(r.records.length,0);
});
test('Unknown transfer date preserves capital without inventing a placement month',()=>{
 const r=report([loan({transfer:null,20:serial('2026-02-01')})]);
 assert.equal(cell(r,'loan_recovered').amount,100);assert.equal(cell(r,'loan_placed','2026-02').amount,null);
 assert.equal(r.unassigned.find(x=>x.kind==='loan_placed').amount,1000);assert(codes(r).includes('LOAN_TRANSFER_DATE_UNRESOLVED'));
});
test('Conflicting transfer dates never choose a convenient month',()=>{
 const r=report([loan(),loan({installment:2,transfer:'2026-02-01'})]);
 assert(codes(r).includes('LOAN_TRANSFER_DATE_UNRESOLVED'));assert.equal(r.records.filter(x=>x.kind==='loan_placed').length,0);
});
test('A/B uses Hermosillo calendar boundary, including same-day payment',()=>{
 const r=report([loan({date:'2026-10-31',paid:200}),loan({date:'2026-11-01',paid:300,installment:2})],[],{consultedAt:'2026-11-01T06:59:59.000Z'});
 assert.equal(r.asOf,'2026-10-31');assert.equal(cell(r,'loan_recovered').amount,200);assert.equal(cell(r,'loan_scheduled','2026-11').amount,300);
 const next=report([loan({date:'2026-11-01',paid:300})],[],{consultedAt:'2026-11-01T07:00:00.000Z'});
 assert.equal(next.asOf,'2026-11-01');assert.equal(cell(next,'loan_recovered','2026-11').amount,300);assert.equal(cell(next,'loan_scheduled','2026-11').amount,0);
});
test('Editing B replaces one recorded value, without accumulating corrections',()=>{
 const original=[HEADERS,loan({paid:950})],copy=structuredClone(original);
 const a=buildCashFlow({from:'2026-01',loans:original,savings:savings(),consultedAt:NOW});
 assert.deepEqual(original,copy);original[1][1]=500;
 const b=buildCashFlow({from:'2026-01',loans:original,savings:savings(),consultedAt:NOW});
 assert.equal(cell(a,'loan_recovered').amount,950);assert.equal(cell(b,'loan_recovered').amount,500);assert.equal(b.records.filter(x=>x.kind==='loan_recovered').length,1);
});
test('Legacy Z/AB/AC/AD do not become recovered components',()=>{
 const r=report([loan({25:15,27:200,28:1200,29:1000})]);
 for(const id of ['loan_principal','loan_interest','loan_admin','loan_pending'])assert.equal(cell(r,id).amount,null,id);
 assert.equal(cell(r,'loan_recovered').amount,100);assert(codes(r).includes('LOAN_BREAKDOWN_NOT_CERTIFIED'));
});
test('Corroborated zero B is a known zero receipt and zero components',()=>{
 const r=report([loan({paid:0})]);
 for(const id of ['loan_recovered','loan_principal','loan_interest','loan_admin'])assert.equal(cell(r,id).amount,0,id);
 assert.equal(cell(r,'loan_pending').amount,null);
});
test('Missing dates and invalid cents are visible, never fabricated or rounded',()=>{
 const r=report([loan({date:null}),loan({id:'2',paid:100.001})]);
 assert(codes(r).includes('LOAN_PAYMENT_DATE_MISSING'));assert(codes(r).includes('LOAN_PAYMENT_INVALID'));
 assert.equal(cell(r,'loan_recovered').amount,null);assert.equal(cell(r,'loan_principal').amount,null);
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
 assert.equal(cell(r,'withdrawal_unspecified').amount,150);assert.equal(cell(r,'withdrawal_partial').amount,null);assert.equal(cell(r,'withdrawal_total').amount,null);
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

function client({authenticated=true,authorized=true,changed=false}={}){
 let contexts=0;return {auth:{getUser:async()=>({data:{user:authenticated?{id:'actor'}:null},error:null})},rpc:async(name,args)=>{
  if(name==='get_admin_reports_jc_context'){contexts++;return {data:authorized?{actor:'actor',session:changed&&contexts>1?'new-context':null}:null,error:null};}
  assert.equal(name,'get_admin_reports_jc_cash_flow');assert.deepEqual(args,{p_from:'2026-01-01'});return {data:savings(),error:null};
 }};
}
test('Unauthenticated or unauthorized requests fail before Google is queried',async()=>{
 for(const [options,error]of [[{authenticated:false},'AUTH_REQUIRED'],[{authorized:false},'ADMIN_DENIED']]){
  let google=0;await assert.rejects(loadCashFlow({action:'CASH_FLOW',from:'2026-01'},client(options),async()=>{google++;return [HEADERS];},()=>NOW),new RegExp(error));assert.equal(google,0);
 }
});
test('Context change after data read rejects the result',async()=>{
 let google=0;await assert.rejects(loadCashFlow({action:'CASH_FLOW',from:'2026-01'},client({changed:true}),async()=>{google++;return [HEADERS];},()=>NOW),/CONTEXT_CHANGED/);assert.equal(google,1);
});
test('Valid request returns the original actor context and read-only projection',async()=>{
 const r=await loadCashFlow({action:'CASH_FLOW',from:'2026-01'},client(),async()=>[HEADERS,loan()],()=>NOW);
 assert.deepEqual(r.context,{actor:'actor',session:null});assert.equal(cell(r.data,'loan_recovered').amount,100);
});
test('Unexpected selectors and invalid period fail before authorization/source calls',async()=>{
 for(const body of [{action:'CASH_FLOW',from:'2026-01',sheet:'Ahorro'},{action:'CASH_FLOW',from:'2026-13'},{action:'LOAD',from:'2026-01'}])
  await assert.rejects(loadCashFlow(body,null,()=>assert.fail('No source read allowed')),/REQUEST_INVALID/);
});

// Ephemeral synthetic RSA key: never reads credentials, filesystem snapshots or network.
const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const account={type:'service_account',client_email:READER_EMAIL,project_id:READER_PROJECT,private_key:privateKey.export({type:'pkcs8',format:'pem'})};
const env=name=>name===READER_SECRET?JSON.stringify(account):undefined;
function response(body,status=200){return {ok:status>=200&&status<300,status,json:async()=>body};}
function googlePayload(){return {spreadsheetId:WORKBOOK,valueRanges:[{values:[HEADERS.slice(0,4),[serial('2026-10-15'),100,'1','100']]},{values:[HEADERS.slice(6,11),['Caja de Ahorro',.01,12,1000,1200]]},{values:[['X'],[1]]},{values:[['Fecha Transferencia'],[serial('2026-01-05')]]}]};}
test('Google reader uses fixed ranges, unformatted serials and the existing read-only identity',async()=>{
 const calls=[];const rows=await readCashFlowGoogle(env,async(url,options)=>{
  calls.push({url,options});if(url===TOKEN_ENDPOINT){assert.equal(options.method,'POST');const jwt=options.body.get('assertion'),claim=JSON.parse(Buffer.from(jwt.split('.')[1],'base64url').toString());assert.equal(claim.scope,READ_ONLY_SCOPE);assert.equal(claim.iss,READER_EMAIL);return response({access_token:'synthetic-test-token'});}
  assert.equal(options.method,'GET');const u=new URL(url);assert.equal(u.pathname,`/v4/spreadsheets/${WORKBOOK}/values:batchGet`);
  assert.deepEqual(u.searchParams.getAll('ranges'),CASH_FLOW_RANGES);assert.equal(u.searchParams.get('valueRenderOption'),'UNFORMATTED_VALUE');assert.equal(u.searchParams.get('dateTimeRenderOption'),'SERIAL_NUMBER');return response(googlePayload());
 });
 assert.equal(calls.length,2);assert.equal(rows[1][18],1);assert.equal(rows[1][30],serial('2026-01-05'));
 const r=buildCashFlow({from:'2026-01',loans:rows,savings:savings(),consultedAt:NOW});assert.equal(cell(r,'loan_placed','2026-01').amount,1000);
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
