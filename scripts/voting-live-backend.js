'use strict';
// H-SUTIAPP-VOTACIONES-LIVE-002 backend runner.
//   test  : forward migration + live matrix + recovery, all inside one transaction that always rolls back.
//   apply : applies the exact tested migration and records it in supabase_migrations.
//   verify: read-only post-apply checks.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const {query,body}=require('./voting-live-db');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/voting-live-20260916');
const migration='supabase/migrations/20260916000200_voting_live.sql',recovery='supabase/recovery/20260916000200_voting_live.sql';
const read=file=>fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');
const sha=text=>crypto.createHash('sha256').update(text).digest('hex');
const write=(name,data)=>{fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,name),JSON.stringify(data,null,2));};
async function main(){
 const mode=process.argv[2]||'test',source=read(migration),hash=sha(source),recoveryHash=sha(read(recovery));
 if(mode==='test'){
  const sql=['begin;',body(migration),read('scripts/test-voting-live.sql'),body(recovery),
   `select 'PASS' status,(select array_agg(label order by label) from voting_live_checks) groups,
     (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('set_voting_active_question','get_voting_live','count_voting_electorate','voting_live_visible','voting_live_touch','voting_electorate')) new_functions_after_recovery,
     (select count(*) from pg_publication_tables where pubname='supabase_realtime' and tablename='voting_live_state') published_after_recovery,
     (select pg_get_constraintdef(oid) from pg_constraint where conname='voting_consultations_electorate_check') electorate_check_after_recovery;`,
   'rollback;'].join('\n');
  const result=await query(sql),row=result[0]||{};
  assert.equal(row.status,'PASS',JSON.stringify(result).slice(0,1200));
  assert.equal(Number(row.new_functions_after_recovery),0);assert.equal(Number(row.published_after_recovery),0);
  assert.equal(row.electorate_check_after_recovery,'CHECK ((electorate > 0))');
  const after=await query(`select (select count(*) from public.voting_consultations) consultations,(select count(*) from public.voting_questions) questions,(select count(*) from public.voting_votes) votes,
   (select count(*) from pg_class where relname='voting_live_state') live_table,(select md5(coalesce(string_agg(t::text,'|' order by t.id),'')) from public.voting_votes t) votes_hash`);
  const restore=JSON.parse(fs.readFileSync(path.join(out,'restore-point.json'),'utf8'));
  assert.equal(Number(after[0].votes),restore.counts.votes);assert.equal(after[0].votes_hash,restore.row_hashes.votes);assert.equal(Number(after[0].live_table),0,'rolled back');
  const data={status:'PASS',migrationSha256:hash,recoverySha256:recoveryHash,groups:row.groups,recoveryVerified:{newFunctionsDropped:true,unpublished:true,electorateCheck:row.electorate_check_after_recovery,functionMd5sRestored:true},
   productionAfterRollback:{...after[0],matchesRestorePoint:true},fixturesPersisted:0};
  write('backend.json',data);console.log(JSON.stringify(data));
 }else if(mode==='apply'){
  const tested=JSON.parse(fs.readFileSync(path.join(out,'backend.json'),'utf8'));
  assert.equal(tested.status,'PASS');assert.equal(tested.migrationSha256,hash,'Migration changed after the tested run');
  const result=await query('begin;\n'+body(migration)+"\ninsert into supabase_migrations.schema_migrations(version,name,statements) values('20260916000200','voting_live',array['"+source.replace(/'/g,"''")+"']);\nselect 'PASS' status;\ncommit;");
  assert.equal(result[0]?.status,'PASS');
  const data={status:'PASS',version:'20260916000200',migrationSha256:hash,appliedAt:new Date().toISOString()};write('applied.json',data);console.log(JSON.stringify(data));
 }else if(mode==='verify'){
  const result=await query(`select
   (select count(*) from supabase_migrations.schema_migrations where version='20260916000200') migration_recorded,
   (select count(*) from public.voting_consultations) consultations,(select count(*) from public.voting_questions) questions,(select count(*) from public.voting_votes) votes,
   (select md5(coalesce(string_agg(t::text,'|' order by t.id),'')) from public.voting_votes t) votes_hash,
   (select count(*) from public.voting_live_state) live_rows,(select count(*) from public.voting_live_state where active_question_id is not null) on_air,
   (select count(*) from pg_publication_tables where pubname='supabase_realtime' and tablename='voting_live_state') realtime,
   has_table_privilege('authenticated','public.voting_live_state','SELECT') signal_select,has_table_privilege('authenticated','public.voting_live_state','UPDATE') signal_update,
   has_table_privilege('authenticated','public.voting_votes','SELECT') votes_select,
   has_function_privilege('anon','public.set_voting_active_question(uuid,uuid)','EXECUTE') anon_activate,
   (select count(*) from voting_restore_private.votes_20260916) restore_point_votes`);
  const r=result[0],restore=JSON.parse(fs.readFileSync(path.join(out,'restore-point.json'),'utf8'));
  assert.equal(Number(r.migration_recorded),1);assert.equal(Number(r.votes),restore.counts.votes);assert.equal(r.votes_hash,restore.row_hashes.votes);
  assert.equal(Number(r.live_rows),Number(r.consultations));assert.equal(Number(r.realtime),1);assert.equal(r.signal_select,true);assert.equal(r.signal_update,false);
  assert.equal(r.votes_select,false);assert.equal(r.anon_activate,false);assert.equal(Number(r.restore_point_votes),restore.counts.votes);
  const data={status:'PASS',...r,historyUnchanged:true};write('installed.json',data);console.log(JSON.stringify(data));
 }else throw Error('Unknown mode '+mode);
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
