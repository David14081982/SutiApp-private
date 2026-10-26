'use strict';
// Only the three reviewed chunks are regenerated; unrelated work is preserved.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto'),cp=require('child_process');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'.tmp/history-read-efficiency'),release=path.join(dir,'release'),out=path.join(root,'docs/qa/evidence/history-read-efficiency');
const read=f=>fs.readFileSync(path.join(root,f),'utf8'),sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const focal=['history-loans-repository.js','history-loans.jsx','operations-store.jsx'];
const files=focal.map(n=>'app/'+n).concat(['supabase/functions/loan-history/history.mjs','google-apps-script/financial-handoff/Code.gs',
 'scripts/test-history-efficiency-backend.js','scripts/test-history-efficiency-receiver.js','scripts/test-history-efficiency-browser.js',
 'scripts/test-loan-history.js','scripts/test-loan-history-receiver.js','scripts/test-loan-history-browser.js',
 'scripts/package-history-efficiency.js','scripts/release-history-efficiency.js','scripts/verify-history-efficiency-live.js','docs/audits/H-HISTORY-READ-EFFICIENCY-001.md','docs/SECURITY_RULES.md']);
const context={};vm.createContext(context);vm.runInContext(fs.readFileSync('C:/tmp/sutiapp-babel-7.28.4.min.js','utf8'),context);
const chunks=s=>new Map([...s.replace(/\r/g,'').matchAll(/\/\* @@file (.*?) \*\/\n([\s\S]*?)(?=\/\* @@file |$)/g)].map(m=>[m[1],m[2]]));
function patchBundle(original){
 let s=original.replace(/\r/g,'');const before=chunks(s);
 for(const name of focal){assert(before.has(name));const source=read('app/'+name).replace(/\r/g,''),code=name.endsWith('.jsx')?context.Babel.transform(source,{presets:['react'],filename:name}).code:source.trimEnd();
  s=s.replace(new RegExp('/\\* @@file '+name.replaceAll('.','\\.')+' \\*/\\n[\\s\\S]*?(?=/\\* @@file |$)'),()=>`/* @@file ${name} */\n(function(){\n${code}\n})();\n`);}
 const after=chunks(s);assert.equal(before.size,after.size);assert([...after].every(([name,value])=>focal.includes(name)||before.get(name)===value));new vm.Script(s);return s;
}
fs.mkdirSync(out,{recursive:true});
if(process.argv[2]==='build'){
 const {environment}=require('./inspect-loan-history'),e=environment(),target=path.join(dir,'site');
 const result=cp.spawnSync(process.execPath,[path.join(release,'scripts/build-pages-site.js'),target],{cwd:release,env:{...process.env,SUTIAPP_SUPABASE_URL:e.SUPABASE_URL,SUTIAPP_SUPABASE_PUBLISHABLE_KEY:e.SUPABASE_PUBLISHABLE_KEY},encoding:'utf8',windowsHide:true});
 fs.writeFileSync(path.join(dir,'build-private.log'),(result.stdout||'')+(result.stderr||''));assert.equal(result.status,0,'PAGES_BUILD_FAILED');
 const bundleSha256=sha(fs.readFileSync(path.join(target,'app/bundle.js')));assert.equal(bundleSha256,sha(fs.readFileSync(path.join(release,'app/bundle.js'))));
 const proof={status:'PASS',bundleSha256,focalChunks:focal,otherChunksUnchanged:true};fs.writeFileSync(path.join(out,'build.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
}else{
 for(const n of focal.concat(['google-apps-script/financial-handoff/Code.gs','supabase/functions/loan-history/history.mjs'])){
  const file=n.includes('/')?n:'app/'+n,base=path.join(dir,'before',file.replaceAll('/','__'));
  const current=fs.readFileSync(path.join(release,file),'utf8').replace(/\r/g,'');
  assert(current===fs.readFileSync(base,'utf8').replace(/\r/g,'')||current===read(file).replace(/\r/g,''),'RELEASE_BASE_DRIFT_'+file);
 }
 for(const base of [root,release]){
  const file=path.join(base,'app/bundle.js');fs.writeFileSync(file,patchBundle(fs.readFileSync(file,'utf8')));
  for(const name of ['SutiApp.html','sw.js']){const file=path.join(base,name),source=fs.readFileSync(file,'utf8');fs.writeFileSync(file,source.replace(/app\/bundle\.js\?v=\d+/g,'app/bundle.js?v=2026102507').replace(/sutiapp-v\d+/g,'sutiapp-v2026102507'));}
 }
 for(const file of files){const target=path.join(release,file);fs.mkdirSync(path.dirname(target),{recursive:true});
  if(file==='docs/SECURITY_RULES.md'){
   const marker='### H-HISTORY-READ-EFFICIENCY-001',section=read(file).slice(read(file).indexOf(marker));assert(section.startsWith(marker));
   const prior=fs.readFileSync(target,'utf8'),at=prior.indexOf(marker);fs.writeFileSync(target,(at<0?prior:prior.slice(0,at)).trimEnd()+'\n\n'+section);
  }else fs.copyFileSync(path.join(root,file),target);
 }
 const manifest={status:'PASS',phase:'CANDIDATE',focalChunks:focal,files:files.concat(['app/bundle.js','SutiApp.html','sw.js']).map(file=>({file,sha256:sha(fs.readFileSync(path.join(release,file)))}))};
 fs.writeFileSync(path.join(out,'candidate.json'),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({status:'PASS',files:manifest.files.length,otherChunksUnchanged:true}));
}
