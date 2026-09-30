'use strict';
// Rebuild only this H's chunks. Preserve all unrelated pre-existing workspace changes.
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const original=read('.tmp/savings-individual-withdrawal/before/app/bundle.js');
const parse=s=>s.split(/(?=\/\* @@file )/).filter(Boolean).map(bytes=>({name:bytes.match(/^\/\* @@file (.*?) \*\//)[1],bytes}));
const focal=['savings-panel-admin.jsx','savings-runtime-admin.jsx'],added=['savings-individual-withdrawal-repository.js','savings-individual-withdrawal.jsx'];
const compile=name=>{const source=read('app/'+name).replace(/\r\n/g,'\n').trimEnd();new vm.Script(source,{filename:name});return `/* @@file ${name} */\n(function(){\n${source}\n})();\n`;};
const old=parse(original),next=old.map(x=>(x.name==='savings-runtime-admin.jsx'?added.map(compile).join(''):'')+(focal.includes(x.name)?compile(x.name):x.bytes)).join('');
new vm.Script(next);const final=parse(next);for(const x of old)if(!focal.includes(x.name))assert.equal(final.find(y=>y.name===x.name).bytes,x.bytes);
fs.writeFileSync(path.join(root,'app/bundle.js'),next);
for(const name of ['SutiApp.html','sw.js']){
 const baseline=path.join(root,'.tmp/savings-individual-withdrawal/before',name);
 if(!fs.existsSync(baseline))fs.copyFileSync(path.join(root,name),baseline);
 let source=fs.readFileSync(baseline,'utf8');
 source=source.replace(/app\/bundle\.js\?v=(\d+)/g,(_,v)=>'app/bundle.js?v='+(Number(v)+1));
 if(name==='sw.js')source=source.replace(/sutiapp-v(\d+)/,(_,v)=>'sutiapp-v'+(Number(v)+1));
 else source=source.replace(/sw\.js\?v=(\d+)/,(_,v)=>'sw.js?v='+(Number(v)+1));
 fs.writeFileSync(path.join(root,name),source);
}
const result={status:'PASS',changed:focal,added,preservedChunks:old.length-focal.length,sha256:crypto.createHash('sha256').update(next).digest('hex')};
fs.mkdirSync(path.join(root,'docs/qa/evidence/savings-individual-withdrawal'),{recursive:true});fs.writeFileSync(path.join(root,'docs/qa/evidence/savings-individual-withdrawal/build.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
