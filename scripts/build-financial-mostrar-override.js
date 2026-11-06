/* Focal build: preserve every existing bundled module except Admin Fondos. */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),file='screens-admin-fondos.jsx',bundlePath=path.join(root,'app/bundle.js');
const before=fs.readFileSync(bundlePath,'utf8'),source=fs.readFileSync(path.join(root,'app',file),'utf8').replace(/\r\n/g,'\n');
const box={};vm.createContext(box);vm.runInContext(fs.readFileSync(process.env.SUTIAPP_BABEL_PATH||'C:/tmp/babel-standalone-7.29.0.min.js','utf8'),box);
const marker='/* @@file '+file+' */',start=before.indexOf(marker);assert(start>=0&&before.indexOf(marker,start+marker.length)<0,'FOCAL_MODULE_NOT_UNIQUE');
const next=before.indexOf('/* @@file ',start+marker.length),end=next<0?before.length:next;
const code=box.Babel.transform(source,{presets:['react'],filename:file}).code;
const chunk=marker+'\n(function(){\n'+code+'\n})();\n';
const after=before.slice(0,start)+chunk+before.slice(end);new vm.Script(after,{filename:'app/bundle.js'});
assert.equal(after.slice(0,start),before.slice(0,start));assert.equal(after.slice(start+chunk.length),before.slice(end));
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
fs.writeFileSync(bundlePath,after,'utf8');
const result={status:'PASS',module:file,sourceSha256:sha(source),bundleBeforeSha256:sha(before),bundleAfterSha256:sha(after),unchangedOtherModules:true,nonFocalSha256:sha(before.slice(0,start)+before.slice(end)),moduleCount:(after.match(/\/\* @@file /g)||[]).length};
const out=path.join(root,'docs/qa/evidence/financial-mostrar-override');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'build.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
