'use strict';
// H-AFFILIATE-ACCESS-REPAIR-001 — apply the additive migration to production in ONE transaction.
// Aborts (nothing persists) if any affiliate row, existing function, grant or trigger changes.
// Usage: node scripts/apply-affiliate-access-repair.js            -> status only (read)
//        node scripts/apply-affiliate-access-repair.js --dry-run  -> full envelope, forced rollback
//        node scripts/apply-affiliate-access-repair.js --apply    -> requires PASS evidence
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const VERSION='20260926000100',NAME='affiliate_access_repair';
const file=path.join(root,`supabase/migrations/${VERSION}_${NAME}.sql`);
const evidence=path.join(root,'docs/qa/evidence/affiliate-access-repair-20260926');
const env={};
for(const line of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^﻿/,'').split(/\r?\n/)){
  const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m)env[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');
}
async function query(sql){
  const ref=new URL(env.SUPABASE_URL).hostname.split('.')[0];
  const response=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',
    headers:{Authorization:`Bearer ${env.SUPABASE_ACCESS_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql})});
  const text=await response.text();if(!response.ok)throw Error(`SQL_${response.status}: ${text.slice(0,2000)}`);return JSON.parse(text);
}
const q=(s)=>"'"+String(s).replace(/'/g,"''")+"'";
const NEW="('affiliate_access_expected_eligibility','affiliates_release_stale_duplicate_email','get_admin_affiliate_access_diagnosis','list_admin_affiliate_access_issues','admin_relink_affiliate_account','admin_release_affiliate_account','admin_recalculate_affiliate_access','revert_affiliate_access_repair')";
const digest=`select
  (select md5(coalesce(string_agg(md5(to_jsonb(a)::text),'' order by a.id),'')) from public.affiliates a) rows_hash,
  (select count(*) from public.affiliates) rows_count,
  (select md5(coalesce(string_agg(md5(pg_get_functiondef(p.oid))||coalesce(p.proacl::text,''),'' order by p.oid),'')) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' and p.proname not in ${NEW}) fn_hash,
  (select md5(coalesce(string_agg(tgname||pg_get_triggerdef(oid),'' order by tgname),'')) from pg_trigger where not tgisinternal and tgname<>'affiliates_release_stale_duplicate_email') trg_hash,
  (select md5(coalesce(string_agg(c.oid::text||coalesce(c.relacl::text,'')||c.relrowsecurity||c.relforcerowsecurity,'' order by c.oid),'')) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname<>'affiliate_access_repairs') tables_hash`;
(async()=>{
  const bytes=fs.readFileSync(file),sql=bytes.toString('utf8'),sha=crypto.createHash('sha256').update(bytes).digest('hex');
  const installed=await query(`select version from supabase_migrations.schema_migrations where version=${q(VERSION)}`);
  const dry=process.argv.includes('--dry-run');
  if(!process.argv.includes('--apply')&&!dry){console.log(JSON.stringify({version:VERSION,installed:installed.length>0,migrationSha256:sha}));return;}
  if(installed.length){console.log(JSON.stringify({status:'PASS',applied:false,alreadyInstalled:true,version:VERSION}));return;}
  for(const name of dry?[]:['postgres-rollback.json','postgres-recovery.json','browser-result.json','build.json']){
    const report=JSON.parse(fs.readFileSync(path.join(evidence,name),'utf8'));
    if(report.status!=='PASS')throw Error('REQUIRED_CHECK_NOT_PASS:'+name);
  }
  const body=sql.trim().replace(/^begin;/i,'').replace(/commit;$/i,'');
  const transaction=`begin isolation level repeatable read; set local lock_timeout='3s'; set local statement_timeout='60s';
create temporary table access_repair_before on commit drop as ${digest};
${body}
do $verify$ begin
  if exists(select * from access_repair_before except ${digest}) then raise exception 'ACCESS_REPAIR_EXISTING_STATE_CHANGED'; end if;
  if to_regprocedure('public.admin_relink_affiliate_account(uuid,timestamptz,text)') is null then raise exception 'ACCESS_REPAIR_NOT_INSTALLED'; end if;
end $verify$;
insert into supabase_migrations.schema_migrations(version,name,statements) values (${q(VERSION)},${q(NAME)},array[${q(sql)}]);
select jsonb_build_object('status','PASS','applied',true,'version',${q(VERSION)},'existingStateChanged',false,'before',(select to_jsonb(b) from access_repair_before b)) result;
commit;`;
  if(dry){ // Same envelope, but end in a forced error so nothing persists.
    const probe=transaction.replace(/select jsonb_build_object\('status'[\s\S]*$/,"do $d$ begin raise exception 'DRY_RUN_PASS'; end $d$;");
    try{await query(probe);throw Error('DRY_RUN_DID_NOT_ABORT');}catch(error){if(!String(error.message).includes('DRY_RUN_PASS'))throw error;}
    const still=await query(`select version from supabase_migrations.schema_migrations where version=${q(VERSION)}`);
    console.log(JSON.stringify({status:'PASS',dryRun:true,envelopeVerified:true,persisted:still.length>0}));return;
  }
  const result=await query(transaction);
  const receipt={status:'PASS',version:VERSION,migrationSha256:sha,appliedAt:new Date().toISOString(),result,businessDataChanged:false};
  fs.writeFileSync(path.join(evidence,'apply.json'),JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify({status:'PASS',applied:true,version:VERSION}));
})().catch((error)=>{console.error(String(error.message||error));process.exitCode=1;});
