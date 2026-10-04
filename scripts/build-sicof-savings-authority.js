'use strict';
// Isolated candidate; leaves the root's older, unrelated bundle untouched.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),vm=require('vm'),crypto=require('crypto'),cp=require('child_process');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const base=path.join(root,'.tmp/sicof-evidence-integration/candidate'),out=path.join(root,'.tmp/sicof-savings-authority/candidate');
const original=fs.readFileSync(path.join(base,'app/bundle.js'),'utf8');
assert.equal(sha(original),'813c606d88591df084b18cb95a93982b0bc6e408b015641cc3f0efe9796d3226');
const chunks=original.split(/(?=\/\* @@file )/).filter(Boolean).map(bytes=>({name:bytes.match(/^\/\* @@file (.*?) \*\//)?.[1],bytes}));
const targets=['sicof-simulation-client.js','sicof-admin.jsx'];
for(const target of targets)assert.equal(chunks.filter(c=>c.name===target).length,1);
const client=fs.readFileSync(path.join(root,'app/sicof-simulation-client.js'),'utf8').replace(/\r\n/g,'\n').trimEnd();
assert(client.includes('sicof-simulation-worker.js?v=2026100402'));
const next=chunks.map(c=>targets.includes(c.name)?{...c,bytes:`/* @@file ${c.name} */\n(function(){\n${fs.readFileSync(path.join(root,'app',c.name),'utf8').replace(/\r\n/g,'\n').trimEnd()}\n})();\n`}:c);
const bundle=next.map(c=>c.bytes).join('');new vm.Script(bundle);
for(let i=0;i<chunks.length;i++)if(!targets.includes(chunks[i].name))assert.equal(next[i].bytes,chunks[i].bytes);
fs.mkdirSync(path.join(out,'app'),{recursive:true});fs.writeFileSync(path.join(out,'app/bundle.js'),bundle);
for(const f of ['SutiApp.html','sw.js']){
 const content=fs.readFileSync(path.join(base,f),'utf8').replaceAll('2026100401','2026100402');fs.writeFileSync(path.join(out,f),content);
}
cp.execFileSync(process.execPath,[path.join(root,'scripts/build-sicof-simulation-worker.js')],{stdio:'pipe'});
fs.copyFileSync(path.join(root,'app/sicof-simulation-worker.js'),path.join(out,'app/sicof-simulation-worker.js'));
const evidence={status:'PASS',baselineSha256:sha(original),bundleSha256:sha(bundle),changedChunks:targets,preservedChunks:chunks.length-targets.length,workerSha256:sha(fs.readFileSync(path.join(out,'app/sicof-simulation-worker.js'))),productionDeployment:false};
const dir=path.join(root,'docs/qa/evidence/sicof-savings-authority');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'build.json'),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));
