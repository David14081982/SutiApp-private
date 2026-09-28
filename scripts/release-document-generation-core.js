'use strict';
// Focused release transport. No fixtures, user rows, tokens or signed URLs are printed.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {query}=require('./savings-admin-review-db');
const root=path.resolve(__dirname,'..'),mode=process.argv[2]||'status',slug='document-generation',version='20260928000100';
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const values=Object.fromEntries(read('supabase.env').replace(/^\uFEFF/,'').split(/\r?\n/).map(l=>l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map(m=>[m[1],m[2].trim().replace(/^['"]|['"]$/g,'')]));
const ref=new URL(values.SUPABASE_URL).hostname.split('.')[0],base='https://api.supabase.com/v1/projects/'+ref;
const headers={Authorization:'Bearer '+values.SUPABASE_ACCESS_TOKEN};
async function api(route,options={}){const response=await fetch(base+route,{...options,headers:{...headers,...options.headers}});if(!response.ok){await response.body?.cancel();throw Error('MANAGEMENT_HTTP_'+response.status);}return response;}
async function metadata(){return (await query(`select jsonb_build_object('installed',to_regclass('document_private.records') is not null,'tracking',exists(select 1 from supabase_migrations.schema_migrations where version='${version}'),'latest',(select max(version) from supabase_migrations.schema_migrations),'savings_event_type',(select data_type from information_schema.columns where table_schema='public' and table_name='savings_audit_events' and column_name='id'),'private_bucket',(select not public from storage.buckets where id='generated-documents')) as result`))[0].result;}
async function main(){
 if(!['status','bundle','apply','apply-layout','apply-layout-refinement','deploy','verify'].includes(mode))throw Error('MODE_INVALID');
 if(mode==='apply-layout-refinement'){
  const migration='20260928000400',before=await metadata();
  if(before.latest!=='20260928000300'||!before.installed||!before.tracking)throw Error('DOCUMENT_LAYOUT_BASELINE_DRIFT');
  const sql=read('supabase/migrations/'+migration+'_document_layout_refinement.sql');
  await query(sql.replace(/commit;\s*$/i,`insert into supabase_migrations.schema_migrations(version,name,statements) values('${migration}','document_layout_refinement',array['H-SUTIAPP-DOCUMENT-LAYOUT-DESIGNER-002 sha256:${hash(sql)}']);commit;`));
  console.log(JSON.stringify({mode,status:'PASS',...await metadata(),migrationSha256:hash(sql)}));return;
 }
 if(mode==='apply-layout'){
  const layoutVersion='20260928000300',before=await metadata();
  if(before.latest!=='20260928000200'||!before.installed||!before.tracking)throw Error('DOCUMENT_LAYOUT_BASELINE_DRIFT');
  const sql=read('supabase/migrations/'+layoutVersion+'_document_layout_designer.sql');
  await query(sql.replace(/commit;\s*$/i,`insert into supabase_migrations.schema_migrations(version,name,statements) values('${layoutVersion}','document_layout_designer',array['H-SUTIAPP-DOCUMENT-LAYOUT-DESIGNER-001 sha256:${hash(sql)}']);commit;`));
  console.log(JSON.stringify({mode,status:'PASS',...await metadata(),migrationSha256:hash(sql)}));return;
 }
 if(mode==='status'){console.log(JSON.stringify({mode,...await metadata()}));return;}
 if(mode==='bundle'||mode==='deploy'){
  const form=new FormData();form.append('metadata',JSON.stringify({name:slug,entrypoint_path:'index.ts',verify_jwt:false}));
  for(const file of ['index.ts','renderer.mjs','layout.mjs','render-layout.mjs','layout-service.mjs'])form.append('file',new Blob([read('supabase/functions/'+slug+'/'+file)],{type:'application/typescript'}),file);
  const response=await api('/functions/deploy?slug='+slug+(mode==='bundle'?'&bundleOnly=true':''),{method:'POST',body:form});
  let body={};try{body=await response.json();}catch(_){}
  if(mode==='deploy'){
   const key=crypto.randomBytes(32).toString('hex');
   await api('/secrets',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify([{name:'DOCUMENT_GENERATION_WORKER_KEY',value:key}])});
   // Vault and Edge share a backend-only dispatch key; browser JWT is validated inside the Edge.
   await query(`do $$ declare secret_id uuid;begin
    select id into secret_id from vault.secrets where name='document_generation_worker_key';
    if secret_id is null then perform vault.create_secret('${key}','document_generation_worker_key');else perform vault.update_secret(secret_id,'${key}');end if;
    select id into secret_id from vault.secrets where name='document_generation_edge_url';
    if secret_id is null then perform vault.create_secret('${values.SUPABASE_URL}/functions/v1/${slug}','document_generation_edge_url');else perform vault.update_secret(secret_id,'${values.SUPABASE_URL}/functions/v1/${slug}');end if;
   end $$;`);
  }
  console.log(JSON.stringify({mode,status:'PASS',version:body.version||null,sourceSha256:hash(read('supabase/functions/'+slug+'/index.ts')),rendererSha256:hash(read('supabase/functions/'+slug+'/renderer.mjs'))}));return;
 }
 if(mode==='apply'){
  const before=await metadata();if(before.installed||before.tracking)throw Error('DOCUMENT_MIGRATION_ALREADY_PRESENT');
  if(before.savings_event_type!=='bigint')throw Error('DOCUMENT_SOURCE_SCHEMA_DRIFT');
  const sql=read('supabase/migrations/'+version+'_document_generation_core.sql');
  await query(sql.replace(/commit;\s*$/i,`insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','document_generation_core',array['H-SUTIAPP-DOCUMENT-GENERATION-CORE-001 sha256:${hash(sql)}']);commit;`));
  console.log(JSON.stringify({mode,status:'PASS',...await metadata(),migrationSha256:hash(sql)}));return;
 }
 const status=await metadata();if(!status.installed||!status.tracking||!status.private_bucket)throw Error('DOCUMENT_BACKEND_NOT_INSTALLED');
 const edge=await (await api('/functions/'+slug)).json();
 const unauthorized=await fetch(values.SUPABASE_URL+'/functions/v1/'+slug,{method:'POST',headers:{'Content-Type':'application/json'},body:'{"action":"ACCESS"}'});
 if(unauthorized.status!==401)throw Error('DOCUMENT_UNAUTHENTICATED_NOT_DENIED');
 const security=await query(`select jsonb_build_object('rls_tables',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='document_private' and c.relkind='r' and c.relrowsecurity and c.relforcerowsecurity),'browser_worker_execute',has_function_privilege('authenticated','public.document_generation_worker(text,jsonb)','execute'),'anon_command_execute',has_function_privilege('anon','public.document_generation_command(text,jsonb)','execute'),'cron',(select count(*) from cron.job where jobname='document-generation-core' and active),'triggers',(select count(*) from pg_trigger where tgname in ('document_program_approval','document_savings_approval')),'documents',(select count(*) from document_private.records)) as result`);
 const checked=security[0].result;
 const layoutSecurity=await query("select jsonb_build_object('installed',to_regclass('document_private.layouts') is not null,'browser_persist',case when to_regprocedure('public.document_layout_persist(text,jsonb)') is not null then has_function_privilege('authenticated','public.document_layout_persist(text,jsonb)','execute') else false end,'anon_context',case when to_regprocedure('public.document_layout_context(text,jsonb)') is not null then has_function_privilege('anon','public.document_layout_context(text,jsonb)','execute') else false end) as result");
 const layout=layoutSecurity[0].result;if(checked.rls_tables!==(layout.installed?10:8)||layout.browser_persist||layout.anon_context||checked.browser_worker_execute||checked.anon_command_execute||checked.cron!==1||checked.triggers!==2)throw Error('DOCUMENT_SECURITY_POSTFLIGHT_FAILED');
 console.log(JSON.stringify({mode,status:'PASS',edgeStatus:edge.status,...checked,layoutSecurity:layout,unauthenticatedHttp:401}));
}
main().catch(e=>{console.error(JSON.stringify({status:'FAIL',error:/MANAGEMENT_HTTP|DOCUMENT_|MODE_INVALID/.test(e.message)?e.message:'RELEASE_TRANSPORT_FAILED'}));process.exitCode=1;});
