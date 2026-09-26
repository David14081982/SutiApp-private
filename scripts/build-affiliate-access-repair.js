'use strict';
// H-AFFILIATE-ACCESS-REPAIR-001 — preserve every unrelated released chunk; rebuild only the two
// authorized files. Before swapping, prove the recipe reproduces the HEAD chunks byte for byte.
const fs=require('fs'),path=require('path'),vm=require('vm'),cp=require('child_process'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const TARGETS=['admin-affiliates-repository.js','screens-admin-affiliates.jsx'];
const git=(file)=>cp.execFileSync('git',['show','HEAD:'+file],{cwd:root,maxBuffer:30000000}).toString().replace(/\r\n/g,'\n');
const base=git('app/bundle.js');
const sandbox={};vm.createContext(sandbox);vm.runInContext(fs.readFileSync('C:/tmp/babel-standalone-7.29.0.min.js','utf8'),sandbox);
const compile=(name,source)=>name.endsWith('.jsx')?sandbox.Babel.transform(source,{presets:['react'],filename:name}).code:source;
const chunk=(name,source)=>`/* @@file ${name} */\n(function(){\n${compile(name,source)}\n})();\n`;
const chunks=[...base.matchAll(/\/\* @@file ([^\n]+) \*\/\n([\s\S]*?)(?=\/\* @@file |$)/g)];
assert.equal(chunks.map((m)=>m[0]).join(''),base);
const replacements={};
for(const name of TARGETS){
  assert.equal(chunks.filter((m)=>m[1]===name).length,1,'chunk '+name);
  const released=chunks.find((m)=>m[1]===name)[0];
  const variants=[chunk(name,git('app/'+name)),chunk(name,git('app/'+name).replace(/\n$/,''))];
  assert.ok(variants.includes(released),'HEAD recipe must reproduce the released chunk: '+name);
  const trim=variants.indexOf(released)===1;
  const source=fs.readFileSync(path.join(root,'app',name),'utf8').replace(/\r\n/g,'\n');
  replacements[name]=chunk(name,trim?source.replace(/\n$/,''):source);
}
const next=chunks.map((m)=>replacements[m[1]]||m[0]).join('');new vm.Script(next);
fs.writeFileSync(path.join(root,'app/bundle.js'),next);
const result={status:'PASS',changedChunks:TARGETS,headRecipeReproduced:true,preservedChunks:chunks.length-TARGETS.length,totalChunks:chunks.length,
  bundleSha256:crypto.createHash('sha256').update(next).digest('hex')};
const dir=path.join(root,'docs/qa/evidence/affiliate-access-repair-20260926');fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(path.join(dir,'build.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
