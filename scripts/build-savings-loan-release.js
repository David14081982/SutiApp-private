'use strict';
// Preserve unrelated published modules when their historical compiler differs.
const fs=require('fs'),path=require('path'),cp=require('child_process'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),baseline=process.argv[3]||'HEAD';
const allowed=new Set(['savings-loan-eligibility.js','screens-admin-finanzas.jsx','screens-admin-fondos.jsx']);
const original=cp.execFileSync('git',['show',baseline+':app/bundle.js'],{cwd:root,maxBuffer:30*1024*1024}).toString('utf8');
cp.execFileSync(process.execPath,[path.join(__dirname,'build-bundle.js'),path.resolve(process.argv[2])],{cwd:root,stdio:'pipe'});
const parse=s=>s.replace(/\r\n/g,'\n').split(/(?=\/\* @@file )/).filter(Boolean).map(bytes=>({name:bytes.match(/^\/\* @@file (.*?) \*\//)[1],bytes}));
const old=parse(original),oldByName=new Map(old.map(x=>[x.name,x.bytes]));
const next=parse(fs.readFileSync(path.join(root,'app/bundle.js'),'utf8'));
const changed=[],preserved=[];
const final=next.map(x=>{
 if(allowed.has(x.name)){if(x.bytes!==oldByName.get(x.name))changed.push(x.name);return x.bytes;}
 assert(oldByName.has(x.name),'Unexpected new module '+x.name);
 if(x.bytes!==oldByName.get(x.name))preserved.push(x.name);
 return oldByName.get(x.name);
}).join('');
for(const x of old)assert(next.some(y=>y.name===x.name),'Removed module '+x.name);
new vm.Script(final);fs.writeFileSync(path.join(root,'app/bundle.js'),final);
console.log(JSON.stringify({status:'PASS',baseline,modules:next.length,changed,preservedPublishedModules:preserved}));
