-- Caller wraps installation and all fixtures in BEGIN/ROLLBACK; no real assignment persists.
do $test$
declare actor uuid:=gen_random_uuid(); target uuid:=gen_random_uuid(); weak uuid:=gen_random_uuid();
 person uuid:=gen_random_uuid(); other uuid:=gen_random_uuid(); actor_role uuid; module_role uuid;
 context jsonb; direct_context jsonb; session uuid; denied boolean; original_actor uuid; row_count integer; saved jsonb;
begin
 insert into auth.users(id,email,email_confirmed_at,created_at,updated_at) values
 (actor,actor||'@assisted-test.invalid',now(),now(),now()),
 (target,target||'@assisted-test.invalid',now(),now(),now()),
 (weak,weak||'@assisted-test.invalid',now(),now(),now());
 insert into public.affiliates(id,auth_user_id,numero_control,historical_email_raw,historical_email_normalized,auth_eligibility,full_name,display_name,record_origin)
 values(person,target,'ASSISTED-ROLLBACK',target||'@assisted-test.invalid',target||'@assisted-test.invalid','eligible','Assisted fixture','Assisted fixture','ADMIN_AFFILIATES');
 select id into actor_role from public.admin_roles where code='principal_admin';
 select id into module_role from public.admin_roles where code='module_admin';
 insert into public.admin_assignments(auth_user_id,role,role_id,enabled,permissions) values(actor,'visual_admin',actor_role,true,'{}'),(target,'visual_admin',module_role,true,'{}'),(weak,'visual_admin',module_role,true,'{}');
 insert into public.admin_section_responsibilities(auth_user_id,section_key,action,enabled,granted_by_auth_user_id)
 select target,'admin_affiliates',a,true,actor from unnest(array['read','update']) a;
 insert into public.admin_section_responsibilities(auth_user_id,section_key,action,enabled,granted_by_auth_user_id)
 select weak,'admin_impersonation',a,true,actor from unnest(array['read','update']) a;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',target,'role','authenticated','session_id','assisted-direct')::text,true);
 direct_context:=public.get_admin_access_context();
 if direct_context is distinct from admin_support_private.get_admin_access_context(target) then raise exception 'NORMAL_TARGET_PARITY'; end if;
 if not public.has_admin_permission('affiliates.write') then raise exception 'DIRECT_TARGET_WRITE_MISSING'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','session_id','assisted-actor')::text,true);
 if public.get_admin_access_context() is distinct from admin_support_private.get_admin_access_context(actor) then raise exception 'NORMAL_ACTOR_PARITY'; end if;
 select session_id into session from public.start_affiliate_impersonation(person,'Isolated admin support regression');
 context:=public.get_admin_access_context();
 if context->'module_keys'<>'["affiliates"]'::jsonb or context->>'role_code'<>'module_admin' then raise exception 'ASSISTED_EXACT_MODULES:%',context; end if;
 if context->'technical_permissions' is distinct from direct_context->'technical_permissions' then raise exception 'ASSISTED_TARGET_PERMISSION_PARITY'; end if;
 if (context->'support_context'->>'subject_auth_user_id')::uuid<>target or auth.uid()<>actor then raise exception 'ACTOR_SUBJECT_MIXED'; end if;
 if public.get_effective_affiliate_id()<>person or not exists(select 1 from public.get_impersonation_context()) then raise exception 'SELF_SERVICE_CONTEXT_LOST'; end if;
 if not public.has_admin_permission('affiliates.write') or public.has_admin_permission('authorization.write') or public.has_admin_permission('program_requests.read') then raise exception 'ASSISTED_PERMISSION_CEILING'; end if;
 if public.has_admin_module('finanzas') or public.admin_module_boundary(array['finanzas']) then raise exception 'ASSISTED_MODULE_BOUNDARY'; end if;
 if not public.admin_actor_can_impersonate() or public.has_admin_permission('affiliates.impersonate') then raise exception 'SESSION_CAPABILITY_NOT_SEPARATED'; end if;
 denied:=false;begin perform public.list_admin_module_catalog();exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'PRIOR_HELPER_BYPASS'; end if;
 -- Real authenticated RLS/write and audit operate as the actor with target capability ceiling.
 execute 'set local role authenticated';
 if public.get_admin_refresh_context()->'module_keys'<>'["affiliates"]'::jsonb then raise exception 'AUTHENTICATED_REFRESH_MISMATCH'; end if;
 perform public.update_admin_affiliate(person,(select updated_at from public.affiliates where id=person),'{"address_raw":"Assisted rollback update"}'::jsonb,'Controlled assisted write test');
 if not exists(select 1 from public.affiliates where id=person and address_raw='Assisted rollback update') then raise exception 'ASSISTED_WRITE_NOT_APPLIED'; end if;
 denied:=false;begin perform public.list_admin_financial_request_queue();exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'ASSISTED_FINANCE_RPC_BYPASS'; end if;
 execute 'reset role';
 if not exists(select 1 from public.admin_audit_log where resource='affiliate_admin_events' and actor_auth_user_id=actor
  and details->'admin_assistance'->>'subject_auth_user_id'=target::text) then raise exception 'REAL_WRITE_ACTOR_CONTEXT_AUDIT'; end if;
 insert into public.admin_audit_log(actor_auth_user_id,resource,action,target_id,result,details)
 values(actor,'ASSISTED_ROLLBACK_TEST','VERIFY',person::text,'SUCCESS','{}');
 if not exists(select 1 from public.admin_audit_log where resource='ASSISTED_ROLLBACK_TEST' and actor_auth_user_id=actor
  and details->'admin_assistance'->>'subject_auth_user_id'=target::text and details->'admin_assistance'->>'session_id'=session::text) then raise exception 'ASSISTED_AUDIT_MISSING'; end if;
 -- Revoking the attended account immediately removes Admin; session exit remains possible.
 update public.admin_assignments set enabled=false,revoked_at=now(),revoked_by_auth_user_id=actor where auth_user_id=target;
 context:=public.get_admin_access_context();
 if context->>'role_code' is not null or context->'module_keys'<>'[]'::jsonb or public.has_admin_permission('affiliates.write') then raise exception 'TARGET_REVOCATION_STALE'; end if;
 if not public.stop_affiliate_impersonation() then raise exception 'STOP_WITHOUT_TARGET_PERMISSION'; end if;
 if public.get_admin_access_context() is distinct from admin_support_private.get_admin_access_context(actor) then raise exception 'EXIT_ACTOR_NOT_RESTORED'; end if;
 update public.admin_assignments set enabled=true,revoked_at=null,revoked_by_auth_user_id=null where auth_user_id=target;
 -- Wrong Auth session cannot acquire another session's context.
 select session_id into session from public.start_affiliate_impersonation(person,'Second isolated session boundary');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','session_id','different-session')::text,true);
 if public.get_admin_access_context() ? 'support_context' then raise exception 'CROSS_SESSION_CONTEXT'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','session_id','assisted-actor')::text,true);
 update public.impersonation_sessions set started_at=now()-interval '31 minutes',expires_at=now()-interval '1 minute' where id=session;
 if public.get_admin_access_context() ? 'support_context' then raise exception 'EXPIRED_CONTEXT'; end if;
 perform public.stop_affiliate_impersonation();
 -- Operator with impersonation only cannot borrow Afiliados or target full access.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',weak,'role','authenticated','session_id','assisted-weak')::text,true);
 select session_id into session from public.start_affiliate_impersonation(person,'Weak operator cannot escalate');
 if public.has_admin_permission('affiliates.read') or public.has_admin_permission('affiliates.write') or public.has_admin_module('affiliates') then raise exception 'OPERATOR_ESCALATION'; end if;
 if public.get_admin_access_context()->'module_keys'<>'[]'::jsonb then raise exception 'WEAK_OPERATOR_MENU_ESCALATION'; end if;
 update public.admin_assignments set role_id=actor_role where auth_user_id=target;
 if public.has_admin_permission('affiliates.write') or public.has_admin_permission('authorization.write')
 or public.has_admin_module('affiliates') or (public.get_admin_access_context()->>'full_access')::boolean then raise exception 'STRONG_TARGET_ESCALATION'; end if;
 if public.get_admin_access_context()->'module_keys'<>'["impersonation"]'::jsonb then raise exception 'STRONG_TARGET_MODULE_CEILING'; end if;
 update public.admin_assignments set enabled=false,revoked_at=now(),revoked_by_auth_user_id=actor where auth_user_id=weak;
 if public.admin_actor_can_impersonate() or public.has_admin_permission('affiliates.write') or public.get_admin_access_context() ? 'support_context' then raise exception 'REVOKED_ACTOR_AUTHORITY'; end if;
 update public.admin_assignments set enabled=true,revoked_at=null,revoked_by_auth_user_id=null where auth_user_id=weak;
 update public.admin_assignments set role_id=module_role where auth_user_id=target;
 perform public.stop_affiliate_impersonation();
 -- No Auth account on the attended affiliate must not inherit the operator's Admin.
 update public.affiliates set auth_user_id=null where id=person;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','session_id','assisted-actor')::text,true);
 select session_id into session from public.start_affiliate_impersonation(person,'No Auth account means no Admin');
 if public.get_admin_access_context()->'module_keys'<>'[]'::jsonb or public.has_admin_permission('affiliates.read') then raise exception 'NO_AUTH_INHERITED_ADMIN'; end if;
 perform public.stop_affiliate_impersonation();
 if has_schema_privilege('authenticated','admin_support_private','USAGE') or has_schema_privilege('anon','admin_support_private','USAGE') then raise exception 'PRIVATE_SUBJECT_READER_EXPOSED'; end if;
end $test$;
select 'PASS' as status,'actor/target parity, exact screen, write capability, backend denial, session binding, revoke/exit, expiry, no Auth, no escalation, actor audit' as checks;
