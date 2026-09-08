'use strict';
const fs=require('fs'),path=require('path'),a=require('./audit.cjs');
const definitions=require('./policy-definitions.json');
const root=path.resolve(__dirname,'../../../../..');
function guard(accepted){return `do $guard$
declare p record;
begin
 select polcmd,polpermissive,polwithcheck,
  md5(pg_get_expr(polqual,polrelid)) hash,
  array(select r.rolname::text from pg_catalog.pg_roles r where r.oid=any(polroles) order by 1) roles
 into strict p from pg_catalog.pg_policy
 where polrelid='storage.objects'::regclass and polname='master_private_storage_authorized_read';
 if p.hash is null or p.hash <> all(array[${accepted.map(x=>"'"+x+"'").join(',')}])
 or p.roles <> array['authenticated']::text[] or p.polcmd <> 'r'
 or not p.polpermissive or p.polwithcheck is not null then
  raise exception 'H04_POLICY_DRIFT';
 end if;
 if not (select relrowsecurity from pg_catalog.pg_class where oid='storage.objects'::regclass)
 or (select public from storage.buckets where id='private-assets') is distinct from false then
  raise exception 'H04_STORAGE_SECURITY_DRIFT';
 end if;
end;
$guard$;
`;}
const header="-- H04: equivalent private Storage authorization; no data or grant changes.\nbegin;\nset local lock_timeout='2s';\nset local statement_timeout='15s';\nset local search_path='';\n";
const migration=header+guard([definitions.before.md5,definitions.after.md5])+fs.readFileSync(a.dir+'/candidate-split.sql','utf8').replace(/^--.*\r?\n/,'')+guard([definitions.after.md5])+'commit;\n';
const recovery=header+guard([definitions.after.md5,definitions.before.md5])+`alter policy master_private_storage_authorized_read on storage.objects using (${definitions.before.qual});\n`+guard([definitions.before.md5])+'commit;\n';
const filename='20260907000400_private_storage_rls_work.sql';
for(const [folder,content] of [['migrations',migration],['recovery',recovery]]){
 const directory=path.join(root,'supabase',folder);fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(path.join(directory,filename),content);
}
console.log('H04 migration and recovery prepared');
