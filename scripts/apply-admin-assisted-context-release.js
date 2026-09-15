'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const {query}=require('./savings-admin-review-db');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/admin-assisted-context-20260915'),version='20260915000100';
const file='supabase/migrations/'+version+'_admin_assisted_context.sql',source=fs.readFileSync(path.join(root,file),'utf8'),hash=crypto.createHash('sha256').update(source).digest('hex');
const quote=s=>"'"+s.replace(/'/g,"''")+"'",body=source.trim().slice(6,-7);
const snapshot=`jsonb_build_object(
 'assignments',(select md5(coalesce(string_agg(to_jsonb(t)::text,'' order by auth_user_id),'')) from public.admin_assignments t),
 'responsibilities',(select md5(coalesce(string_agg(to_jsonb(t)::text,'' order by auth_user_id,section_key,action),'')) from public.admin_section_responsibilities t),
 'existing_roles',(select md5(coalesce(string_agg(to_jsonb(t)::text,'' order by id),'')) from public.admin_roles t ),
 'role_permissions',(select md5(coalesce(string_agg(to_jsonb(t)::text,'' order by role_id,permission),'')) from public.admin_role_permissions t),
 'affiliates',(select md5(coalesce(string_agg(to_jsonb(t)::text,'' order by id),'')) from public.affiliates t),
 'requests',(select md5(coalesce(string_agg(to_jsonb(t)::text,'' order by id),'')) from public.program_requests t),
 'assets',(select count(*) from public.app_assets),
 'private_assets',(select count(*) from public.private_assets),
 'objects',(select count(*) from storage.objects))`;
async function main(){
 const expected=JSON.parse(fs.readFileSync(path.join(out,'prepared.json'),'utf8')).migrationSha256;assert.equal(hash,expected,'Reviewed SQL changed');
 const installed=await query(`select version from supabase_migrations.schema_migrations where version='${version}'`);
 if(installed.length)throw Error('MIGRATION_ALREADY_INSTALLED: use installed verification');
 const mode=process.argv[2];assert(['test','apply'].includes(mode));
 assert.equal(mode,'apply');
 assert.equal(JSON.parse(fs.readFileSync(path.join(out,'backend.json'),'utf8')).status,'PASS');
 assert.equal(JSON.parse(fs.readFileSync(path.join(out,'browser.json'),'utf8')).status,'PASS');
 const sql=`begin isolation level repeatable read;
 create temporary table module_install_before on commit drop as select ${snapshot} value;
 ${body}
 create temporary table module_install_after on commit drop as select ${snapshot} value;
 do $$begin
  if (select value from module_install_before) is distinct from (select value from module_install_after) then raise exception 'INSTALL_CHANGED_EXISTING_DATA'; end if;
  if (select count(*) from public.admin_section_definitions where module_key is not null)<>33 then raise exception 'MODULE_CATALOG_INCOMPLETE'; end if;
 end $$;
 insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','admin_assisted_context',array[${quote(source)}]);
 select 'PASS' status,${quote(hash)} migration_sha256,(select value from module_install_before) before,(select value from module_install_after) after;
 commit;`;
 const proof=await query(sql);assert.equal(proof[0]?.status,'PASS');const result={status:'PASS',version,migrationSha256:hash,proof,existingAssignmentsChanged:0,businessRowsChanged:0};
 fs.writeFileSync(path.join(out,'release-sql-applied.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({status:'PASS',version,existingAssignmentsChanged:0,businessRowsChanged:0}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
