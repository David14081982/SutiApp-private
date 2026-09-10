'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert').strict,crypto=require('crypto');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),base='1a4c76330a29fc20dbd62fd1f5bc3206660a34b7';
const changed=cp.execFileSync('git',['diff','--name-only',base],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/);
const css=read('app/text-size.css'),declared=new Set([...css.matchAll(/(--text-[\w-]+):/g)].map(m=>m[1]));
const sources=changed.filter(f=>f.startsWith('app/')&&f!=='app/bundle.js');let tokenized=0;
for(const f of sources){const source=read(f);for(const m of source.matchAll(/var\((--text-[\w-]+)/g)){assert(declared.has(m[1]),'Undefined token '+m[1]+' in '+f);tokenized++;}}
const normalize=s=>s.replace(/'var\(--text-[\w-]+, ([\d.]+)px\)'/g,'$1').replace(/fontSize:\s*'var\(--text-[\w-]+, ([\d.]+)px\)'/g,'fontSize:$1').replace(/font-size:\s*var\(--text-[\w-]+, ([\d.]+)px\)/g,'font-size:$1px').replace(/fontSize:\s*([\d.]+)/g,'fontSize:$1').replace(/font-size:\s*/g,'font-size:').replace(/\r\n/g,'\n');
const presentationOnly=sources.filter(f=>!['app/app.jsx','app/ui.jsx','app/screens-credencial.jsx','app/screens-convenios.jsx','app/screens-financiera.jsx','app/screens-historial.jsx','app/admin-store.jsx','app/screens-catalogo.jsx','app/text-size.css','app/text-size-preferences.js'].includes(f));
for(const f of presentationOnly){assert.equal(normalize(read(f)),normalize(cp.execFileSync('git',['show',base+':'+f],{cwd:root,encoding:'utf8'})),'Non-typography change: '+f);}
assert(!changed.some(f=>f.startsWith('supabase/')||f.startsWith('google-apps-script/')),'Backend/legacy changes forbidden');assert(!changed.some(f=>f.startsWith('app/')&&f.endsWith('-repository.js')),'Business repositories unchanged');
assert(!/maximum-scale|user-scalable\s*=\s*no/.test(read('SutiApp.html')));assert(!/(?:localStorage|sessionStorage|indexedDB|service_role)/.test(read('app/text-size-preferences.js')));assert(!/\bzoom\s*:/.test(css));
assert(read('SutiApp.html').includes('text-size.css?v=239'));assert(read('sw.js').includes('text-size.css?v=239'));assert(read('sw.js').includes('bundle.js?v=239'));
const result={status:'PASS',base,files:changed,tokenReferences:tokenized,mechanicalTypographyOnly: presentationOnly,businessRepositoriesChanged:0,backendChanges:0,legacyChanges:0,localPreferenceAuthorities:0,browserZoomAllowed:true};
const out=path.join(root,'docs/qa/evidence/text-size-20260909');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'scope-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({status:'PASS',tokenReferences:tokenized,mechanicalTypographyFiles:presentationOnly.length,backendChanges:0}));
