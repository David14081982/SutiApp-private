'use strict';
// Rebuild only the three authorized module chunks. Preserve every unrelated byte.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),bundlePath=path.join(root,'app/bundle.js');
const allowed=new Set(['program-catalog-repository.js','screens-admin-program-products.jsx','screens-program-product-payment.jsx']);
const compiler={};vm.createContext(compiler);vm.runInContext(fs.readFileSync(process.argv[2]||'C:/tmp/babel-standalone-7.28.4.min.js','utf8'),compiler);
const prior=fs.readFileSync(bundlePath,'utf8').replace(/\r\n/g,'\n'),parts=prior.split(/(?=\/\* @@file )/).filter(Boolean);
const changed=[];
const result=parts.map(part=>{const name=part.match(/^\/\* @@file (.*?) \*\//)?.[1];assert(name);if(!allowed.has(name))return part;
 const source=fs.readFileSync(path.join(root,'app',name),'utf8').replace(/\r\n/g,'\n').trimEnd();
 // The published product editor is plain createElement code; only the simulator
 // used Babel formatting. Keep each module's established compilation convention.
 const code=name==='screens-program-product-payment.jsx'?compiler.Babel.transform(source,{presets:['react'],filename:name}).code:source;
 const next=`/* @@file ${name} */\n(function(){\n${code}\n})();\n`;new vm.Script(next);if(next!==part)changed.push(name);return next;
}).join('');
assert.equal(parts.length,(result.match(/\/\* @@file /g)||[]).length);new vm.Script(result);fs.writeFileSync(bundlePath,result);
console.log(JSON.stringify({status:'PASS',changed,unchangedModules:parts.length-changed.length}));
