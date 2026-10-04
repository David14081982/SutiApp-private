'use strict';
// Replace only the two audited SICOF chunks; preserve unrelated local changes.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),vm=require('vm'),crypto=require('crypto'),cp=require('child_process');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const before='.tmp/sicof-evidence-integration/published/';
const candidate=path.join(root,'.tmp/sicof-evidence-integration/candidate');fs.mkdirSync(path.join(candidate,'app'),{recursive:true});
const parse=s=>s.split(/(?=\/\* @@file )/).filter(Boolean).map(bytes=>({name:bytes.match(/^\/\* @@file (.*?) \*\//)?.[1],bytes}));
const normalize=s=>s.replace(/\r\n/g,'\n').trimEnd();
const targets=['sicof-admin.jsx','sicof-simulation-client.js'];
let client=read('app/sicof-simulation-client.js');client=client.replace(/sicof-simulation-worker\.js\?v=\d+/,'sicof-simulation-worker.js?v=2026100401');fs.writeFileSync(path.join(root,'app/sicof-simulation-client.js'),client);
const original=read(before+'bundle.js'),chunks=parse(original);assert(chunks.every(c=>c.name));
for(const name of targets)assert.equal(chunks.filter(c=>c.name===name).length,1,'MISSING_OR_DUPLICATE_CHUNK:'+name);
const next=chunks.map(c=>targets.includes(c.name)?{...c,bytes:`/* @@file ${c.name} */\n(function(){\n${normalize(read('app/'+c.name))}\n})();\n`}:c);
const output=next.map(c=>c.bytes).join('');new vm.Script(output);
for(let i=0;i<chunks.length;i++)if(!targets.includes(chunks[i].name))assert.equal(chunks[i].bytes,next[i].bytes);
fs.writeFileSync(path.join(candidate,'app/bundle.js'),output);
for(const file of ['SutiApp.html','sw.js']){
 let s=read(before+file).replace(/app\/bundle\.js\?v=\d+/g,'app/bundle.js?v=2026100401');
 s=file==='sw.js'?s.replace(/sutiapp-v\d+/,'sutiapp-v2026100401'):s.replace(/sw\.js\?v=\d+/g,'sw.js?v=2026100401');
 fs.writeFileSync(path.join(candidate,file),s);
}
cp.execFileSync(process.execPath,[path.join(root,'scripts/build-sicof-simulation-worker.js')],{stdio:'pipe'});
fs.copyFileSync(path.join(root,'app/sicof-simulation-worker.js'),path.join(candidate,'app/sicof-simulation-worker.js'));
const proof={status:'PASS',baseline:'published v322',baselineSha256:sha(original),candidate:'.tmp/sicof-evidence-integration/candidate',changedChunks:targets,preservedChunks:chunks.length-targets.length,bundleSha256:sha(output),generatedArtifactsOnly:true};
const out=path.join(root,'docs/qa/evidence/sicof-evidence-integration');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'build.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
