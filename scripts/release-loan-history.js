'use strict';
// Owner-authorized focal activation. Never writes business records or Sheet cells.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto'),cp=require('child_process');
const {environment}=require('./inspect-loan-history');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'.tmp/history-loan-payments'),release=path.join(dir,'release'),out=path.join(root,'docs/qa/evidence/history-loan-payments');
const env=environment(),mode=process.argv[2],read=f=>fs.readFileSync(path.join(root,f),'utf8'),norm=s=>s.replace(/\r/g,'').trim(),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const script='1cw2bLuwFWfJkALd-cSgz-KYmQdX2q9I6a5hABo6nwQIXsZ2mDMzy3h5o',deployment='AKfycbwvQ_HZ1-lb5RVv9En4XgTRh1f3EjcIXSZel3zkWhC9gCI4vW_vRLd64RjxvOSQqdIz0g';
const google='https://script.googleapis.com/v1/projects/'+script,management='https://api.supabase.com/v1/projects/'+new URL(env.SUPABASE_URL).hostname.split('.')[0];
const canonical=c=>JSON.stringify(c.files.map(({name,type,source})=>({name,type,source:norm(source)})).sort((a,b)=>a.name.localeCompare(b.name)));
function proof(name,data){fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(data,null,2)+'\n');console.log(JSON.stringify(data));}
async function json(url,options={}){const r=await fetch(url,{...options,signal:AbortSignal.timeout(55000)});if(!r.ok){fs.writeFileSync(path.join(dir,'release-private-error.txt'),await r.text());throw Error('RELEASE_HTTP_'+r.status);}return r.json();}
async function query(query,write=false){return json(management+'/database/query',{method:'POST',headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query,read_only:!write})});}
async function gh(){const a=JSON.parse(fs.readFileSync('C:/Users/david/.clasprc.json','utf8')).tokens.default,t=await json('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:a.client_id,client_secret:a.client_secret,refresh_token:a.refresh_token,grant_type:'refresh_token',scope:'https://www.googleapis.com/auth/script.projects https://www.googleapis.com/auth/script.deployments'})});return {Authorization:'Bearer '+t.access_token,'Content-Type':'application/json'};}
async function snapshot(h){const dep=await json(google+'/deployments/'+deployment,{headers:h});const content=await json(google+'/content?versionNumber='+dep.deploymentConfig.versionNumber,{headers:h}),head=await json(google+'/content',{headers:h});return {deployment:dep,content,head};}
function candidate(){const m=JSON.parse(read('docs/qa/evidence/history-loan-payments/candidate.json'));for(const f of m.files)assert.equal(sha(fs.readFileSync(path.join(root,f.file))),f.sha256,'CANDIDATE_DRIFT_'+f.file);return m;}
async function main(){
 candidate();
 if(mode==='serve'){
  const bundle=fs.readFileSync(path.join(release,'app/bundle.js')),site=path.join(dir,'published-site-'+sha(bundle).slice(0,12)),mime={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.mjs':'text/javascript;charset=utf-8','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
  require('http').createServer((req,res)=>{const file=path.resolve(site,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/\/$/,'/index.html'));if(!file.startsWith(site+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);}).listen(8080,'127.0.0.1',()=>console.log('HISTORY_RELEASE_PREVIEW http://localhost:8080/'));return;
 }
 if(mode==='google'||mode==='verify-google'){
  const h=await gh(),before=JSON.parse(read('.tmp/history-loan-payments/google-before.json'));
  const files=before.content.files.map(({name,type,source})=>({name,type,source:name==='Code'?read('google-apps-script/financial-handoff/Code.gs'):source}));
  let version;
  if(mode==='google'){
   const current=await snapshot(h);assert.equal(current.deployment.deploymentConfig.versionNumber,19);assert.equal(canonical(current.content),canonical(before.content));assert.equal(canonical(current.head),canonical(before.head));
   cp.execFileSync(process.execPath,['scripts/test-loan-history-receiver.js'],{cwd:root,stdio:'pipe'});
   const remote=await json(management+'/secrets',{headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN}}),auth=JSON.parse(fs.readFileSync('C:/Users/david/.clasprc.json','utf8')).tokens.default;
   for(const [key,value] of [['GOOGLE_REQUEST_SYNC_OAUTH_CLIENT_ID',auth.client_id],['GOOGLE_REQUEST_SYNC_OAUTH_CLIENT_SECRET',auth.client_secret],['GOOGLE_REQUEST_SYNC_OAUTH_REFRESH_TOKEN',auth.refresh_token],['FINANCIAL_LEGACY_API_URL','https://script.google.com/macros/s/'+deployment+'/exec']])assert.equal(remote.find(x=>x.name===key)?.value,sha(value),'RUNTIME_SECRET_DRIFT');
   assert(remote.some(x=>x.name==='FINANCIAL_LEGACY_API_TOKEN'&&x.value));
   await json(google+'/content',{method:'PUT',headers:h,body:JSON.stringify({files})});assert.equal(canonical(await json(google+'/content',{headers:h})),canonical({files}));
   version=(await json(google+'/versions',{method:'POST',headers:h,body:JSON.stringify({description:'Own Historial read-only projection; preserve all financial writers'})})).versionNumber;
   fs.writeFileSync(path.join(dir,'google-published-version.json'),JSON.stringify({version,previous:19}));
   const updated=await json(google+'/deployments/'+deployment,{method:'PUT',headers:h,body:JSON.stringify({deploymentConfig:{...before.deployment.deploymentConfig,versionNumber:version}})});assert.equal(updated.deploymentConfig.versionNumber,version);
  }else version=JSON.parse(read('.tmp/history-loan-payments/google-published-version.json')).version;
  let after;for(let i=0;i<8;i++){after=await snapshot(h);if(after.deployment.deploymentConfig.versionNumber===version&&canonical(after.content)===canonical({files})&&canonical(after.head)===canonical({files}))break;if(i===7)throw Error('GOOGLE_READBACK_PENDING');await new Promise(r=>setTimeout(r,1000));}
  assert.deepEqual(after.deployment.entryPoints,before.deployment.entryPoints);fs.writeFileSync(path.join(dir,'google-after.json'),JSON.stringify(after));
  const old=await json(env.SUPABASE_URL+'/functions/v1/savings-settlement/source-status',{headers:{Authorization:'Bearer '+env.SUPABASE_SECRET_KEY,apikey:env.SUPABASE_SECRET_KEY}});assert.equal(old.status,'PASS');assert.equal(old.read_only,true);
  proof('google-deployed',{status:'PASS',version,previous:19,exactReadback:true,entrypointsPreserved:true,manifestPreserved:true,legacyReader:'PASS',sheetWrites:0});return;
 }
 if(mode==='database'){
  assert.equal(JSON.parse(read('docs/qa/evidence/history-loan-payments/google-deployed.json')).status,'PASS');
  const migration=read('supabase/migrations/20261025000100_self_loan_history.sql'),body=migration.replace(/\bbegin;/i,'').replace(/commit;\s*$/i,'');
  const fingerprint="select 'requests' kind,md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'[]')) value from public.program_requests t union all select 'events',md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'[]')) from public.program_request_admin_events t union all select 'affiliates',md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'[]')) from public.affiliates t union all select 'protected_functions',md5(coalesce(jsonb_agg(jsonb_build_array(oid,pg_get_functiondef(oid),proacl) order by oid)::text,'[]')) from pg_proc where pronamespace='public'::regnamespace and (proname in('get_effective_affiliate_id','list_self_program_request_history') or proname like '%approv%financial%' or proname like '%financial%approv%')";
  const sql=`begin isolation level repeatable read;set local lock_timeout='2s';set local statement_timeout='50s';
create temporary table history_release_before on commit drop as ${fingerprint};
${body}
create temporary table history_release_after on commit drop as ${fingerprint};
do $guard$ begin if exists(select * from history_release_before except select * from history_release_after) or exists(select * from history_release_after except select * from history_release_before) then raise exception 'HISTORY_INTEGRITY_CHANGED';end if;end $guard$;
insert into supabase_migrations.schema_migrations(version,name,statements) values('20261025000100','self_loan_history',array[$migration$${migration}$migration$]);
select 'PASS' integrity,count(*) compared_domains from history_release_before;commit;`;
  const result=await query(sql,true);const grants=(await query("select has_function_privilege('anon','public.get_self_loan_history_context()','EXECUTE') anon,has_function_privilege('authenticated','public.get_self_loan_history_context()','EXECUTE') authenticated,has_function_privilege('service_role','public.get_self_loan_history_context()','EXECUTE') service_role"))[0];assert.equal(grants.anon,false);assert.equal(grants.authenticated,true);assert.equal(grants.service_role,false);
  proof('database-deployed',{status:'PASS',migration:'20261025000100',sha256:sha(migration),result,grants,businessWrites:0,approvalWriterUnchanged:true});return;
 }
 if(mode==='edge'){
  assert.equal(JSON.parse(read('docs/qa/evidence/history-loan-payments/database-deployed.json')).status,'PASS');const h={Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN};
  const existing=await json(management+'/functions',{headers:h});assert(!existing.some(x=>x.slug==='loan-history'),'EDGE_ALREADY_INSTALLED');
  const form=new FormData();form.append('metadata',JSON.stringify({name:'loan-history',slug:'loan-history',entrypoint_path:'index.ts',verify_jwt:true}));
  for(const name of ['index.ts','history.mjs','source.mjs'])form.append('file',new Blob([read('supabase/functions/loan-history/'+name)],{type:name.endsWith('.ts')?'application/typescript':'application/javascript'}),name);
  const deployed=await json(management+'/functions/deploy?slug=loan-history',{method:'POST',headers:h,body:form});fs.writeFileSync(path.join(dir,'edge-deployed-private.json'),JSON.stringify(deployed));
  const current=(await json(management+'/functions',{headers:h})).find(x=>x.slug==='loan-history');assert(current);assert.equal(current.verify_jwt,true);assert.equal(current.status,'ACTIVE');
  proof('edge-deployed',{status:'PASS',slug:current.slug,version:current.version,verifyJwt:current.verify_jwt,remoteStatus:current.status,sourceFiles:['index.ts','history.mjs','source.mjs'].map(n=>({file:n,sha256:sha(read('supabase/functions/loan-history/'+n))}))});return;
 }
 if(mode==='prepare'){
  const get=f=>fs.readFileSync(path.join(release,f),'utf8'),put=(f,s)=>{const p=path.join(release,f);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,s);};
  for(const f of ['app/screens-historial.jsx','google-apps-script/financial-handoff/Code.gs'])assert.equal(norm(get(f)),norm(read('.tmp/history-loan-payments/before/'+f.replaceAll('/','__'))),'REMOTE_BASELINE_DRIFT_'+f);
  const beforeBundle=get('app/bundle.js'),chunks=s=>new Map([...s.replace(/\r/g,'').matchAll(/\/\* @@file (.*?) \*\/\n([\s\S]*?)(?=\/\* @@file |$)/g)].map(m=>[m[1],m[2]])),a=chunks(beforeBundle),b=chunks(read('app/bundle.js'));
  const focal=['history-loans-repository.js','history-loans.jsx','screens-historial.jsx'];let bundle=beforeBundle.replace(/\r/g,'');assert(!a.has(focal[0]));
  bundle=bundle.replace(/\/\* @@file screens-historial.jsx \*\/\n[\s\S]*?(?=\/\* @@file |$)/,()=>focal.map(n=>'/* @@file '+n+' */\n'+b.get(n)).join(''));
  const after=chunks(bundle);assert.deepEqual([...after].filter(([n,v])=>a.get(n)!==v).map(([n])=>n),focal);assert.equal(after.size,a.size+2);new (require('vm').Script)(bundle);put('app/bundle.js',bundle);
  const build=get('scripts/build-bundle.js');assert(build.includes("'screens-historial.jsx'"));assert(!build.includes("'history-loans.jsx'"));put('scripts/build-bundle.js',build.replace("'screens-historial.jsx'","'history-loans-repository.js',\n  'history-loans.jsx',\n  'screens-historial.jsx'"));
  const html=get('SutiApp.html');assert(html.includes('app/bundle.js?v=2026102505'));put('SutiApp.html',html.replaceAll('2026102505','2026102506'));
  const worker=get('sw.js');assert(worker.includes('sutiapp-v2026102505'));put('sw.js',worker.replaceAll('2026102505','2026102506'));
  const manifest=candidate();for(const {file} of manifest.files.filter(x=>!['app/bundle.js','scripts/build-bundle.js','SutiApp.html'].includes(x.file)))put(file,read(file));
  for(const f of ['scripts/release-loan-history.js','scripts/verify-loan-history-live.js','docs/audits/H-HISTORY-LOAN-PAYMENTS-001.md'])if(fs.existsSync(path.join(root,f)))put(f,read(f));
  for(const f of fs.readdirSync(out))if(/\.(json|md|png)$/.test(f))fs.copyFileSync(path.join(out,f),(fs.mkdirSync(path.join(release,'docs/qa/evidence/history-loan-payments'),{recursive:true}),path.join(release,'docs/qa/evidence/history-loan-payments',f)));
  fs.writeFileSync(path.join(dir,'remote-before-bundle.js'),beforeBundle);
  proof('release-prepared',{status:'PASS',baseCommit:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:release,encoding:'utf8'}).trim(),bundleSha256:sha(bundle),previousBundleSha256:sha(beforeBundle),changedChunks:focal,otherChunksPreserved:true});return;
 }
 if(mode==='build'){
  const bundle=fs.readFileSync(path.join(release,'app/bundle.js')),target=path.join(dir,'published-site-'+sha(bundle).slice(0,12));
  try{cp.execFileSync(process.execPath,[path.join(release,'scripts/build-pages-site.js'),target],{cwd:release,env:{...process.env,SUTIAPP_SUPABASE_URL:env.SUPABASE_URL,SUTIAPP_SUPABASE_PUBLISHABLE_KEY:env.SUPABASE_PUBLISHABLE_KEY},stdio:'pipe',windowsHide:true});}catch(e){fs.writeFileSync(path.join(dir,'release-build-private.log'),String(e.stdout||'')+String(e.stderr||''));throw Error('RELEASE_BUILD_FAILED');}
  assert.equal(sha(fs.readFileSync(path.join(target,'app/bundle.js'))),sha(bundle));proof('release-build',{status:'PASS',bundleSha256:sha(bundle)});return;
 }
 throw Error('UNKNOWN_MODE');
}
main().catch(e=>{console.error(e.code==='ERR_ASSERTION'?'RELEASE_ASSERTION: '+e.message.split('\n')[0]:e.message);process.exitCode=1;});
