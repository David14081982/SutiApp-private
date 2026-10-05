'use strict';
// Rebuild only the authorized screen from the current workspace, preserving other work.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),write=(f,s)=>fs.writeFileSync(path.join(root,f),s);
const name='screens-admin-affiliates.jsx',before=read('.tmp/affiliates-demographics/before/app/bundle.js');
const sandbox={};vm.createContext(sandbox);vm.runInContext(fs.readFileSync('C:/tmp/babel-standalone-7.29.0.min.js','utf8'),sandbox);
const compiled=sandbox.Babel.transform(read('app/'+name),{presets:['react'],filename:name}).code;
const pattern=/\/\* @@file ([^\r\n]+) \*\/\r?\n[\s\S]*?(?=\/\* @@file |$)/g;
const chunks=[...before.matchAll(pattern)];assert.equal(chunks.map(m=>m[0]).join(''),before);
assert.equal(chunks.filter(m=>m[1]===name).length,1);
const next=chunks.map(m=>m[1]===name?`/* @@file ${name} */\n(function(){\n${compiled}\n})();\n`:m[0]).join('');
new vm.Script(next);write('app/bundle.js',next);
const after=[...next.matchAll(pattern)];assert.equal(after.length,chunks.length);
for(let i=0;i<chunks.length;i++)if(chunks[i][1]!==name)assert.equal(after[i][0],chunks[i][0]);
const html=read('.tmp/affiliates-demographics/before/SutiApp.html'),sw=read('.tmp/affiliates-demographics/before/sw.js');
const matches=[...html.matchAll(/(?:bundle\.js\?v=|sw\.js\?v=)(\d+)/g),...sw.matchAll(/(?:sutiapp-v|bundle\.js\?v=)(\d+)/g)];
assert(matches.length);const version=Math.max(...matches.map(m=>Number(m[1])))+1;
const normalize=s=>s.replace(/(app\/bundle\.js\?v=|sw\.js\?v=|sutiapp-v)\d+/g,'$1VERSION');
for(const [file,old] of [['SutiApp.html',html],['sw.js',sw]]){
 const updated=old.replace(/(app\/bundle\.js\?v=|sw\.js\?v=|sutiapp-v)\d+/g,'$1'+version);
 assert.equal(normalize(updated),normalize(old));write(file,updated);
}
const report={status:'PASS',changedChunks:[name],unrelatedChunksPreserved:chunks.length-1,workerLogicIdentical:true,version,bundleSha256:crypto.createHash('sha256').update(next).digest('hex'),productionPublished:false};
write('docs/qa/evidence/affiliates-demographics/build.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
