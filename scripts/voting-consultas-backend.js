'use strict';
// H-SUTIAPP-VOTACIONES-CONSULTAS-004 backend runner.
//   test          : (1) capture + forward migration + matrix + recovery-with-data, (2) forward + recovery = exact schema;
//                   both inside transactions that always roll back. Production must be identical before and after.
//   restore-point : private copy of every voting row and function (additive, voting_restore_private.*_20261119).
//   apply         : applies the exact tested migration (requires the tested hash and the restore point).
//   verify        : read-only post-apply checks.
// Output never contains rows with personal data: only statuses, counts, hashes and check labels.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const {query,body}=require('./voting-consultas-db');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/voting-consultas-20261119');
const VERSION='20261119000100',NAME='voting_consultations';
const migration=`supabase/migrations/${VERSION}_${NAME}.sql`,recovery=`supabase/recovery/${VERSION}_${NAME}.sql`;
const read=file=>fs.readFileSync(path.join(root,file),'utf8').replace(/^﻿/,'').replace(/\r\n/g,'\n');
const sha=text=>crypto.createHash('sha256').update(text).digest('hex');
const write=(name,data)=>{fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,name),JSON.stringify(data,null,2)+'\n');};
const rolledBack=sql=>{assert(sql.startsWith('begin;')&&sql.trimEnd().endsWith('rollback;'),'test SQL must be one rolled-back transaction');assert(!/^\s*commit\s*;/im.test(sql),'test SQL must not commit');return sql;};

const SNAPSHOT=`select
 (select count(*)::int from public.voting_consultations) consultations,(select count(*)::int from public.voting_questions) questions,(select count(*)::int from public.voting_votes) votes,(select count(*)::int from public.voting_live_state) live_rows,
 (select md5(coalesce(string_agg(t::text,'|' order by t.id),'')) from public.voting_consultations t) consultations_hash,
 (select md5(coalesce(string_agg(t::text,'|' order by t.id),'')) from public.voting_questions t) questions_hash,
 (select md5(coalesce(string_agg(t::text,'|' order by t.id),'')) from public.voting_votes t) votes_hash,
 (select md5(coalesce(string_agg(t::text,'|' order by t.consultation_id),'')) from public.voting_live_state t) live_hash,
 (select md5(string_agg(p.oid::regprocedure::text||'='||md5(pg_get_functiondef(p.oid))||'='||coalesce(p.proacl::text,''),'|' order by p.oid::regprocedure::text)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like '%voting%') functions_hash,
 (select md5(string_agg(table_name||'.'||column_name||':'||data_type||':'||is_nullable,'|' order by table_name,ordinal_position)) from information_schema.columns where table_schema='public' and table_name like 'voting\\_%') columns_hash,
 (select md5(string_agg(conname||'='||pg_get_constraintdef(oid),'|' order by conname)) from pg_constraint where conrelid in ('public.voting_consultations'::regclass,'public.voting_questions'::regclass,'public.voting_votes'::regclass,'public.voting_live_state'::regclass)) constraints_hash,
 (select display_name from public.admin_section_definitions where section_key='admin_votaciones') menu,
 (select count(*)::int from supabase_migrations.schema_migrations where version='${VERSION}') migration_recorded`;

const SCHEMA_FN=`create function pg_temp.vx_schema() returns jsonb language sql stable as $$ select jsonb_build_object(
 'columns',(select jsonb_agg(table_name||'.'||column_name||':'||data_type||':'||is_nullable||':'||coalesce(column_default,'') order by table_name,ordinal_position) from information_schema.columns where table_schema='public' and table_name like 'voting\\_%'),
 'constraints',(select jsonb_object_agg(conrelid::regclass::text||'.'||conname,pg_get_constraintdef(oid)) from pg_constraint where conrelid in ('public.voting_consultations'::regclass,'public.voting_questions'::regclass,'public.voting_votes'::regclass,'public.voting_live_state'::regclass)),
 'functions',(select jsonb_object_agg(p.oid::regprocedure::text,jsonb_build_array(md5(pg_get_functiondef(p.oid)),p.proacl::text)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like '%voting%'),
 'triggers',(select jsonb_agg(pg_get_triggerdef(oid) order by tgname) from pg_trigger where tgrelid='public.voting_votes'::regclass and not tgisinternal),
 'menu',(select display_name from public.admin_section_definitions where section_key='admin_votaciones')) $$;`;

async function snapshot(){return (await query(SNAPSHOT))[0];}

async function main(){
 const mode=process.argv[2]||'test',source=read(migration),hash=sha(source),recoveryHash=sha(read(recovery));
 if(mode==='test'){
  const before=await snapshot();
  assert.equal(before.migration_recorded,0,'migration already recorded in production');
  const matrix=rolledBack(['begin;',read('scripts/test-voting-consultas-capture.sql'),body(migration),read('scripts/test-voting-consultas.sql'),body(recovery),read('scripts/test-voting-consultas-recovery.sql'),
   `select 'PASS' status,(select array_agg(label order by label) from vc_checks) groups;`,'rollback;'].join('\n'));
  const started=Date.now(),row=(await query(matrix,{write:true}))[0]||{},matrixMs=Date.now()-started;
  assert.equal(row.status,'PASS',JSON.stringify(row).slice(0,600));assert.equal(row.groups.length,16,'all check groups ran: '+row.groups.join(','));
  const exact=rolledBack(['begin;',SCHEMA_FN,'create temporary table vx_before as select pg_temp.vx_schema() snap;',body(migration),
   'create temporary table vx_mid as select pg_temp.vx_schema() snap;',body(recovery),
   `select (select snap from vx_before)=pg_temp.vx_schema() exact,(select snap from vx_before)<>(select snap from vx_mid) migration_changed_schema,
     (select coalesce(jsonb_agg(k),'[]') from jsonb_object_keys((select snap from vx_before)) k where (select snap from vx_before)->k is distinct from pg_temp.vx_schema()->k) differing;`,'rollback;'].join('\n'));
  const exactRow=(await query(exact,{write:true})).find(r=>'exact' in r)||{};
  assert.equal(exactRow.exact,true,'recovery without new data must restore the exact schema: '+JSON.stringify(exactRow.differing));assert.equal(exactRow.migration_changed_schema,true);
  const after=await snapshot();
  assert.deepEqual(after,before,'production changed during the rolled-back test');
  const data={status:'PASS',migrationSha256:hash,recoverySha256:recoveryHash,groups:row.groups,matrixMs,
   recovery:{withNewData:'functions byte-identical, new RPC dropped, columns in use preserved, existing consultations identical',withoutNewData:'exact schema, constraints, triggers, functions and ACLs'},
   productionBeforeAndAfter:{consultations:before.consultations,questions:before.questions,votes:before.votes,identical:true},fixturesPersisted:0};
  write('backend.json',data);console.log(JSON.stringify(data));
 }else if(mode==='restore-point'){
  const r=(await query(read('scripts/voting-consultas-restore-point.sql'),{write:true})).find(x=>x.status)||{};
  assert.equal(r.status,'PASS');
  const data={status:'PASS',schema:'voting_restore_private',suffix:'20261119',gitTag:'restore/pre-votaciones-consultas-20261119',baseCommit:'eefd9e267dc72d8bbc5b84f18d726a7d0c39f2c7',counts:r.counts,rowHashes:r.row_hashes,functions:r.functions,createdAt:new Date().toISOString()};
  write('restore-point.json',data);console.log(JSON.stringify({status:data.status,counts:data.counts}));
 }else if(mode==='apply'){
  const tested=JSON.parse(fs.readFileSync(path.join(out,'backend.json'),'utf8'));
  assert.equal(tested.status,'PASS');assert.equal(tested.migrationSha256,hash,'migration changed after the tested run');
  const restore=(await query(`select to_regclass('voting_restore_private.manifest_20261119') is not null present,(select count(*)::int from voting_restore_private.votes_20261119) votes`))[0];
  assert.equal(restore.present,true,'restore point required');
  const before=await snapshot();assert.equal(before.votes,restore.votes,'votes changed since the restore point');assert.equal(before.migration_recorded,0);
  const r=(await query('begin;\n'+body(migration)+`\ninsert into supabase_migrations.schema_migrations(version,name,statements) values('${VERSION}','${NAME}',array['${source.replace(/'/g,"''")}']);\nselect 'PASS' status;\ncommit;`,{write:true})).find(x=>x.status)||{};
  assert.equal(r.status,'PASS');
  const data={status:'PASS',version:VERSION,migrationSha256:hash,appliedAt:new Date().toISOString()};write('applied.json',data);console.log(JSON.stringify(data));
 }else if(mode==='verify'){
  const r=(await query(`select
   (select count(*)::int from supabase_migrations.schema_migrations where version='${VERSION}') migration_recorded,
   (select count(*)::int from public.voting_consultations) consultations,(select count(*)::int from public.voting_questions) questions,(select count(*)::int from public.voting_votes) votes,
   (select md5(coalesce(string_agg(row(t.id,t.consultation_id,t.question_id,t.affiliate_id,t.actor_auth_user_id,t.answer,t.folio,t.cast_at,t.identity_snapshot)::text,'|' order by t.id),'')) from public.voting_votes t)
    =(select md5(coalesce(string_agg(row(t.id,t.consultation_id,t.question_id,t.affiliate_id,t.actor_auth_user_id,t.answer,t.folio,t.cast_at,t.identity_snapshot)::text,'|' order by t.id),'')) from voting_restore_private.votes_20261119 t) votes_preserved,
   (select md5(coalesce(string_agg(row(t.id,t.title,t.closes_on,t.published,t.audience,t.archived_at,t.version)::text,'|' order by t.id),'')) from public.voting_consultations t where t.created_at<=(select created_at from voting_restore_private.manifest_20261119))
    =(select md5(coalesce(string_agg(row(t.id,t.title,t.closes_on,t.published,t.audience,t.archived_at,t.version)::text,'|' order by t.id),'')) from voting_restore_private.consultations_20261119 t) consultations_preserved,
   (select md5(coalesce(string_agg(row(t.id,t.consultation_id,t.title,t.detail,t.sort_order,t.archived_at)::text,'|' order by t.id),'')) from public.voting_questions t where t.id in (select id from voting_restore_private.questions_20261119))
    =(select md5(coalesce(string_agg(row(t.id,t.consultation_id,t.title,t.detail,t.sort_order,t.archived_at)::text,'|' order by t.id),'')) from voting_restore_private.questions_20261119 t) questions_preserved,
   not exists(select 1 from public.voting_consultations where id in (select id from voting_restore_private.consultations_20261119) and (presentation<>'{}'::jsonb or closes_on is null)) consultations_default,
   not exists(select 1 from public.voting_questions where id in (select id from voting_restore_private.questions_20261119) and (answer_kind<>'options' or options is not null or not final)) questions_default,
   not exists(select 1 from public.voting_votes where answer_text is not null or changed_at is not null) votes_default,
   has_function_privilege('authenticated','public.cast_voting_answer(uuid,uuid,text,text)','EXECUTE') answer_rpc_authenticated,
   has_function_privilege('anon','public.cast_voting_answer(uuid,uuid,text,text)','EXECUTE') answer_rpc_anon,
   has_function_privilege('authenticated','public.voting_clean_options(text,jsonb)','EXECUTE') helper_authenticated,
   has_table_privilege('authenticated','public.voting_votes','SELECT') votes_select,
   (select display_name from public.admin_section_definitions where section_key='admin_votaciones') menu,
   (select pg_get_constraintdef(oid) from pg_constraint where conname='voting_votes_answer_check' and conrelid='public.voting_votes'::regclass) answer_check`))[0];
  assert.equal(r.migration_recorded,1);for(const k of ['votes_preserved','consultations_preserved','questions_preserved','consultations_default','questions_default','votes_default','answer_rpc_authenticated'])assert.equal(r[k],true,k);
  for(const k of ['answer_rpc_anon','helper_authenticated','votes_select'])assert.equal(r[k],false,k);assert.equal(r.menu,'Votaciones y consultas');
  const data={status:'PASS',...r,historyUnchanged:true};write('installed.json',data);console.log(JSON.stringify(data));
 }else throw Error('Unknown mode '+mode);
}
main().catch(e=>{console.error(String(e.message).slice(0,1500));process.exitCode=1;});
