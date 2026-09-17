'use strict';
// H-SUTIAPP-CONVENIOS-ANUNCIOS-001 backend runner.
//   test  : forward migration + audience matrix + recovery inside one transaction that always rolls back.
//   apply : applies the exact tested migration and records it in supabase_migrations.
//   verify: read-only post-apply checks.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const {query,body}=require('./voting-live-db');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/anuncios-convenios-20260917');
const migration='supabase/migrations/20260917000100_banners_audience.sql',recovery='supabase/recovery/20260917000100_banners_audience.sql';
const read=file=>fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');
const sha=text=>crypto.createHash('sha256').update(text).digest('hex');
const write=(name,data)=>{fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,name),JSON.stringify(data,null,2));};
const restore=()=>JSON.parse(fs.readFileSync(path.join(out,'restore-point.json'),'utf8'));
const stateSql=`select (select count(*) from public.banners) banners,(select md5(string_agg(t::text,'|' order by t.id)) from public.banners t) banners_hash,(select count(*) from public.banner_deletions) deletions`;
async function main(){
 const mode=process.argv[2]||'test',source=read(migration),hash=sha(source);
 if(mode==='test'){
  const sql=['begin;',body(migration),read('scripts/test-banners-audience.sql'),body(recovery),
   `select 'PASS' status,(select array_agg(label order by label) from ad_checks) groups,
     (select count(*) from pg_proc where proname='list_public_banners') rpc_after_recovery,
     (select pg_get_expr(polqual,polrelid) from pg_policy where polrelid='public.banners'::regclass and polname='banners_public_read') policy_after_recovery,
     (select count(*) from information_schema.columns where table_schema='public' and table_name='banners' and column_name='audience_mode') columns_kept;`,
   'rollback;'].join('\n');
  const row=(await query(sql))[0]||{};
  assert.equal(row.status,'PASS');assert.equal(Number(row.rpc_after_recovery),0);assert.equal(row.policy_after_recovery,'(enabled = true)');assert.equal(Number(row.columns_kept),1);
  const after=(await query(stateSql))[0],base=restore();
  assert.equal(Number(after.banners),base.banners);assert.equal(after.banners_hash,base.banners_hash);assert.equal(Number(after.deletions),base.deletions);
  const data={status:'PASS',migrationSha256:hash,recoverySha256:sha(read(recovery)),groups:row.groups,recovery:{rpcDropped:true,policy:row.policy_after_recovery,columnsKept:true},productionAfterRollback:{...after,matchesRestorePoint:true},fixturesPersisted:0};
  write('backend.json',data);console.log(JSON.stringify(data));
 }else if(mode==='apply'){
  const tested=JSON.parse(fs.readFileSync(path.join(out,'backend.json'),'utf8'));
  assert.equal(tested.status,'PASS');assert.equal(tested.migrationSha256,hash,'Migration changed after the tested run');
  const result=await query('begin;\n'+body(migration)+"\ninsert into supabase_migrations.schema_migrations(version,name,statements) values('20260917000100','banners_audience',array['"+source.replace(/'/g,"''")+"']);\nselect 'PASS' status;\ncommit;");
  assert.equal(result[0]?.status,'PASS');
  const data={status:'PASS',version:'20260917000100',migrationSha256:hash,appliedAt:new Date().toISOString()};write('applied.json',data);console.log(JSON.stringify(data));
 }else if(mode==='verify'){
  const r=(await query(`select (select count(*) from supabase_migrations.schema_migrations where version='20260917000100') recorded,
   (select count(*) from public.banners where audience_mode='all' and accent_hue is null and created_at<'2026-09-17') legacy_defaulted,
   (select count(*) from public.banners where created_at<'2026-09-17') legacy_rows,
   (select pg_get_expr(polqual,polrelid) from pg_policy where polrelid='public.banners'::regclass and polname='banners_public_read') public_read,
   has_function_privilege('anon','public.list_public_banners(text)','EXECUTE') anon_rpc,
   has_column_privilege('authenticated','public.banners','audience_mode','INSERT') audience_insert,
   (select count(*) from public.banner_deletions) deletions`))[0];
  assert.equal(Number(r.recorded),1);assert.equal(Number(r.legacy_defaulted),Number(r.legacy_rows));assert.equal(r.anon_rpc,true);assert.equal(r.audience_insert,true);
  assert(String(r.public_read).includes('matches_current_affiliate_audience'),'audience-aware public read');assert.equal(Number(r.deletions),restore().deletions);
  const data={status:'PASS',...r,archivedUntouched:true};write('installed.json',data);console.log(JSON.stringify(data));
 }else throw Error('Unknown mode '+mode);
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
