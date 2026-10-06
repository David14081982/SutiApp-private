'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto'),cp=require('child_process');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'.tmp/history-document-private'),release=path.join(dir,'release'),out=path.join(root,'docs/qa/evidence/history-private-documents');
const mode=process.argv[2],read=f=>fs.readFileSync(path.join(root,f),'utf8').replace(/^\uFEFF/,''),norm=s=>s.replace(/\r\n/g,'\n'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const env={};for(const line of read('supabase.env').replace(/^\uFEFF/,'').split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m)env[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}
const version='20261005000200',file='supabase/migrations/'+version+'_history_private_documents.sql';
function proof(name,result){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));}
async function query(query,write=false){const r=await fetch('https://api.supabase.com/v1/projects/'+new URL(env.SUPABASE_URL).hostname.split('.')[0]+'/database/query',{method:'POST',headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query,read_only:!write}),signal:AbortSignal.timeout(60000)});if(!r.ok){fs.writeFileSync(path.join(dir,'private-release-error.txt'),await r.text());throw Error('DATABASE_HTTP_'+r.status);}return r.json();}
async function main(){
 if(mode==='build'){
  const output=path.join(dir,'site');cp.execFileSync(process.execPath,[path.join(release,'scripts/build-pages-site.js'),output],{cwd:release,env:{...process.env,SUTIAPP_SUPABASE_URL:env.SUPABASE_URL,SUTIAPP_SUPABASE_PUBLISHABLE_KEY:env.SUPABASE_PUBLISHABLE_KEY},stdio:'pipe',windowsHide:true});proof('pages-build',{status:'PASS',bundleSha256:sha(fs.readFileSync(path.join(output,'app/bundle.js')))});return;
 }
 if(mode==='serve'){
  const http=require('http'),site=path.join(dir,'site'),mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2'};
  http.createServer((req,res)=>{const file=path.resolve(site,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/\/$/,'/index.html'));if(!file.startsWith(site+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);}).listen(8080,'127.0.0.1',()=>console.log('LOCAL_BUILD http://localhost:8080/'));return;
 }
 const backup=JSON.parse(fs.readFileSync(path.join(dir,'catalog.json'),'utf8'));
 const catalog=`select pg_get_functiondef(oid) definition,oid,proowner owner,to_jsonb(proacl) acl,prosecdef security_definer,to_jsonb(proconfig) config from pg_proc where oid='document_private.visible(document_private.records,boolean)'::regprocedure`;
 if(mode==='apply'){
  assert.equal(JSON.parse(read('docs/qa/evidence/history-private-documents/browser.json')).status,'PASS');
  assert.equal(JSON.parse(read('docs/qa/evidence/history-private-documents/database-tests.json')).status,'PASS');
  const current=(await query(catalog))[0];assert.equal(norm(current.definition),norm(backup.definition));assert.equal(String(current.oid),backup.oid);assert.deepEqual(current.acl,backup.acl);
  const migration=read(file),body=migration.replace(/\bbegin;/i,'').replace(/commit;\s*$/i,'');
  const sql=`begin isolation level repeatable read; set local lock_timeout='2s';set local statement_timeout='60s';
create temporary table history_privacy_baseline on commit drop as select md5(coalesce(jsonb_agg(to_jsonb(r) order by id)::text,'[]')) fingerprint,count(*) records from document_private.records r;
${body}
do $data_guard$ begin if (select fingerprint from history_privacy_baseline) is distinct from (select md5(coalesce(jsonb_agg(to_jsonb(r) order by id)::text,'[]')) from document_private.records r) then raise exception 'DOCUMENT_ROWS_CHANGED'; end if; end $data_guard$;
insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','history_private_documents',array[$migration$${migration}$migration$]);
select records,'PASS'::text data_integrity from history_privacy_baseline;commit;`;
  const result=await query(sql,true);proof('backend-applied',{status:'PASS',migration:version,migrationSha256:sha(migration),result,businessWrites:0,storageWrites:0});return;
 }
 if(mode==='diagnose-pdf'){
  const login=await fetch(env.SUPABASE_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:env.H005_TEST_EMAIL,password:env.H005_TEST_PASSWORD})});assert(login.ok);const session=await login.json(),headers={apikey:env.SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'};
  const r=await fetch(env.SUPABASE_URL+'/rest/v1/affiliate_documents?select=id,affiliate_id,status,private_asset:private_assets(mime_type),affiliate_file:affiliate_files(mime_type)&status=in.(PENDING_REVIEW,UNDER_REVIEW,REUPLOAD_REQUIRED)&order=created_at.asc&limit=100',{headers});assert(r.ok);const rows=await r.json(),doc=rows.find(x=>(x.private_asset||x.affiliate_file||{}).mime_type==='application/pdf');assert(doc,'NO_QUEUED_PDF');
  const response=await fetch(env.SUPABASE_URL+'/rest/v1/rpc/authorize_admin_document_preview',{method:'POST',headers,body:JSON.stringify({p_document_id:doc.id,p_target_affiliate_id:doc.affiliate_id,p_purpose:'ADMIN_DOCUMENT_REVIEW'})});const data=await response.json();
  const origins=[];for(const origin of ['http://localhost:8766','http://localhost:8080','https://david14081982.github.io']){const edge=await fetch(env.SUPABASE_URL+'/functions/v1/document-access',{method:'POST',headers:{...headers,Origin:origin},body:JSON.stringify({mode:'ADMIN',purpose:'ADMIN_DOCUMENT_REVIEW',document_id:doc.id,target_affiliate_id:doc.affiliate_id})});const ed=await edge.json();origins.push({origin,status:edge.status,error:ed.error||null});}
  proof('global-pdf-diagnosis',{status:'READ_ONLY',documentStatus:doc.status,rpcStatus:response.status,rpcCode:data.code||null,rpcMessage:response.ok?null:data.message,origins});return;
 }
 if(mode==='verify'){
  const current=(await query(catalog))[0],expected=norm(backup.definition).replace('else r.affiliate_id=public.get_effective_affiliate_id() end',"else r.domain<>'program' and r.affiliate_id=public.get_effective_affiliate_id() end");assert.equal(norm(current.definition),expected);assert.deepEqual(current.acl,backup.acl);assert.equal(String(current.oid),backup.oid);assert.equal(String(current.owner),backup.owner);assert.deepEqual(current.config,backup.config);assert.equal(current.security_definer,backup.securityDefiner);
  const login=await fetch(env.SUPABASE_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:env.H005_TEST_EMAIL,password:env.H005_TEST_PASSWORD})});assert(login.ok,'CONTROLLED_LOGIN_FAILED');const session=await login.json(),headers={apikey:env.SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'};
  const rpc=async(data)=>{const r=await fetch(env.SUPABASE_URL+'/rest/v1/rpc/document_generation_command',{method:'POST',headers,body:JSON.stringify(data)});return {status:r.status,body:await r.json()};};
  const list=await rpc({p_action:'LIST',p_data:{domain:'program',admin:true}});assert.equal(list.status,200);const doc=list.body.find(r=>r.status==='READY');assert(doc,'NO_LEGITIMATE_READY_DOCUMENT');
  const self=await rpc({p_action:'LIST',p_data:{domain:'program',admin:false}});assert.equal(self.status,200);assert.deepEqual(self.body,[]);
  const edge=async(admin)=>{const r=await fetch(env.SUPABASE_URL+'/functions/v1/document-generation',{method:'POST',headers,body:JSON.stringify({action:'ACCESS',data:{id:doc.id,admin}})});return {status:r.status,body:await r.json()};};
  const denied=await edge(false);assert.equal(denied.status,403);assert.equal(denied.body.error,'DOCUMENT_ACCESS_DENIED');const allowed=await edge(true);assert.equal(allowed.status,200);assert.equal(allowed.body.expires_in,120);const pdf=await fetch(allowed.body.url);assert(pdf.ok);const bytes=Buffer.from(await pdf.arrayBuffer());assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
  proof('backend-verified',{status:'PASS',oidOwnerAclPreserved:true,sourceExact:true,affiliateContextList:0,affiliateContextAccess:denied.status,adminList:list.body.length,adminPdfAccess:allowed.status,legitimatePdf:true,ttlSeconds:120,rawUrlsLogged:0});return;
 }
 throw Error('UNKNOWN_MODE');
}
main().catch(e=>{console.error(e.code==='ERR_ASSERTION'?e.message:String(e.message).split('\n')[0]);process.exitCode=1;});
