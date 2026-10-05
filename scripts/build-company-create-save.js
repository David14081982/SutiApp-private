'use strict';
// Replace the focal chunk, preserving concurrent work byte-for-byte.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const read=f=>fs.readFileSync(f,'utf8'),name='screens-admin-visual-crud.jsx';
const before=read('app/bundle.js'),sandbox={};vm.createContext(sandbox);vm.runInContext(read('C:/tmp/babel-standalone-7.29.0.min.js'),sandbox);
const compiled=sandbox.Babel.transform(read('app/'+name),{presets:['react'],filename:name}).code;
const pattern=/\/\* @@file ([^\r\n]+) \*\/\r?\n[\s\S]*?(?=\/\* @@file |$)/g,chunks=[...before.matchAll(pattern)];
assert.equal(chunks.map(m=>m[0]).join(''),before);assert.equal(chunks.filter(m=>m[1]===name).length,1);
const next=chunks.map(m=>m[1]===name?`/* @@file ${name} */\n(function(){\n${compiled}\n})();\n`:m[0]).join('');new vm.Script(next);
const after=[...next.matchAll(pattern)];for(let i=0;i<chunks.length;i++)if(chunks[i][1]!==name)assert.equal(after[i][0],chunks[i][0]);
fs.writeFileSync('app/bundle.js',next);
const html=read('SutiApp.html'),sw=read('sw.js'),version=Math.max(...[...html.matchAll(/(?:bundle\.js\?v=|sw\.js\?v=)(\d+)/g),...sw.matchAll(/(?:sutiapp-v|bundle\.js\?v=)(\d+)/g)].map(m=>Number(m[1])))+1;
const normalize=s=>s.replace(/(app\/bundle\.js\?v=|sw\.js\?v=|sutiapp-v)\d+/g,'$1VERSION');
for(const[file,old]of[['SutiApp.html',html],['sw.js',sw]]){const updated=old.replace(/(app\/bundle\.js\?v=|sw\.js\?v=|sutiapp-v)\d+/g,'$1'+version);assert.equal(normalize(updated),normalize(old));fs.writeFileSync(file,updated);}
const result={status:'PASS',changedChunks:[name],unrelatedChunksPreserved:chunks.length-1,workerLogicIdentical:true,version,bundleSha256:crypto.createHash('sha256').update(next).digest('hex'),productionPublished:false};
fs.mkdirSync('docs/qa/evidence/company-create-save',{recursive:true});fs.writeFileSync('docs/qa/evidence/company-create-save/build.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
