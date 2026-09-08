'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert').strict,path=require('path');
const root=path.resolve(__dirname,'..');
const tests=[];
function harness(){
 const authListeners=new Set(),adminListeners=new Set();let version='v1',failure=null,hold=null;
 let auth={phase:'authenticated',session:{user:{id:'actor-a'},session_id:'session-a'},affiliate:{id:'affiliate-a'},impersonation:null};
 let admin={phase:'denied',assignment:null};const calls=[];
 const payload=()=>({schema_version:'SAVINGS_USER_LIVE_READONLY_V1',participant:{id:'participant-'+auth.affiliate.id},balances:{total:version==='v1'?100:200,capital:80,yield:20},history:[{id:'movement',amount:10}],annual:[],upcoming:[],withdrawals:[],actions:{JOIN:false},write_capabilities:{requests:false,beneficiaries:false}});
 const rpc=async(name,params)=>{
  calls.push({name,params:JSON.parse(JSON.stringify(params||{}))});
  const context={actor_auth_user_id:auth.session?.user.id,effective_affiliate_id:auth.affiliate?.id,actor_session_id:auth.session?.session_id,impersonation_id:auth.impersonation?.session_id||null};
  const data=payload(),selectedVersion=version;
  if(hold){const wait=hold;hold=null;await wait.promise;}
  if(failure){const error=failure;failure=null;return{error};}
  if(name==='get_self_savings_if_changed')return{data:{version:selectedVersion,modified:params.p_known_version!==selectedVersion,cacheable:true,context,...(params.p_known_version===selectedVersion?{}:{data})}};
  return {data:{ok:true,participant:{id:'admin-participant'}}};
 };
 const window={SutiSupabase:{getClient:()=>({rpc})},AffiliateAuth:{getState:()=>auth,subscribe:fn=>{authListeners.add(fn);return()=>authListeners.delete(fn);}},AdminRepository:{getState:()=>admin,subscribe:fn=>{adminListeners.add(fn);return()=>adminListeners.delete(fn);}}};
 const context=vm.createContext({window,React:{useEffect:()=>{},useState:()=>[0,()=>{}]},crypto:{randomUUID:()=> 'isolated-action'},Intl,atob:s=>Buffer.from(s,'base64').toString(),Object,Promise,Set,Error,JSON});
 for(const f of ['app/savings-repository.js','app/savings-store.jsx'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),context,{filename:f});
 return {window,calls,setVersion:v=>{version=v;},fail:e=>{failure=e;},defer:()=>{let resolve;const promise=new Promise(r=>{resolve=r;});hold={promise,resolve};return resolve;},setAuth:patch=>{auth={...auth,...patch};authListeners.forEach(f=>f(auth));},setAdmin:value=>{admin=value;adminListeners.forEach(f=>f(admin));},getAuth:()=>auth};
}
async function test(name,fn){await fn();tests.push({name,status:'PASS'});}
(async()=>{
 await test('cold and sequential reuse require backend validation',async()=>{const h=harness(),r=h.window.SavingsRepository;const a=await r.getSelfDashboard(),b=await r.getSelfDashboard();assert.equal(a,b);assert(Object.isFrozen(b.history[0]));assert.equal(h.calls.length,2);assert.equal(h.calls[0].params.p_known_version,null);assert.equal(h.calls[1].params.p_known_version,'v1');});
 await test('simultaneous readers share one request',async()=>{const h=harness(),r=h.window.SavingsRepository;const [a,b]=await Promise.all([r.getSelfDashboard(),r.getSelfDashboard()]);assert.equal(a,b);assert.equal(h.calls.length,1);});
 await test('changed underlying version refreshes complete projection',async()=>{const h=harness(),r=h.window.SavingsRepository;await r.getSelfDashboard();h.setVersion('v2');const b=await r.getSelfDashboard();assert.equal(b.balances.total,200);assert.equal(b.history[0].amount,10);});
 await test('force refresh discards cached version',async()=>{const h=harness(),r=h.window.SavingsRepository;await r.getSelfDashboard();await r.getSelfDashboard({force:true});assert.equal(h.calls.at(-1).params.p_known_version,null);});
 await test('network/permission error clears cache without fallback',async()=>{const h=harness(),r=h.window.SavingsRepository;await r.getSelfDashboard();h.fail({code:'42501',message:'denied'});await assert.rejects(r.getSelfDashboard(),e=>e.code==='42501');await r.getSelfDashboard();assert.equal(h.calls.at(-1).params.p_known_version,null);});
 await test('store initial load and validated navigation remain ready',async()=>{const h=harness(),s=h.window.savingsStore;await s.loadSelf();assert.equal(s.state().selfPhase,'ready');const first=s.state().self;await s.loadSelf();assert.equal(s.state().self,first);assert.equal(h.calls.at(-1).params.p_known_version,'v1');});
 await test('store failures are visible and contain no prior financial data',async()=>{const h=harness(),s=h.window.savingsStore;await s.loadSelf();h.fail({code:'NETWORK_ERROR'});await assert.rejects(s.loadSelf());assert.equal(s.state().selfPhase,'error');assert.equal(s.state().self,null);});
 await test('logout clears both self/admin financial state and rejects reuse',async()=>{const h=harness(),s=h.window.savingsStore;await s.loadSelf();await s.loadAdmin();h.setAuth({phase:'signing_out'});assert.equal(s.state().self,null);assert.equal(s.state().admin,null);await assert.rejects(h.window.SavingsRepository.getSelfDashboard(),e=>e.code==='42501');});
 for(const [name,patch]of [['actor',{session:{user:{id:'actor-b'},session_id:'session-b'},affiliate:{id:'affiliate-b'}}],['session',{session:{user:{id:'actor-a'},session_id:'session-new'}}],['affiliate',{affiliate:{id:'affiliate-b'}}],['impersonation',{impersonation:{session_id:'imp-1'}}]]){
  await test(name+' change invalidates memory',async()=>{const h=harness(),s=h.window.savingsStore;await s.loadSelf();h.setAuth(patch);assert.equal(s.state().self,null);await s.loadSelf();assert.equal(s.state().selfPhase,'ready');assert.equal(h.calls.at(-1).params.p_known_version,null);});
 }
 await test('administrative context change invalidates reuse',async()=>{const h=harness(),s=h.window.savingsStore;await s.loadSelf();h.setAdmin({phase:'authorized',assignment:{permissions:['savings.read']}});assert.equal(s.state().self,null);await s.loadSelf();assert.equal(h.calls.at(-1).params.p_known_version,null);});
 await test('late response from a former session cannot restore data',async()=>{const h=harness(),s=h.window.savingsStore;const release=h.defer(),old=s.loadSelf();await Promise.resolve();h.setAuth({session:{user:{id:'actor-b'},session_id:'session-b'},affiliate:{id:'affiliate-b'}});release();await old;assert.equal(s.state().self,null);await s.loadSelf();assert.equal(s.state().self.participant.id,'participant-affiliate-b');});
 await test('forced read supersedes an older in-flight response',async()=>{const h=harness(),s=h.window.savingsStore;await s.loadSelf();const release=h.defer(),old=s.loadSelf();await Promise.resolve();h.setVersion('v2');const current=s.loadSelf(true);release();await Promise.all([old,current]);assert.equal(s.state().selfPhase,'ready');assert.equal(s.state().self.balances.total,200);});
 await test('successful savings write invalidates before and after',async()=>{const h=harness(),r=h.window.SavingsRepository,s=h.window.savingsStore;await s.loadSelf();await r.replaceBeneficiaries([], 'action');assert.equal(s.state().self,null);await s.loadSelf();assert.equal(h.calls.at(-1).params.p_known_version,null);});
 await test('uncertain failed write also invalidates cached projection',async()=>{const h=harness(),r=h.window.SavingsRepository;await r.getSelfDashboard();h.fail({code:'NETWORK_ERROR'});await assert.rejects(r.releaseHold('hold','reason'));await r.getSelfDashboard();assert.equal(h.calls.at(-1).params.p_known_version,null);});
 await test('read-only admin operation does not invalidate self projection',async()=>{const h=harness(),r=h.window.SavingsRepository;await r.getSelfDashboard();await r.getAdminDashboard();await r.getSelfDashboard();assert.equal(h.calls.at(-1).params.p_known_version,'v1');});
 await test('explicit state clear also discards repository cache',async()=>{const h=harness(),s=h.window.savingsStore;await s.loadSelf();s.clearSelf();await s.loadSelf();assert.equal(h.calls.at(-1).params.p_known_version,null);});
 console.log(JSON.stringify({status:'PASS',tests:tests.length,cases:tests,fixtures:'Isolated VM only; no network or real financial writes'}));
})().catch(e=>{console.error(JSON.stringify({status:'FAIL',passed:tests.length,error:e.message,stack:e.stack}));process.exitCode=1;});
