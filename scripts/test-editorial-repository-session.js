'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
async function main(){
 const microtasks=[],requests=[],listeners={auth:[],admin:[]};let user='A',assignment={fullAccess:true,permissions:['content.read','content.write']};
 const window={addEventListener(){},AdminRepository:{getState:()=>({assignment}),subscribe:fn=>{listeners.admin.push(fn);fn();}},SutiSupabase:{getClient:()=>({rpc:(name,p)=>new Promise(resolve=>requests.push({name,p,resolve}))})}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'app/editorial-repository.js'),'utf8'),{window,queueMicrotask:fn=>microtasks.push(fn),console,Map,Set,JSON});
 assert.equal(listeners.auth.length,0);
 window.AffiliateAuth={getState:()=>({session:{user:{id:user}}}),subscribe:fn=>{listeners.auth.push(fn);fn();}};
 microtasks.forEach(fn=>fn());assert.equal(listeners.auth.length,1);
 const R=window.EditorialRepository,old=R.load('home',true);
 user='B';listeners.auth.forEach(fn=>fn());assert.equal(R.snapshot('home',true).phase,'idle');
 const current=R.load('home',true);requests[1].resolve({data:{screen:'home',version:2,nodes:[{id:'B'}],editableTypes:['section']}});await current;
 requests[0].resolve({data:{screen:'home',version:1,nodes:[{id:'A'}],editableTypes:['section']}});await old;
 assert.equal(R.snapshot('home',true).nodes[0].id,'B','late previous-account response must not replace current data');
 const pending=R.load('home',true,true);assignment=null;listeners.admin.forEach(fn=>fn());
 requests[2].resolve({data:{screen:'home',version:2,nodes:[{id:'B'}]}});await pending;
 assert.equal(R.snapshot('home',true).phase,'idle','revocation clears snapshots and rejects pending responses');
 const failure=R.load('home',true);requests[3].resolve({error:{message:'EDITORIAL_ADMIN_DENIED'}});await assert.rejects(()=>failure);
 assert.equal(R.snapshot('home',true).phase,'error');assert.equal(R.snapshot('home',true).nodes.length,0);
 assert.equal(R.snapshot('home',false).phase,'idle','public and admin projections are separate');
 const proof={status:'PASS',network:false,checks:['Auth defined after repository still subscribed','account switch clears data','late response cannot resurrect previous account','revocation clears in-flight and cached data','authority error visible without fallback','public/admin cache separation']};
 fs.writeFileSync(path.join(root,'docs/qa/evidence/screen-permission-fix-20260924/editorial-session.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
