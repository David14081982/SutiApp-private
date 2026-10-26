// Isolated GAS and transport fixtures; never uses credentials, network or Sheets.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {readHistorySnapshotSource,validateHistorySnapshot,groupHistorySnapshot} from '../supabase/functions/loan-history/snapshot-source.mjs';
import {projectHistory} from '../supabase/functions/loan-history/history.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),require=createRequire(import.meta.url);
const oldTest=fs.readFileSync(path.join(root,'scripts/test-history-efficiency-receiver.js'),'utf8');
const setup=oldTest.slice(0,oldTest.indexOf('const unauthorized=fixture();'))+'\nmodule.exports={fixture,payload,source};';
const module={exports:{}},testRequire=name=>name==='fs'?{readFileSync:(name,encoding)=>fs.readFileSync(path.resolve(root,name),encoding)}:require(name);
vm.runInNewContext(setup,{require:testRequire,module,Intl,Date,console},{filename:'existing-GAS-isolated-fixture.js'});
const {fixture,payload,source}=module.exports;
const input={action:'read_history_snapshot',contract_version:'HISTORY_SNAPSHOT_READ_V1',secret:payload.secret};
const clone=value=>JSON.parse(JSON.stringify(value)),hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const send=gas=>clone(gas.send(input));

// Strip exactly the added function and dispatch; every existing reader/writer
// and all existing dispatch/error behavior must remain identical.
const inverse=source.replace(/\/\/ Fixed whole-history snapshot read\.[\s\S]*?(?=function doPost\(event\))/,'')
 .replace(/    if\(payload\.action==='read_history_snapshot'\)return readHistorySnapshot_\(payload\);\r?\n/,'');
assert.equal(hash(inverse.replace(/\r/g,'')),'b5e1db5d71a5a7325a830306fe7163dd1edbea235285a3c55c9e2ec74bd417e9','unchanged entire legacy implementation outside the additive reader and dispatch');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'google-apps-script/financial-handoff/appsscript.json'),'utf8'));
assert.deepEqual(manifest,{timeZone:'America/Phoenix',dependencies:{},webapp:{access:'ANYONE',executeAs:'USER_DEPLOYING'},exceptionLogging:'STACKDRIVER',runtimeVersion:'V8'});

const unauthorized=fixture();
assert.equal(unauthorized.send({...input,secret:'wrong'}).error,'UNAUTHORIZED');
for(const extra of [{folio:'0007'},{range:'A:AI'},{sheet:'other'},{owner:'0007'},{contract_version:'wrong'}])assert.equal(unauthorized.send({...input,...extra}).error,'INVALID_REQUEST');
assert.equal(unauthorized.state.opens,0,'reject secret and client selectors before opening workbook');

const representative=fixture({large:true}),snapshot=send(representative);
assert.equal(snapshot.ok,true);await validateHistorySnapshot(snapshot);
assert.equal(snapshot.loans.length,20000);assert.equal(snapshot.requests.length,2800);
const self=clone(representative.send());
assert.deepEqual(snapshot.loans.filter(r=>r.owner===payload.folio),self.loans);
assert.deepEqual(snapshot.requests.filter(r=>r.owner===payload.folio),self.requests);
assert.equal(snapshot.issues.length,1,'malformed foreign fixture note is isolated instead of losing the complete observation');
assert.equal(snapshot.issues[0].owner,'FOREIGN');
assert.equal(snapshot.counts.unaddressable_owner_rows,1,'raw whitespace owner stays intact and is explicitly counted');
const groups=await groupHistorySnapshot(snapshot),own=groups.find(g=>g.folio===payload.folio),other=groups.find(g=>g.folio==='FOREIGN');
assert(own&&other);assert.deepEqual(JSON.parse(own.source_text),{loans:self.loans,requests:self.requests,issues:[]});
assert.equal(JSON.parse(other.source_text).issues[0].code,'HISTORY_TRANSFER_IDENTITY_INVALID');
for(const group of groups){assert.equal(group.content_hash,hash(group.source_text));const data=JSON.parse(group.source_text);assert(data.loans.concat(data.requests).every(r=>r.owner===group.folio));assert(data.issues.every(i=>i.owner===group.folio));}
assert.equal(representative.state.writes,0);
assert(!snapshot.loans.some(r=>'name' in r||'display' in r||'values' in r));
assert(!snapshot.requests.some(r=>'note' in r||'documents' in r||'name' in r));

const special=fixture();
for(const [index,owner] of [[1,''],[2,'0'],[6,' 0007 '],[8,'__proto__']]){special.sheets.loans[index].values[3]=owner;special.sheets.loans[index].display[3]=owner;}
special.sheets.loans[1].values[2]='';special.sheets.loans[1].display[2]='';
special.sheets.loans[2].values[9]='#REF!';special.sheets.loans[2].display[9]='#REF!';
special.sheets.loans[6].values[18]=4;special.sheets.loans[6].display[18]='4';
special.sheets.loans[8].values[1]=false;special.sheets.loans[8].display[1]='FALSE';
special.sheets.loans[9]={values:Array(35).fill(''),display:Array(35).fill(''),note:''};
special.sheets.requests[6]={values:Array(25).fill(''),display:Array(25).fill(''),note:''};
// A row with content only outside the response projection is not silently lost.
special.sheets.requests[7]={values:Array(25).fill(''),display:Array(25).fill(''),note:''};
special.sheets.requests[7].values[2]='Private fixture name';special.sheets.requests[7].display[2]='Private fixture name';
const specialSnapshot=send(special),specialGroups=await groupHistorySnapshot(specialSnapshot);
for(const owner of ['', '0',' 0007 ','__proto__','7','00070'])assert(specialGroups.some(g=>g.folio===owner),'preserve exact owner '+JSON.stringify(owner));
assert.equal(specialSnapshot.counts.ignored_blank_loan_rows,1);assert.equal(specialSnapshot.counts.ignored_blank_request_rows,1);
assert.equal(specialSnapshot.loans.find(r=>r.owner==='0').principal,'#REF!');
assert.equal(specialSnapshot.loans.find(r=>r.owner===' 0007 ').number,4);
assert.equal(specialSnapshot.loans.find(r=>r.owner==='__proto__').amount,false);
assert.equal(JSON.parse(specialGroups.find(g=>g.folio==='').source_text).requests.length,1,'retain incomplete inaccessible group without copying its name');
assert(!JSON.stringify(specialSnapshot).includes('Private fixture name'));

for(const note of ['SUTI_LOAN_TRANSFER_V1:{bad','SUTI_LOAN_TRANSFER_V1:{}\nSUTI_LOAN_TRANSFER_V1:{}',
 ...[null,false,[],{}, {id:999,identity:'SR-WRONG',sourceHash:'a'.repeat(64)}, {id:1,identity:'WRONG',sourceHash:'a'.repeat(64)}].map(value=>'SUTI_LOAN_TRANSFER_V1:'+JSON.stringify(value))]){
 const gas=fixture();gas.sheets.requests[1].note=note;const captured=send(gas),byOwner=await groupHistorySnapshot(captured);
 assert.equal(captured.ok,true);assert.equal(captured.requests.find(r=>r.owner==='0007'&&r.id==='1').receipt,null);
 assert.equal(JSON.parse(byOwner.find(g=>g.folio==='0007').source_text).issues.length,1);
 const clean=JSON.parse(byOwner.find(g=>g.folio==='7').source_text);
 assert.equal(clean.issues.length,0);assert.equal(projectHistory({...clean,folio:'7'},{folio:'7',requests:[]},'2026-10-26T12:00:00Z').entries.length,1,'a different valid owner remains projectable');
}
const extraReceipt=fixture();extraReceipt.sheets.requests[1].note='SUTI_LOAN_TRANSFER_V1:'+JSON.stringify({id:1,identity:'SR-2026-000001',sourceHash:'a'.repeat(64),private_note:'Unnecessary private text'});
const minimized=send(extraReceipt);await validateHistorySnapshot(minimized);
assert.deepEqual(minimized.requests.find(r=>r.owner==='0007'&&r.id==='1').receipt,{id:1,identity:'SR-2026-000001',sourceHash:'a'.repeat(64)});
assert(!JSON.stringify(minimized).includes('Unnecessary private text'));
assert(!minimized.issues.some(issue=>issue.owner==='0007'),'valid linkage fields remain equivalent; only unrelated anomalous extras are removed');

// The deployed transfer writer preserves String(original A), including numeric
// requests predating SR identities. This is evidence, not a native SR mapping.
for(const identity of ['2300','0002300']){
 const historical=fixture(),receipt={id:1,identity,sourceHash:'b'.repeat(64)};
 historical.sheets.requests[1].note='SUTI_LOAN_TRANSFER_V1:'+JSON.stringify(receipt);
 const captured=send(historical);await validateHistorySnapshot(captured);
 const ownRequest=captured.requests.find(r=>r.owner==='0007'&&r.id==='1');
 assert.deepEqual(ownRequest.receipt,receipt);
 assert(!captured.issues.some(issue=>issue.owner==='0007'));
 assert.deepEqual(ownRequest,clone(historical.send()).requests.find(r=>r.id==='1'),'numeric receipt matches the unchanged self-reader contract');
}
for(const identity of ['', ' 2300', '2300 ', '-2300', '2300.0', '2300x']){
 const invalid=fixture();invalid.sheets.requests[1].note='SUTI_LOAN_TRANSFER_V1:'+JSON.stringify({id:1,identity,sourceHash:'b'.repeat(64)});
 const captured=send(invalid);assert(captured.issues.some(issue=>issue.owner==='0007'));
 assert.equal(captured.requests.find(r=>r.owner==='0007'&&r.id==='1').receipt,null);
}

const mutations=[
 ['loan amount',{name:'requests',method:'getNotes'},api=>{api.sheets.loans[1].values[1]=999;}],
 ['loan display',{name:'requests',method:'getNotes'},api=>{api.sheets.loans[1].display[23]='LIQUIDADO';}],
 ['owner',{name:'requests',method:'getNotes'},api=>{api.sheets.loans[1].display[3]='OTHER';}],
 ['loan header',{name:'requests',method:'getNotes'},api=>{api.sheets.loans[0].display[3]='Wrong';}],
 ['request value',{name:'requests',method:'getNotes'},api=>{api.sheets.requests[1].values[7]=999;}],
 ['request note',{name:'requests',method:'getNotes'},api=>{api.sheets.requests[1].note+='\nChanged';}],
 ['row movement',{name:'requests',method:'getNotes'},api=>{[api.sheets.loans[1],api.sheets.loans[3]]=[api.sheets.loans[3],api.sheets.loans[1]];}],
 ['loan appended',{name:'requests',method:'getNotes'},api=>{api.sheets.loans.push(api.sheets.loans[8]);}],
 ['request removed',{name:'requests',method:'getNotes'},api=>{api.sheets.requests.pop();}],
 ['cross-sheet note while loans rechecked',{name:'loans',method:'getValues',second:true},api=>{api.sheets.requests[1].note+='\nChanged late';}]
];
for(const [name,condition,mutate] of mutations){
 let hits=0,fired=false;
 const gas=fixture({onRead:(event,api)=>{if(event.name===condition.name&&event.method===condition.method){hits++;if(!fired&&(!condition.second||hits===2)){fired=true;mutate(api);}}}});
 const result=send(gas);assert.equal(result.ok,false,name);assert(['HISTORY_SNAPSHOT_SOURCE_CHANGED','HISTORY_SNAPSHOT_SOURCE_INVALID'].includes(result.error),name);assert(fired);assert.equal(gas.state.writes,0);
}
for(const sheet of ['loans','requests'])assert.equal(send(fixture({badSheet:sheet})).error,'HISTORY_SNAPSHOT_SOURCE_INVALID');

const stable=fixture(),before=send(stable),unchanged=send(stable);
assert.equal(before.fingerprints.content,unchanged.fingerprints.content,'observation timestamp does not cause financial rewrites');
const oldGroups=await groupHistorySnapshot(before);stable.sheets.loans.splice(3,1);
const removed=send(stable),newGroups=await groupHistorySnapshot(removed);
assert.equal(removed.loans.length,before.loans.length-1);assert(!newGroups.some(g=>g.folio==='7'),'complete manifest removes owners no longer in either source');
assert(oldGroups.some(g=>g.folio==='7'));assert.notEqual(removed.fingerprints.content,before.fingerprints.content);

for(const tamper of [s=>{s.loans[0].owner='WRONG';},s=>{s.counts.loan_rows++;},s=>{s.fingerprints.content='0'.repeat(64);},s=>{s.loan_sheet_id=0;},
 s=>{s.requests[0].name='Not permitted';},s=>{s.issues[0].note='Not permitted';},s=>{s.loans[0].principal={value:1};},s=>{s.loans[0].source_row=s.loans[1].source_row;}]){
 const corrupted=clone(snapshot);tamper(corrupted);await assert.rejects(validateHistorySnapshot(corrupted),/HISTORY_SNAPSHOT_/);
}

const envValues={GOOGLE_REQUEST_SYNC_OAUTH_CLIENT_ID:'fixture-client',GOOGLE_REQUEST_SYNC_OAUTH_CLIENT_SECRET:'fixture-client-secret',
 GOOGLE_REQUEST_SYNC_OAUTH_REFRESH_TOKEN:'fixture-refresh',FINANCIAL_LEGACY_API_URL:'https://fixture.invalid/private-gas',FINANCIAL_LEGACY_API_TOKEN:payload.secret};
const env=name=>envValues[name];
function transport(options={}){
 const calls=[];
 const fetcher=async(url,init)=>{
  calls.push(url);assert.equal(init.method,'POST');
  if(calls.length===1){assert.equal(url,'https://oauth2.googleapis.com/token');assert.equal(init.body.get('scope'),'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/script.webapp.deploy');
   return {ok:!options.oauthFailure,json:async()=>options.oauthFailure?{error:'private upstream detail'}:{access_token:'fixture-access'}};}
  assert.equal(url,envValues.FINANCIAL_LEGACY_API_URL);assert.equal(init.headers.Authorization,'Bearer fixture-access');
  assert.deepEqual(JSON.parse(init.body),input);
  return {ok:!options.sourceFailure,json:async()=>options.data??snapshot};
 };
 return {fetcher,calls};
}
const normal=transport();assert.deepEqual(await readHistorySnapshotSource(env,normal.fetcher),snapshot);assert.equal(normal.calls.length,2);
for(const options of [{oauthFailure:true},{sourceFailure:true},{data:{ok:false,error:'HISTORY_SNAPSHOT_SOURCE_CHANGED'}}]){
 const test=transport(options);await assert.rejects(readHistorySnapshotSource(env,test.fetcher),error=>/^HISTORY_SNAPSHOT_/.test(error.message)&&!error.message.includes('private'));assert(test.calls.length<=2,'no retries or fallback');
}
let used=false;await assert.rejects(readHistorySnapshotSource(()=>'',()=>{used=true;throw Error();}),/HISTORY_SNAPSHOT_SOURCE_UNAVAILABLE/);assert.equal(used,false);

console.log(JSON.stringify({status:'PASS',fixtureRows:{loans:snapshot.counts.loan_rows,requests:snapshot.counts.request_rows},
 snapshotReadCalls:representative.metrics().calls-42,groupCount:groups.length,unaddressableOwnerRows:specialSnapshot.counts.unaddressable_owner_rows,
 checks:['same per-owner typed projection as actual self reader','both fixed sheets','whole-source raw/display/note recheck','cross-sheet mutation detection','exact zero/blank/whitespace owners preserved',
 'incomplete historical values preserved','bad receipt isolated to group issues','valid other owners still project','complete deletion manifest','fingerprints and coverage counts verified',
 'unchanged legacy readers/writers/manifest','no PII names or private document fields in response','worker transport has no client selectors or fallback'],
 liveReads:0,SheetWrites:0},null,2));
