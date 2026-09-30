'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const {query}=require('./savings-admin-review-db');const root=path.resolve(__dirname,'..'),dir=path.join(root,'docs/qa/evidence/savings-individual-withdrawal');
const version='20260930000100',read=f=>fs.readFileSync(path.join(root,f),'utf8'),quote=s=>"'"+String(s).replace(/'/g,"''")+"'";
const tables=['affiliates','savings_participants','savings_enrollments','savings_transactions','savings_holds','savings_requests','savings_yield_periods','savings_yield_allocations','savings_contribution_plans','savings_action_availability','savings_withdrawal_openings','savings_audit_events'];
const fingerprints=tables.map(n=>`select '${n}' resource,count(*) total,md5(coalesce(string_agg(to_jsonb(t)::text,'|' order by id),'')) fingerprint from public.${n} t`).join(' union all ');
async function security(){return query(`select p.proname,p.prosecdef,array_to_string(p.proconfig,',') config,has_function_privilege('anon',p.oid,'execute') anon,has_function_privilege('authenticated',p.oid,'execute') authenticated,has_function_privilege('service_role',p.oid,'execute') service_role from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in ('get_admin_savings_individual_withdrawal','admin_set_savings_individual_withdrawal') order by p.proname`);}
async function main(){const mode=process.argv[2]||'status';fs.mkdirSync(dir,{recursive:true});
 if(mode==='status'){console.log(JSON.stringify({security:await security(),data:await query(fingerprints)}));return;}
 if(mode!=='apply')throw Error('Use status or apply');
 const schema=JSON.parse(read('.tmp/savings-individual-withdrawal/schema.json'));
 const current=await query(`select proname name,pg_get_functiondef(oid) definition from pg_proc where pronamespace='public'::regnamespace and proname in ('savings_effective_action','savings_runtime_assert_identity','savings_runtime_submit','savings_runtime_assert_payout','has_admin_permission','get_admin_savings_runtime_requests')`);
 for(const expected of schema.definitions)assert.equal(current.find(x=>x.name===expected.name)?.definition,expected.definition,'LIVE_FUNCTION_DRIFT '+expected.name);
 assert.equal((await security()).length,0,'new endpoints already exist: inspect before any retry');
 const sql=read('supabase/migrations/'+version+'_savings_individual_withdrawal.sql'),digest=crypto.createHash('sha256').update(sql).digest('hex');
 const statement=`begin;set local lock_timeout='5s';set local statement_timeout='30s';
 lock table ${tables.map(n=>'public.'+n).join(',')} in share mode;
 create temp table savings_individual_before on commit drop as ${fingerprints};
 ${sql.replace(/^\s*begin;/i,'').replace(/commit;\s*$/i,'')}
 do $guard$ begin if exists((select * from savings_individual_before) except (${fingerprints})) then raise exception 'SAVINGS_INDIVIDUAL_DATA_CHANGED';end if;end $guard$;
 insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','savings_individual_withdrawal',array[${quote('H-SAVINGS-INDIVIDUAL-WITHDRAWAL-UX-001 sha256:'+digest)}]);
 select jsonb_build_object('before',(select jsonb_agg(x order by resource) from savings_individual_before x),'after',(select jsonb_agg(x order by resource) from (${fingerprints}) x)) evidence;commit;`;
 const applied=await query(statement),acl=await security();assert.equal(acl.length,2);assert(acl.every(x=>x.prosecdef&&!x.anon&&x.authenticated&&!x.service_role));
 const proof={status:'PASS',migration:version,sha256:digest,dataUnchangedWithinTransaction:true,evidence:applied,security:acl,productionBusinessWrites:0};fs.writeFileSync(path.join(dir,'apply.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
