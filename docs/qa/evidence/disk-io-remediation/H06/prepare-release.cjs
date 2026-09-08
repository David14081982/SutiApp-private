'use strict';
const fs=require('fs'),cp=require('child_process'),path=require('path'),a=require('./audit.cjs');
const release='C:/tmp/sutiapp-h06-release-20260907';
const files=a.files.filter(f=>!['scripts/build-bundle.js','app/screens-admin-documents.jsx'].includes(f)).concat('app/private-resource-demand.js','app/image-viewer.jsx','scripts/test-catalog-resource-demand.js','scripts/test-catalog-resource-demand-browser.js','scripts/test-program-catalog-cutover.js','scripts/test-program-products-admin-cutover.js','scripts/test-membership-document-thumbnail-viewer.js');
for(const f of files)fs.copyFileSync(f,path.join(release,f));
let build=cp.execFileSync('git',['show','c047eec:scripts/build-bundle.js'],{encoding:'utf8'}).replace("'program-request-repository.js', 'document-workflow-repository.js'","'program-request-repository.js', 'private-resource-demand.js', 'document-workflow-repository.js'").replace("fs.readFileSync(filePath, 'utf8');","fs.readFileSync(filePath, 'utf8').replace(/\\r\\n/g, '\\n');");fs.writeFileSync(release+'/scripts/build-bundle.js',build);
for(const dir of [process.cwd(),release])for(const file of ['SutiApp.html','sw.js']){let s=fs.readFileSync(dir+'/'+file,'utf8').replaceAll('bundle.js?v=222','bundle.js?v=223').replaceAll('sw.js?v=169','sw.js?v=170').replace("sutiapp-v169","sutiapp-v170");fs.writeFileSync(dir+'/'+file,s);}
// Exact committed bytes are required by the HTML SRI attributes.
for(const f of ['app/vendor/react-18.3.1/react.production.min.js','app/vendor/react-dom-18.3.1/react-dom.production.min.js','app/vendor/supabase-js-2.112.3/supabase.min.js'])fs.writeFileSync(release+'/'+f,cp.execFileSync('git',['show','c047eec:'+f],{maxBuffer:5000000}));
console.log(cp.execFileSync(process.execPath,['scripts/build-bundle.js','C:/tmp/babel-standalone-7.28.4.min.js'],{cwd:release,encoding:'utf8'}).trim());
const e=a.env(),out='C:/tmp/sutiapp-h06-site-'+Date.now();
console.log(cp.execFileSync(process.execPath,['scripts/build-pages-site.js',out],{cwd:release,encoding:'utf8',env:{...process.env,SUTIAPP_SUPABASE_URL:e.SUPABASE_URL,SUTIAPP_SUPABASE_PUBLISHABLE_KEY:e.SUPABASE_PUBLISHABLE_KEY}}).trim());
// Avoid changing unchanged public artifacts through checkout EOL conversion.
const publicFiles=[...fs.readFileSync(release+'/scripts/build-pages-site.js','utf8').match(/const publicFiles = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map(x=>x[1]);
for(const f of publicFiles.filter(f=>!['SutiApp.html','sw.js','app/bundle.js'].includes(f)))fs.writeFileSync(out+'/'+f,cp.execFileSync('git',['show','c047eec:'+f],{maxBuffer:5000000}));
fs.writeFileSync('C:/tmp/sutiapp-h06-current-site.txt',out);a.save('build-local',{at:new Date().toISOString(),release,site:out,files,bundle:223,worker:170});
