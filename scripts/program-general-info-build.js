'use strict';
// Rebuild declared modules only; preserve every unrelated compiled module byte-for-byte.
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..'));
const files=['screens-marketplace.jsx','screens-admin-program-products.jsx','screens-admin-fincat.jsx','fincat-store.jsx','screens-terreno.jsx','program-general-info.jsx'];
const sandbox={};vm.createContext(sandbox);vm.runInContext(fs.readFileSync('C:/tmp/babel-standalone-7.28.4.min.js','utf8'),sandbox);
let bundle=fs.readFileSync(path.join(root,'app/bundle.js'),'utf8');
for(const file of files){
  const source=fs.readFileSync(path.join(root,'app',file),'utf8').replace(/\r\n/g,'\n');
  let code=source.trimEnd();try{new vm.Script(code);}catch(_){code=sandbox.Babel.transform(source,{presets:['react'],filename:file}).code;}
  const chunk=`/* @@file ${file} */\n(function(){\n${code}\n})();\n`;
  const start=bundle.indexOf('/* @@file '+file+' */');
  if(start<0){const before=bundle.indexOf('/* @@file savings-panel-repository.js */');if(before<0)throw new Error('INSERTION_ANCHOR_MISSING');bundle=bundle.slice(0,before)+chunk+bundle.slice(before);}
  else{const end=bundle.indexOf('/* @@file ',start+10);bundle=bundle.slice(0,start)+chunk+(end<0?'':bundle.slice(end));}
}
new vm.Script(bundle);fs.writeFileSync(path.join(root,'app/bundle.js'),bundle);console.log('PASS: six declared modules compiled; bundle syntax valid.');
