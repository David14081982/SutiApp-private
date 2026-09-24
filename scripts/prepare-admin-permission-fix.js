'use strict';
// Offline compilation from captured definitions. Never applies SQL.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const {sourceInventory,root,read}=require('./screen-permission-contract');
const {compile}=require('./register-admin-screen');
const metadata=JSON.parse(read('docs/qa/evidence/screen-permission-fix-20260924/production-metadata.json'));
const catalog=JSON.parse(read('docs/qa/evidence/screen-permissions-20260924/production-metadata.json'));
const version='20260924000200',state='admin_permission_fix_recovery_'+version;
const quote=s=>"'"+s.replaceAll("'","''")+"'";
const md5=s=>crypto.createHash('md5').update(s).digest('hex');
const scope="(public.has_admin_permission('companies.write') and public.admin_module_boundary(array['companies_admin'],'update'))";
function replaceOnce(source,from,to){assert.equal(source.split(from).length,2,'BASELINE_PATTERN_CHANGED: '+from);return source.replace(from,to);}
const changed=[];
function change(name,fn){const old=metadata.functions.find(f=>f.name===name);assert(old,name);changed.push({...old,replacement:fn(old.definition)});}
change('module_visible',()=>compile(sourceInventory(),catalog,version).definition);
change('can_manage_company_ficha',d=>replaceOnce(d,"public.has_admin_permission('companies.write')",scope));
for(const name of ['enforce_company_ficha_action','enforce_company_ficha_asset_action'])change(name,d=>replaceOnce(d,"public.has_admin_permission('companies.write')",scope));
const relationTables=['company_benefit_profiles','company_benefits','company_audience_rules'];
const guard=`create function public.enforce_admin_company_module_scope() returns trigger language plpgsql security definer set search_path='' as $$
declare company_id uuid:=coalesce(new.company_id,old.company_id); action_name text:=case tg_op when 'INSERT' then 'create' when 'DELETE' then 'delete' else 'update' end;
begin
 if auth.role()='service_role' then return coalesce(new,old);end if;
 if tg_op='UPDATE' and new.company_id is distinct from old.company_id then raise exception 'COMPANY_BOUNDARY_IMMUTABLE';end if;
 if not (
  (public.has_admin_permission('companies.write') and public.admin_module_boundary(array['companies_admin'],'update'))
  or public.has_section_action('companies',action_name)
  or not public.company_is_paid(company_id)
 ) then raise exception 'COMPANY_MODULE_BOUNDARY_DENIED';end if;
 return coalesce(new,old);
end $$;
revoke all on function public.enforce_admin_company_module_scope() from public,anon,authenticated,service_role;`;
const policy=metadata.policies.find(p=>p.tablename==='marketplace_company_memberships'&&p.policyname==='marketplace_memberships_self_read');assert(policy);
const policyExpr="(auth_user_id=(select auth.uid())) or (public.has_admin_permission('companies.read') and public.admin_module_boundary(array['companies_admin','planes']))";
const hashes=['admin_assignments','admin_section_responsibilities','admin_roles','admin_role_permissions','admin_audit_log','companies','company_assets','company_benefit_profiles','company_benefits','company_audience_rules','marketplace_company_memberships','company_portal_subscriptions','company_portal_plans'].map(t=>`md5(coalesce((select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text from public.${t} x),'[]'))`);
const fingerprint=`md5(concat_ws('|',${hashes.join(',')}))`;
const locks="lock table public.admin_assignments,public.admin_section_responsibilities,public.admin_roles,public.admin_role_permissions,public.admin_audit_log,public.companies,public.company_assets,public.company_benefit_profiles,public.company_benefits,public.company_audience_rules,public.marketplace_company_memberships,public.company_portal_subscriptions,public.company_portal_plans in share row exclusive mode;";
const policyHash="(select md5(pg_get_expr(polqual,polrelid)) from pg_policy where polrelid='public.marketplace_company_memberships'::regclass and polname='marketplace_memberships_self_read')";
const forward=`begin;
set local lock_timeout='2s';set local statement_timeout='60s';
${locks}
do $checks$ begin
${changed.map(f=>`if md5(pg_get_functiondef(${quote(f.signature)}::regprocedure))<>${quote(f.hash)} then raise exception 'FUNCTION_DRIFT:${f.name}';end if;`).join('\n')}
if ${policyHash} is distinct from ${quote(md5(policy.qual))} then raise exception 'MEMBERSHIP_POLICY_DRIFT';end if;
end $checks$;
create table public.${state}(key text primary key,definition text not null,applied_hash text,security jsonb);
alter table public.${state} enable row level security;alter table public.${state} force row level security;
revoke all on public.${state} from public,anon,authenticated,service_role;
insert into public.${state}(key,definition)
${changed.map(f=>'select '+quote(f.signature)+',pg_get_functiondef('+quote(f.signature)+'::regprocedure)').concat(["select 'membership_policy',pg_get_expr(polqual,polrelid) from pg_policy where polrelid='public.marketplace_company_memberships'::regclass and polname='marketplace_memberships_self_read'"]).join('\nunion all\n')};
insert into public.${state}(key,definition) select 'state',${fingerprint};
${changed.map(f=>f.replacement+';').join('\n')}
${guard}
${relationTables.map(t=>`create trigger admin_company_module_scope before insert or update or delete on public.${t} for each row execute function public.enforce_admin_company_module_scope();`).join('\n')}
alter policy marketplace_memberships_self_read on public.marketplace_company_memberships using(${policyExpr});
${changed.map(f=>`update public.${state} set applied_hash=md5(pg_get_functiondef(${quote(f.signature)}::regprocedure)) where key=${quote(f.signature)};`).join('\n')}
${changed.map(f=>`update public.${state} set security=(select jsonb_build_array(oid,proowner,proacl::text) from pg_proc where oid=${quote(f.signature)}::regprocedure) where key=${quote(f.signature)};`).join('\n')}
update public.${state} set applied_hash=${policyHash} where key='membership_policy';
update public.${state} set security=(select jsonb_build_array(polpermissive,polroles::text,polcmd,pg_get_expr(polwithcheck,polrelid)) from pg_policy where polrelid='public.marketplace_company_memberships'::regclass and polname='marketplace_memberships_self_read') where key='membership_policy';
insert into public.${state}(key,definition,applied_hash) select 'new_guard','',md5(pg_get_functiondef('public.enforce_admin_company_module_scope()'::regprocedure));
update public.${state} set security=(select jsonb_build_array(oid,proowner,proacl::text) from pg_proc where oid='public.enforce_admin_company_module_scope()'::regprocedure) where key='new_guard';
do $unchanged$ begin if (select definition from public.${state} where key='state')<>${fingerprint} then raise exception 'UNEXPECTED_DATA_CHANGE';end if;end $unchanged$;
commit;
`;
const recovery=`begin;
set local lock_timeout='2s';set local statement_timeout='60s';
${locks}
do $recover$ declare r record;begin
 if (select definition from public.${state} where key='state') is distinct from ${fingerprint} then raise exception 'RECOVERY_BLOCKED_DATA_OR_AUTHORIZATION_USE';end if;
 for r in select * from public.${state} where key not in('state','membership_policy','new_guard') loop
  if r.applied_hash is distinct from md5(pg_get_functiondef(r.key::regprocedure)) then raise exception 'RECOVERY_BLOCKED_FUNCTION_DRIFT';end if;
  if r.security is distinct from (select jsonb_build_array(oid,proowner,proacl::text) from pg_proc where oid=r.key::regprocedure) then raise exception 'RECOVERY_BLOCKED_FUNCTION_SECURITY_DRIFT';end if;
 end loop;
 if (select applied_hash from public.${state} where key='membership_policy') is distinct from ${policyHash} then raise exception 'RECOVERY_BLOCKED_POLICY_DRIFT';end if;
 if (select security from public.${state} where key='membership_policy') is distinct from (select jsonb_build_array(polpermissive,polroles::text,polcmd,pg_get_expr(polwithcheck,polrelid)) from pg_policy where polrelid='public.marketplace_company_memberships'::regclass and polname='marketplace_memberships_self_read') then raise exception 'RECOVERY_BLOCKED_POLICY_SECURITY_DRIFT';end if;
 if (select applied_hash from public.${state} where key='new_guard') is distinct from md5(pg_get_functiondef('public.enforce_admin_company_module_scope()'::regprocedure)) then raise exception 'RECOVERY_BLOCKED_GUARD_DRIFT';end if;
 if (select security from public.${state} where key='new_guard') is distinct from (select jsonb_build_array(oid,proowner,proacl::text) from pg_proc where oid='public.enforce_admin_company_module_scope()'::regprocedure) then raise exception 'RECOVERY_BLOCKED_GUARD_SECURITY_DRIFT';end if;
 ${relationTables.map(t=>`if not exists(select 1 from pg_trigger where tgrelid='public.${t}'::regclass and tgname='admin_company_module_scope' and tgenabled='O' and tgfoid='public.enforce_admin_company_module_scope()'::regprocedure and tgtype=31) then raise exception 'RECOVERY_BLOCKED_TRIGGER_DRIFT';end if;`).join('\n')}
 for r in select * from public.${state} where key not in('state','membership_policy','new_guard') loop execute r.definition;end loop;
 execute 'alter policy marketplace_memberships_self_read on public.marketplace_company_memberships using('||(select definition from public.${state} where key='membership_policy')||')';
end $recover$;
${relationTables.map(t=>`drop trigger admin_company_module_scope on public.${t};`).join('\n')}
drop function public.enforce_admin_company_module_scope();
drop table public.${state};
commit;
`;
for(const [folder,sql] of [['migrations',forward],['recovery',recovery]])fs.writeFileSync(path.join(root,'supabase',folder,version+'_admin_screen_permission_boundaries'+(folder==='recovery'?'_recovery':'')+'.sql'),sql);
console.log(JSON.stringify({status:'PREPARED_NOT_APPLIED',version,changed:changed.map(f=>f.signature),newGuardTables:relationTables,forwardSha256:crypto.createHash('sha256').update(forward).digest('hex')}));
