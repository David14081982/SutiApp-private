'use strict';
// Focal rebuild: preserve existing compiled bytes whenever Babel proves the
// current source equivalent; compile real changes and preserve all other modules.
const fs=require('fs'),vm=require('vm'),crypto=require('crypto');
const destination='app/bundle.js';let bundle=fs.readFileSync(destination,'utf8').replace(/\r\n/g,'\n');
const focal=["reports-jc-repository.js","reports-jc-export.js","reports-jc-admin.jsx","savings-refunds-repository.js","savings-refunds-admin.jsx","savings-regularization-admin.jsx","screens-admin.jsx","savings-panel-admin.jsx"];
const compiled=["screens-admin.jsx","savings-panel-admin.jsx"];
const sections=text=>new Map([...text.matchAll(/\/\* @@file ([^\n]+) \*\/\n([\s\S]*?)(?=\/\* @@file |$)/g)].map(m=>[m[1],m[0]]));
const before=sections(bundle),box={};vm.createContext(box);
vm.runInContext(fs.readFileSync(process.argv[2]||process.env.SUTIAPP_BABEL_PATH||'C:/tmp/babel-standalone-7.29.0.min.js','utf8'),box);
if(!box.Babel)throw Error('BABEL_UNAVAILABLE');
const transform=(file,source)=>box.Babel.transform(source,{presets:['react'],filename:file}).code;
for(const name of focal){
 const source=fs.readFileSync('app/'+name,'utf8').replace(/\r\n/g,'\n').trimEnd();new vm.Script(source,{filename:name});
 const prefix='/* @@file '+name+' */\n(function(){\n',suffix='\n})();\n',old=before.get(name);
 let code=compiled.includes(name)?transform(name,source):source;
 let block=prefix+code+suffix;
 if(compiled.includes(name)&&old){
  if(!old.startsWith(prefix)||!old.endsWith(suffix))throw Error('FOCAL_WRAPPER_CHANGED:'+name);
  if(code===transform(name,old.slice(prefix.length,-suffix.length)))block=old;
 }
 if(old)bundle=bundle.replace(old,()=>block);else bundle=block+bundle;
}
new vm.Script(bundle,{filename:destination});const after=sections(bundle);
for(const [name,block]of before)if(!focal.includes(name)&&after.get(name)!==block)throw Error('UNRELATED_BUNDLE_CHANGED:'+name);
fs.writeFileSync(destination,bundle);
console.log(JSON.stringify({files:focal,preservedModules:[...before.keys()].filter(n=>!focal.includes(n)).length,sha256:crypto.createHash('sha256').update(bundle).digest('hex')}));
