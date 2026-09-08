'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert').strict,crypto=require('crypto');
const root=path.resolve(__dirname,'..'),folder=path.join(root,'docs/qa/evidence/requests-workflow-google-sync-20260908'),env={},mode=process.argv[2]||'prepare';
for(const line of fs.readFileSync(process.env.SUTIAPP_TEST_ENV_FILE||'C:/Users/david/OneDrive/Documentos/Sutiapp 20082026/supabase.env','utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const i=line.indexOf('=');if(i>0)env[line.slice(0,i).trim()]=line.slice(i+1).trim().replace(/^['"]|['"]$/g,'');}
const quote=s=>"'"+String(s).replace(/'/g,"''")+"'",sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const migrationPath=path.join(root,'supabase/migrations/20260908000200_request_snapshot_status_validation.sql');
async function sql(query){const r=await fetch('https://api.supabase.com/v1/projects/'+new URL(env.SUPABASE_URL).hostname.split('.')[0]+'/database/query',{method:'POST',headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query}),signal:AbortSignal.timeout(45000)});const d=await r.json();assert(r.ok,'DATABASE_OPERATION_FAILED');return d;}
async function main(){
 const names=['validate_operational_request_tracking','resolve_program_request_workflow_state'];
 const before=await sql("select p.proname,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in("+names.map(quote).join(',')+") order by p.proname");
 const backup=path.join(folder,'before-snapshot-validation.json');
 if(mode==='verify-recovery'){
  const prior=JSON.parse(fs.readFileSync(backup,'utf8')),recovery=fs.readFileSync(path.join(root,'supabase/recovery/20260908000200_request_snapshot_status_validation_recovery.sql'),'utf8');
  const checks=prior.map(r=>`if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=${quote(r.proname)} and pg_get_functiondef(p.oid)=${quote(r.definition)}) then raise exception 'RECOVERY_DEFINITION_MISMATCH';end if;`).join('\n');
  await sql(recovery.replace(/commit;\s*$/,`do $verify$ begin ${checks} end $verify$;rollback;`));
  const proof={status:'PASS',mode,transaction:'ROLLBACK',functionsRestored:names,committedWrites:0};fs.writeFileSync(path.join(folder,'snapshot-validation-recovery.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));return;
 }
 if(mode==='prepare'){
  if(fs.existsSync(backup))assert.deepEqual(before,JSON.parse(fs.readFileSync(backup,'utf8')),'BASELINE_DRIFT');else fs.writeFileSync(backup,JSON.stringify(before,null,2)+'\n');
  const changed=before.map(row=>{let s=row.definition;const from=row.proname===names[0]?"coalesce(v_stage->>'outcome','process')='process' and v_status in('submitted','in_review','requires_financial_processing')":"r.status in('approved','rejected','cancelled') and stage->>'outcome' in('success','failure')";
    const to=row.proname===names[0]?"coalesce(v_stage->>'outcome','process')='process' and (v_status in('submitted','in_review','requires_financial_processing') or (v_status='approved' and v_stage->'status_references'?'approved'))":"r.status in('approved','rejected','cancelled') and (stage->>'outcome' in('success','failure') or (r.status='approved' and stage->'status_references'?'approved'))";
    assert(s.includes(from),'FUNCTION_ANCHOR_MISSING');return s.replace(from,to).trimEnd()+';';});
  fs.writeFileSync(migrationPath,'begin;\n-- Honor the explicit approved mapping in the immutable snapshot, including v16 process stages.\n'+changed.join('\n\n')+"\nnotify pgrst,'reload schema';\ncommit;\n");
  fs.writeFileSync(path.join(root,'supabase/recovery/20260908000200_request_snapshot_status_validation_recovery.sql'),'begin;\n'+before.map(r=>r.definition.trimEnd()+';').join('\n\n')+"\nnotify pgrst,'reload schema';\ncommit;\n");
  console.log(JSON.stringify({status:'PASS',mode,functions:names,historicalRewrites:0}));return;
 }
 assert.equal(mode,'apply');assert.deepEqual(before,JSON.parse(fs.readFileSync(backup,'utf8')),'LIVE_FUNCTION_DRIFT');
 const proof=JSON.parse(fs.readFileSync(path.join(folder,'controlled-approval.json'),'utf8'));assert(proof.status==='PASS'&&proof.trackingMigration===true,'CONTROLLED_APPROVAL_REQUIRED');
 const migration=fs.readFileSync(migrationPath,'utf8');
 const guard=before.map(r=>`if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=${quote(r.proname)} and pg_get_functiondef(p.oid)=${quote(r.definition)}) then raise exception 'LIVE_FUNCTION_DRIFT';end if;`).join('\n');
 await sql(migration.replace('begin;',`begin;do $guard$ begin ${guard} end $guard$;`).replace(/commit;\s*$/,`insert into supabase_migrations.schema_migrations(version,name,statements) values('20260908000200','request_snapshot_status_validation',array[${quote(migration)}]);commit;`));
 const result={status:'PASS',mode,functions:names,migrationSha256:sha(migration),historicalRewrites:0};fs.writeFileSync(path.join(folder,'snapshot-validation-apply.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}
main().catch(e=>{console.error(JSON.stringify({status:'FAIL',error:e.message.split('\n')[0]}));process.exitCode=1;});
