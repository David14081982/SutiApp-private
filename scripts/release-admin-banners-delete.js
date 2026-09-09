'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert').strict,crypto=require('crypto');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/admin-banners-delete-20260908'),env={};
for(const line of fs.readFileSync(process.env.SUTIAPP_ENV_FILE||'C:/Users/david/OneDrive/Documentos/Sutiapp 20082026/supabase.env','utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const at=line.indexOf('=');if(at>0&&!line.trim().startsWith('#'))env[line.slice(0,at).trim()]=line.slice(at+1).trim().replace(/^['"]|['"]$/g,'');}
const quote=s=>"'"+String(s).replace(/'/g,"''")+"'",sha=s=>crypto.createHash('sha256').update(s).digest('hex');
async function sql(query){const r=await fetch('https://api.supabase.com/v1/projects/'+new URL(env.SUPABASE_URL).hostname.split('.')[0]+'/database/query',{method:'POST',headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query}),signal:AbortSignal.timeout(60000)});const d=await r.json();if(!r.ok)throw Error('SQL '+r.status+' '+JSON.stringify(d));return d;}
function proof(name,data){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(data,null,2)+'\n');console.log(JSON.stringify(data));}
const inventory=`select (select count(*) from public.banners) as banners,(select md5(string_agg(to_jsonb(b)::text,'' order by id)) from public.banners b) as banner_hash,(select count(*) from public.app_assets) as assets,(select count(*) from storage.objects) as objects`;
async function main(){
 const mode=process.argv[2],version='20260908000800',name='admin_banners_archive',file=path.join(root,'supabase/migrations/'+version+'_'+name+'.sql');
 if(mode==='audit'){
  const counts=(await sql(inventory))[0],schema=await sql("select column_name,data_type from information_schema.columns where table_schema='public' and table_name='banners' order by ordinal_position"),policies=await sql("select policyname,permissive,roles,cmd,qual,with_check from pg_policies where schemaname='public' and tablename='banners'"),triggers=await sql("select pg_get_triggerdef(oid) as definition from pg_trigger where tgrelid='public.banners'::regclass and not tgisinternal");
  proof('before',{status:'PASS',counts,schema,policies,triggers});return;
 }
 const source=fs.readFileSync(file,'utf8'),strip=s=>s.replace(/^begin;\s*/i,'').replace(/commit;\s*$/i,''),body=strip(source);
 if(mode==='test'||mode==='verify'){
  const actor=(await sql('select id from auth.users where email='+quote(env.H005_TEST_EMAIL)))[0];assert(actor);
  const tests=fs.readFileSync(path.join(root,'scripts/test-admin-banners-delete.sql'),'utf8');
  const result=await sql('begin;'+(mode==='test'?body:'')+"select set_config('test.banner_actor',"+quote(actor.id)+",true); savepoint before_tests;"+tests+'rollback to before_tests;'+(mode==='test'?strip(fs.readFileSync(path.join(root,'supabase/recovery/'+version+'_'+name+'.sql'),'utf8')):'')+"select 'PASS' as result;rollback;");
  if(mode==='test'){
   let blocked=false;try{await sql('begin;'+body+"select set_config('request.jwt.claim.sub',"+quote(actor.id)+",true);select public.archive_admin_banner((select id from public.banners limit 1));"+strip(fs.readFileSync(path.join(root,'supabase/recovery/'+version+'_'+name+'.sql'),'utf8'))+'rollback;');}catch(e){if(!e.message.includes('BANNER_ARCHIVE_HISTORY_MUST_BE_PRESERVED'))throw e;blocked=true;}assert(blocked);
  }
  proof(mode==='test'?'sql-dry-run':'sql-live',{status:'PASS',migrationSha256:sha(source),result,persistentBusinessWrites:0,checks:['active','inactive','historical','adminHidden','publicHidden','normalDenied','updateOnlyDenied','deleteOnlyAllowed','auditActorTime','idempotentRetry','archivedWritesDenied','privateMetadataDenied','auditFailureAtomic','masterRowsUnchanged'],recovery:mode==='test'?'PASS_EMPTY_AND_HISTORY_GUARD':'NOT APPLICABLE'});return;
 }
 if(mode==='apply'){
  assert.equal(JSON.parse(fs.readFileSync(path.join(out,'sql-dry-run.json'))).migrationSha256,sha(source));const before=(await sql(inventory))[0];
  await sql('begin;'+body+`insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name}',array[${quote(source)}]);commit;`);
  const after=(await sql(inventory))[0];assert.deepEqual(after,before);proof('sql-apply',{status:'PASS',version,migrationSha256:sha(source),before,after,businessRowsChanged:0});return;
 }
 throw Error('Unknown mode');
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={sql,env,quote,proof};
