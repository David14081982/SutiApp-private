'use strict';
const fs=require('fs'),cp=require('child_process'),path=require('path'),assert=require('assert').strict,a=require('./audit.cjs');
const release='C:/tmp/sutiapp-h06-release-20260907';
function check(){const r=cp.spawnSync('python',['scripts/generate-architecture-registry.py','check','--json'],{cwd:release,encoding:'utf8',maxBuffer:2000000});return JSON.parse(r.stdout);}
const before=check(),normalised=[];
const allowed=new Set(JSON.parse(fs.readFileSync(a.dir+'/build-local.json')).files.concat('scripts/build-bundle.js','SutiApp.html','sw.js','app/bundle.js'));
for(const file of before.changed){
 if(allowed.has(file)||file.startsWith('docs/qa/evidence/disk-io-remediation/H06/'))continue;
 const old=cp.execFileSync('git',['show','c047eec:'+file],{cwd:release,maxBuffer:20000000}),current=fs.readFileSync(path.join(release,file));
 assert.equal(current.toString('utf8').replace(/\r\n/g,'\n'),old.toString('utf8').replace(/\r\n/g,'\n'),'Unexpected release drift '+file);
 fs.writeFileSync(path.join(release,file),old);normalised.push(file);
}
if(normalised.length)cp.execFileSync('git',['add','--',...normalised],{cwd:release});
assert.equal(cp.execFileSync('git',['diff','--cached','--numstat'],{cwd:release,encoding:'utf8'}).trim(),'','Normalization must stage no changes');
a.save('registry-normalization',{at:new Date().toISOString(),verifiedAgainst:'c047eec',status:'PASS',normalised});
const next=check(),files=[...next.changed,...next.added,...next.removed];
console.log(cp.execFileSync('python',['scripts/generate-architecture-registry.py','incremental',...files],{cwd:release,encoding:'utf8',maxBuffer:1000000}).trim());
console.log(JSON.stringify(check()));
