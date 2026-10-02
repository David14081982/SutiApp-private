'use strict';
// Authorized schema delivery; never submits or approves a production financial operation.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const {query,body}=require('./savings-admin-review-db');
const root=path.resolve(__dirname,'..'),privateDir=path.join(root,'.tmp/savings-admin-ux-20261001');
const out=path.join(root,'docs/qa/evidence/savings-admin-ux-20261001');
const releases=['20261001000100_savings_auto_enrollment','20261001000200_savings_admin_workspace'];
const tables=['affiliates','savings_participants','savings_enrollments','savings_contribution_plans','savings_transactions','savings_contribution_overrides','savings_balance_certifications','savings_review_records','savings_requests','savings_holds','savings_audit_events','savings_yield_periods','savings_yield_allocations','savings_action_availability','savings_operation_settings','savings_publication_state'].map(x=>'public.'+x).concat(['document_private.records']);
const quote=s=>"'"+String(s).replace(/'/g,"''")+"'",hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const fingerprints=tables.map(t=>`select '${t}' resource,count(*) total,md5(coalesce(string_agg(to_jsonb(t)::text,'|' order by to_jsonb(t)::text),'')) fingerprint from ${t} t`).join(' union all ');
const funcs=`select p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition,p.proowner::regrole::text owner,p.proacl::text acl from pg_proc p where (p.pronamespace='public'::regnamespace and p.proname like '%savings%') or (p.pronamespace='document_private'::regnamespace and p.proname='capture_event') order by 1`;
const guard=`do $guard$ begin if exists((select * from savings_ux_before except (${fingerprints})) union all ((${fingerprints}) except select * from savings_ux_before)) then raise exception 'SAVINGS_UX_BUSINESS_DATA_CHANGED';end if;end $guard$;`;
const names=['savings_activate_join','savings_workspace_receipts','savings_workspace_history','savings_workspace_person_row','get_admin_savings_workspace_people','get_admin_savings_workspace_person','get_admin_savings_workspace_summary'];
const aclSql=`select p.proname,p.prosecdef,p.proconfig,has_function_privilege('anon',p.oid,'execute') anon,has_function_privilege('authenticated',p.oid,'execute') authenticated,has_function_privilege('service_role',p.oid,'execute') service_role from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in (${names.map(quote).join(',')}) order by p.proname`;
function validateAcl(rows){assert.equal(rows.length,7);for(const r of rows){assert(r.prosecdef&&!r.anon&&!r.service_role,r.proname);assert.equal(r.authenticated,r.proname.startsWith('get_admin_'),r.proname);assert(r.proconfig.some(x=>x==='search_path=""'),r.proname+' search_path');}}
async function main(){
 const mode=process.argv[2]||'preflight';assert(['preflight','apply','status'].includes(mode));fs.mkdirSync(out,{recursive:true});fs.mkdirSync(privateDir,{recursive:true});
 if(mode==='status'){const acl=await query(aclSql);validateAcl(acl);console.log(JSON.stringify({status:'PASS',acl}));return;}
 const current=await query('begin read only;'+funcs+';rollback;');
 const artifactHashes=Object.fromEntries(releases.flatMap(n=>['migrations','recovery'].map(d=>{const f=`supabase/${d}/${n}.sql`;return[f,hash(fs.readFileSync(path.join(root,f),'utf8'))];})));
 const backupPath=path.join(privateDir,'installed-before.json');
 if(mode==='preflight'){assert.equal((await query(aclSql)).length,0,'Already installed: inspect status');fs.writeFileSync(backupPath,JSON.stringify({functions:current,artifactHashes},null,2));}
 const backup=JSON.parse(fs.readFileSync(backupPath,'utf8'));assert.deepEqual(current,backup.functions,'LIVE_FUNCTION_DRIFT');assert.deepEqual(artifactHashes,backup.artifactHashes,'MIGRATION_ARTIFACT_DRIFT');
 const sql=`begin;set local lock_timeout='2s';set local statement_timeout='60s';
 lock table ${tables.join(',')} in share mode;
 create temp table savings_ux_before on commit drop as ${fingerprints};
 create temp table savings_ux_functions_before on commit drop as ${funcs};
 ${releases.map(n=>body(`supabase/migrations/${n}.sql`)).join('\n')}
 ${guard}
 create temp table savings_ux_new_acl on commit drop as ${aclSql};
 do $security$ begin
  if (select count(*) from savings_ux_new_acl)<>7 or exists(select 1 from savings_ux_new_acl where not prosecdef or anon or service_role or authenticated is distinct from (proname like 'get_admin_%') or ('search_path=""'=any(proconfig)) is distinct from true) then raise exception 'SAVINGS_UX_FUNCTION_SECURITY_CHANGED';end if;
  if exists(select 1 from savings_ux_functions_before b left join (${funcs}) a using(signature) where a.signature is null or a.owner is distinct from b.owner or a.acl is distinct from b.acl) then raise exception 'SAVINGS_UX_EXISTING_ACL_OWNER_CHANGED';end if;
 end $security$;
 create temp table savings_ux_checks on commit drop as
 with people as materialized(select public.savings_workspace_person_row(id) data from public.savings_participants where data_classification='CANONICAL')
 select count(*) participants,count(*) filter(where data->>'identity_conflict'='true') identity_conflicts,
 sum((data->'balance'->>'total')::numeric) total_balance,
 sum((data->'pending'->>'count')::int) pending_receipts
 from people;
 ${mode==='preflight'?releases.slice().reverse().map(n=>body(`supabase/recovery/${n}.sql`)).join('\n')+guard+`do $restore$ begin if exists((select * from savings_ux_functions_before except (${funcs})) union all ((${funcs}) except select * from savings_ux_functions_before)) then raise exception 'SAVINGS_UX_RECOVERY_MISMATCH';end if;end $restore$;`:releases.map(n=>`insert into supabase_migrations.schema_migrations(version,name,statements) values(${quote(n.split('_')[0])},${quote(n.slice(15))},array[${quote('H-SAVINGS-ADMIN-UX-IMPLEMENTATION-001 sha256:'+artifactHashes['supabase/migrations/'+n+'.sql'])}]);`).join('\n')}
 select jsonb_build_object('dataUnchanged',true,'counts',(select jsonb_agg(jsonb_build_object('resource',resource,'total',total) order by resource) from savings_ux_before),
 'acl',(select jsonb_agg(to_jsonb(a) order by proname) from savings_ux_new_acl a),'aggregate',(select to_jsonb(c) from savings_ux_checks c),
 'functions',(select jsonb_agg(to_jsonb(f) order by signature) from (${funcs}) f)) evidence;
 ${mode==='preflight'?'rollback;':'commit;'}`;
 const start=Date.now(),result=(await query(sql))[0].evidence;validateAcl(result.acl);
 if(mode==='preflight')assert.deepEqual(result.functions,current,'Recovery must restore exact definitions, owners and ACL');
 else for(const old of current){const now=result.functions.find(x=>x.signature===old.signature);assert(now,'Function removed '+old.signature);assert.equal(now.acl,old.acl);assert.equal(now.owner,old.owner);}
 delete result.functions;
 const proof={status:'PASS',mode,artifactHashes,elapsedMs:Date.now()-start,productionBusinessWrites:0,recoveryVerified:mode==='preflight',...result};
 fs.writeFileSync(path.join(out,mode+'.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
