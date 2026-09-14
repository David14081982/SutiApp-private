'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),cp=require('child_process'),assert=require('assert/strict'),crypto=require('crypto');
const workspace=path.resolve(__dirname,'..'),root=path.resolve(process.env.SUTIAPP_MODULE_RELEASE_ROOT||path.join(workspace,'tmp/admin-user-modules-release'));
const base=cp.execFileSync('git',['show','origin/main:app/bundle.js'],{cwd:root,maxBuffer:20000000}).toString().replace(/\r\n/g,'\n');
const sandbox={};vm.createContext(sandbox);vm.runInContext(fs.readFileSync(process.env.SUTIAPP_BABEL_PATH||'C:/tmp/babel-standalone-7.29.0.min.js','utf8'),sandbox);
const selected=['admin-repository.js','admin-cutover-repository.js','admin-cutover-store.jsx','screens-admin-access.jsx','section-responsibility.jsx','program-request-repository.js','screens-admin.jsx','app.jsx'];
function compile(source,name){try{return sandbox.Babel.transform(source,{presets:['react'],filename:name}).code;}catch(error){console.error(error.message);process.exit(1);}}
const parts=s=>[...s.matchAll(/\/\* @@file ([^\n]+) \*\/\n([\s\S]*?)(?=\/\* @@file |$)/g)];
const chunks=parts(base),found=[];assert.equal(chunks.length,122);
const next=chunks.map(match=>{const name=match[1];if(!selected.includes(name))return match[0];found.push(name);const source=fs.readFileSync(path.join(root,'app',name),'utf8').replace(/\r\n/g,'\n'),code=name.endsWith('.jsx')?compile(source,name):source.trimEnd();return `/* @@file ${name} */\n(function(){\n${code}\n})();\n`;}).join('');
assert.equal(found.length,8);new vm.Script(next);
const after=Object.fromEntries(parts(next).map(m=>[m[1],m[0]]));let preserved=0;
for(const m of chunks)if(!selected.includes(m[1])){assert.equal(after[m[1]],m[0]);preserved++;}
fs.writeFileSync(path.join(root,'app/bundle.js'),next);
const result={status:'PASS',base:cp.execFileSync('git',['rev-parse','origin/main'],{cwd:root}).toString().trim(),changedChunks:found,preservedChunks:preserved,totalChunks:chunks.length,sha256:crypto.createHash('sha256').update(next).digest('hex')};
fs.writeFileSync(path.join(root,'docs/qa/evidence/admin-user-modules-20260914/release-build.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
