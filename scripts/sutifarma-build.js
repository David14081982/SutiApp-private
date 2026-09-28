'use strict';
// Compile authorized chunks only, preserving the current published baseline.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');const root=path.resolve(__dirname,'..');
const files=['farma-repository.js','screens-farma.jsx','program-catalog-repository.js','program-catalog-admin-store.jsx','screens-admin-program-products.jsx','screens-catalogo.jsx','request-submission-success.jsx','screens-admin-fincat.jsx','screens-admin.jsx','screens-historial.jsx','request-push.js'];
const baselineFile=path.join(root,'.tmp/sutifarma/published-bundle.js');
const baseline=(fs.existsSync(baselineFile)?fs.readFileSync(baselineFile,'utf8'):require('child_process').execFileSync('git',['show','9a0ac6ce2c09125f2b0e071c227b578f05259dbc:app/bundle.js'],{cwd:root,maxBuffer:20000000}).toString()).replace(/\r\n/g,'\n'),box={};vm.createContext(box);vm.runInContext(fs.readFileSync('C:/tmp/babel-standalone-7.29.0.min.js','utf8'),box);
const compile=name=>{const source=fs.readFileSync(path.join(root,'app',name),'utf8').replace(/\r\n/g,'\n');const code=name.endsWith('.jsx')?box.Babel.transform(source,{presets:['react'],filename:name}).code:source.trimEnd();return `/* @@file ${name} */\n(function(){\n${code}\n})();\n`;};
const chunks=[...baseline.matchAll(/\/\* @@file ([^\n]+) \*\/\n([\s\S]*?)(?=\/\* @@file |$)/g)];assert.equal(chunks.map(m=>m[0]).join(''),baseline);
const newFiles=files.filter(name=>!chunks.some(m=>m[1]===name));const bundle=chunks.map(m=>(m[1]==='app.jsx'?newFiles.map(compile).join(''):'')+(files.includes(m[1])?compile(m[1]):m[0])).join('');
// New declarations are evaluated synchronously before React's first render.
new vm.Script(bundle);fs.writeFileSync(path.join(root,'app/bundle.js'),bundle);
const result={status:'PASS',changedChunks:files,preservedChunks:chunks.filter(m=>!files.includes(m[1])).length,bundleSha256:crypto.createHash('sha256').update(bundle).digest('hex'),baselineSha256:crypto.createHash('sha256').update(baseline).digest('hex')};const out=path.join(root,'docs/qa/evidence/sutifarma-20260928');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'build.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
