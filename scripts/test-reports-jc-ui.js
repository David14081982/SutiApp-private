'use strict';
// Real repository/component with synthetic responses; every browser network request is denied.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
async function repositoryChecks(){
 const actor='synthetic-admin',affiliate='synthetic-affiliate',session='synthetic-session';
 const auth={phase:'authenticated',session:{user:{id:actor},session_id:session},affiliate:{id:affiliate},impersonation:null};
 const admin={phase:'ready',subjectKey:'synthetic',assignment:{permissions:['program_requests.read','savings.read','savings.reports']}};
 const calls=[];let responder=async()=>({data:{context:{actor,effective_affiliate:affiliate,session},data:{year:2026}}});
 const window={AffiliateAuth:{getState:()=>auth},AdminRepository:{getState:()=>admin},SutiSupabase:{getClient:()=>({functions:{invoke:async(name,options)=>{calls.push({name,options});return responder();}}})}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'app/reports-jc-repository.js'),'utf8'),{window,atob:s=>Buffer.from(s,'base64').toString()});
 assert.equal((await window.ReportsJcRepository.load(2026)).year,2026);assert.equal(calls[0].name,'reports-jc');assert.equal(calls[0].options.body.action,'LOAD');assert.equal(calls[0].options.body.year,2026);
 responder=async()=>({data:{context:{actor:'other-admin',effective_affiliate:affiliate,session},data:{}}});await assert.rejects(window.ReportsJcRepository.load(2026),/CONTEXT_CHANGED/);
 responder=async()=>({data:{context:{actor,effective_affiliate:'other-affiliate',session},data:{}}});await assert.rejects(window.ReportsJcRepository.template(),/CONTEXT_CHANGED/);
 responder=async()=>({data:{context:{actor,effective_affiliate:affiliate,session:'new-session'},data:{}}});await assert.rejects(window.ReportsJcRepository.template(),/CONTEXT_CHANGED/);
 responder=async()=>{admin.assignment={permissions:[]};return {data:{context:{actor,effective_affiliate:affiliate,session},data:{year:2026}}};};await assert.rejects(window.ReportsJcRepository.load(2026),/CONTEXT_CHANGED/);
 responder=async()=>({error:{context:{clone:()=>({json:async()=>({error:'GOOGLE_ACCESS_DENIED'})})}}});await assert.rejects(window.ReportsJcRepository.load(2026),/GOOGLE_ACCESS_DENIED/);
 auth.phase='signed_out';const count=calls.length;await assert.rejects(window.ReportsJcRepository.load(2026),/AUTH_REQUIRED/);assert.equal(calls.length,count);
 assert(!fs.readFileSync(path.join(root,'app/reports-jc-repository.js'),'utf8').includes('localStorage'));
 return {actorSessionAffiliateMatch:true,revocationDuringLoad:true,sourceErrorVisible:true,noSignedOutNetwork:true};
}
(async()=>{const repository=await repositoryChecks();console.log(JSON.stringify({status:'PASS',repository,productionWrites:0,networkRequests:0,fixtures:'synthetic only'}));})().catch(error=>{console.error(error.stack);process.exitCode=1;});
