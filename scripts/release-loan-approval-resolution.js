'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),cp=require('child_process'),http=require('http');
const root=path.resolve(__dirname,'..'),temp=path.join(root,'.tmp/approval-resolution'),evidence=path.join(root,'docs/qa/evidence/loan-approval-resolution-20260928');
const mode=process.argv[2],hash=s=>crypto.createHash('sha256').update(s).digest('hex');
if(mode==='build'){
 fs.mkdirSync(temp,{recursive:true});fs.mkdirSync(evidence,{recursive:true});
 for(const name of ['app/bundle.js','SutiApp.html','sw.js','app/financial-legacy-repository.js','supabase/functions/financial-legacy/index.ts']){
  const backup=path.join(temp,'before',name);if(!fs.existsSync(backup)){fs.mkdirSync(path.dirname(backup),{recursive:true});fs.copyFileSync(path.join(root,name),backup);}
 }
 const file='app/screens-admin-finanzas.jsx',original=fs.readFileSync(path.join(temp,'before/app/bundle.js'),'utf8').replace(/\r\n/g,'\n');
 const box={};vm.createContext(box);vm.runInContext(fs.readFileSync('C:/tmp/babel-standalone-7.29.0.min.js','utf8'),box);
 const code=box.Babel.transform(fs.readFileSync(path.join(root,file),'utf8'),{presets:['react'],filename:path.basename(file)}).code;
 const name=path.basename(file),pattern=/\/\* @@file screens-admin-finanzas\.jsx \*\/\n[\s\S]*?(?=\/\* @@file |$)/g;
 if([...original.matchAll(pattern)].length!==1)throw Error('BUNDLE_CHUNK_MISSING');
 const bundle=original.replace(pattern,()=>`/* @@file ${name} */\n(function(){\n${code}\n})();\n`);new vm.Script(bundle);
 fs.writeFileSync(path.join(root,'app/bundle.js'),bundle);
 for(const name of ['SutiApp.html','sw.js']){
  let text=fs.readFileSync(path.join(temp,'before',name),'utf8');
  text=text.replace(/app\/bundle\.js\?v=(\d+)/g,(_,n)=>'app/bundle.js?v='+(Number(n)+1));
  text=text.replace(/app\/financial-legacy-repository\.js\?v=(\d+)/g,(_,n)=>'app/financial-legacy-repository.js?v='+(Number(n)+1));
  if(name==='SutiApp.html')text=text.replace(/sw\.js\?v=\d+/, 'sw.js?v='+ (Number(fs.readFileSync(path.join(temp,'before/sw.js'),'utf8').match(/sutiapp-v(\d+)/)[1])+1));
  if(name==='sw.js')text=text.replace(/sutiapp-v(\d+)/,(_,n)=>'sutiapp-v'+(Number(n)+1));fs.writeFileSync(path.join(root,name),text);
 }
 const proof={status:'PASS',changedChunks:[name],otherChunksPreserved:true,bundleSha256:hash(bundle),originalSha256:hash(original)};
 fs.writeFileSync(path.join(evidence,'build.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}else if(mode==='site'){
 const env={...process.env};for(const line of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const at=line.indexOf('=');if(at>0)env[line.slice(0,at).trim()]=line.slice(at+1).trim().replace(/^['"]|['"]$/g,'');}
 env.SUTIAPP_SUPABASE_URL=env.SUPABASE_URL;env.SUTIAPP_SUPABASE_PUBLISHABLE_KEY=env.SUPABASE_PUBLISHABLE_KEY;
 const site=path.join(temp,'site');
 if(fs.existsSync(site)){
  for(const file of ['app/bundle.js','app/financial-legacy-repository.js','sw.js','SutiApp.html'])fs.copyFileSync(path.join(root,file),path.join(site,file));
  fs.copyFileSync(path.join(root,'SutiApp.html'),path.join(site,'index.html'));console.log('Updated focused local build files');
 }else cp.execFileSync(process.execPath,['scripts/build-pages-site.js','.tmp/approval-resolution/site'],{cwd:root,env,stdio:'inherit'});
}else if(mode==='global-local'){
 // An unrelated server already owns localhost/IPv6:8080. Resolve localhost to
 // this build's IPv4 listener without rewriting app requests, assets or data.
 const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
 const launch=chromium.launch.bind(chromium);chromium.launch=options=>launch({...options,args:[...(options.args||[]),'--host-resolver-rules=MAP localhost 127.0.0.1']});
 process.env.SUTIAPP_IMAGE_E2E_URL='http://localhost:8080/';
 process.env.SUTIAPP_IMAGE_EXPECTED_BUNDLE_SHA256=hash(fs.readFileSync(path.join(root,'app/bundle.js')));
 require('./test-global-image-regression-production-live.js');
}else if(mode==='serve'){
 const site=path.join(temp,'site'),mime={'.js':'application/javascript','.html':'text/html','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
 http.createServer((req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname,file=path.resolve(site,'.'+(pathname==='/'?'/index.html':decodeURIComponent(pathname)));if(!file.startsWith(site+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);});}).listen(8080,'127.0.0.1',()=>console.log('Approval resolution build http://localhost:8080'));
}else throw Error('USAGE: build|site|serve|global-local');
