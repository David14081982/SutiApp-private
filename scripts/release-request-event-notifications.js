'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert').strict;
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/finance-request-confirmation-20260908'),backup='C:/tmp/sutiapp-confirmation-ux-20260908';
const values={};for(const line of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const at=line.indexOf('=');if(at>0&&!line.startsWith('#'))values[line.slice(0,at).trim()]=line.slice(at+1).trim().replace(/^['"]|['"]$/g,'');}
const hash=s=>crypto.createHash('sha256').update(s).digest('hex'),quote=s=>"'"+s.replace(/'/g,"''")+"'";
async function sql(query){const ref=new URL(values.SUPABASE_URL).hostname.split('.')[0],r=await fetch('https://api.supabase.com/v1/projects/'+ref+'/database/query',{method:'POST',headers:{Authorization:'Bearer '+values.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query})});const data=await r.json();if(!r.ok){fs.writeFileSync(path.join(backup,'release-private-error.json'),JSON.stringify(data));throw Error('MANAGEMENT_SQL_'+r.status);}return data;}
const baselineSql="select count(*) requests,md5(string_agg(to_jsonb(r)::text,',' order by r.id)) request_hash,(select md5(string_agg(to_jsonb(e)::text,',' order by e.id)) from public.program_request_admin_events e) event_hash,(select md5(string_agg(to_jsonb(t)::text,',' order by t.request_id)) from public.operational_request_tracking t) tracking_hash from public.program_requests r";
async function main(){
 const migration=fs.readFileSync(path.join(root,'supabase/migrations/20260908000600_request_event_notifications.sql'),'utf8');
 if(process.argv[2]==='apply'){
  const proof=JSON.parse(fs.readFileSync(path.join(out,'sql.json'),'utf8'));assert.equal(proof.status,'PASS');assert.equal(proof.migrationSha256,hash(migration));
  const installed=await sql("select to_regclass('public.program_request_event_receipts') is not null installed");assert(!installed[0].installed,'Already installed; use readback');
  const before=await sql(baselineSql);fs.writeFileSync(path.join(backup,'notification-before-apply.json'),JSON.stringify({before,migrationSha256:hash(migration),recovery:fs.readFileSync(path.join(root,'supabase/recovery/20260908000600_request_event_notifications.sql'),'utf8')}));
  const body=migration.replace(/^begin;\s*/i,'').replace(/commit;\s*$/i,'');
  await sql('begin;create temporary table notification_before as '+baselineSql+';'+body+
   "do $$ begin if (select row_to_json(b)::text from notification_before b)<>(select row_to_json(a)::text from ("+baselineSql+") a) then raise exception 'BUSINESS_MUTATION';end if;end $$;"+
   "insert into supabase_migrations.schema_migrations(version,name,statements) values('20260908000600','request_event_notifications',array["+quote(migration)+"]);commit;");
 }
 const result=await sql("select (select relrowsecurity and relforcerowsecurity from pg_class where oid='public.program_request_event_receipts'::regclass) rls,has_table_privilege('authenticated','public.program_request_event_receipts','select') exposed,has_function_privilege('anon','public.list_self_request_event_notifications()','execute') anon,(select count(*) from supabase_migrations.schema_migrations where version='20260908000600') migration_records,(select count(*) from public.program_request_event_receipts) receipts");
 assert.equal(result[0].rls,true);assert.equal(result[0].exposed,false);assert.equal(result[0].anon,false);assert.equal(Number(result[0].migration_records),1);
 const proof={status:'PASS',applied:true,migration:'20260908000600',migrationSha256:hash(migration),readback:result[0],businessWritersChanged:0};
 fs.writeFileSync(path.join(out,'migration-applied.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
