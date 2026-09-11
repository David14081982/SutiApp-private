'use strict';
// Focal generated artifact: preserve all other compiled modules and SW behavior.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert').strict;
const crypto=require('crypto'),cp=require('child_process');
const root=path.resolve(__dirname,'..'),privateDir=process.env.SUTIAPP_PUSH_BUILD_DIR||'C:/tmp/sutiapp-push-persistence-fix-20260911';
const out=path.join(root,'docs/qa/evidence/request-push-persistence-fix-20260911');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
async function main(){
  const read=f=>fs.readFileSync(path.join(root,f),'utf8');
  const bundle=read('app/bundle.js'),source=read('app/request-push.js').replace(/\r\n/g,'\n').trimEnd();
  const marker='/* @@file request-push.js */',start=bundle.indexOf(marker),end=bundle.indexOf('/* @@file ',start+marker.length);
  assert(start>=0&&end>start,'Existing focal module boundary');
  const chunk=marker+'\n(function(){\n'+source+'\n})();\n';
  const result=bundle.slice(0,start)+chunk+bundle.slice(end);new vm.Script(result);
  assert.equal(result.slice(0,start),bundle.slice(0,start));assert.equal(result.slice(start+chunk.length),bundle.slice(end));
  const html=read('SutiApp.html'),worker=read('sw.js');
  const remote=await fetch('https://sutiapp.com/SutiApp.html',{signal:AbortSignal.timeout(20000)});assert(remote.ok);
  const published=await remote.text();
  const version=Math.max(...[html,worker,published].map(s=>Number(s.match(/app\/bundle\.js\?v=(\d+)/)[1])))+1;
  const cache=Math.max(Number(worker.match(/sutiapp-v(\d+)/)[1]),Number(published.match(/sw\.js\?v=(\d+)/)[1]))+1;
  const nextHtml=html.replace(/app\/bundle\.js\?v=\d+/g,'app/bundle.js?v='+version).replace(/sw\.js\?v=\d+/g,'sw.js?v='+cache);
  const nextWorker=worker.replace(/app\/bundle\.js\?v=\d+/g,'app/bundle.js?v='+version).replace(/sutiapp-v\d+/,'sutiapp-v'+cache);
  const normalizeWorker=s=>s.replace(/app\/bundle\.js\?v=\d+/g,'app/bundle.js?v=VERSION').replace(/sutiapp-v\d+/,'sutiapp-vVERSION');
  assert.equal(normalizeWorker(nextWorker),normalizeWorker(worker));new vm.Script(nextWorker);
  fs.writeFileSync(path.join(root,'app/bundle.js'),result);fs.writeFileSync(path.join(root,'SutiApp.html'),nextHtml);fs.writeFileSync(path.join(root,'sw.js'),nextWorker);
  const env={};for(const line of read('supabase.env').replace(/^\uFEFF/,'').split(/\r?\n/)){const at=line.indexOf('=');if(at>0&&!line.startsWith('#'))env[line.slice(0,at).trim()]=line.slice(at+1).trim().replace(/^['"]|['"]$/g,'');}
  const site=path.join(privateDir,'site-'+version);
  cp.execFileSync(process.execPath,['scripts/build-pages-site.js',site],{cwd:root,env:{...process.env,SUTIAPP_SUPABASE_URL:env.SUPABASE_URL,SUTIAPP_SUPABASE_PUBLISHABLE_KEY:env.SUPABASE_PUBLISHABLE_KEY},stdio:'pipe'});
  const proof={status:'PASS',builtAt:new Date().toISOString(),sourceSha256:sha(source),bundleSha256:sha(result),unrelatedModulesIdentical:true,swLogicIdentical:true,bundleVersion:version,workerVersion:cache,site,productionDeployed:false};
  fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'build.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
