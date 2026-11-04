'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),vm=require('vm');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'.tmp/affiliate-document-retirement');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'docs/qa/evidence/affiliate-document-retirement/assembly.json'),'utf8'));
const sections=s=>new Map([...s.matchAll(/^\/\* @@file ([^\r\n]+) \*\/\r?\n[\s\S]*?(?=^\/\* @@file |$(?![\s\S]))/gm)].map(m=>[m[1],m[0]]));
const current=fs.readFileSync(path.join(root,'app/bundle.js'),'utf8'),published=fs.readFileSync(path.join(dir,'release/app/bundle.js'),'utf8'),before=sections(current),after=sections(published);let result=current;
for(const f of manifest.modifiedModules){assert(before.has(f)&&after.has(f));result=result.replace(before.get(f),()=>after.get(f));}
new vm.Script(result);const next=sections(result);for(const[name,content]of before)if(!manifest.modifiedModules.includes(name))assert.equal(next.get(name),content);
for(const file of ['app/bundle.js','SutiApp.html','sw.js']){const saved=path.join(dir,'before',path.basename(file));if(!fs.existsSync(saved))fs.copyFileSync(path.join(root,file),saved);}
fs.writeFileSync(path.join(root,'app/bundle.js'),result);
const html=fs.readFileSync(path.join(root,'SutiApp.html'),'utf8'),oldVersion=html.match(/app\/bundle\.js\?v=(\d+)/)[1];
for(const file of ['SutiApp.html','sw.js']){const original=fs.readFileSync(path.join(root,file),'utf8');const from=file==='sw.js'?original.match(/sutiapp-v(\d+)/)[1]:oldVersion;assert(original.includes(from));fs.writeFileSync(path.join(root,file),original.replaceAll(from,manifest.version));}
console.log(JSON.stringify({status:'PASS',localModulesPreserved:before.size-manifest.modifiedModules.length,modifiedModules:manifest.modifiedModules,previousLocalWorkPreserved:true}));
