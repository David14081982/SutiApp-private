'use strict';
// Focal generated artifacts only; never rebuild or publish unrelated dirty modules.
const fs=require('fs'),path=require('path'),vm=require('vm'),cp=require('child_process'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),release=process.argv.includes('--release');
const task=path.join(root,'.tmp/savings-admin-ux-20261001'),destination=release?path.join(task,'release'):root;
const focal=['savings-panel-admin.jsx','savings-runtime-admin.jsx','savings-panel-reference.jsx','savings-request-form.jsx','savings-panel-repository.js'];
const normalize=s=>s.replace(/\r\n/g,'\n'),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const baseline=f=>release?cp.execFileSync('git',['-C',destination,'show','HEAD:'+f],{maxBuffer:32*1024*1024,encoding:'utf8'}):fs.readFileSync(path.join(task,'before',f),'utf8');
function parse(source){return source.split(/(?=\/\* @@file )/).filter(Boolean).map(bytes=>({name:bytes.match(/^\/\* @@file (.*?) \*\//)[1],bytes}));}
const previous=parse(baseline('app/bundle.js'));
for(const name of focal){
 assert(previous.some(x=>x.name===name),'Missing baseline module '+name);
 if(release)assert.equal(normalize(baseline('app/'+name)).trimEnd(),normalize(read('.tmp/savings-admin-ux-20261001/before/app/'+name)).trimEnd(),'Published source drift '+name);
}
const next=previous.map(entry=>{
 if(!focal.includes(entry.name))return entry.bytes;
 const source=normalize(read('app/'+entry.name)).trimEnd();new vm.Script(source,{filename:entry.name});
 if(release)fs.writeFileSync(path.join(destination,'app',entry.name),source+'\n');
 return `/* @@file ${entry.name} */\n(function(){\n${source}\n})();\n`;
}).join('');
new vm.Script(next,{filename:'app/bundle.js'});
const compiled=parse(next);for(const prior of previous)if(!focal.includes(prior.name))assert.equal(compiled.find(x=>x.name===prior.name).bytes,prior.bytes);
fs.writeFileSync(path.join(destination,'app/bundle.js'),next);
const version=Number(baseline('SutiApp.html').match(/app\/bundle\.js\?v=(\d+)/)[1])+1;
for(const file of ['SutiApp.html','sw.js']){
 let source=baseline(file).replace(/app\/bundle\.js\?v=\d+/g,'app/bundle.js?v='+version);
 source=file==='sw.js'?source.replace(/sutiapp-v(\d+)/,(_,v)=>'sutiapp-v'+(Number(v)+1)):source.replace(/sw\.js\?v=(\d+)/,(_,v)=>'sw.js?v='+(Number(v)+1));
 fs.writeFileSync(path.join(destination,file),source);
}
const proof={status:'PASS',kind:release?'published-baseline-release':'workspace-focal-build',focal,preservedModules:previous.length-focal.length,version,sha256:hash(next),normalizedSha256:hash(normalize(next)),serviceWorkerBehaviorChanged:false};
const out=path.join(root,'docs/qa/evidence/savings-admin-ux-20261001');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,release?'release-build.json':'build.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
