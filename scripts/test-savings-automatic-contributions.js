'use strict';
// Isolated PostgreSQL/WASM; schema/function snapshots contain no customer rows.
// Auth and pg_cron transport are test providers; production functions and guards run unchanged.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const {PGlite}=require(path.join(root,'.tmp/savings-loan-eligibility/node_modules/@electric-sql/pglite'));
const fixture=JSON.parse(read('scripts/fixtures/savings-automatic-contributions-schema.json'));
const forward='supabase/migrations/20261003000400_savings_automatic_contributions.sql';
const recovery='supabase/recovery/20261003000400_savings_automatic_contributions.sql';
const uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const quote=v=>"'"+String(v).replaceAll("'","''")+"'";
async function main(){
 const db=new PGlite(),checks=[];let sequence=1000;
 const q=async(sql,args=[])=>(await db.query(sql,args)).rows;
 const scalar=async(sql,args)=>(await q(sql,args))[0]?.v;
 const key=()=>uuid(sequence++);
 const owner=()=>db.exec('reset role');
 const actor=async(perms='savings.read,savings.write,savings.config,savings.approve,savings.reports',id=1)=>{
  await owner();await q("select set_config('test.uid',$1,false),set_config('test.permissions',$2,false)",[id?uuid(id):'',perms]);await db.exec('set role authenticated');
 };
 const today=async date=>{await owner();await q("select set_config('test.today',$1,false)",[date]);};
 const receipt=(p,en,date,amount,version,k=key())=>scalar('select public.admin_confirm_savings_account_receipt($1,$2,$3,$4,$5,$6,$7) v',[p,en,date,amount,version,'Corrección aislada',k]);
 const instruction=(p,en,date,amount,version,k=key())=>scalar('select public.admin_set_savings_scheduled_contribution($1,$2,$3,$4,$5,$6,$7) v',[p,en,date,amount,version,'Instrucción aislada',k]);
 const run=async(limit=500)=>{await owner();return scalar('select savings_automatic_private.run_due($1) v',[limit]);};
 const balance=async p=>{await owner();return Number(await scalar('select capital v from public.savings_participant_balance($1)',[p]));};
 const nTx=async p=>{await owner();return scalar('select count(*)::int v from public.savings_transactions where participant_id=$1',[p]);};
 const check=async(name,fn)=>{await fn();checks.push(name);console.log('PASS '+name);};
 const account=async(n,{amount=500,first='2026-09-15',last=null,process='PROCESS_1',terminated=null}={})=>{
  await owner();let af=uuid(n),p=uuid(n+100),en=uuid(n+200),plan=uuid(n+300);
  await q('insert into public.affiliates(id,numero_control,full_name) values($1,$2,$3)',[af,'0'+n,'PERSONA SINTETICA '+n]);
  await q("insert into public.savings_participants(id,participant_type,affiliate_id,legacy_folio,identity_status,certification_status,data_classification) values($1,'AFFILIATE',$2,$3,'RESOLVED','CERTIFIED','CANONICAL')",[p,af,'0'+n]);
  await q("insert into public.savings_enrollments(id,participant_id,sequence_number,status,enrollment_started_at,approved_at,first_expected_contribution_date,terminated_at,process_snapshot,data_classification) values($1,$2,1,$3,'2026-09-01',now(),$4,$5,$6,'CANONICAL')",[en,p,terminated?'TERMINATED':'ACTIVE',first,terminated?terminated+'T07:00:00Z':null,process]);
  await q("insert into public.savings_contribution_plans(id,enrollment_id,amount,process_snapshot,effective_from,effective_to,data_classification,created_by_auth_user_id) values($1,$2,$3,$4,$5,$6,'CANONICAL',$7)",[plan,en,amount,process,first,last,uuid(1)]);
  return {af,p,en,plan};
 };
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema extensions;create schema savings_period_private;create schema cron;
   create table auth.users(id uuid primary key);
   insert into auth.users values('${uuid(1)}'),('${uuid(9)}');
   create function extensions.gen_random_uuid() returns uuid language sql as $$select gen_random_uuid()$$;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
   create function public.has_admin_permission(text) returns boolean language sql stable as $$select $1=any(string_to_array(coalesce(current_setting('test.permissions',true),''),','))$$;
   create function public.get_effective_affiliate_id() returns uuid language sql stable as $$select '${uuid(2)}'::uuid$$;
   create table public.affiliates(id uuid primary key,numero_control text,full_name text,is_archived boolean default false);
   insert into public.affiliates(id,numero_control,full_name) values('${uuid(2)}','ADMIN_TEST','ADMIN TEST');
   create table public.savings_import_batches(id uuid primary key);
   create table public.affiliate_documents(id uuid primary key);
   create table public.savings_legacy_evidence(id uuid primary key);
   create table public.savings_action_availability(id uuid primary key);
   create table public.savings_review_records(id uuid primary key,source_sheet text,source_folio text,source_row integer,field_defs jsonb default '[]',source_data jsonb default '{}',proposed_data jsonb default '{}',version integer default 1);
   create table public.savings_review_events(id uuid primary key,record_id uuid,command jsonb,observation text,after_data jsonb);
   create table public.savings_process_change_events(id uuid,participant_id uuid,status text,conversion_snapshot jsonb,effective_from date,reviewed_at timestamptz);
   create table public.savings_beneficiary_versions(id uuid,participant_id uuid,status text);
   create table public.savings_beneficiaries(id uuid,version_id uuid,full_name text,relationship text,percentage numeric);
   create table savings_period_private.attribution_events(id uuid primary key,transaction_id uuid);
   create table savings_period_private.attribution_slices(event_id uuid,origin_key text,amount numeric);
   create table cron.job(jobid bigint generated always as identity primary key,jobname text unique,schedule text,command text);
   create function cron.schedule(text,text,text) returns bigint language plpgsql as $$declare v bigint;begin insert into cron.job(jobname,schedule,command) values($1,$2,$3) returning jobid into v;return v;end$$;
   create function cron.unschedule(bigint) returns boolean language plpgsql as $$begin delete from cron.job where jobid=$1;return found;end$$;
   create schema document_private;
   create function document_private.capture_event() returns trigger language plpgsql as $$begin return new;end$$;
   create function public.set_h0072_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now();return new;end$$;
   insert into pg_extension(oid,extname,extowner,extnamespace,extrelocatable,extversion) values(95000,'pg_cron',(select oid from pg_roles where rolname=current_user),'pg_catalog'::regnamespace,false,'test-provider');
   grant usage on schema public,auth to authenticated,anon,service_role;
  `);
  for(const t of fixture.tables){
   const cols=t.columns.map(c=>'"'+c.name+'" '+c.type+(t.name==='savings_audit_events'&&c.name==='id'?' generated always as identity':c.default?' default '+c.default:'')+(c.notnull?' not null':''));
   const constraints=t.constraints.filter(c=>!c.definition.startsWith('FOREIGN')).map(c=>'constraint "'+c.name+'" '+c.definition);
   await db.exec('create table public.'+t.name+'('+cols.concat(constraints).join(',')+');alter table public.'+t.name+' enable row level security;alter table public.'+t.name+' force row level security;');
   await db.exec('revoke all on public.'+t.name+' from public,anon,authenticated,service_role;');
   if(t.acl?.includes('service_role='))await db.exec('grant '+(t.acl.includes('service_role=r/')?'select':'all')+' on public.'+t.name+' to service_role;');
  }
  for(const t of fixture.tables)for(const c of t.constraints.filter(c=>c.definition.startsWith('FOREIGN')))await db.exec('alter table public.'+t.name+' add constraint "'+c.name+'" '+c.definition);
  const funcs=[...fixture.functions].sort((a,b)=>Number(a.name.startsWith('savings_workspace'))-Number(b.name.startsWith('savings_workspace')));
  // SQL readers depend on receipt aggregator; other PL/pgSQL dependencies resolve when invoked.
  for(const f of funcs){
   await db.exec(f.definition);
   const sig=f.signature.startsWith(f.schema+'.')?f.signature:f.schema+'.'+f.signature;
   await db.exec('revoke all on function '+sig+' from public,anon,authenticated,service_role');
   for(const entry of (f.acl||'').slice(1,-1).split(',')){
    const match=entry.match(/^([^=]*)=([^/]*)\//);if(match&&match[2].includes('X')&&match[1]!=='postgres')await db.exec('grant execute on function '+sig+' to '+(match[1]||'public'));
   }
   if(f.acl===null)await db.exec('grant execute on function '+sig+' to public');
  }
  for(const t of fixture.tables)for(const tr of t.triggers||[])await db.exec(tr.definition);
  await db.exec(`create function public.savings_runtime_assert_identity(uuid) returns uuid language sql as $$select public.savings_receipt_assert_identity($1)$$;
   create function public.savings_effective_action(text,uuid) returns boolean language sql as $$select true$$;
   create function public.savings_runtime_assert_payout(uuid) returns void language plpgsql as $$begin return;end$$;
   create function public.savings_review_identity(text) returns jsonb language sql as $$select jsonb_build_object('name',max(full_name),'match_count',count(*),'active_match_count',count(*) filter(where not is_archived)) from public.affiliates where numero_control=$1$$;
   create function public.savings_affiliate_display_name(uuid) returns text language sql as $$select a.full_name from savings_participants p join affiliates a on a.id=p.affiliate_id where p.id=$1$$;
   create function public.savings_review_edit_allowed() returns boolean language sql as $$select public.has_admin_permission('savings.write')$$;
   insert into public.savings_publication_state(id,mode) values(true,'PRIVATE');
  `);
  const originals=await q("select p.oid::regprocedure::text signature,p.oid,md5(pg_get_functiondef(p.oid)) hash,p.proacl::text acl from pg_proc p where p.oid=any($1::regprocedure[])",[fixture.functions.filter(f=>!['savings_workspace_receipts','savings_workspace_history','resolve_origin'].includes(f.name)).map(f=>f.schema+'.'+f.signature.replace(f.schema+'.',''))]);
  await check('installation rejects exact function drift before changing schema',async()=>{
   await db.exec("create or replace function public.savings_operation_today() returns date language sql stable set search_path='' as $$select '2026-10-03'::date$$");
   await assert.rejects(db.exec(read(forward)),/SAVINGS_AUTO_BASELINE_DRIFT/);await db.exec('rollback');
   assert.equal(await scalar("select to_regnamespace('savings_automatic_private')::text v"),null);
   await db.exec(fixture.functions.find(f=>f.name==='savings_operation_today').definition);
  });
  await check('installation refuses an existing cron name and altered receipt schema',async()=>{
   await db.exec("select cron.schedule('savings-automatic-contributions','0 0 * * *','select 1')");
   await assert.rejects(db.exec(read(forward)),/SAVINGS_AUTO_CRON_CONFLICT/);await db.exec('rollback');
   assert.equal(await scalar("select command v from cron.job where jobname='savings-automatic-contributions'"),'select 1');
   await db.exec("select cron.unschedule(jobid) from cron.job where jobname='savings-automatic-contributions';alter table savings_contribution_overrides alter column actual_amount type numeric(15,2)");
   await assert.rejects(db.exec(read(forward)),/SAVINGS_AUTO_TABLE_COLUMNS_DRIFT/);await db.exec('rollback');
   assert.equal(await scalar("select to_regnamespace('savings_automatic_private')::text v"),null);
   await db.exec('alter table savings_contribution_overrides alter column actual_amount type numeric(14,2)');
  });
  await check('installation preserves OIDs/ACLs, has no financial effects, cron disabled policy; clean structural recovery',async()=>{
   await db.exec(read(forward));
   assert.equal(await scalar('select count(*)::int v from savings_transactions'),0);
   assert.equal((await run()).status,'DISABLED');
   assert.equal(await scalar("select schedule v from cron.job where jobname='savings-automatic-contributions'"),'*/5 * * * *');
   for(const b of originals){const after=(await q('select oid,proacl::text acl from pg_proc where oid=$1',[b.oid]))[0];assert.equal(after?.oid,b.oid);assert.equal(after.acl,b.acl);}
   await db.exec(read(recovery));
   assert.equal(await scalar("select to_regnamespace('savings_automatic_private')::text v"),null);
   for(const b of originals)assert.equal(await scalar('select md5(pg_get_functiondef($1::oid)) v',[b.oid]),b.hash);
   await db.exec(read(forward));
   await db.exec("create or replace function public.savings_operation_today() returns date language sql stable set search_path='' as $$select current_setting('test.today')::date$$");
   await today('2026-10-03');
  });
  await check('recovery with only failed runs preserves error evidence and is repeatable',async()=>{
   const branch=new PGlite({loadDataDir:await db.dumpDataDir()});
   try{
    await branch.exec(`select set_config('test.today','2026-10-03',false),set_config('test.uid','${uuid(1)}',false),set_config('test.permissions','savings.config',false);
     insert into affiliates(id,numero_control,full_name) values('${uuid(9001)}','ERR_TEST','SINTETICO'),('${uuid(9002)}','ERR_TEST','DUPLICADO');
     insert into savings_participants(id,participant_type,affiliate_id,legacy_folio,identity_status,certification_status,data_classification) values('${uuid(9010)}','AFFILIATE','${uuid(9001)}','ERR_TEST','RESOLVED','CERTIFIED','CANONICAL');
     insert into savings_enrollments(id,participant_id,sequence_number,status,enrollment_started_at,approved_at,first_expected_contribution_date,process_snapshot,data_classification) values('${uuid(9020)}','${uuid(9010)}',1,'ACTIVE','2026-09-30',now(),'2026-09-30','PROCESS_1','CANONICAL');
     insert into savings_contribution_plans(enrollment_id,amount,process_snapshot,effective_from,data_classification,created_by_auth_user_id) values('${uuid(9020)}',500,'PROCESS_1','2026-09-30','CANONICAL','${uuid(1)}');
     select public.admin_configure_savings_automatic_contributions(true,'2026-09-30','Autorización aislada de rama','${uuid(9030)}');`);
    const result=(await branch.query('select savings_automatic_private.run_due() v')).rows[0].v;assert.equal(result.failed,1);assert.equal(result.applied,0);
    await branch.exec(read(recovery));await branch.exec(read(recovery));
    assert.equal((await branch.query('select count(*)::int n from savings_automatic_private.runs')).rows[0].n,1);
    assert.equal((await branch.query('select count(*)::int n from savings_automatic_private.attempts')).rows[0].n,1);
    assert.equal((await branch.query('select count(*)::int n from savings_contribution_overrides')).rows[0].n,0);
    assert.equal((await branch.query('select enabled from savings_automatic_private.policy')).rows[0].enabled,false);
   }finally{await branch.close();}
  });
  let a=await account(10),b=await account(11),z=await account(12);
  await check('manual overrides including zero take precedence; policy authenticates author separately',async()=>{
   assert.equal(await scalar('select count(*)::int v from savings_automatic_private.due(null,false)'),0);
   await actor();await receipt(b.p,b.en,'2026-09-30',300,0);await receipt(z.p,z.en,'2026-09-30',0,0);
   const k=key(),args=[true,'2026-09-30','Regla explícita aislada',k];
   const configured=await scalar('select public.admin_configure_savings_automatic_contributions($1,$2,$3,$4) v',args);
   assert.equal(configured.authorized_by,uuid(1));assert.equal(configured.version,1);
   assert.deepEqual(await scalar('select public.admin_configure_savings_automatic_contributions($1,$2,$3,$4) v',args),configured);
   await assert.rejects(scalar('select public.admin_configure_savings_automatic_contributions(true,$1,$2,$3) v',['2026-09-15','No ampliar pasado',key()]),/SAVINGS_AUTO_CONFIG_INVALID/);
   const runResult=await run();assert.equal(runResult.applied,1);assert.equal(runResult.failed,0);
   assert.equal(await balance(a.p),500);assert.equal(await balance(b.p),300);assert.equal(await balance(z.p),0);
   const audit=(await q("select actor_real_auth_user_id,action,after_data from savings_audit_events where participant_id=$1 and action='APPLY_SCHEDULED_RECEIPT'",[a.p]))[0];
   assert.equal(audit.actor_real_auth_user_id,null);assert.equal(audit.after_data.command.origin.policy_authorized_by,uuid(1));assert.equal(audit.after_data.command.origin.plan_id,a.plan);
   assert.equal((await run()).applied,0);assert.equal(await nTx(a.p),1);
   assert.equal(await scalar("select count(*)::int v from savings_transactions where contribution_date<'2026-09-30' or effective_date>'2026-10-03'"),0);
  });
  await check('subsequent correction uses delta; system idempotency key cannot be replayed as manual',async()=>{
   const k=await scalar("select client_action_id v from savings_contribution_overrides where enrollment_id=$1",[a.en]);
   await actor();await assert.rejects(receipt(a.p,a.en,'2026-09-30',500,0,k),/SAVINGS_IDEMPOTENCY_CONFLICT/);
   await receipt(a.p,a.en,'2026-09-30',300,1);assert.equal(await balance(a.p),300);assert.equal(await nTx(a.p),2);
   await run();assert.equal(await balance(a.p),300);
  });
  await check('zero then positive has real CONTRIBUTION anchor and canonical semester origin',async()=>{
   await actor();await receipt(z.p,z.en,'2026-09-30',500,1);
   await owner();let tx=(await q('select id,transaction_type from savings_transactions where participant_id=$1',[z.p]))[0];assert.equal(tx.transaction_type,'CONTRIBUTION');
   const origin=(await q("select * from savings_period_private.resolve_origin($1,'2026-10-03')",[tx.id]))[0];assert.equal(origin.origin_key,'2026-S2');assert.equal(Number(origin.amount),500);
   await actor();await receipt(z.p,z.en,'2026-09-30',0,2);assert.equal(await balance(z.p),0);await run();assert.equal(await balance(z.p),0);
  });
  let future=await account(13,{first:'2026-10-15'});
  await check('future instruction is versioned, zero-safe and creates no money; readers agree on effective scheduled amount',async()=>{
   await actor();let k=key(),v=await instruction(future.p,future.en,'2026-10-15',300,0,k);assert.equal(v.expected,500);assert.equal(v.scheduled_amount,300);assert.equal(v.scheduled_version,1);
   assert.deepEqual(await instruction(future.p,future.en,'2026-10-15',300,0,k),v);
   await assert.rejects(instruction(future.p,future.en,'2026-10-15',400,0),/SAVINGS_PREVIEW_STALE/);
   assert.equal(await balance(future.p),0);assert.equal(await nTx(future.p),0);
   await actor();let view=await scalar('select public.get_admin_savings_account($1,$2) v',[future.p,'2026-10-15']);
   assert.equal(view.schedule[0].expected,500);assert.equal(view.schedule[0].scheduled_amount,300);assert.equal(view.schedule[0].confirmed,false);assert.equal(view.projected_total,300);
   let person=await scalar('select public.get_admin_savings_workspace_person($1,0,10) v',[future.p]);assert.equal(person.next_expected.amount,300);assert.equal(person.next_expected.plan_amount,500);
   const rh=await scalar("select public.get_admin_savings_rh_report('mensual',2026,10,15) v");assert.equal(rh.rows.find(r=>r.Folio==='013').Monto,300);
   await owner();const self=await scalar('select savings_period_private.projection_before($1) v',[future.p]);assert.equal(self.upcoming[0].scheduled_amount,300);assert.equal(self.upcoming[0].expected_amount,500);assert.equal(self.balances.capital,0);
   await actor();
   await instruction(future.p,future.en,'2026-10-15',0,1);assert.equal(await balance(future.p),0);
   await today('2026-10-15');await run();await owner();assert.equal(Number(await scalar('select actual_amount v from savings_contribution_overrides where enrollment_id=$1',[future.en])),0);assert.equal(await nTx(future.p),0);
   await actor();await assert.rejects(instruction(future.p,future.en,'2026-10-15',800,2),/SAVINGS_SCHEDULE_INSTRUCTION_INVALID/);
   await receipt(future.p,future.en,'2026-10-15',400,1);assert.equal(await balance(future.p),400);
  });
  await check('automatic provenance is shown honestly in account/workspace history',async()=>{
   await actor();const view=await scalar('select public.get_admin_savings_account($1,$2) v',[a.p,'2026-10-15']);
   assert(view.history.some(h=>h.entry_source==='SYSTEM_SCHEDULE'&&h.actor==='Aplicación automática'));
   const page=await scalar('select public.get_admin_savings_workspace_person($1,0,50) v',[a.p]);
   assert(page.history.some(h=>h.entry_source==='SYSTEM_SCHEDULE'&&h.actor_label==='Aplicación automática'));
  });
  await today('2026-10-03');let changed=await account(14,{first:'2026-10-15'});
  await check('changed future plan never silently replaces instruction; new edit explicitly rebases',async()=>{
   await actor();await instruction(changed.p,changed.en,'2026-10-15',350,0);
   await owner();await q("update savings_contribution_plans set effective_to='2026-10-30' where id=$1",[changed.plan]);
   assert.equal((await scalar("select savings_automatic_private.scheduled($1,'2026-10-15') v",[changed.en])).scheduled_amount,350);
   await owner();await q('update savings_contribution_plans set amount=700 where id=$1',[changed.plan]);
   await actor();const view=await scalar('select public.get_admin_savings_account($1,$2) v',[changed.p,'2026-10-15']);assert.equal(view.schedule[0].scheduled_status,'PLAN_CHANGED');assert.equal(view.schedule[0].scheduled_amount,null);assert.equal(view.projected_total,null);
   await today('2026-10-15');const result=await run();assert(result.error_codes.includes('SAVINGS_AUTO_INSTRUCTION_PLAN_CHANGED'));assert.equal(await nTx(changed.p),0);
   // Before maturity, a manager can intentionally replace the exception against the current plan.
   await today('2026-10-03');await actor();await instruction(changed.p,changed.en,'2026-10-15',350,1);
   await today('2026-10-15');await run();assert.equal(await balance(changed.p),350);
  });
  await today('2026-10-03');let stopped=await account(15,{terminated:'2026-10-01'}),ended=await account(16,{last:'2026-09-29'}),jub=await account(17,{first:'2026-09-05',process:'JUB'});
  await check('terminated backlog before cessation credits; plan expiry and monthly calendar do not fabricate dates',async()=>{
   await run();assert.equal(await balance(stopped.p),500);assert.equal(await balance(ended.p),0);assert.equal(await balance(jub.p),0);
   await today('2026-10-05');await run();assert.equal(await balance(jub.p),500);assert.equal(await balance(stopped.p),500);
   await owner();const dates=await q("select contribution_date::text from generate_savings_schedule($1,'2028-02-01','2028-02-29')",[a.en]);assert.deepEqual(dates.map(x=>x.contribution_date),['2028-02-15','2028-02-28']);
   assert.equal(await scalar("select count(*)::int v from savings_transactions where participant_id=$1 and contribution_date>='2026-10-01'",[stopped.p]),0);
  });
  let cert=await account(18);
  await check('opening cutoff is protected and first actual certification date is preserved',async()=>{
   await owner();const record=key();await q("insert into savings_review_records(id,source_sheet,source_folio) values($1,'Ahorro','018')",[record]);
   await q("insert into savings_balance_certifications(record_id,participant_id,enrollment_id,cutoff_on,source_version,source_snapshot,command,capital,yield_amount,actor_real_auth_user_id,client_action_id) values($1,$2,$3,'2026-09-30',1,'{}','{\"first_date\":\"2025-01-15\"}',0,0,$4,$5)",[record,cert.p,cert.en,uuid(1),key()]);
   await run();assert.equal(await nTx(cert.p),0);
   await today('2026-10-15');await run();assert.equal(await balance(cert.p),500);
   assert.equal(await scalar('select first_actual_contribution_date::text v from savings_enrollments where id=$1',[cert.en]),'2025-01-15');
  });
  await check('held/delivered capital prevent unsafe correction; invalid identities and conflicts do not contaminate other accounts',async()=>{
   await owner();await q("insert into savings_holds(participant_id,enrollment_id,component,amount,reason,created_by_auth_user_id) values($1,$2,'CAPITAL',700,'Retención aislada',$3)",[a.p,a.en,uuid(1)]);
   await actor();await assert.rejects(receipt(a.p,a.en,'2026-10-15',0,1),/SAVINGS_RECEIPT_EXCEEDS_AVAILABLE_CAPITAL/);
   let bad=await account(19),good=await account(20);await q('insert into affiliates(id,numero_control,full_name) values($1,$2,$3)',[key(),'019','DUPLICADO AISLADO']);
   const result=await run();assert(result.error_codes.includes('SAVINGS_EXACT_IDENTITY_REQUIRED'));assert.equal(await nTx(bad.p),0);assert((await balance(good.p))>0);
   let mismatch=await account(21);await q("insert into savings_transactions(participant_id,enrollment_id,transaction_type,component,direction,amount,effective_date,contribution_date,idempotency_key,data_classification) values($1,$2,'CONTRIBUTION','CAPITAL','CREDIT',5,'2026-09-30','2026-09-30',$3,'CANONICAL')",[mismatch.p,mismatch.en,key()]);
   assert((await run()).error_codes.includes('SAVINGS_RECEIPT_HISTORY_MISMATCH'));assert.equal(await balance(mismatch.p),505);
  });
  await check('final yield cutoff protects CREDITED and EXCLUDED, ordinary and early',async()=>{
   await owner();const period=key(),availability=key();await q("insert into savings_yield_periods(id,period_year,semester,starts_on,ends_on) values($1,2026,2,'2026-07-01','2026-12-31')",[period]);await q('insert into savings_action_availability values($1)',[availability]);
   await q("insert into savings_withdrawal_openings(availability_id,yield_period_id,cutoff_on,percentage,opening_kind,reason,actor_real_auth_user_id,client_action_id) values($1,$2,'2026-10-15',100,'EARLY','Cierre aislado',$3,$4)",[availability,period,uuid(1),key()]);
   const blocked=await account(22);await q("insert into savings_yield_allocations(yield_period_id,participant_id,eligible,status) values($1,$2,false,'EXCLUDED')",[period,blocked.p]);
   assert((await run()).error_codes.includes('SAVINGS_YIELD_PERIOD_PROTECTED'));assert.equal(await nTx(blocked.p),0);
   const creditedEarly=await account(40);await q("insert into savings_yield_allocations(yield_period_id,participant_id,eligible,status) values($1,$2,true,'CREDITED')",[period,creditedEarly.p]);
   await run();assert.equal(await nTx(creditedEarly.p),0);
   // A second period isolates the ORDINARY guard; no EARLY row can accidentally satisfy it.
   const ordinaryPeriod=key(),ordinaryAvailability=key();
   await q("insert into savings_yield_periods(id,period_year,semester,starts_on,ends_on) values($1,2027,1,'2027-01-01','2027-06-30')",[ordinaryPeriod]);
   await q('insert into savings_action_availability values($1)',[ordinaryAvailability]);
   await q("insert into savings_withdrawal_openings(availability_id,yield_period_id,cutoff_on,percentage,opening_kind,reason,actor_real_auth_user_id,client_action_id) values($1,$2,'2027-06-30',100,'ORDINARY','Cierre ordinario aislado',$3,$4)",[ordinaryAvailability,ordinaryPeriod,uuid(1),key()]);
   for(const [n,status] of [[41,'CREDITED'],[42,'EXCLUDED']]){
    const p=await account(n);await q('insert into savings_yield_allocations(yield_period_id,participant_id,eligible,status) values($1,$2,$3,$4)',[ordinaryPeriod,p.p,status==='CREDITED',status]);
    await run();assert.equal(await nTx(p.p),0);
   }
  });
  await check('total settlement refuses pending automatic due without changing request or money',async()=>{
   const pending=await account(23),request=key();await owner();await q("insert into savings_requests(id,folio,participant_id,enrollment_id,request_type,status,component,requested_amount,continue_saving,actor_real_auth_user_id,usuario_contexto_affiliate_id,idempotency_key,data_classification,metadata) values($1,'TEST_TOTAL',$2,$3,'WITHDRAW','APPROVED','CAPITAL',500,false,$4,$5,$6,'CANONICAL','{\"origin\":\"SAVINGS_RUNTIME_V1\"}')",[request,pending.p,pending.en,uuid(1),pending.af,key()]);
   await actor();await assert.rejects(scalar('select public.admin_save_savings_operation($1,$2) v',[{kind:'SETTLE',request_id:request,capital:500,yield:0},key()]),/SAVINGS_SCHEDULED_RECEIPTS_PENDING/);
   assert.equal(await nTx(pending.p),0);await owner();assert.equal(await scalar('select status v from savings_requests where id=$1',[request]),'APPROVED');
   await actor();await scalar('select public.admin_configure_savings_automatic_contributions(false,$1,$2,$3) v',['2026-09-30','Pausa aislada',key()]);
   assert.equal((await run()).status,'DISABLED');
   await actor();await assert.rejects(scalar('select public.admin_save_savings_operation($1,$2) v',[{kind:'SETTLE',request_id:request,capital:500,yield:0},key()]),/SAVINGS_SCHEDULED_RECEIPTS_PENDING/);
   await assert.rejects(scalar('select public.admin_configure_savings_automatic_contributions(true,$1,$2,$3) v',['2026-10-15','No ocultar vencidos',key()]),/SAVINGS_AUTO_START_DATE_IMMUTABLE/);
   await scalar('select public.admin_configure_savings_automatic_contributions(true,$1,$2,$3) v',['2026-09-30','Reanudación aislada',key()]);
   await run();await actor();await assert.rejects(scalar('select public.admin_save_savings_operation($1,$2) v',[{kind:'SETTLE',request_id:request,capital:500,yield:0},key()]),/SAVINGS_TOTAL_WITHDRAWAL_AMOUNT_MISMATCH/);
   await owner();assert.equal(await scalar('select status v from savings_enrollments where id=$1',[pending.en]),'ACTIVE');
  });
  await check('overlapping plans and net-zero ledger without receipt require review, never fresh credit',async()=>{
   const ambiguous=await account(24,{last:'2026-09-30'});
   await q("insert into savings_contribution_plans(enrollment_id,amount,process_snapshot,effective_from,effective_to,data_classification,created_by_auth_user_id) values($1,700,'PROCESS_1','2026-09-20','2026-09-30','CANONICAL',$2)",[ambiguous.en,uuid(1)]);
   const reversed=await account(25,{last:'2026-09-30'}),original=key();
   await q("insert into savings_transactions(id,participant_id,enrollment_id,transaction_type,component,direction,amount,effective_date,contribution_date,idempotency_key,data_classification) values($1,$2,$3,'CONTRIBUTION','CAPITAL','CREDIT',500,'2026-09-30','2026-09-30',$4,'CANONICAL')",[original,reversed.p,reversed.en,key()]);
   await q("insert into savings_transactions(participant_id,enrollment_id,transaction_type,component,direction,amount,effective_date,contribution_date,reversal_of_transaction_id,idempotency_key,data_classification) values($1,$2,'REVERSAL','CAPITAL','DEBIT',500,'2026-09-30','2026-09-30',$3,$4,'CANONICAL')",[reversed.p,reversed.en,original,key()]);
   const result=await run();assert(result.error_codes.includes('SAVINGS_AUTO_PLAN_CONFLICT'));assert(result.error_codes.includes('SAVINGS_RECEIPT_HISTORY_MISMATCH'));
   assert.equal(await nTx(ambiguous.p),0);assert.equal(await balance(reversed.p),0);assert.equal(await nTx(reversed.p),2);
   assert.equal(await scalar('select count(*)::int v from savings_contribution_overrides where enrollment_id=$1',[reversed.en]),0);
  });
  await check('bounded batch explicitly reports more pending and eventually reaches untouched accounts',async()=>{
   const one=await account(26),two=await account(27);const partial=await run(1);
   assert.equal(partial.applied,1);assert.equal(partial.status,'MORE_PENDING');assert.equal(partial.batch_limit,1);assert(partial.remaining>0);
   await run();assert.equal(await balance(one.p),1000);assert.equal(await balance(two.p),1000);
  });
  await check('backend grants, real actor checks and origin constraint deny direct client/system impersonation',async()=>{
   await actor('savings.read',9);await assert.rejects(instruction(a.p,a.en,'2026-10-30',0,0),/SAVINGS_WRITE_DENIED/);
   await assert.rejects(scalar('select public.admin_configure_savings_automatic_contributions(true,$1,$2,$3) v',['2026-09-30','No autorizado',key()]),/SAVINGS_CONFIG_DENIED/);
   await assert.rejects(q('select * from savings_automatic_private.policy'),/permission denied/);
   await assert.rejects(q('select savings_automatic_private.run_due()'),/permission denied/);
   await owner();await db.exec('set role anon');await assert.rejects(q('select public.admin_set_savings_scheduled_contribution(null,null,null,null,null,null,null)'),/permission denied/);
   await owner();await assert.rejects(q("insert into savings_contribution_overrides(enrollment_id,contribution_date,expected_amount,actual_amount,version_number,reason,client_action_id,entry_source) values($1,'2026-12-30',500,0,1,'Inválido',$2,'MANUAL')",[a.en,key()]),/savings_override_origin_actor_check/);
   assert.equal(await scalar("select count(*)::int v from savings_transactions where component='YIELD' or transaction_type='WITHDRAWAL'"),0);
  });
  await check('recovery after postings stops job while preserving all money, instructions and audit',async()=>{
   await owner();const before=await scalar("select md5(coalesce(jsonb_agg(t order by id)::text,'[]')) v from savings_transactions t"),overrides=await scalar('select count(*)::int v from savings_contribution_overrides'),audit=await scalar('select count(*)::int v from savings_audit_events');
   await db.exec(read(recovery));assert.equal(await scalar('select enabled v from savings_automatic_private.policy'),false);assert.equal(await scalar("select count(*)::int v from cron.job where jobname='savings-automatic-contributions'"),0);
   assert.equal(await scalar("select md5(coalesce(jsonb_agg(t order by id)::text,'[]')) v from savings_transactions t"),before);assert.equal(await scalar('select count(*)::int v from savings_contribution_overrides'),overrides);assert.equal(await scalar('select count(*)::int v from savings_audit_events'),audit);
  });
  const files=[forward,recovery,'scripts/test-savings-automatic-contributions.js','scripts/fixtures/savings-automatic-contributions-schema.json'];
  const result={status:'PASS',environment:'isolated PostgreSQL/WASM',productionWrites:0,checks,hashes:Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(read(f)).digest('hex')])),limits:'Real catalog definitions/constraints/guards executed. Auth, payout evidence and pg_cron transport simulated. Actual simultaneous PostgreSQL sessions and scheduler wake require separate verification; no live synthetic transactions were executed.'};
  fs.mkdirSync(path.join(root,'docs/qa/evidence/savings-automatic-contributions'),{recursive:true});fs.writeFileSync(path.join(root,'docs/qa/evidence/savings-automatic-contributions/sql-isolated.json'),JSON.stringify(result,null,2)+'\n');
 }catch(e){
  if(e.message==='SAVINGS_AUTO_TABLE_CONSTRAINTS_DRIFT'){
   await db.exec('rollback');
   const actual=await q('select conname name,pg_get_constraintdef(oid) definition from pg_constraint where conrelid=$1::regclass order by conname',['public.'+e.detail]);
   const expected=fixture.tables.find(t=>t.name===e.detail).constraints;
   console.error(JSON.stringify({schemaDifference:{table:e.detail,actual,expected}},null,2));
  }
  throw e;
 }finally{await db.close();}
}
main().catch(e=>{console.error(e.message,e.detail||'');process.exitCode=1;});
