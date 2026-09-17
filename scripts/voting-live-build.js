'use strict';
// Rebuilds app/bundle.js from the published bundle, replacing only the voting chunks (all other chunks byte-identical).
const fs=require('fs'),path=require('path'),vm=require('vm'),cp=require('child_process'),crypto=require('crypto'),assert=require('assert/strict');
const arg=(name,fallback)=>(process.argv.find(x=>x.startsWith('--'+name+'='))||'').split('=')[1]||fallback;
const root=path.resolve(__dirname,'..'),out=path.join(root,arg('out','docs/qa/evidence/voting-live-20260916'));
const VERSION=arg('version','voting-live-20260916-001'),EVIDENCE=arg('evidence','build.json');
const git=(...args)=>cp.execFileSync('git',args,{cwd:root,maxBuffer:64*1024*1024}).toString().replace(/\r\n/g,'\n');
const sandbox={};vm.createContext(sandbox);vm.runInContext(fs.readFileSync('C:/tmp/babel-standalone-7.29.0.min.js','utf8'),sandbox);
const chunk=(name,source)=>`/* @@file ${name} */\n(function(){\n${name.endsWith('.jsx')?sandbox.Babel.transform(source,{presets:['react'],filename:name}).code:source.trimEnd()}\n})();\n`;
const parts=s=>[...s.matchAll(/\/\* @@file ([^\n]+) \*\/\n([\s\S]*?)(?=\/\* @@file |$)/g)];
const changed=arg('files','voting-repository.js,screens-voting.jsx').split(',');
const base=git('show','origin/main:app/bundle.js'),chunks=parts(base);
assert(chunks.length>100,'unexpected bundle shape');assert.equal(chunks.map(m=>m[0]).join(''),base,'chunk split must be lossless');
// The compiler must reproduce the published chunks from the published sources before it is trusted with new ones.
for(const name of changed){const published=chunks.find(m=>m[1]===name);assert(published,'missing chunk '+name);assert.equal(chunk(name,git('show','origin/main:app/'+name)),published[0],'compiler drift on '+name);}
const next=chunks.map(m=>changed.includes(m[1])?chunk(m[1],fs.readFileSync(path.join(root,'app',m[1]),'utf8').replace(/\r\n/g,'\n')):m[0]).join('');
new vm.Script(next);
const after=parts(next);assert.equal(after.length,chunks.length);
let preserved=0;for(let i=0;i<chunks.length;i++){assert.equal(after[i][1],chunks[i][1],'order changed');if(!changed.includes(chunks[i][1])){assert.equal(after[i][0],chunks[i][0],'unexpected change in '+chunks[i][1]);preserved++;}}
fs.writeFileSync(path.join(root,'app/bundle.js'),next);
const htmlFile=path.join(root,'SutiApp.html'),html=git('show','origin/main:SutiApp.html'),matches=html.match(/app\/bundle\.js\?v=[^"\s]+/g)||[];
assert.equal(matches.length,1,'expected one bundle cachebuster');
fs.writeFileSync(htmlFile,html.replace(matches[0],'app/bundle.js?v='+VERSION));
const result={status:'PASS',version:VERSION,previousCachebuster:matches[0],changed,preservedChunks:preserved,totalChunks:chunks.length,compilerReproducesPublished:true,sha256:crypto.createHash('sha256').update(next).digest('hex')};
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,EVIDENCE),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
