'use strict';
// Rebuild only the three reviewed History chunks against the current bundle.
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8').replace(/\r\n/g,'\n');
const names=['history-loans-repository.js','history-loans.jsx','screens-historial.jsx'];
const chunks=s=>new Map([...s.matchAll(/\/\* @@file (.*?) \*\/\n([\s\S]*?)(?=\/\* @@file |$)/g)].map(m=>[m[1],m[2]]));
const hash=s=>crypto.createHash('sha256').update(s).digest('hex'),before=read('app/bundle.js'),old=chunks(before),context={};
const babel=process.argv[2]||process.env.SUTIAPP_BABEL_PATH;
if(!babel)throw Error('Pass a Babel Standalone file path.');
vm.createContext(context);vm.runInContext(fs.readFileSync(babel,'utf8'),context);
let bundle=before;
for(const name of names){
 if(!old.has(name))throw Error('HISTORY_CHUNK_MISSING:'+name);
 const source=read('app/'+name),code=name.endsWith('.jsx')?context.Babel.transform(source,{presets:['react'],filename:name}).code:source.trimEnd();
 bundle=bundle.replace('/* @@file '+name+' */\n'+old.get(name),'/* @@file '+name+' */\n(function(){\n'+code+'\n})();\n');
}
new vm.Script(bundle);const after=chunks(bundle);
if(after.size!==old.size)throw Error('CHUNK_COUNT_CHANGED');
for(const [name,code]of old)if(!names.includes(name)&&after.get(name)!==code)throw Error('UNRELATED_CHUNK_CHANGED:'+name);
fs.writeFileSync(path.join(root,'app/bundle.js'),bundle);
const html=read('SutiApp.html'),next=html.replace(/(app\/bundle\.js\?v=)[^"']+(?=["'] onerror)/,'$1'+'2026112501');
if(!next.includes('app/bundle.js?v=2026112501'))throw Error('CACHEBUSTER_NOT_FOUND');
fs.writeFileSync(path.join(root,'SutiApp.html'),next);
const proof={status:'PASS',changedBundleChunks:names,allOtherChunksPreserved:true,bundleSha256:hash(bundle),sourceHashes:Object.fromEntries(names.map(n=>[n,hash(read('app/'+n))])),globalImageRegression:'NOT APPLICABLE: focal History only',businessWrites:0};
const out=path.join(root,'docs/qa/evidence/history-debt');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'build.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
