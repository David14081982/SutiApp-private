'use strict';
// Exact migration, actor-scoped assignment and Edge release. Never prints secrets/PII.
const fs=require('fs'),path=require('path'),crypto=require('crypto');const {query}=require('./savings-admin-review-db');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/sutifarma-20260928'),version='20260928000600';
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const env=Object.fromEntries(read('supabase.env').replace(/^\uFEFF/,'').split(/\r?\n/).map(l=>l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map(m=>[m[1],m[2].trim().replace(/^['"]|['"]$/g,'')]));
const quote=s=>"'"+s.replace(/'/g,"''")+"'",hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const base='https://api.supabase.com/v1/projects/'+new URL(env.SUPABASE_URL).hostname.split('.')[0];
async function api(route,options={}){const r=await fetch(base+route,{...options,headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN,...options.headers}});if(!r.ok){await r.body?.cancel();throw Error('FARMA_MANAGEMENT_HTTP_'+r.status);}return r;}
async function snapshot(){return (await query(`select jsonb_build_object('latest',(select max(version) from supabase_migrations.schema_migrations),'requests',(select count(*) from program_requests),'requests_hash',(select md5(string_agg(to_jsonb(r)::text,',' order by id)) from program_requests r),'affiliates_hash',(select md5(string_agg(to_jsonb(a)::text,',' order by id)) from affiliates a),'other_catalog_hash',(select md5(string_agg(to_jsonb(i)::text,',' order by id)) from program_catalog_items i where program_key<>'farma'),'catalog_assets_hash',(select md5(string_agg(to_jsonb(i)::text,',' order by id)) from program_catalog_item_assets i),'farma_products',(select count(*) from program_catalog_items where program_key='farma')) result`))[0].result;}
async function verify(){return (await query(`select jsonb_build_object('inventory_count',(select count(*) from farma_private.inventory),'opening_units',(select sum(opening_quantity) from farma_private.inventory),'new_requests',(select count(*) from farma_private.requests),'rls_tables',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='farma_private' and c.relkind='r' and c.relrowsecurity and c.relforcerowsecurity),'public_rpc',has_function_privilege('anon','public.farma_command(text,jsonb)','execute'),'browser_worker',has_function_privilege('authenticated','public.claim_farma_push_batch()','execute'),'manager_modules',(select jsonb_agg(distinct d.module_key) from admin_section_responsibilities s join admin_section_definitions d using(section_key) join auth.users u on u.id=s.auth_user_id where lower(u.email)='marianafrancoq32@gmail.com' and s.enabled),'cron',(select count(*) from cron.job where jobname='farma-web-push' and active),'push_subscribed',(select count(*) from request_push_subscriptions s join auth.users u on u.id=s.auth_user_id where lower(u.email)='marianafrancoq32@gmail.com' and s.revoked_at is null)) result`))[0].result;}
async function main(){fs.mkdirSync(out,{recursive:true});const mode=process.argv[2]||'status';
 if(mode==='status'){console.log(JSON.stringify(await snapshot()));return;}
 if(mode==='apply'){
  const before=await snapshot();if(before.latest!=='20260928000500'||before.farma_products!==50)throw Error('FARMA_PREFLIGHT_DRIFT');
  const sql=read('supabase/migrations/'+version+'_sutifarma_donations.sql');
  const assignment=`
do $assignment$ declare actor uuid; target uuid; current_state jsonb;begin
 select u.id into actor from auth.users u join admin_assignments a on a.auth_user_id=u.id and a.enabled join admin_roles r on r.id=a.role_id and r.code='principal_admin' where lower(u.email)=lower(${quote(env.H005_TEST_EMAIL)});
 if actor is null then raise exception 'FARMA_AUTHORIZED_ACTOR_MISSING';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 current_state:=public.get_admin_user_modules('marianafrancoq32@gmail.com');
 if current_state->>'mode'<>'unassigned' or coalesce((current_state->>'protected')::boolean,false) then raise exception 'FARMA_MANAGER_ASSIGNMENT_DRIFT';end if;
 perform public.save_admin_user_modules('marianafrancoq32@gmail.com','limited',array['farma'],current_state->>'version');
end $assignment$;
insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','sutifarma_donations',array['H-SUTIFARMA-DONATIONS-001 sha256:${hash(sql)}']);commit;`;
  await query(sql.replace(/commit;\s*$/i,()=>assignment));const after=await snapshot(),security=await verify();
  for(const key of ['requests','requests_hash','affiliates_hash','other_catalog_hash','catalog_assets_hash','farma_products'])if(before[key]!==after[key])throw Error('FARMA_POSTFLIGHT_'+key);
  if(security.rls_tables!==7||security.inventory_count!==50||security.public_rpc||security.browser_worker||JSON.stringify(security.manager_modules)!=='["farma"]')throw Error('FARMA_SECURITY_POSTFLIGHT');
  const evidence={status:'PASS',before,after,security,migrationSha256:hash(sql),syntheticProductionWrites:0};fs.writeFileSync(path.join(out,'apply.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));return;
 }
 if(mode==='bundle'||mode==='deploy'){
  const slug='request-push';const form=new FormData();form.append('metadata',JSON.stringify({name:slug,entrypoint_path:'index.ts',verify_jwt:false}));form.append('file',new Blob([read('supabase/functions/request-push/index.ts')],{type:'application/typescript'}),'index.ts');
  const response=await api('/functions/deploy?slug='+slug+(mode==='bundle'?'&bundleOnly=true':''),{method:'POST',body:form});const result=await response.json();const evidence={status:'PASS',mode,version:result.version||null,sourceSha256:hash(read('supabase/functions/request-push/index.ts'))};fs.writeFileSync(path.join(out,'edge-'+mode+'.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));return;
 }
 if(mode==='verify'){console.log(JSON.stringify(await verify()));return;}throw Error('FARMA_MODE_INVALID');
}
main().catch(e=>{console.error(/FARMA_/.test(e.message)?e.message:'FARMA_RELEASE_FAILED');process.exitCode=1;});
