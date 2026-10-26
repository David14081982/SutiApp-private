'use strict';
// Regenerate only reviewed focal chunks; preserve unrelated published chunks.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto'),cp=require('child_process');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
const baseRef='85c78e138515851823843994c781e83b56071c7e';
const base=cp.execFileSync('git',['-c','safe.directory='+root.replaceAll('\\','/'),'show',baseRef+':app/bundle.js'],{cwd:root,encoding:'utf8',maxBuffer:30e6}).replace(/\r/g,'');
const parse=s=>new Map([...s.matchAll(/\/\* @@file (.*?) \*\/\n([\s\S]*?)(?=\/\* @@file |$)/g)].map(m=>[m[1],m[2]]));
const existing=['history-loans-repository.js','history-loans.jsx','screens-admin-finanzas.jsx'],added=['history-statement.js','history-sync-admin.js'];
const babel={};vm.createContext(babel);vm.runInContext(fs.readFileSync(process.env.SUTIAPP_BABEL_PATH||'C:/tmp/sutiapp-babel-7.28.4.min.js','utf8'),babel);
function chunk(name){const source=read('app/'+name).replace(/\r/g,''),code=name.endsWith('.jsx')?babel.Babel.transform(source,{presets:['react'],filename:name}).code:source.trimEnd();return '/* @@file '+name+' */\n(function(){\n'+code+'\n})();\n';}
let bundle=base;const before=parse(base);
for(const name of existing){assert(before.has(name));bundle=bundle.replace(new RegExp('/\\* @@file '+name.replaceAll('.','\\.')+' \\*/\\n[\\s\\S]*?(?=/\\* @@file |$)'),()=>chunk(name));}
for(const [name,anchor] of [['history-statement.js','history-loans.jsx'],['history-sync-admin.js','screens-admin-finanzas.jsx']]){assert(!before.has(name));bundle=bundle.replace('/* @@file '+anchor+' */',()=>chunk(name)+'/* @@file '+anchor+' */');}
const after=parse(bundle);assert.equal(after.size,before.size+2);
for(const [name,code]of before)if(!existing.includes(name))assert.equal(after.get(name),code,'UNRELATED_CHUNK_CHANGED_'+name);
new vm.Script(bundle);fs.writeFileSync(path.join(root,'app/bundle.js'),bundle);
for(const file of ['SutiApp.html','sw.js'])fs.writeFileSync(path.join(root,file),read(file).replace(/app\/bundle\.js\?v=\d+/g,'app/bundle.js?v=2026102602').replace(/sutiapp-v\d+/g,'sutiapp-v2026102602').replace(/sw\.js\?v=\d+/g,'sw.js?v=2026102602'));
const proof={status:'PASS',base:'85c78e138515851823843994c781e83b56071c7e',existingChunks:existing,addedChunks:added,unchangedChunks:before.size-existing.length,bundleSha256:crypto.createHash('sha256').update(bundle).digest('hex')};
const out=path.join(root,'docs/qa/evidence/history-snapshot');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'bundle.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
