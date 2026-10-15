'use strict';
// Compile only this H's focal modules from current source. Preserve every other chunk.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),write=(f,s)=>fs.writeFileSync(path.join(root,f),s);
const names=['admin-affiliates-repository.js','screens-admin-affiliates.jsx'],before=read('app/bundle.js'),sandbox={};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync('C:/tmp/babel-standalone-7.29.0.min.js','utf8'),sandbox);
const pattern=/\/\* @@file ([^\r\n]+) \*\/\r?\n[\s\S]*?(?=\/\* @@file |$)/g,chunks=[...before.matchAll(pattern)];
assert.equal(chunks.map(m=>m[0]).join(''),before);
for(const name of names)assert.equal(chunks.filter(m=>m[1]===name).length,1);
const next=chunks.map(m=>{if(!names.includes(m[1]))return m[0];const source=read('app/'+m[1]).replace(/\r\n/g,'\n'),compiled=m[1].endsWith('.jsx')?sandbox.Babel.transform(source,{presets:['react'],filename:m[1]}).code:source.trimEnd();return `/* @@file ${m[1]} */\n(function(){\n${compiled}\n})();\n`;}).join('');
new vm.Script(next);write('app/bundle.js',next);
const after=[...next.matchAll(pattern)];for(let i=0;i<chunks.length;i++)if(!names.includes(chunks[i][1]))assert.equal(chunks[i][0],after[i][0]);
const html=read('SutiApp.html'),sw=read('sw.js'),versions=[...html.matchAll(/(?:bundle\.js\?v=|sw\.js\?v=)(\d+)/g),...sw.matchAll(/(?:sutiapp-v|bundle\.js\?v=)(\d+)/g)];
const version=Math.max(...versions.map(m=>Number(m[1])))+(next===before?0:1);
const normalize=s=>s.replace(/(app\/bundle\.js\?v=|sw\.js\?v=|sutiapp-v)\d+/g,'$1VERSION');
for(const [file,old] of [['SutiApp.html',html],['sw.js',sw]]){const updated=old.replace(/(app\/bundle\.js\?v=|sw\.js\?v=|sutiapp-v)\d+/g,'$1'+version);assert.equal(normalize(updated),normalize(old));write(file,updated);}
const report={status:'PASS',changedChunks:names,unrelatedChunksPreserved:chunks.length-names.length,workerLogicIdentical:true,version,bundleSha256:crypto.createHash('sha256').update(next).digest('hex'),productionPublished:false};
const dir=path.join(root,'docs/qa/evidence/affiliate-control-change');fs.mkdirSync(dir,{recursive:true});write('docs/qa/evidence/affiliate-control-change/build.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
