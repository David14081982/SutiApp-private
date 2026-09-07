'use strict';
const fs=require('fs'),{query,body}=require('./savings-admin-review-db');
const forward='supabase/migrations/20260906000700_savings_admin_access.sql',recovery='supabase/recovery/20260906000700_savings_admin_access_recovery.sql';
const checks=`do $test$ declare manager uuid; member uuid; email text; p uuid; old_ctx jsonb; result jsonb; key uuid:=extensions.gen_random_uuid(); rid uuid; begin
 select auth_user_id into manager from public.admin_assignments a where a.enabled and 'authorization.write'=any(a.permissions) and 'savings.read'=any(a.permissions) limit 1;
 select u.id,u.email into member,email from auth.users u where u.email_confirmed_at is not null and not exists(select 1 from public.admin_assignments a where a.auth_user_id=u.id) and not exists(select 1 from public.admin_section_responsibilities r where r.auth_user_id=u.id and r.enabled) limit 1;
 if member is null or manager is null then raise exception 'EXISTING_ROLES_REQUIRED'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',manager,'role','authenticated')::text,true);
 if public.get_admin_access_context()<>public.savings_context_before_20260906() then raise exception 'OPEN_EXISTING_CONTEXT_CHANGED'; end if;
 if (public.get_savings_admin_access()->>'mode')<>'OPEN' then raise exception 'NOT_OPEN_DEFAULT'; end if;
 select id into rid from public.savings_review_records order by id limit 1;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',member,'role','authenticated')::text,true);
 if public.has_admin_permission('savings.read') or public.savings_review_edit_allowed() then raise exception 'ORDINARY_USER_OPEN_ACCESS'; end if;
 begin perform public.get_admin_savings_review(rid);raise exception 'USER_DATA_LEAK';exception when insufficient_privilege then null;end;
 begin perform public.set_savings_admin_access_mode('OPEN',0,key);raise exception 'USER_MODE_WRITE';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',manager,'role','authenticated')::text,true);
 perform public.set_section_responsibilities(email,'savings',array['read']);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',member,'role','authenticated')::text,true);
 if not public.has_admin_permission('savings.read') or public.savings_review_edit_allowed() then raise exception 'READ_ONLY_LEVEL'; end if;
 if not (public.get_admin_access_context()->'technical_permissions' ? 'savings.read') then raise exception 'DELEGATE_NAVIGATION'; end if;
 perform public.get_admin_savings_review(rid);
 if (public.get_savings_admin_access()->>'can_manage')::boolean or jsonb_array_length(public.get_savings_admin_access()->'members')<>0 then raise exception 'MEMBER_EMAIL_LIST_EXPOSED';end if;
 if public.has_admin_permission('affiliates.read') or public.has_admin_permission('authorization.write') or public.has_admin_permission('savings.write') or public.has_admin_permission('savings.identity_review') then raise exception 'PRIVILEGE_ESCALATION';end if;
 begin perform public.set_section_responsibilities(email,'savings',array['read','update']);raise exception 'SELF_ESCALATION';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',manager,'role','authenticated')::text,true);
 perform public.set_section_responsibilities(email,'savings',array['read','update']);
 perform public.set_savings_admin_access_mode('RESTRICTED',0,key);
 perform public.set_savings_admin_access_mode('RESTRICTED',0,key);
 if (select count(*) from public.savings_admin_access_events)<>1 then raise exception 'MODE_RETRY_DUPLICATED';end if;
 begin perform public.set_savings_admin_access_mode('OPEN',0,extensions.gen_random_uuid());raise exception 'STALE_MODE_ACCEPTED';exception when raise_exception then if sqlerrm<>'SAVINGS_ACCESS_CHANGED' then raise;end if;end;
 if not public.has_admin_permission('savings.read') then raise exception 'MANAGER_LOCKOUT';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',member,'role','authenticated')::text,true);
 if not public.savings_review_edit_allowed() or not public.savings_review_identity_allowed() then raise exception 'DELEGATE_EDIT_DENIED';end if;
 result:=public.get_admin_savings_review(null);if not (result->>'can_write')::boolean then raise exception 'EDIT_UI_DENIED';end if;
 perform public.admin_save_savings_review(rid,(select version from public.savings_review_records where id=rid),'{}','IN_REVIEW',null,extensions.gen_random_uuid());
 if public.has_admin_permission('savings.approve') or public.has_admin_permission('savings.write') then raise exception 'DELEGATE_OPERATIONAL_ACCESS';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',manager,'role','authenticated')::text,true);
 perform public.revoke_section_responsibilities(member,'savings');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',member,'role','authenticated')::text,true);
 if public.has_admin_permission('savings.read') or public.savings_review_edit_allowed() then raise exception 'REVOKED_ACCESS';end if;
 begin perform public.get_admin_savings_review(rid);raise exception 'REVOKED_DATA';exception when insufficient_privilege then null;end;
 -- Existing role permissions must also respect restricted membership; other domains stay unchanged.
 select id into p from public.admin_roles where code='principal_admin';
 insert into public.admin_roles(code,name,description) values('isolated_savings_access_role','Isolated rollback','Test') returning id into p;
 insert into public.admin_role_permissions(role_id,permission) values(p,'savings.read'),(p,'affiliates.read');
 insert into public.admin_assignments(auth_user_id,role_id,permissions,enabled) values(member,p,array['savings.read','affiliates.read'],true);
 if public.has_admin_permission('savings.read') or not public.has_admin_permission('affiliates.read') then raise exception 'RESTRICTED_ROLE_GATE';end if;
 if public.get_admin_access_context()->'technical_permissions' ? 'savings.read' then raise exception 'RESTRICTED_CONTEXT_LEAK';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',manager,'role','authenticated')::text,true);
 perform public.set_savings_admin_access_mode('OPEN',1,extensions.gen_random_uuid());
 perform set_config('request.jwt.claims',jsonb_build_object('sub',member,'role','authenticated')::text,true);
 if not public.has_admin_permission('savings.read') then raise exception 'OPEN_ROLE_DENIED';end if;
 perform set_config('request.jwt.claims','{"role":"anon"}',true);
 if public.has_admin_permission('savings.read') then raise exception 'ANON_OPEN';end if;
 if has_function_privilege('anon','public.get_savings_admin_access()','execute') or has_function_privilege('authenticated','public.savings_permission_before_20260906(text)','execute') or has_table_privilege('authenticated','public.savings_admin_access_mode','update') then raise exception 'EXPOSED_INTERNALS';end if;
 if (select count(*) from pg_class where oid in ('public.savings_admin_access_mode'::regclass,'public.savings_admin_access_events'::regclass,'public.savings_access_definition_backup'::regclass) and relrowsecurity and relforcerowsecurity)<>3 then raise exception 'FORCED_RLS_REQUIRED';end if;
end $test$;`;
async function main(){
 const installed=(await query("select to_regclass('public.savings_admin_access_mode') is not null installed"))[0].installed;
 await query(`begin;${installed?'':body(forward)}savepoint fixture;${checks}rollback to fixture;${installed?'':body(recovery)}rollback;`);
 const roleCheck=await query(`begin;${installed?'':body(forward)}
 do $$ declare manager uuid; member uuid; email text; begin
 select auth_user_id into manager from public.admin_assignments where enabled and 'authorization.write'=any(permissions) and 'savings.read'=any(permissions) limit 1;
 select u.id,u.email into member,email from auth.users u where u.email_confirmed_at is not null and not exists(select 1 from public.admin_assignments a where a.auth_user_id=u.id) and not exists(select 1 from public.admin_section_responsibilities r where r.auth_user_id=u.id and r.enabled) limit 1;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',manager,'role','authenticated')::text,true);
 perform public.set_section_responsibilities(email,'savings',array['read','update']);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',member,'role','authenticated')::text,true);
 end $$;
 set local role authenticated;
 select (public.get_admin_access_context()->'technical_permissions' ? 'savings.read') can_enter,
 (public.get_admin_savings_review(null)->>'can_write')::boolean can_review,
 (public.get_savings_admin_access()->>'can_manage')::boolean can_manage;
 rollback;`);
 if(!roleCheck[0].can_enter||!roleCheck[0].can_review||roleCheck[0].can_manage)throw Error('AUTHENTICATED_ROLE_DELEGATE_FAILED');
 const out={status:'PASS',mode:'ROLLBACK',installed,checks:['OPEN preserves current administrators','no public access','email assignment reused','read/edit levels','review edits without financial privileges','no self elevation','restricted role gate','manager recovery access','revocation immediate','mode retry and stale version','other domains unchanged','recovery before activity']};
 fs.mkdirSync('docs/qa/evidence/savings-access-20260906',{recursive:true});fs.writeFileSync('docs/qa/evidence/savings-access-20260906/sql-result.json',JSON.stringify(out,null,2));console.log(JSON.stringify(out));
}
module.exports={forward,recovery,checks};if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
