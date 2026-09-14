-- Runs ONLY inside the caller's transaction followed by ROLLBACK.
do $test$
declare actor uuid; subject uuid; subject_email text; original jsonb; saved jsonb; context jsonb;
 denied boolean; count_rows integer; item text; mode_before text; module_row record; queue jsonb; financial_id uuid;
begin
 select a.auth_user_id into actor from public.admin_assignments a join public.admin_roles r on r.id=a.role_id
 where a.enabled and r.code='principal_admin' order by a.protected_assignment desc,a.created_at limit 1;
 select u.id,u.email into subject,subject_email from auth.users u
 where u.email_confirmed_at is not null and not exists(select 1 from public.admin_assignments a where a.auth_user_id=u.id and a.enabled)
 and not exists(select 1 from public.admin_section_responsibilities g where g.auth_user_id=u.id and g.enabled)
 order by u.created_at limit 1;
 if actor is null or subject is null then raise exception 'ISOLATED_SUBJECT_REQUIRED'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','session_id','module-test-actor')::text,true);
 context:=public.get_admin_access_context();
 if (context-'module_keys'-'module_access_version') is distinct from public.module_prior_get_admin_access_context() then raise exception 'TOTAL_CONTEXT_REGRESSION'; end if;
 if jsonb_array_length(public.list_admin_module_catalog())<>33 then raise exception 'CATALOG_INCOMPLETE'; end if;
 original:=public.get_admin_user_modules(subject_email);
 saved:=public.save_admin_user_modules(subject_email,'limited',array['affiliates','requests','program_products','membresias'],original->>'version');
 if saved->>'version'=original->>'version' then raise exception 'VERSION_NOT_CHANGED'; end if;
 denied:=false;
 begin perform public.save_admin_user_modules(subject_email,'limited',array['banners'],original->>'version');
 exception when serialization_failure then denied:=true; end;
 if not denied then raise exception 'STALE_OVERWRITE_ALLOWED'; end if;
 denied:=false;
 begin perform public.save_admin_user_modules(subject_email,'limited',array['roles'],saved->>'version');
 exception when others then denied:=SQLERRM='INVALID_ADMIN_MODULE'; end;
 if not denied then raise exception 'GOVERNANCE_MODULE_ESCALATION'; end if;
 denied:=false;
 begin perform public.save_admin_user_modules(subject_email,'limited',array['unknown'],saved->>'version');
 exception when others then denied:=SQLERRM='INVALID_ADMIN_MODULE'; end;
 if not denied then raise exception 'UNKNOWN_MODULE_ALLOWED'; end if;

 perform set_config('request.jwt.claims',jsonb_build_object('sub',subject,'role','authenticated','session_id','module-test-subject')::text,true);
 context:=public.get_admin_access_context();
 if context->'module_keys'<> '["affiliates","requests","program_products","membresias"]'::jsonb then raise exception 'EXACT_MODULE_SET_FAILED:%',context->'module_keys'; end if;
 if public.has_admin_permission('authorization.write') or public.has_admin_permission('authorization.read') or public.has_admin_permission('affiliates.impersonate') then raise exception 'LIMITED_ADMIN_ESCALATED'; end if;
 if not public.has_admin_permission('affiliates.write') or not public.has_admin_permission('program_requests.read') or not public.has_admin_permission('program_catalog.write') or not public.has_admin_permission('memberships.write') then raise exception 'SELECTED_MODULE_MISSING_CAPABILITY'; end if;
 if public.admin_module_boundary(array['finanzas']) then raise exception 'FINANCE_BOUNDARY_OPEN'; end if;
 queue:=public.list_module_general_requests();
 if jsonb_array_length(queue)<>(select least(count(*),250) from public.program_requests where financial_processing_status is null) then raise exception 'GENERAL_QUEUE_INCOMPLETE'; end if;
 if exists(select 1 from jsonb_array_elements(queue) r where r->>'financial_processing_status' is not null or r ? 'financial_profile_snapshot' or r ? 'applicant_profile_snapshot') then raise exception 'GENERAL_QUEUE_EXPOSES_FINANCIAL_DATA'; end if;
 select id into financial_id from public.program_requests where financial_processing_status is not null limit 1;
 if financial_id is not null and public.list_module_general_requests(financial_id)<>'[]'::jsonb then raise exception 'GENERAL_DETAIL_EXPOSES_FINANCE'; end if;
 if jsonb_array_length(queue)>0 and jsonb_array_length(public.list_module_general_requests((queue->0->>'id')::uuid))<>1 then raise exception 'GENERAL_DETAIL_MISSING'; end if;
 denied:=false;
 begin perform public.list_admin_finance_request_flow_queue(); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'FINANCE_API_BYPASS'; end if;
 denied:=false;
 begin perform public.list_admin_financial_request_queue(); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'FINANCIAL_QUEUE_BYPASS'; end if;
 denied:=false;
 begin perform public.get_admin_user_modules(subject_email); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'LIMITED_CAN_MANAGE_ACCESS'; end if;
 denied:=false;
 begin perform public.register_branding_assets('[]'::jsonb); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'MEMBERSHIP_DEPENDENCY_UNLOCKED_BRANDING_RPC'; end if;
 if public.admin_asset_module_boundary('app-assets','branding/admin/brand.icon/not-an-object.png') then raise exception 'MEMBERSHIP_CAN_WRITE_BRANDING_STORAGE'; end if;
 if not public.admin_asset_module_boundary('app-assets','membership/'||subject::text||'/not-an-object.png') then raise exception 'MEMBERSHIP_LOGO_UPLOAD_BLOCKED'; end if;
 if public.admin_asset_module_boundary('app-assets','membership/'||actor::text||'/not-an-object.png') then raise exception 'CROSS_USER_ASSET_WRITE_ALLOWED'; end if;
 -- Exercise direct table RLS as the real browser database role; zero-row updates.
 execute 'set local role authenticated';
 begin
  update public.app_settings set updated_at=updated_at where id='primary';
  get diagnostics count_rows=row_count;
 exception when insufficient_privilege then count_rows:=0; end;
 if count_rows<>0 then raise exception 'ASSET_DEPENDENCY_UNLOCKED_BRANDING'; end if;
 begin
  if exists(select 1 from public.program_requests where financial_processing_status is not null and affiliate_id is distinct from public.get_effective_affiliate_id()) then raise exception 'FINANCIAL_ROWS_VISIBLE'; end if;
 exception when insufficient_privilege then null; end;
 execute 'reset role';

 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 saved:=public.save_admin_user_modules(subject_email,'limited',array['noticias'],saved->>'version');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',subject,'role','authenticated')::text,true);
 if not public.has_section_action('news','assets') or public.has_section_action('banners','read') or public.has_admin_permission('affiliates.read') then raise exception 'SECTION_OR_OLD_GRANT_LEAK'; end if;
 if public.get_admin_access_context()->'module_keys'<>'["noticias"]'::jsonb then raise exception 'SELECTION_REPLACEMENT_FAILED'; end if;

 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 saved:=public.save_admin_user_modules(subject_email,'limited',array['savings'],saved->>'version');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',subject,'role','authenticated')::text,true);
 if not public.has_admin_permission('savings.read') or not public.has_section_action('savings','update') then raise exception 'SAVINGS_ACCESS_MISSING'; end if;
 if public.has_admin_permission('authorization.write') then raise exception 'SAVINGS_AUTHORIZATION_ESCALATED'; end if;

 for module_row in select module_key from public.admin_section_definitions where module_key is not null and not module_total_only loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
  saved:=public.save_admin_user_modules(subject_email,'limited',array[module_row.module_key],saved->>'version');
  perform set_config('request.jwt.claims',jsonb_build_object('sub',subject,'role','authenticated')::text,true);
  context:=public.get_admin_access_context();
  if context->'module_keys'<>jsonb_build_array(module_row.module_key) then raise exception 'SINGLE_MODULE_ISOLATION_FAILED:%',module_row.module_key; end if;
  if public.has_admin_permission('authorization.write') then raise exception 'SINGLE_MODULE_ESCALATION:%',module_row.module_key; end if;
  if module_row.module_key='requests' then
   perform public.list_module_general_requests();
   if public.has_admin_permission('affiliates.read') then raise exception 'GENERAL_QUEUE_REQUIRES_FULL_AFFILIATE_ACCESS'; end if;
  else
   denied:=false;
   begin perform public.list_module_general_requests(); exception when insufficient_privilege then denied:=true; end;
   if not denied then raise exception 'GENERAL_QUEUE_OUTSIDE_SELECTED_MODULE:%',module_row.module_key; end if;
  end if;
  if module_row.module_key='fincat' then
   denied:=false;
   begin perform public.list_admin_request_workflow_tracking(); exception when insufficient_privilege then denied:=true; end;
   if not denied then raise exception 'CATALOG_EXPOSES_REQUEST_TRACKING'; end if;
   denied:=false;
   begin perform public.reorder_operational_workflow_stages(null,'{}'::uuid[]); exception when insufficient_privilege then denied:=true; end;
   if not denied then raise exception 'CATALOG_CAN_REORDER_WORKFLOW'; end if;
  end if;
  if module_row.module_key='flujos' then
   denied:=false;
   begin perform public.save_program_general_info('module-test-no-row',null,'{}'::jsonb); exception when insufficient_privilege then denied:=true; end;
   if not denied then raise exception 'WORKFLOW_CAN_EDIT_PROGRAM_HEADER'; end if;
  end if;
  if module_row.module_key in ('program_products','fincat') and not public.admin_asset_module_boundary('app-assets','program-general/'||subject::text||'/not-an-object.png') then raise exception 'SELECTED_PROGRAM_COVER_BLOCKED'; end if;
  if module_row.module_key='sindicato' and (not public.has_section_action('agreements','update') or not public.has_section_action('documents','update')) then raise exception 'UNION_CHILD_EDITOR_MISSING'; end if;
 end loop;

 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 perform public.revoke_admin_assignment(subject);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',subject,'role','authenticated')::text,true);
 context:=public.get_admin_access_context();
 if context->'module_keys'<>'[]'::jsonb or context->'technical_permissions'<>'[]'::jsonb or context->'section_actions'<>'[]'::jsonb or context->>'role_code' is not null then raise exception 'REVOCATION_LEFT_ACCESS'; end if;

 -- The preserved total-admin button and revoke RPC must not revive dormant module grants.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 perform public.set_total_admin_by_email(subject_email);
 perform public.revoke_admin_assignment(subject);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',subject,'role','authenticated')::text,true);
 context:=public.get_admin_access_context();
 if context->'section_actions'<>'[]'::jsonb or context->>'role_code' is not null then raise exception 'LEGACY_REVOKE_REVIVED_MODULES'; end if;

 -- Verify no public/anonymous writer, and no direct browser DML on authorization.
 foreach item in array array['list_admin_module_catalog()','get_admin_user_modules(text)','save_admin_user_modules(text,text,text[],text)'] loop
  if has_function_privilege('anon',('public.'||item)::regprocedure,'execute') then raise exception 'ANONYMOUS_RPC_GRANTED'; end if;
 end loop;
 if has_table_privilege('authenticated','public.admin_section_responsibilities','insert') then raise exception 'DIRECT_GRANT_WRITE_ALLOWED'; end if;
 perform set_config('request.jwt.claims','{}',true);
 denied:=false;
 begin perform public.save_admin_user_modules(subject_email,'total','{}','invalid'); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'ANONYMOUS_ASSIGNMENT_ALLOWED'; end if;
end $test$;
select 'PASS' as status,'total parity, exact selection, persistence, optimistic conflict, governance denial, finance RPC denial, RLS, section isolation, Savings, revocation, anonymous' as checks;
