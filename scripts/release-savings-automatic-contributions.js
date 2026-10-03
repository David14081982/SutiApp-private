'use strict';
// Authorized Savings release. Secrets and row-level backups never enter public evidence.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const {query,rpc,login}=require('./release-sicof-backend.js');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'.tmp/savings-auto-contributions'),out=path.join(root,'docs/qa/evidence/savings-automatic-contributions');
fs.mkdirSync(dir,{recursive:true});fs.mkdirSync(out,{recursive:true});
const name='20261003000400_savings_automatic_contributions',version=name.slice(0,14),file='supabase/migrations/'+name+'.sql';
const read=f=>fs.readFileSync(path.join(root,f),'utf8'),q=s=>"'"+String(s).replace(/'/g,"''")+"'",sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const save=(name,data)=>fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify(data,null,2)+'\n');
const load=name=>JSON.parse(fs.readFileSync(path.join(dir,name+'.json'),'utf8'));
const proof=(name,data)=>{const result={status:'PASS',at:new Date().toISOString(),...data};fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));};
const tables=['savings_participants','savings_enrollments','savings_contribution_plans','savings_contribution_overrides','savings_transactions','savings_balance_certifications','savings_audit_events','savings_yield_allocations','savings_yield_periods','savings_withdrawal_openings','savings_holds','savings_requests','savings_publication_state'];
const fp=(after=false)=>tables.map(n=>`select '${n}' resource,count(*)::int rows,md5(coalesce(string_agg(${after&&n==='savings_contribution_overrides'?"(to_jsonb(t)-'entry_source')":"to_jsonb(t)"}::text,'|' order by to_jsonb(t)->>'id'),'')) fingerprint from public.${n} t`).join(' union all ');
const functions=`select n.nspname schema,p.oid,p.oid::regprocedure::text signature,p.proname name,pg_get_userbyid(p.proowner) owner,p.proacl::text acl,md5(pg_get_functiondef(p.oid)) md5,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.prokind='f' and ((n.nspname='public' and p.proname like '%savings%') or n.nspname like 'savings%') order by p.oid`;
function verifyCandidate(){
 const evidence=JSON.parse(read('docs/qa/evidence/savings-automatic-contributions/sql-isolated.json'));assert.equal(evidence.status,'PASS');
 for(const [file,digest] of Object.entries(evidence.hashes))assert.equal(sha(read(file)),digest,'TESTED_CANDIDATE_CHANGED:'+file);
 const review=JSON.parse(read('docs/qa/evidence/savings-automatic-contributions/sql-review.json'));assert.equal(review.status,'APPROVED');assert.equal(review.migrationSha256,sha(read(file)));assert.equal(review.recoverySha256,sha(read('supabase/recovery/'+name+'.sql')));
}
async function readOwner(sql){return query('begin read only;'+sql+';commit;',true);}
async function main(){const mode=process.argv[2]||'prepare',candidate=read(file),candidateSha=sha(candidate);
 if(mode==='prepare'){
  const presence=(await query(`select exists(select 1 from supabase_migrations.schema_migrations where version=${q(version)}) collision,to_regnamespace('savings_automatic_private') is not null installed`))[0];assert.deepEqual(presence,{collision:false,installed:false});
  const auth=await login(),receipt=await rpc(auth.access_token,'get_admin_savings_reconciliation',{p_date:'2026-09-30'});
  const pending=receipt.rows.filter(r=>r.route==='ACCOUNT'&&!r.confirmed),people=await rpc(auth.access_token,'get_admin_savings_workspace_people',{p_search:'4944',p_limit:50,p_offset:0,p_filter:'todos'}),target=people.rows.filter(r=>r.folio==='4944');assert.equal(target.length,1);
  assert.equal(pending.length,294,'EXPECTED_PENDING_SET_CHANGED');assert(pending.every(r=>r.expected>0&&r.can_write),'PENDING_ACCOUNT_NOT_WRITABLE');
  const backup=await readOwner(`select jsonb_build_object(${tables.map(n=>q(n)+`,(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)->>'id'),'[]') from public.${n} t)`).join(',')}) data`);
  const metadata=await query(functions),fingerprints=await query(fp()),cron=await query('select * from cron.job order by jobid');
  const eligibility=await query(`select count(*)::int pending_enrollments,count(*) filter(where e.approved_at is null)::int not_approved,count(*) filter(where e.status in ('REQUESTED','REJECTED'))::int invalid_status from public.savings_enrollments e where e.id in (${pending.map(r=>q(r.enrollment_id)+'::uuid').join(',')})`);assert.equal(eligibility[0].not_approved,0);assert.equal(eligibility[0].invalid_status,0);
  const context=await rpc(auth.access_token,'get_admin_sicof_context',{p_from:'2026-07-01',p_to:'2026-10-03'});save('report-before-context-private',context);
  const pendingRows=JSON.stringify(pending.map(r=>({participant_id:r.participant_id,amount:r.expected})));
  const balances=await readOwner(`select x.participant_id,sum(x.amount) expected_delta,(public.savings_participant_balance(x.participant_id)).* from jsonb_to_recordset(${q(pendingRows)}::jsonb) x(participant_id uuid,amount numeric) group by x.participant_id`);save('balances-before-private',balances);
  save('release-before',{at:new Date().toISOString(),candidateSha,metadata,fingerprints,cron,pending,receipt,target:target[0],backup:backup[0].data});
  proof('release-prepared',{candidateSha,protectedTables:tables.length,privateBackupSaved:true,functions:metadata.length,pending:pending.length,existing:receipt.rows.filter(r=>r.route==='ACCOUNT'&&r.confirmed).length,eligible:eligibility[0],financialWrites:0});return;
 }
 const before=load('release-before');assert.equal(candidateSha,before.candidateSha,'CANDIDATE_CHANGED_AFTER_PREPARATION');
 if(mode==='apply'){
  verifyCandidate();
  assert.deepEqual(await query(functions),before.metadata,'LIVE_FUNCTION_DRIFT');
  const body=candidate.replace(/^\s*begin;/i,'').replace(/commit;\s*$/i,'');
  const result=await query(`begin;set local lock_timeout='5s';set local statement_timeout='90s';
   select pg_advisory_xact_lock(hashtextextended('savings-config',0));
   lock table ${tables.map(n=>'public.'+n).join(',')} in share row exclusive mode;
   create temp table savings_auto_before on commit drop as ${fp()};
   create temp table savings_auto_functions_before on commit drop as ${functions};
   ${body}
   do $g$ begin
    if exists((select * from savings_auto_before) except (${fp(true)})) or exists((${fp(true)}) except(select * from savings_auto_before)) then raise exception 'SAVINGS_AUTO_DDL_CHANGED_FINANCIAL_DATA';end if;
    if (select enabled from savings_automatic_private.policy where id) then raise exception 'SAVINGS_AUTO_NOT_DISABLED';end if;
    if exists(select 1 from savings_auto_functions_before b left join pg_proc p on p.oid=b.oid where p.oid is null or pg_get_userbyid(p.proowner) is distinct from b.owner or p.proacl::text is distinct from b.acl) then raise exception 'SAVINGS_AUTO_EXISTING_METADATA_CHANGED';end if;
    if exists(select 1 from savings_auto_functions_before b join pg_proc p on p.oid=b.oid where not exists(select 1 from savings_automatic_private.function_backup f where to_regprocedure(f.signature)=b.oid) and md5(pg_get_functiondef(p.oid))<>b.md5) then raise exception 'SAVINGS_AUTO_UNEXPECTED_FUNCTION_CHANGED';end if;
   end $g$;
   insert into supabase_migrations.schema_migrations(version,name,statements) values(${q(version)},'savings_automatic_contributions',array[${q('H-SAVINGS-AUTO-CONTRIBUTIONS-001 sha256:'+candidateSha)}]);
   select jsonb_build_object('tables',(select count(*) from savings_auto_before),'unchanged',true,'policyDisabled',true) evidence;commit;`,true);
  save('release-after-functions',await query(functions));proof('migration',{version,candidateSha,evidence:result,financialWrites:0,existingFinancialDataUnchanged:true,defaultDisabled:true});return;
 }
 if(mode==='activate'){
  verifyCandidate();const installed=load('release-after-functions');assert.deepEqual(await query(functions),installed,'INSTALLED_CANDIDATE_DRIFT');
  const auth=await login(),claims=JSON.parse(Buffer.from(auth.access_token.split('.')[1],'base64url').toString());assert.equal(claims.sub,auth.user.id);assert.equal(claims.role,'authenticated');
  const keyPath=path.join(dir,'activation-key.txt');if(!fs.existsSync(keyPath))fs.writeFileSync(keyPath,crypto.randomUUID());const key=fs.readFileSync(keyPath,'utf8');assert(/^[a-f0-9-]{36}$/.test(key));
  const pendingJson=JSON.stringify(before.pending.map(r=>({participant_id:r.participant_id,enrollment_id:r.enrollment_id,amount:r.expected}))),target=before.target;
  const preserved=['savings_participants','savings_contribution_plans','savings_balance_certifications','savings_yield_allocations','savings_yield_periods','savings_withdrawal_openings','savings_holds','savings_requests','savings_publication_state'];
  const fingerprintPreserved=preserved.map(n=>`select '${n}' resource,md5(coalesce(string_agg(to_jsonb(t)::text,'|' order by to_jsonb(t)->>'id'),'')) fingerprint from public.${n} t`).join(' union all ');
  const result=await query(`begin;set local lock_timeout='5s';set local statement_timeout='120s';
   select pg_advisory_xact_lock(hashtextextended('savings-auto-job',0));
   select pg_advisory_xact_lock(hashtextextended('savings-config',0));
   lock table ${tables.map(n=>'public.'+n).join(',')} in share row exclusive mode;
   create temp table savings_auto_preserved on commit drop as ${fingerprintPreserved};
   create temp table savings_auto_prior_receipts on commit drop as select * from public.savings_contribution_overrides;
   create temp table savings_auto_prior_transactions on commit drop as select * from public.savings_transactions;
   create temp table savings_auto_prior_audit on commit drop as select * from public.savings_audit_events;
   create temp table savings_auto_prior_enrollments on commit drop as select * from public.savings_enrollments;
   create temp table savings_auto_expected on commit drop as select * from jsonb_to_recordset(${q(pendingJson)}::jsonb) x(participant_id uuid,enrollment_id uuid,amount numeric);
   create temp table savings_auto_balances_before on commit drop as select x.participant_id,sum(x.amount) expected_delta,(public.savings_participant_balance(x.participant_id)).* from savings_auto_expected x group by x.participant_id;
   do $g$ begin
    if exists(select 1 from jsonb_to_recordset(${q(JSON.stringify(installed.map(({oid,owner,acl,md5})=>({oid,owner,acl,md5}))))}::jsonb) x(oid oid,owner text,acl text,md5 text) left join pg_proc p on p.oid=x.oid where p.oid is null or pg_get_userbyid(p.proowner) is distinct from x.owner or p.proacl::text is distinct from x.acl or md5(pg_get_functiondef(p.oid)) is distinct from x.md5) then raise exception 'SAVINGS_AUTO_INSTALLED_CANDIDATE_CHANGED';end if;
    if exists(select 1 from savings_automatic_private.policy where enabled or version<>0) then raise exception 'SAVINGS_AUTO_POLICY_ALREADY_CONFIGURED';end if;
    if (select mode from public.savings_publication_state where id)<>'PUBLISHED' then raise exception 'SAVINGS_AUTO_NOT_PUBLISHED';end if;
    if public.savings_operation_today()<>'2026-10-03'::date then raise exception 'SAVINGS_AUTO_RELEASE_DATE_CHANGED';end if;
    if exists(select 1 from savings_auto_expected x where not exists(select 1 from public.generate_savings_schedule(x.enrollment_id,'2026-09-30','2026-09-30') s where s.expected_amount=x.amount) or exists(select 1 from public.savings_contribution_overrides o where o.enrollment_id=x.enrollment_id and o.contribution_date='2026-09-30')) then raise exception 'SAVINGS_AUTO_PENDING_SET_CHANGED';end if;
    if (select total from public.savings_participant_balance(${q(target.participant_id)}::uuid))<>${Number(target.saldo)} then raise exception 'SAVINGS_AUTO_TARGET_BALANCE_CHANGED';end if;
   end $g$;
   select set_config('request.jwt.claims',${q(JSON.stringify(claims))},true);set local role authenticated;
   select public.admin_configure_savings_automatic_contributions(true,'2026-09-30','Instrucción del propietario: aplicar al vencimiento el importe programado validado por la encargada, salvo corrección expresa; sin conciliación adicional.',${q(key)}::uuid);
   reset role;
   do $g$ begin
    if exists((select participant_id,enrollment_id,contribution_date,expected_amount from savings_automatic_private.due()) except(select participant_id,enrollment_id,'2026-09-30'::date,amount from savings_auto_expected)) or exists((select participant_id,enrollment_id,'2026-09-30'::date,amount from savings_auto_expected) except(select participant_id,enrollment_id,contribution_date,expected_amount from savings_automatic_private.due())) then raise exception 'SAVINGS_AUTO_DUE_SET_CHANGED';end if;
   end $g$;
   create temp table savings_auto_run on commit drop as select savings_automatic_private.run_due() result;
   do $g$ begin
    if (select result->>'status' from savings_auto_run)<>'COMPLETE' or (select (result->>'applied')::int from savings_auto_run)<>(select count(*) from savings_auto_expected) or (select (result->>'failed')::int from savings_auto_run)<>0 then raise exception 'SAVINGS_AUTO_APPLICATION_INCOMPLETE';end if;
    if (select count(*) from public.savings_contribution_overrides)-(select count(*) from savings_auto_prior_receipts)<>(select count(*) from savings_auto_expected) or (select count(*) from public.savings_transactions)-(select count(*) from savings_auto_prior_transactions)<>(select count(*) from savings_auto_expected) or (select count(*) from public.savings_audit_events)-(select count(*) from savings_auto_prior_audit)<>(select count(*)+1 from savings_auto_expected) then raise exception 'SAVINGS_AUTO_ROW_COUNTS_MISMATCH';end if;
    if exists(select 1 from savings_auto_balances_before b cross join lateral public.savings_participant_balance(b.participant_id) a where a.capital is distinct from b.capital+b.expected_delta or a.total is distinct from b.total+b.expected_delta or a.yield_amount is distinct from b.yield_amount or a.held_capital is distinct from b.held_capital) then raise exception 'SAVINGS_AUTO_ACCOUNT_BALANCE_MISMATCH';end if;
    if exists((select * from savings_auto_preserved) except (${fingerprintPreserved})) then raise exception 'SAVINGS_AUTO_PROTECTED_DATA_CHANGED';end if;
    if exists((select * from savings_auto_prior_receipts) except(select * from public.savings_contribution_overrides)) or exists((select * from savings_auto_prior_transactions) except(select * from public.savings_transactions)) or exists((select * from savings_auto_prior_audit) except(select * from public.savings_audit_events)) then raise exception 'SAVINGS_AUTO_HISTORY_CHANGED';end if;
    if exists((select to_jsonb(t)-'first_actual_contribution_date' from savings_auto_prior_enrollments t) except(select to_jsonb(t)-'first_actual_contribution_date' from public.savings_enrollments t)) then raise exception 'SAVINGS_AUTO_ENROLLMENT_CHANGED';end if;
    if exists(select 1 from savings_auto_prior_enrollments b join public.savings_enrollments a on a.id=b.id where not exists(select 1 from savings_auto_expected x where x.enrollment_id=b.id) and to_jsonb(a) is distinct from to_jsonb(b)) then raise exception 'SAVINGS_AUTO_UNRELATED_ENROLLMENT_CHANGED';end if;
    if exists(select 1 from public.savings_enrollments a join public.savings_balance_certifications c on c.enrollment_id=a.id where exists(select 1 from savings_auto_expected x where x.enrollment_id=a.id) and a.first_actual_contribution_date is distinct from public.savings_panel_date(c.command->>'first_date')) then raise exception 'SAVINGS_AUTO_CERTIFIED_FIRST_DATE_CHANGED';end if;
    if exists(select 1 from public.savings_contribution_overrides o where not exists(select 1 from savings_auto_prior_receipts b where b.id=o.id) and (o.contribution_date<>'2026-09-30' or o.entry_source<>'SYSTEM_SCHEDULE' or o.editor_auth_user_id is not null or not exists(select 1 from savings_auto_expected x where x.enrollment_id=o.enrollment_id and x.amount=o.actual_amount and x.amount=o.expected_amount))) then raise exception 'SAVINGS_AUTO_RECEIPT_MISMATCH';end if;
    if exists(select 1 from public.savings_transactions t where not exists(select 1 from savings_auto_prior_transactions b where b.id=t.id) and (t.contribution_date is distinct from '2026-09-30'::date or t.effective_date is distinct from '2026-09-30'::date or t.transaction_type<>'CONTRIBUTION' or t.component<>'CAPITAL' or t.direction<>'CREDIT' or t.created_by_auth_user_id is not null or not exists(select 1 from savings_auto_expected x where x.participant_id=t.participant_id and x.enrollment_id=t.enrollment_id and x.amount=t.amount))) then raise exception 'SAVINGS_AUTO_LEDGER_MISMATCH';end if;
    if exists(select 1 from public.savings_audit_events a where not exists(select 1 from savings_auto_prior_audit b where b.id=a.id) and (a.resource='savings_automatic_policy' and a.action='CONFIGURE' and a.actor_real_auth_user_id=${q(auth.user.id)}::uuid and a.client_action_id=${q(key)}::uuid or a.resource='savings_account_receipts' and a.action='APPLY_SCHEDULED_RECEIPT' and a.actor_real_auth_user_id is null and exists(select 1 from savings_auto_expected x where x.participant_id=a.participant_id and a.after_data->'command'->>'enrollment_id'=x.enrollment_id::text and a.after_data->'command'->>'date'='2026-09-30' and (a.after_data->'command'->>'actual')::numeric=x.amount)) is not true) then raise exception 'SAVINGS_AUTO_AUDIT_MISMATCH';end if;
    if (select total from public.savings_participant_balance(${q(target.participant_id)}::uuid))<>${Number(target.saldo)+300} then raise exception 'SAVINGS_AUTO_TARGET_DELTA_MISMATCH';end if;
   end $g$;
   select jsonb_build_object('run',(select result from savings_auto_run),'newReceipts',(select count(*) from public.savings_contribution_overrides)-(select count(*) from savings_auto_prior_receipts),'newTransactions',(select count(*) from public.savings_transactions)-(select count(*) from savings_auto_prior_transactions),'newAuditEvents',(select count(*) from public.savings_audit_events)-(select count(*) from savings_auto_prior_audit),'oldRowsPreserved',true,'targetDelta',300,'targetYieldUnchanged',(select yield_amount from public.savings_participant_balance(${q(target.participant_id)}::uuid))=${Number(target.rendimiento_actual)}) evidence;
   commit;`,true);
  save('activation-result',result);const evidence=result.filter(r=>r.evidence).map(r=>r.evidence);assert.equal(evidence.length,1);assert.equal(evidence[0].newReceipts,before.pending.length);assert.equal(evidence[0].newTransactions,before.pending.length);assert(evidence[0].targetYieldUnchanged);proof('activation',{version,candidateSha,evidence:evidence[0],automaticActor:'SYSTEM',manualPolicyAuthorization:true,startsOn:'2026-09-30'});return;
 }
 if(mode==='verify'){
  const auth=await login(),receipt=await rpc(auth.access_token,'get_admin_savings_reconciliation',{p_date:'2026-09-30'}),people=await rpc(auth.access_token,'get_admin_savings_workspace_people',{p_search:'4944',p_limit:50,p_offset:0,p_filter:'todos'}),target=people.rows.find(r=>r.folio==='4944');
  const accounts=receipt.rows.filter(r=>r.route==='ACCOUNT');assert.equal(accounts.length,295);assert(accounts.every(r=>r.confirmed));assert.equal(target.ultimo,'2026-09-30');assert.equal(target.pending.count,0);assert.equal(target.saldo,before.target.saldo+300);assert.equal(target.rendimiento_actual,before.target.rendimiento_actual);
  const repeated=await query(`begin;create temp table repeat_before on commit drop as ${fp(true)};create temp table repeated_run on commit drop as select savings_automatic_private.run_due() result;do $g$ begin if exists((select * from repeat_before) except (${fp(true)})) then raise exception 'SAVINGS_AUTO_REPEAT_WRITES';end if;end $g$;select result from repeated_run;commit;`,true);assert.equal(repeated[0].result.applied,0);assert.equal(repeated[0].result.failed,0);
  const jobs=await query("select jobname,schedule,active,username,command from cron.job where jobname='savings-automatic-contributions'");assert.equal(jobs.length,1);assert(jobs[0].active);assert.equal(jobs[0].username,'postgres');
  const future=await query("select count(*)::int future_automatic_receipts from public.savings_contribution_overrides where entry_source='SYSTEM_SCHEDULE' and contribution_date>(now() at time zone 'America/Hermosillo')::date");assert.equal(future[0].future_automatic_receipts,0);
  save('verified-private',{receipt,target});proof('backend-verification',{date:'2026-09-30',accounts:accounts.length,confirmed:accounts.filter(r=>r.confirmed).length,targetLastContribution:target.ultimo,targetDelta:target.saldo-before.target.saldo,targetPending:target.pending.count,yieldUnchanged:true,repeat:repeated[0].result,noRepeatFinancialWrites:true,cron:jobs[0],futureAutomaticReceipts:0});return;
 }
 if(mode==='cron'){
  const observed=await readOwner(`select j.jobname,j.schedule,j.active,d.status,d.start_time,d.end_time from cron.job j join cron.job_run_details d on d.jobid=j.jobid where j.jobname='savings-automatic-contributions' order by d.start_time desc limit 3`);
  const success=observed.find(r=>r.status==='succeeded'&&r.end_time);assert(success,'SCHEDULED_EXECUTION_NOT_YET_OBSERVED');
  const runs=await readOwner(`select r.started_at,r.finished_at,r.summary from savings_automatic_private.runs r where r.started_at>=${q(success.start_time)}::timestamptz and r.finished_at<=${q(success.end_time)}::timestamptz order by r.started_at`);
  assert(runs.length>0,'CRON_RUN_NOT_CORRELATED');assert(runs.every(r=>r.summary.failed===0&&r.summary.applied===0&&r.summary.remaining===0));
  proof('cron-live',{readOnly:true,actualSchedulerObserved:true,execution:success,runs,noDuplicateContributions:true});return;
 }
 throw Error('MODE prepare|apply|activate|verify|cron');
}
main().catch(e=>{fs.writeFileSync(path.join(dir,'release-error.txt'),e.stack||String(e));console.error(JSON.stringify({status:'FAIL',error:e.message}));process.exitCode=1;});
