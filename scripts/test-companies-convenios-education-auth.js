'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert').strict;
const source=fs.readFileSync('app/affiliate-auth.js','utf8');
function harness({company=true,rpcError=false,explicit=true}={}){
 let session=null,signouts=0;const calls=[];
 const client={auth:{signInWithPassword:async()=>{session={user:{id:'qa-company-auth',email:'qa@example.test'}};return {data:{session},error:null};},signOut:async()=>{signouts++;session=null;return {error:null};},getSession:async()=>({data:{session}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},rpc:async name=>{calls.push(name);if(name==='get_admin_access_context')return {data:{section_actions:[]}};if(name==='get_current_company_access')return rpcError?{error:{code:'PGRST202'}}:{data:company?[{company_id:'qa-company-a',role:'owner'}]:[]};throw Error(name);}};
 const window={location:{href:'https://example.test/'+(explicit?'?company_portal=1':''),origin:'https://example.test',pathname:'/'},SutiSupabase:{getClient:()=>client},AdminRepository:{clearAccessContext(){},primeAccessContext(){}},AffiliateRepository:{clearProfilePhotoCache(){},getCurrentAffiliate:async()=>{throw {code:'AUTH_IDENTITY_WITHOUT_AFFILIATE'};},claimCurrentIdentity:async()=>{throw {code:'SOURCE_ERROR'};}}};
 const context={window,URL,console,setTimeout,clearTimeout,React:{useEffect(){},useState:v=>[v,()=>{}],createElement(){}}};vm.createContext(context);vm.runInContext(source,context);return {auth:window.AffiliateAuth,calls,signouts:()=>signouts};
}
(async()=>{
 for(const explicit of [true,false]){const h=harness({explicit});assert.equal(await h.auth.signIn('qa@example.test','fixture'),true);const s=h.auth.getState();assert.equal(s.companyOnly,true);assert.equal(s.affiliate,null);assert.equal(s.affiliateView,null);assert(!s.adminOnly);assert(h.calls.includes('get_current_company_access'));await h.auth.signOut();assert.equal(h.auth.getState().phase,'unauthenticated');}
 const denied=harness({company:false});assert.equal(await denied.auth.signIn('qa@example.test','fixture'),false);assert.equal(denied.auth.getState().errorCode,'COMPANY_PLAN_ACCESS_REQUIRED');assert.equal(denied.signouts(),1);
 const error=harness({rpcError:true});assert.equal(await error.auth.signIn('qa@example.test','fixture'),false);assert.equal(error.auth.getState().phase,'error');assert(!error.auth.getState().companyOnly);
 console.log(JSON.stringify({status:'PASS',explicitCompanyEntry:true,companyWithoutAffiliate:true,noAdminOrAffiliatePrivileges:true,noPlanDenied:true,backendFailureClosed:true,logout:true}));
})().catch(e=>{console.error(e);process.exitCode=1;});
