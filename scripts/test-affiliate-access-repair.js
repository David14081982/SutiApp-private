'use strict';
// H-AFFILIATE-ACCESS-REPAIR-001 — applies the migration (and optionally its recovery) against
// production INSIDE one transaction that always ends in a forced error, so nothing persists.
// Scenarios use the real pre-repair case of control 13838 (audit 2026-09-26), resolved at run time
// by control number so no personal data or account ids live in this public repository.
// Usage: node scripts/test-affiliate-access-repair.js [--recovery]
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const env={};
for(const line of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^﻿/,'').split(/\r?\n/)){
  const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m)env[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');
}
const body=(file)=>{const sql=fs.readFileSync(path.join(root,file),'utf8').trim();
  if(!/^begin;/i.test(sql)||!/commit;$/i.test(sql))throw Error('TRANSACTION_BOUNDARY_REQUIRED '+file);
  return sql.replace(/^begin;/i,'').replace(/commit;$/i,'');};
const MIGRATION=body('supabase/migrations/20260926000100_affiliate_access_repair.sql');
const RECOVERY=body('supabase/recovery/20260926000100_affiliate_access_repair_recovery.sql');

const CASE_CONTROL='13838';
const C=(column)=>`(select ${column} from pg_temp.t_case)`;
const ADMIN=C('admin_id');            // H005_TEST from supabase.env (affiliates.read/write)
const CASE_AUTH=C('account_id');      // Auth account whose email is on the 13838 row
const ROW_CASE=C('target_id');        // control 13838
const ROW_WRONG=C('source_id');       // row that holds that account by mistake
const CASE_EMAIL=C('email');

const as=(sub,role)=>`reset role; set local role ${role||'authenticated'}; select set_config('request.jwt.claims', json_build_object('sub',${sub},'role','${role||'authenticated'}')::text, true);`;
const ok=(name,cond,detail)=>`insert into pg_temp.t_results(name,ok,detail) values (${q(name)},coalesce((${cond}),false),left((${detail||"''"})::text,400));`;
const q=(s)=>"'"+String(s).replace(/'/g,"''")+"'";
const expectError=(name,call,fragment)=>`do $t$ begin perform ${call}; ${ok(name,'false',"'no error'")} exception when others then ${ok(name,`sqlerrm like ${q('%'+fragment+'%')}`,'sqlerrm')} end $t$;`;
const run=(name,stmts)=>`do $t$ declare d jsonb; r jsonb; begin ${stmts} exception when others then ${ok(name,'false','sqlerrm')} end $t$;`;
// Test-only helpers inside the rolled-back transaction: RLS hides other rows from the admin role.
const updatedAt=(id)=>`pg_temp.ua(${id})`;
const pick=(kind)=>`(select id from pg_temp.t_pick where kind='${kind}')`;
const pickedAt=(kind)=>`pg_temp.ua(${pick(kind)})`;

const identity="select md5(coalesce(string_agg(id::text||':'||coalesce(auth_user_id::text,'-')||':'||auth_eligibility,',' order by id),'')) from public.affiliates";
const rowsHash="select md5(coalesce(string_agg(md5(to_jsonb(a)::text),'' order by a.id),'')) from public.affiliates a";
const fnHash="select md5(coalesce(string_agg(md5(pg_get_functiondef(p.oid)),'' order by p.oid),'')) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' and p.proname not in ('affiliate_access_expected_eligibility','affiliates_release_stale_duplicate_email','get_admin_affiliate_access_diagnosis','list_admin_affiliate_access_issues','admin_relink_affiliate_account','admin_release_affiliate_account','admin_recalculate_affiliate_access','revert_affiliate_access_repair')";
const aclHash="select md5(coalesce(string_agg(p.oid::text||coalesce(p.proacl::text,''),'' order by p.oid),'')) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'";
const trgHash="select md5(coalesce(string_agg(tgname,',' order by tgname),'')) from pg_trigger where not tgisinternal and tgname<>'affiliates_release_stale_duplicate_email'";

const withRecovery=process.argv.includes('--recovery');
const sql=[
`begin; set local lock_timeout='3s'; set local statement_timeout='90s';`,
`create temporary table t_results(ts timestamptz default clock_timestamp(), name text, ok boolean, detail text);`,
`grant insert, select on pg_temp.t_results to authenticated, anon, service_role;`,
`create temporary table t_before as select (${identity}) ident, (${rowsHash}) rows_hash, (${fnHash}) fn_hash, (${trgHash}) trg_hash;`,
`create temporary table t_acl_before as select (${aclHash}) acl;`,
MIGRATION,
ok('migration: filas de afiliados intactas',`(${rowsHash})=(select rows_hash from t_before)`),
ok('migration: funciones existentes intactas',`(${fnHash})=(select fn_hash from t_before)`),
ok('migration: triggers existentes intactos',`(${trgHash})=(select trg_hash from t_before)`),
`grant select on pg_temp.t_before to authenticated, service_role;`,
`create temporary table t_case as
  select t.id target_id, t.historical_email_normalized email, u.id account_id, s.id source_id,
    (select id from auth.users where lower(email)=lower(${q(env.H005_TEST_EMAIL||'')})) admin_id
  from public.affiliates t
  left join auth.users u on lower(btrim(u.email))=t.historical_email_normalized
  left join public.affiliates s on s.auth_user_id=u.id
  where t.numero_control=${q(CASE_CONTROL)};`,
`grant select on pg_temp.t_case to authenticated, anon, service_role;`,
ok('caso 13838 resuelto por número de control',"(select count(*) from pg_temp.t_case where target_id is not null and account_id is not null and source_id is not null and source_id<>target_id and admin_id is not null)=1"),
`create function pg_temp.ua(p uuid) returns timestamptz language sql stable security definer set search_path='' as $f$ select updated_at from public.affiliates where id=p $f$;`,
`create temporary table t_pick as
  select 'healthy'::text kind,(select a.id from public.affiliates a join auth.users u on u.id=a.auth_user_id where not a.is_archived and a.historical_email_normalized=lower(btrim(u.email)) and (select count(*) from public.affiliates b where b.historical_email_normalized=a.historical_email_normalized)=1 order by a.id limit 1) id
  union all select 'certified',(select id from public.affiliates where numero_control='1536' and auth_user_id is not null)
  union all select 'shared',(select a.id from public.affiliates a where a.auth_user_id is null and not a.is_archived and (select count(*) from public.affiliates b where b.historical_email_normalized=a.historical_email_normalized)>1 order by a.id limit 1)
  union all select 'dup',(select a.id from public.affiliates a where a.auth_eligibility='duplicate_email' and a.auth_user_id is null and not a.is_archived and (select count(*) from public.affiliates b where b.historical_email_normalized=a.historical_email_normalized)=2 and exists(select 1 from public.affiliates b where b.id<>a.id and b.historical_email_normalized=a.historical_email_normalized and b.auth_user_id is null) order by a.id limit 1)
  union all select 'plain',(select a.id from public.affiliates a where a.auth_user_id is null and not a.is_archived and a.historical_email_normalized is not null and (select count(*) from public.affiliates b where b.historical_email_normalized=a.historical_email_normalized)=1 order by a.id limit 1);`,
`insert into pg_temp.t_pick select 'dup_sibling', b.id from public.affiliates b join public.affiliates d on d.id=(select id from pg_temp.t_pick where kind='dup') where b.id<>d.id and b.historical_email_normalized=d.historical_email_normalized;`,
`create temporary table t_plain as select auth_eligibility from public.affiliates where id=(select id from pg_temp.t_pick where kind='plain');`,
`grant select on pg_temp.t_pick, pg_temp.t_plain to authenticated, service_role;`,
ok('fixtures de prueba encontrados',"(select count(*) from pg_temp.t_pick where id is not null)=6","(select string_agg(kind||'='||coalesce(id::text,'NULL'),', ') from pg_temp.t_pick)"),

// --- Diagnosis (admin)
as(ADMIN),
run('diagnóstico 13838: bloqueado, cuenta en otro afiliado, relink disponible',`d:=public.get_admin_affiliate_access_diagnosis(${ROW_CASE});
  ${ok('diagnóstico 13838: bloqueado, cuenta en otro afiliado, relink disponible',
    "d->>'state'='BLOCKED' and d->'issues' ? 'STALE_BLOCK' and d->'issues' ? 'ACCOUNT_ON_OTHER_AFFILIATE' and (d->'actions'->>'relink')::boolean and (d->'actions'->>'recalculate')::boolean and (d->'email_account'->'holder'->>'id')="+ROW_WRONG+"::text",'d')}`),
run('diagnóstico fila errónea: vínculo roto, separar disponible',`d:=public.get_admin_affiliate_access_diagnosis(${ROW_WRONG});
  ${ok('diagnóstico fila errónea: vínculo roto, separar disponible',"d->'issues' ? 'LINK_EMAIL_MISMATCH' and (d->'actions'->>'release')::boolean and not (d->'actions'->>'relink')::boolean",'d')}`),
run('lista de problemas incluye 13838 y la fila errónea',`r:=public.list_admin_affiliate_access_issues();
  ${ok('lista de problemas incluye 13838 y la fila errónea',`exists(select 1 from jsonb_array_elements(r) x where x->>'id'=${ROW_CASE}::text) and exists(select 1 from jsonb_array_elements(r) x where x->>'id'=${ROW_WRONG}::text)`,"jsonb_array_length(r)")}`),

// --- Guards
expectError('relink rechaza versión vieja',`public.admin_relink_affiliate_account(${ROW_CASE}, now()-interval '1 day', '')`,'VERSION_CONFLICT'),
expectError('recalcular rechaza fila vinculada',`public.admin_recalculate_affiliate_access(${ROW_WRONG}, ${updatedAt(ROW_WRONG)}, '')`,'ALREADY_LINKED'),
expectError('separar rechaza un vínculo sano',`public.admin_release_affiliate_account(${pick('healthy')}, ${pickedAt('healthy')}, '')`,'LINK_HEALTHY'),
// Certified links all match today; simulate a later email edit on one (rolled back).
`reset role; update public.affiliates set historical_email_raw='otro.h-access@example.invalid', historical_email_normalized='otro.h-access@example.invalid' where id=${pick('certified')};`,
as(ADMIN),
expectError('separar protege reparación certificada (control 1536)',`public.admin_release_affiliate_account(${pick('certified')}, ${pickedAt('certified')}, '')`,'CERTIFIED_LINK_PROTECTED'),
expectError('relink rechaza correo compartido',`public.admin_relink_affiliate_account(${pick('shared')}, ${pickedAt('shared')}, '')`,'EMAIL_SHARED'),

// --- Permissions
as(CASE_AUTH),
expectError('afiliado sin permiso: diagnóstico denegado',`public.get_admin_affiliate_access_diagnosis(${ROW_CASE})`,'READ_DENIED'),
expectError('afiliado sin permiso: relink denegado',`public.admin_relink_affiliate_account(${ROW_CASE}, now(), '')`,'WRITE_DENIED'),
`reset role; set local role anon; set local request.jwt.claims='{"role":"anon"}';`,
expectError('anónimo sin ejecución',`public.get_admin_affiliate_access_diagnosis(${ROW_CASE})`,'permission denied'),
expectError('anónimo no puede revertir',`public.revert_affiliate_access_repair(1)`,'permission denied'),
as(ADMIN),
expectError('admin no puede usar revert técnico',`public.revert_affiliate_access_repair(1)`,'permission denied'),

// --- Case 13838: relink in one step
as(ADMIN),
run('pasar cuenta al caso 13838',`r:=public.admin_relink_affiliate_account(${ROW_CASE}, ${updatedAt(ROW_CASE)}, 'Prueba H-AFFILIATE-ACCESS-REPAIR-001');
  ${ok('pasar cuenta al caso 13838',"r ? 'profile'","left(r::text,200)")}`),
`reset role;`,
ok('13838 queda con su cuenta y habilitada',`exists(select 1 from public.affiliates where id=${ROW_CASE} and auth_user_id=${CASE_AUTH} and auth_eligibility='eligible' and auth_ineligibility_reason is null)`),
ok('fila errónea queda sin cuenta y sin habilitación falsa',`exists(select 1 from public.affiliates where id=${ROW_WRONG} and auth_user_id is null and auth_eligibility='missing_email')`),
ok('historial: un evento en cada ficha',`(select count(*) from public.affiliate_admin_events where affiliate_id in (${ROW_CASE},${ROW_WRONG}) and changed_fields=array['acceso_app'])=2`,
  `(select string_agg(reason,' | ') from public.affiliate_admin_events where changed_fields=array['acceso_app'])`),
ok('evidencia de reparación registrada',`(select count(*) from public.affiliate_access_repairs where action='ACCOUNT_RELINKED' and affiliate_id=${ROW_CASE} and source_affiliate_id=${ROW_WRONG} and auth_user_id=${CASE_AUTH} and actor_auth_user_id=${ADMIN})=1`),
as(CASE_AUTH),
ok('sesión del caso 13838: estado ACTIVE',`public.get_current_affiliate_access_state()='ACTIVE'`,'public.get_current_affiliate_access_state()'),
ok('sesión del caso 13838: resuelve su propia ficha 13838',`public.get_effective_affiliate_id()=${ROW_CASE}`,'public.get_effective_affiliate_id()'),
ok('sesión del caso 13838: ve solo su fila por RLS',`(select count(*) from public.affiliates)=1 and (select id from public.affiliates limit 1)=${ROW_CASE}`),
ok('activación de su correo: ALREADY_ACTIVATED',`public.get_affiliate_activation_status(${CASE_EMAIL})->>'status'='ALREADY_ACTIVATED'`),
as(ADMIN),
run('diagnóstico posterior: ACTIVE sin problemas',`d:=public.get_admin_affiliate_access_diagnosis(${ROW_CASE});
  ${ok('diagnóstico posterior: ACTIVE sin problemas',"d->>'state'='ACTIVE' and jsonb_array_length(d->'issues')=0",'d')}`),

// --- Technical revert restores the exact identity state
`reset role; set local role service_role; set local request.jwt.claims='{"role":"service_role"}';`,
run('revert técnico',`r:=public.revert_affiliate_access_repair((select max(id) from public.affiliate_access_repairs));
  ${ok('revert técnico',"r->>'status'='REVERTED'",'r')}`),
`reset role;`,
ok('revert: vínculos y habilitación idénticos al estado original',`(${identity})=(select ident from t_before)`),

// --- Alternative path: release + recalculate + relink (account without affiliate)
as(ADMIN),
run('separar cuenta de la fila errónea',`r:=public.admin_release_affiliate_account(${ROW_WRONG}, ${updatedAt(ROW_WRONG)}, '');
  ${ok('separar cuenta de la fila errónea',"r ? 'profile'")}`),
run('quitar bloqueo a 13838',`r:=public.admin_recalculate_affiliate_access(${ROW_CASE}, ${updatedAt(ROW_CASE)}, '');
  ${ok('quitar bloqueo a 13838',"r ? 'profile'")}`),
ok('con el bloqueo retirado su correo puede activar (ELIGIBLE)',`public.get_affiliate_activation_status(${CASE_EMAIL})->>'status'='ELIGIBLE'`),
expectError('quitar bloqueo dos veces no hace nada',`public.admin_recalculate_affiliate_access(${ROW_CASE}, ${updatedAt(ROW_CASE)}, '')`,'NO_CHANGE'),
run('vincular cuenta existente sin ficha',`d:=public.get_admin_affiliate_access_diagnosis(${ROW_CASE});
  r:=public.admin_relink_affiliate_account(${ROW_CASE}, ${updatedAt(ROW_CASE)}, '');
  ${ok('vincular cuenta existente sin ficha',"d->'issues' ? 'ACCOUNT_WITHOUT_AFFILIATE' and (d->'actions'->>'relink')::boolean and r ? 'profile'",'d')}`),
`reset role;`,
ok('ruta alterna termina en el mismo estado correcto',`exists(select 1 from public.affiliates where id=${ROW_CASE} and auth_user_id=${CASE_AUTH} and auth_eligibility='eligible')`),

// --- Automatic release on the existing edit form (trigger)
as(ADMIN),
run('edición existente: quitar correo duplicado en una ficha',`perform public.update_admin_affiliate(${pick('dup_sibling')}, ${pickedAt('dup_sibling')}, jsonb_build_object('historical_email_raw','prueba.h-access@example.invalid'), '');
  ${ok('edición existente: quitar correo duplicado en una ficha','true')}`),
run('edición existente sin tocar correo',`perform public.update_admin_affiliate(${pick('plain')}, ${pickedAt('plain')}, jsonb_build_object('phone_raw','000 prueba'), '');
  ${ok('edición existente sin tocar correo','true')}`),
`reset role;`,
ok('trigger: la otra ficha del duplicado queda habilitada sola',`(select auth_eligibility from public.affiliates where id=${pick('dup')})='eligible' and exists(select 1 from public.affiliate_access_repairs where action='ELIGIBILITY_AUTO_RELEASED' and affiliate_id=${pick('dup')})`),
ok('trigger: evento visible en el historial de esa ficha',`exists(select 1 from public.affiliate_admin_events where affiliate_id=${pick('dup')} and changed_fields=array['acceso_app'])`),
ok('edición sin cambio de correo no altera la habilitación',`(select auth_eligibility from public.affiliates where id=${pick('plain')})=(select auth_eligibility from pg_temp.t_plain)`),
`reset role;`,
withRecovery?RECOVERY:'',
withRecovery?ok('recovery: objetos nuevos eliminados',"to_regprocedure('public.admin_relink_affiliate_account(uuid,timestamptz,text)') is null and not exists(select 1 from pg_trigger where tgname='affiliates_release_stale_duplicate_email')"):'',
withRecovery?ok('recovery: funciones existentes idénticas',`(${fnHash})=(select fn_hash from t_before)`):'',
withRecovery?ok('recovery: permisos existentes idénticos',`(${aclHash})=(select acl from t_acl_before)`):'',
`do $t$ begin raise exception 'RESULTS:%', (select json_agg(json_build_object('ok',ok,'name',name,'detail',detail) order by ts) from pg_temp.t_results); end $t$;`
].join('\n');

(async()=>{
  const ref=new URL(env.SUPABASE_URL).hostname.split('.')[0];
  const response=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',
    headers:{Authorization:`Bearer ${env.SUPABASE_ACCESS_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql})});
  const text=await response.text();
  let message=text;try{const parsed=JSON.parse(text);message=String(parsed.message||parsed.error||text);}catch(_){}
  const start=message.indexOf('RESULTS:[');
  if(start<0){console.error('UNEXPECTED',response.status,message.slice(0,3000));process.exitCode=2;return;}
  const tail=message.slice(start+'RESULTS:'.length).split(/\nCONTEXT:/)[0];
  const results=JSON.parse(tail.slice(0,tail.lastIndexOf(']')+1));
  let failed=0;for(const r of results){if(!r.ok)failed++;console.log((r.ok?'PASS ':'FAIL ')+r.name+(r.ok?'':'  → '+r.detail));}
  const summary={status:failed?'FAIL':'PASS',checks:results.length,failed,recovery:withRecovery,productionWrites:0,rolledBack:true};
  console.log(JSON.stringify(summary));
  const dir=path.join(root,'docs/qa/evidence/affiliate-access-repair-20260926');fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,withRecovery?'postgres-recovery.json':'postgres-rollback.json'),JSON.stringify(Object.assign(summary,{results:results.map(({name,ok})=>({name,ok}))}),null,2)+'\n');
  process.exitCode=failed?1:0;
})();
