'use strict';
// Preserve every unrelated released chunk; compile only the authorized screen.
const fs=require('fs'),path=require('path'),vm=require('vm'),cp=require('child_process'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),name='screens-admin-affiliates.jsx';
const base=cp.execFileSync('git',['show','HEAD:app/bundle.js'],{cwd:root,maxBuffer:20000000}).toString().replace(/\r\n/g,'\n');
const sandbox={};vm.createContext(sandbox);vm.runInContext(fs.readFileSync('C:/tmp/babel-standalone-7.29.0.min.js','utf8'),sandbox);
const source=fs.readFileSync(path.join(root,'app',name),'utf8').replace(/\r\n/g,'\n');
const code=sandbox.Babel.transform(source,{presets:['react'],filename:name}).code;
const chunks=[...base.matchAll(/\/\* @@file ([^\n]+) \*\/\n([\s\S]*?)(?=\/\* @@file |$)/g)];assert.equal(chunks.filter(m=>m[1]===name).length,1);
const next=chunks.map(m=>m[1]===name?`/* @@file ${name} */\n(function(){\n${code}\n})();\n`:m[0]).join('');assert.equal(chunks.map(m=>m[0]).join(''),base);new vm.Script(next);
fs.writeFileSync(path.join(root,'app/bundle.js'),next);
const result={status:'PASS',changedChunks:[name],preservedChunks:chunks.length-1,totalChunks:chunks.length,bundleSha256:crypto.createHash('sha256').update(next).digest('hex')};
fs.writeFileSync(path.join(root,'docs/qa/evidence/affiliates-optional-reason-20260924/build.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
