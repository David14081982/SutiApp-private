'use strict';
// Build into a private temp directory; publishable config only, no secret copied.
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'tmp/editorial-preview-'+Date.now()),source=path.join(dir,'source'),site=path.join(dir,'site');
fs.mkdirSync(path.join(source,'scripts'),{recursive:true});fs.mkdirSync(path.join(source,'app'),{recursive:true});
fs.copyFileSync(path.join(root,'scripts/build-bundle.js'),path.join(source,'scripts/build-bundle.js'));
for(const f of fs.readdirSync(path.join(root,'app')))if(/\.(js|jsx)$/.test(f))fs.copyFileSync(path.join(root,'app',f),path.join(source,'app',f));
cp.execFileSync(process.execPath,[path.join(source,'scripts/build-bundle.js'),'C:/tmp/babel-standalone-7.29.0.min.js'],{cwd:root,stdio:'pipe'});
const env={};for(const raw of fs.readFileSync(path.join(root,'supabase.env'),'utf8').split(/\r?\n/)){const at=raw.indexOf('=');if(at>0)env[raw.slice(0,at).trim()]=raw.slice(at+1).trim().replace(/^['"]|['"]$/g,'');}
cp.execFileSync(process.execPath,['scripts/build-pages-site.js',site],{cwd:root,env:{...process.env,SUTIAPP_SUPABASE_URL:env.SUPABASE_URL,SUTIAPP_SUPABASE_PUBLISHABLE_KEY:env.SUPABASE_PUBLISHABLE_KEY},stdio:'pipe'});
fs.copyFileSync(path.join(source,'app/bundle.js'),path.join(site,'app/bundle.js'));
const result={status:'PASS',site,source,productionDeployed:false,bundleSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(site,'app/bundle.js'))).digest('hex')};
fs.writeFileSync(path.join(root,'tmp/editorial-preview-latest.json'),JSON.stringify(result,null,2));
fs.writeFileSync(path.join(root,'docs/qa/evidence/screen-permission-fix-20260924/preview-build.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
