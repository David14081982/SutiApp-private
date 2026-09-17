'use strict';
// Differential test for H-SUTIAPP-BRANDING-SEAL-PHASE-001: runs the published and the fixed visual-content.js through the
// same scenarios. Only branding/brandingPhase may change; content phases and the header authority must stay identical.
const fs=require('fs'),path=require('path'),vm=require('vm'),cp=require('child_process'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/branding-seal-20260917');
const published=cp.execFileSync('git',['show','origin/main:app/visual-content.js'],{cwd:root}).toString();
const fixed=fs.readFileSync(path.join(root,'app/visual-content.js'),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));

function harness(source,fail){
 const header=[],states=[],branding={institutional_seal_url:'seal.png',home_header_collapsed_url:'header.jpg'};
 const result=(key,value)=>fail.includes(key)?Promise.reject(new Error(key)):Promise.resolve(value);
 const window={
  assetsStore:{setAuthoritative:(key,value)=>header.push(key+'='+value.url)},
  BannerRepository:{list:kind=>result(kind,[{id:kind}])},PopupRepository:{listActive:()=>result('popups',[{id:'popup'}])},
  CompaniesRepository:{list:()=>result('companies',[{id:'company'}])},BrandingRepository:{get:()=>result('branding',branding)},
 };
 const context={window};vm.createContext(context);vm.runInContext(source,context);
 window.VisualContent.subscribe(s=>states.push({phase:s.phase,brandingPhase:s.brandingPhase,branding:!!s.branding,homeBanners:s.homeBanners.length,errorCode:s.errorCode}));
 return {api:window.VisualContent,header,states};
}
const scenarios={
 full_load:async h=>{h.api.bootstrap();await flush();},
 login_then_full_load:async h=>{h.api.bootstrapBranding();await flush();h.api.bootstrap();await flush();},
 banners_fail:async h=>{h.api.bootstrap();await flush();},
 login_then_banners_fail:async h=>{h.api.bootstrapBranding();await flush();h.api.bootstrap();await flush();},
 branding_fails:async h=>{h.api.bootstrap();await flush();},
 retry_after_load:async h=>{h.api.bootstrap();await flush();h.api.retry();await flush();},
};
const failures={banners_fail:['home'],login_then_banners_fail:['home'],branding_fails:['branding']};

(async()=>{
 const report={};
 for(const [name,run] of Object.entries(scenarios)){
  const fail=failures[name]||[],before=harness(published,fail),after=harness(fixed,fail);
  await run(before);await run(after);
  const content=h=>h.states.map(s=>[s.phase,s.homeBanners,s.errorCode].join('/'));
  // Content phases, lists and the home header authority are untouched.
  assert.deepEqual(content(after),content(before),name+': content states changed');
  assert.deepEqual(after.header,before.header,name+': header authority changed');
  const last=after.states[after.states.length-1],brandingOk=!fail.includes('branding');
  assert.equal(last.brandingPhase,brandingOk?'loaded':'error',name+': final brandingPhase');
  assert.equal(last.branding,brandingOk,name+': final branding');
  // Once loaded, branding never flashes back to empty/error (retry resets it on purpose, then reloads).
  const firstLoaded=after.states.findIndex(s=>s.brandingPhase==='loaded');
  const retryAt=name==='retry_after_load'?after.states.findIndex((s,i)=>i>firstLoaded&&s.brandingPhase==='loading'):-1;
  if(firstLoaded>=0)after.states.slice(firstLoaded,retryAt>=0?retryAt:undefined).forEach((s,i)=>assert(s.branding&&s.brandingPhase==='loaded',name+': flash at '+(firstLoaded+i)));
  report[name]={published:before.states.at(-1),fixed:last,states:after.states.length,headerCalls:after.header.length};
 }
 // The published file reproduces the production defect this fix removes.
 assert.equal(report.full_load.published.brandingPhase,'error');assert.equal(report.full_load.published.branding,true);
 const result={status:'PASS',scenarios:report,reproducedDefect:'published full_load ends with brandingPhase=error while branding is loaded'};
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'unit.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
