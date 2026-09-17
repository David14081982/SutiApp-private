'use strict';
// H-SUTIAPP-VOTACIONES-VER-003 backend runner.
//   test  : forward migration + matrix + recovery, all inside one transaction that always rolls back.
//   apply : applies the exact tested migration and records it in supabase_migrations.
//   verify: read-only post-apply checks.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const {query,body}=require('./voting-live-db');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/voting-ver-20260917');
const migration='supabase/migrations/20260917000200_voting_vote_admin.sql',recovery='supabase/recovery/20260917000200_voting_vote_admin.sql';
const read=file=>fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');
const sha=text=>crypto.createHash('sha256').update(text).digest('hex');
const write=(name,data)=>{fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,name),JSON.stringify(data,null,2));};
const counts=`select (select count(*) from public.voting_consultations) consultations,(select count(*) from public.voting_votes) votes,(select count(*) from public.admin_audit_log) audit,
 (select md5(coalesce(string_agg(t::text,'|' order by t.id),'')) from public.voting_votes t) votes_hash`;
async function main(){
 const mode=process.argv[2]||'test',source=read(migration),hash=sha(source);
 if(mode==='test'){
  const before=(await query(counts))[0];
  const sql=['begin;',body(migration),read('scripts/test-voting-ver.sql'),body(recovery),
   `select 'PASS' status,(select array_agg(label order by label) from voting_ver_checks) groups,
     to_regprocedure('public.list_voting_votes(uuid)') is null and to_regprocedure('public.delete_voting_votes(uuid,uuid,uuid)') is null functions_dropped_after_recovery,
     pg_get_functiondef('public.voting_immutable_vote()'::regprocedure) not like '%voting_delete_votes%' gate_removed_after_recovery;`,
   'rollback;'].join('\n');
  const result=await query(sql),row=result[0]||{};
  assert.equal(row.status,'PASS',JSON.stringify(result).slice(0,1200));
  assert.equal(row.functions_dropped_after_recovery,true);assert.equal(row.gate_removed_after_recovery,true);
  const after=(await query(counts))[0];
  assert.equal(after.votes_hash,before.votes_hash,'production votes changed');assert.equal(Number(after.consultations),Number(before.consultations));
  const data={status:'PASS',migrationSha256:hash,recoverySha256:sha(read(recovery)),groups:row.groups,recoveryVerified:true,productionAfterRollback:{...after,matchesBefore:true},fixturesPersisted:0};
  write('backend.json',data);console.log(JSON.stringify(data));
 }else if(mode==='apply'){
  const tested=JSON.parse(fs.readFileSync(path.join(out,'backend.json'),'utf8'));
  assert.equal(tested.status,'PASS');assert.equal(tested.migrationSha256,hash,'Migration changed after the tested run');
  const result=await query('begin;\n'+body(migration)+"\ninsert into supabase_migrations.schema_migrations(version,name,statements) values('20260917000200','voting_vote_admin',array['"+source.replace(/'/g,"''")+"']);\nselect 'PASS' status;\ncommit;");
  assert.equal(result[0]?.status,'PASS');
  const data={status:'PASS',version:'20260917000200',migrationSha256:hash,appliedAt:new Date().toISOString()};write('applied.json',data);console.log(JSON.stringify(data));
 }else if(mode==='verify'){
  const r=(await query(`select (select count(*) from supabase_migrations.schema_migrations where version='20260917000200') migration_recorded,
   has_function_privilege('authenticated','public.list_voting_votes(uuid)','EXECUTE') list_rpc,has_function_privilege('authenticated','public.delete_voting_votes(uuid,uuid,uuid)','EXECUTE') delete_rpc,
   has_function_privilege('anon','public.delete_voting_votes(uuid,uuid,uuid)','EXECUTE') anon_delete,has_table_privilege('authenticated','public.voting_votes','DELETE') votes_delete,
   (select count(*) from pg_trigger where tgrelid='public.voting_votes'::regclass and tgname='voting_votes_immutable' and tgenabled='O') trigger_enabled`))[0];
  assert.equal(Number(r.migration_recorded),1);assert.equal(r.list_rpc,true);assert.equal(r.delete_rpc,true);assert.equal(r.anon_delete,false);assert.equal(r.votes_delete,false);assert.equal(Number(r.trigger_enabled),1);
  const data={status:'PASS',...r};write('installed.json',data);console.log(JSON.stringify(data));
 }else throw Error('Unknown mode '+mode);
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
