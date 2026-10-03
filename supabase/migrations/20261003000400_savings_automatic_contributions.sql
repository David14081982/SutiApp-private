begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
-- H-SAVINGS-AUTO-CONTRIBUTIONS-001. Infrastructure only: policy starts DISABLED.
-- No synthetic human claims, no historical replay, no monetary write at installation.
do $guard$ declare r jsonb; proc oid; actual jsonb; begin
 if to_regnamespace('savings_automatic_private') is not null then raise exception 'SAVINGS_AUTO_ALREADY_INSTALLED';end if;
 if not exists(select 1 from pg_extension where extname='pg_cron') then raise exception 'SAVINGS_AUTO_CRON_REQUIRED';end if;
 if exists(select 1 from cron.job where jobname='savings-automatic-contributions') then raise exception 'SAVINGS_AUTO_CRON_CONFLICT';end if;
 for r in select value from jsonb_array_elements('[{"signature":"public.admin_confirm_savings_account_receipt(uuid,uuid,date,numeric,integer,text,uuid)","md5":"3537c7f33196a3e40c44dcd747f1490f","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres}"},{"signature":"public.get_admin_savings_account(uuid,date)","md5":"d7eb3bf901e66474b3affca78d672ed3","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres}"},{"signature":"public.savings_workspace_person_row(uuid)","md5":"149a29178f99457d1271b41fd4c2226f","owner":"postgres","acl":"{postgres=X/postgres}"},{"signature":"public.get_admin_savings_workspace_person(uuid,integer,integer)","md5":"cb1c4203dd0607c58badc95cd5a1c0e0","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres}"},{"signature":"public.get_admin_savings_rh_report(text,integer,integer,integer)","md5":"123a835bfda99c71eaf94a259e128e48","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres}"},{"signature":"public.get_admin_savings_reconciliation(date)","md5":"a4f834cc504f83aba8cb92e09053f84b","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres}"},{"signature":"savings_period_private.projection_before(uuid)","md5":"7ccc2a775493c3d76fead822c561af8e","owner":"postgres","acl":"{postgres=X/postgres}"},{"signature":"savings_period_private.operation_before(jsonb,uuid)","md5":"702dabbd07bc0880b2b3fff2dfdd0449","owner":"postgres","acl":"{postgres=X/postgres}"},{"signature":"public.generate_savings_schedule(uuid,date,date)","md5":"3783b5c5ff59f512775c446d6d4b2379","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres}"},{"signature":"public.savings_next_contribution_date(date,text)","md5":"e715929b802cb3ef78ce2808bdfc8814","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres}"},{"signature":"public.savings_operation_today()","md5":"4ee2502b345656286154c58e2a5ca63a","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres}"},{"signature":"public.savings_receipt_assert_identity(uuid)","md5":"60c4158d5172cbf473b30fd28a1c4bae","owner":"postgres","acl":"{postgres=X/postgres}"},{"signature":"public.savings_participant_balance(uuid)","md5":"60370b8c60a9311b5172a09dd4b116ca","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres}"}]'::jsonb) loop
  proc:=to_regprocedure(r->>'signature');
  if proc is null or md5(pg_get_functiondef(proc)) is distinct from r->>'md5'
   or (select pg_get_userbyid(proowner) from pg_proc where oid=proc) is distinct from r->>'owner'
   or (select proacl::text from pg_proc where oid=proc) is distinct from r->>'acl' then
   raise exception 'SAVINGS_AUTO_BASELINE_DRIFT' using detail=r->>'signature';
  end if;
 end loop;
 for r in select value from jsonb_array_elements('[{"name":"savings_audit_events","owner":"postgres","rls":true,"force_rls":true,"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","columns":[{"name":"id","type":"bigint","default":null,"notnull":true},{"name":"actor_real_auth_user_id","type":"uuid","default":null,"notnull":false},{"name":"usuario_contexto_affiliate_id","type":"uuid","default":null,"notnull":false},{"name":"participant_id","type":"uuid","default":null,"notnull":false},{"name":"resource","type":"text","default":null,"notnull":true},{"name":"action","type":"text","default":null,"notnull":true},{"name":"target_id","type":"text","default":null,"notnull":false},{"name":"before_data","type":"jsonb","default":"''{}''::jsonb","notnull":true},{"name":"after_data","type":"jsonb","default":"''{}''::jsonb","notnull":true},{"name":"reason","type":"text","default":"''''::text","notnull":true},{"name":"client_action_id","type":"uuid","default":null,"notnull":false},{"name":"created_at","type":"timestamp with time zone","default":"now()","notnull":true}],"constraints":[{"name":"savings_audit_events_actor_real_auth_user_id_fkey","definition":"FOREIGN KEY (actor_real_auth_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT"},{"name":"savings_audit_events_client_action_id_key","definition":"UNIQUE (client_action_id)"},{"name":"savings_audit_events_participant_id_fkey","definition":"FOREIGN KEY (participant_id) REFERENCES savings_participants(id) ON DELETE RESTRICT"},{"name":"savings_audit_events_pkey","definition":"PRIMARY KEY (id)"},{"name":"savings_audit_events_usuario_contexto_affiliate_id_fkey","definition":"FOREIGN KEY (usuario_contexto_affiliate_id) REFERENCES affiliates(id) ON DELETE RESTRICT"}],"triggers":[{"name":"document_savings_approval","definition":"CREATE TRIGGER document_savings_approval AFTER INSERT ON public.savings_audit_events FOR EACH ROW EXECUTE FUNCTION document_private.capture_event()"},{"name":"savings_audit_events_append_only","definition":"CREATE TRIGGER savings_audit_events_append_only BEFORE DELETE OR UPDATE ON public.savings_audit_events FOR EACH ROW EXECUTE FUNCTION reject_savings_history_mutation()"}]},{"name":"savings_balance_certifications","owner":"postgres","rls":true,"force_rls":true,"acl":"{postgres=arwdDxtm/postgres}","columns":[{"name":"id","type":"uuid","default":"extensions.gen_random_uuid()","notnull":true},{"name":"record_id","type":"uuid","default":null,"notnull":true},{"name":"participant_id","type":"uuid","default":null,"notnull":true},{"name":"enrollment_id","type":"uuid","default":null,"notnull":false},{"name":"cutoff_on","type":"date","default":null,"notnull":true},{"name":"source_version","type":"integer","default":null,"notnull":true},{"name":"source_snapshot","type":"jsonb","default":null,"notnull":true},{"name":"command","type":"jsonb","default":null,"notnull":true},{"name":"capital","type":"numeric(14,2)","default":null,"notnull":true},{"name":"yield_amount","type":"numeric(14,2)","default":null,"notnull":true},{"name":"actor_real_auth_user_id","type":"uuid","default":null,"notnull":true},{"name":"usuario_contexto_affiliate_id","type":"uuid","default":null,"notnull":false},{"name":"observation","type":"text","default":null,"notnull":false},{"name":"client_action_id","type":"uuid","default":null,"notnull":true},{"name":"created_at","type":"timestamp with time zone","default":"clock_timestamp()","notnull":true}],"constraints":[{"name":"savings_balance_certification_usuario_contexto_affiliate_i_fkey","definition":"FOREIGN KEY (usuario_contexto_affiliate_id) REFERENCES affiliates(id)"},{"name":"savings_balance_certifications_actor_real_auth_user_id_fkey","definition":"FOREIGN KEY (actor_real_auth_user_id) REFERENCES auth.users(id)"},{"name":"savings_balance_certifications_capital_check","definition":"CHECK ((capital >= (0)::numeric))"},{"name":"savings_balance_certifications_client_action_id_key","definition":"UNIQUE (client_action_id)"},{"name":"savings_balance_certifications_enrollment_id_fkey","definition":"FOREIGN KEY (enrollment_id) REFERENCES savings_enrollments(id)"},{"name":"savings_balance_certifications_participant_id_fkey","definition":"FOREIGN KEY (participant_id) REFERENCES savings_participants(id)"},{"name":"savings_balance_certifications_participant_id_key","definition":"UNIQUE (participant_id)"},{"name":"savings_balance_certifications_pkey","definition":"PRIMARY KEY (id)"},{"name":"savings_balance_certifications_record_id_fkey","definition":"FOREIGN KEY (record_id) REFERENCES savings_review_records(id)"},{"name":"savings_balance_certifications_record_id_key","definition":"UNIQUE (record_id)"},{"name":"savings_balance_certifications_yield_amount_check","definition":"CHECK ((yield_amount >= (0)::numeric))"}],"triggers":[{"name":"savings_certification_immutable","definition":"CREATE TRIGGER savings_certification_immutable BEFORE DELETE OR UPDATE ON public.savings_balance_certifications FOR EACH ROW EXECUTE FUNCTION reject_savings_history_mutation()"}]},{"name":"savings_contribution_overrides","owner":"postgres","rls":true,"force_rls":true,"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","columns":[{"name":"id","type":"uuid","default":"extensions.gen_random_uuid()","notnull":true},{"name":"enrollment_id","type":"uuid","default":null,"notnull":true},{"name":"contribution_date","type":"date","default":null,"notnull":true},{"name":"expected_amount","type":"numeric(14,2)","default":null,"notnull":true},{"name":"actual_amount","type":"numeric(14,2)","default":null,"notnull":true},{"name":"version_number","type":"integer","default":null,"notnull":true},{"name":"reason","type":"text","default":null,"notnull":true},{"name":"editor_auth_user_id","type":"uuid","default":null,"notnull":true},{"name":"client_action_id","type":"uuid","default":null,"notnull":true},{"name":"created_at","type":"timestamp with time zone","default":"now()","notnull":true}],"constraints":[{"name":"savings_contribution_override_enrollment_id_contribution_da_key","definition":"UNIQUE (enrollment_id, contribution_date, version_number)"},{"name":"savings_contribution_overrides_client_action_id_key","definition":"UNIQUE (client_action_id)"},{"name":"savings_contribution_overrides_editor_auth_user_id_fkey","definition":"FOREIGN KEY (editor_auth_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT"},{"name":"savings_contribution_overrides_enrollment_id_fkey","definition":"FOREIGN KEY (enrollment_id) REFERENCES savings_enrollments(id) ON DELETE RESTRICT"},{"name":"savings_contribution_overrides_pkey","definition":"PRIMARY KEY (id)"},{"name":"savings_override_amount_check","definition":"CHECK (((expected_amount >= (0)::numeric) AND (actual_amount >= (0)::numeric)))"},{"name":"savings_override_reason_check","definition":"CHECK ((length(reason) <= 1000))"},{"name":"savings_override_version_check","definition":"CHECK ((version_number > 0))"}],"triggers":null},{"name":"savings_contribution_plans","owner":"postgres","rls":true,"force_rls":true,"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","columns":[{"name":"id","type":"uuid","default":"extensions.gen_random_uuid()","notnull":true},{"name":"enrollment_id","type":"uuid","default":null,"notnull":true},{"name":"amount","type":"numeric(14,2)","default":null,"notnull":true},{"name":"process_snapshot","type":"text","default":null,"notnull":true},{"name":"effective_from","type":"date","default":null,"notnull":true},{"name":"effective_to","type":"date","default":null,"notnull":false},{"name":"source_request_id","type":"uuid","default":null,"notnull":false},{"name":"data_classification","type":"text","default":"''SHADOW''::text","notnull":true},{"name":"import_batch_id","type":"uuid","default":null,"notnull":false},{"name":"created_by_auth_user_id","type":"uuid","default":null,"notnull":false},{"name":"created_at","type":"timestamp with time zone","default":"now()","notnull":true}],"constraints":[{"name":"savings_contribution_plans_created_by_auth_user_id_fkey","definition":"FOREIGN KEY (created_by_auth_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT"},{"name":"savings_contribution_plans_enrollment_id_fkey","definition":"FOREIGN KEY (enrollment_id) REFERENCES savings_enrollments(id) ON DELETE RESTRICT"},{"name":"savings_contribution_plans_import_batch_id_fkey","definition":"FOREIGN KEY (import_batch_id) REFERENCES savings_import_batches(id) ON DELETE RESTRICT"},{"name":"savings_contribution_plans_pkey","definition":"PRIMARY KEY (id)"},{"name":"savings_plan_amount_check","definition":"CHECK ((amount > (0)::numeric))"},{"name":"savings_plan_class_check","definition":"CHECK ((data_classification = ANY (ARRAY[''LEGACY''::text, ''SHADOW''::text, ''PENDING_REVIEW''::text, ''CANONICAL''::text])))"},{"name":"savings_plan_dates_check","definition":"CHECK (((effective_to IS NULL) OR (effective_to >= effective_from)))"},{"name":"savings_plan_process_check","definition":"CHECK ((process_snapshot = ANY (ARRAY[''JUB''::text, ''PROCESS_1''::text, ''PROCESS_3''::text])))"},{"name":"savings_plan_source_request_fk","definition":"FOREIGN KEY (source_request_id) REFERENCES savings_requests(id) ON DELETE RESTRICT"}],"triggers":null},{"name":"savings_enrollments","owner":"postgres","rls":true,"force_rls":true,"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","columns":[{"name":"id","type":"uuid","default":"extensions.gen_random_uuid()","notnull":true},{"name":"participant_id","type":"uuid","default":null,"notnull":true},{"name":"sequence_number","type":"integer","default":null,"notnull":true},{"name":"status","type":"text","default":null,"notnull":true},{"name":"enrollment_started_at","type":"timestamp with time zone","default":null,"notnull":true},{"name":"requested_at","type":"timestamp with time zone","default":null,"notnull":false},{"name":"approved_at","type":"timestamp with time zone","default":null,"notnull":false},{"name":"first_expected_contribution_date","type":"date","default":null,"notnull":false},{"name":"first_actual_contribution_date","type":"date","default":null,"notnull":false},{"name":"terminated_at","type":"timestamp with time zone","default":null,"notnull":false},{"name":"continue_saving","type":"boolean","default":"true","notnull":true},{"name":"process_snapshot","type":"text","default":null,"notnull":false},{"name":"data_classification","type":"text","default":"''SHADOW''::text","notnull":true},{"name":"import_batch_id","type":"uuid","default":null,"notnull":false},{"name":"created_at","type":"timestamp with time zone","default":"now()","notnull":true}],"constraints":[{"name":"savings_enrollment_activation_check","definition":"CHECK (((status <> ALL (ARRAY[''ACTIVE''::text, ''TERMINATION_PENDING''::text])) OR ((approved_at IS NOT NULL) AND (first_expected_contribution_date IS NOT NULL) AND (process_snapshot IS NOT NULL))))"},{"name":"savings_enrollment_class_check","definition":"CHECK ((data_classification = ANY (ARRAY[''LEGACY''::text, ''SHADOW''::text, ''PENDING_REVIEW''::text, ''CANONICAL''::text])))"},{"name":"savings_enrollment_process_check","definition":"CHECK (((process_snapshot IS NULL) OR (process_snapshot = ANY (ARRAY[''JUB''::text, ''PROCESS_1''::text, ''PROCESS_3''::text]))))"},{"name":"savings_enrollment_sequence_check","definition":"CHECK ((sequence_number > 0))"},{"name":"savings_enrollment_status_check","definition":"CHECK ((status = ANY (ARRAY[''REQUESTED''::text, ''ACTIVE''::text, ''TERMINATION_PENDING''::text, ''TERMINATED''::text, ''REJECTED''::text])))"},{"name":"savings_enrollment_termination_check","definition":"CHECK (((status <> ''TERMINATED''::text) OR (terminated_at IS NOT NULL)))"},{"name":"savings_enrollments_import_batch_id_fkey","definition":"FOREIGN KEY (import_batch_id) REFERENCES savings_import_batches(id) ON DELETE RESTRICT"},{"name":"savings_enrollments_participant_id_fkey","definition":"FOREIGN KEY (participant_id) REFERENCES savings_participants(id) ON DELETE RESTRICT"},{"name":"savings_enrollments_participant_id_sequence_number_key","definition":"UNIQUE (participant_id, sequence_number)"},{"name":"savings_enrollments_pkey","definition":"PRIMARY KEY (id)"}],"triggers":null},{"name":"savings_holds","owner":"postgres","rls":true,"force_rls":true,"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","columns":[{"name":"id","type":"uuid","default":"extensions.gen_random_uuid()","notnull":true},{"name":"participant_id","type":"uuid","default":null,"notnull":true},{"name":"enrollment_id","type":"uuid","default":null,"notnull":false},{"name":"component","type":"text","default":null,"notnull":true},{"name":"amount","type":"numeric(14,2)","default":null,"notnull":true},{"name":"status","type":"text","default":"''ACTIVE''::text","notnull":true},{"name":"reason","type":"text","default":null,"notnull":true},{"name":"created_by_auth_user_id","type":"uuid","default":null,"notnull":true},{"name":"created_at","type":"timestamp with time zone","default":"now()","notnull":true},{"name":"released_at","type":"timestamp with time zone","default":null,"notnull":false}],"constraints":[{"name":"savings_hold_amount_check","definition":"CHECK ((amount > (0)::numeric))"},{"name":"savings_hold_component_check","definition":"CHECK ((component = ANY (ARRAY[''CAPITAL''::text, ''YIELD''::text])))"},{"name":"savings_hold_reason_check","definition":"CHECK (((length(btrim(reason)) >= 3) AND (length(btrim(reason)) <= 1000)))"},{"name":"savings_hold_status_check","definition":"CHECK ((status = ANY (ARRAY[''ACTIVE''::text, ''RELEASED''::text, ''SETTLED''::text])))"},{"name":"savings_holds_created_by_auth_user_id_fkey","definition":"FOREIGN KEY (created_by_auth_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT"},{"name":"savings_holds_enrollment_id_fkey","definition":"FOREIGN KEY (enrollment_id) REFERENCES savings_enrollments(id) ON DELETE RESTRICT"},{"name":"savings_holds_participant_id_fkey","definition":"FOREIGN KEY (participant_id) REFERENCES savings_participants(id) ON DELETE RESTRICT"},{"name":"savings_holds_pkey","definition":"PRIMARY KEY (id)"}],"triggers":null},{"name":"savings_participants","owner":"postgres","rls":true,"force_rls":true,"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","columns":[{"name":"id","type":"uuid","default":"extensions.gen_random_uuid()","notnull":true},{"name":"participant_type","type":"text","default":null,"notnull":true},{"name":"affiliate_id","type":"uuid","default":null,"notnull":false},{"name":"legacy_folio","type":"text","default":null,"notnull":false},{"name":"display_name","type":"text","default":null,"notnull":false},{"name":"identity_status","type":"text","default":null,"notnull":true},{"name":"certification_status","type":"text","default":"''PENDING_REVIEW''::text","notnull":true},{"name":"current_process","type":"text","default":null,"notnull":false},{"name":"process_source","type":"text","default":"''PENDING_REVIEW''::text","notnull":true},{"name":"data_classification","type":"text","default":"''SHADOW''::text","notnull":true},{"name":"legacy_reported_balance","type":"numeric(14,2)","default":null,"notnull":false},{"name":"legacy_balance_status","type":"text","default":"''PENDING_REVIEW''::text","notnull":true},{"name":"import_batch_id","type":"uuid","default":null,"notnull":false},{"name":"created_at","type":"timestamp with time zone","default":"now()","notnull":true},{"name":"updated_at","type":"timestamp with time zone","default":"now()","notnull":true},{"name":"historical_yield_reconciled_through","type":"date","default":null,"notnull":false}],"constraints":[{"name":"savings_participant_balance_check","definition":"CHECK (((legacy_reported_balance IS NULL) OR (legacy_reported_balance >= (0)::numeric)))"},{"name":"savings_participant_balance_status_check","definition":"CHECK ((legacy_balance_status = ANY (ARRAY[''MATCH''::text, ''MISMATCH''::text, ''PENDING_REVIEW''::text])))"},{"name":"savings_participant_cert_check","definition":"CHECK ((certification_status = ANY (ARRAY[''PENDING_REVIEW''::text, ''CERTIFIED''::text])))"},{"name":"savings_participant_class_check","definition":"CHECK ((data_classification = ANY (ARRAY[''LEGACY''::text, ''SHADOW''::text, ''PENDING_REVIEW''::text, ''CANONICAL''::text])))"},{"name":"savings_participant_identity_check","definition":"CHECK ((identity_status = ANY (ARRAY[''RESOLVED''::text, ''AMBIGUOUS''::text, ''ORPHAN''::text, ''NON_AFFILIATE''::text])))"},{"name":"savings_participant_link_check","definition":"CHECK ((((identity_status = ''RESOLVED''::text) AND (affiliate_id IS NOT NULL) AND (participant_type = ''AFFILIATE''::text)) OR ((identity_status = ANY (ARRAY[''AMBIGUOUS''::text, ''ORPHAN''::text])) AND (affiliate_id IS NULL) AND (participant_type = ''LEGACY_UNRESOLVED''::text)) OR ((identity_status = ''NON_AFFILIATE''::text) AND (affiliate_id IS NULL) AND (participant_type = ''NON_AFFILIATE''::text))))"},{"name":"savings_participant_process_check","definition":"CHECK (((current_process IS NULL) OR (current_process = ANY (ARRAY[''JUB''::text, ''PROCESS_1''::text, ''PROCESS_3''::text]))))"},{"name":"savings_participant_process_source_check","definition":"CHECK ((process_source = ANY (ARRAY[''LEGACY''::text, ''SHADOW''::text, ''PENDING_REVIEW''::text])))"},{"name":"savings_participant_type_check","definition":"CHECK ((participant_type = ANY (ARRAY[''AFFILIATE''::text, ''NON_AFFILIATE''::text, ''LEGACY_UNRESOLVED''::text])))"},{"name":"savings_participants_affiliate_id_fkey","definition":"FOREIGN KEY (affiliate_id) REFERENCES affiliates(id) ON DELETE RESTRICT"},{"name":"savings_participants_import_batch_id_fkey","definition":"FOREIGN KEY (import_batch_id) REFERENCES savings_import_batches(id) ON DELETE RESTRICT"},{"name":"savings_participants_pkey","definition":"PRIMARY KEY (id)"}],"triggers":[{"name":"savings_participants_updated_at","definition":"CREATE TRIGGER savings_participants_updated_at BEFORE UPDATE ON public.savings_participants FOR EACH ROW EXECUTE FUNCTION set_h0072_updated_at()"}]},{"name":"savings_publication_state","owner":"postgres","rls":true,"force_rls":true,"acl":"{postgres=arwdDxtm/postgres}","columns":[{"name":"id","type":"boolean","default":"true","notnull":true},{"name":"mode","type":"text","default":"''PRIVATE''::text","notnull":true},{"name":"version","type":"integer","default":"1","notnull":true},{"name":"fingerprint","type":"text","default":null,"notnull":false},{"name":"published_at","type":"timestamp with time zone","default":null,"notnull":false},{"name":"actor_real_auth_user_id","type":"uuid","default":null,"notnull":false}],"constraints":[{"name":"savings_publication_state_actor_real_auth_user_id_fkey","definition":"FOREIGN KEY (actor_real_auth_user_id) REFERENCES auth.users(id)"},{"name":"savings_publication_state_check","definition":"CHECK ((((mode = ''PRIVATE''::text) AND (published_at IS NULL)) OR ((mode = ''PUBLISHED''::text) AND (published_at IS NOT NULL) AND (actor_real_auth_user_id IS NOT NULL))))"},{"name":"savings_publication_state_id_check","definition":"CHECK (id)"},{"name":"savings_publication_state_mode_check","definition":"CHECK ((mode = ANY (ARRAY[''PRIVATE''::text, ''PUBLISHED''::text])))"},{"name":"savings_publication_state_pkey","definition":"PRIMARY KEY (id)"},{"name":"savings_publication_state_version_check","definition":"CHECK ((version > 0))"}],"triggers":null},{"name":"savings_requests","owner":"postgres","rls":true,"force_rls":true,"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","columns":[{"name":"id","type":"uuid","default":"extensions.gen_random_uuid()","notnull":true},{"name":"folio","type":"text","default":null,"notnull":true},{"name":"participant_id","type":"uuid","default":null,"notnull":true},{"name":"enrollment_id","type":"uuid","default":null,"notnull":false},{"name":"request_type","type":"text","default":null,"notnull":true},{"name":"withdrawal_kind","type":"text","default":null,"notnull":false},{"name":"component","type":"text","default":null,"notnull":false},{"name":"requested_amount","type":"numeric(14,2)","default":null,"notnull":false},{"name":"requested_capital_amount","type":"numeric(14,2)","default":null,"notnull":false},{"name":"requested_yield_amount","type":"numeric(14,2)","default":null,"notnull":false},{"name":"new_contribution_amount","type":"numeric(14,2)","default":null,"notnull":false},{"name":"continue_saving","type":"boolean","default":null,"notnull":false},{"name":"supporting_document_id","type":"uuid","default":null,"notnull":false},{"name":"status","type":"text","default":"''SUBMITTED''::text","notnull":true},{"name":"effective_from","type":"date","default":null,"notnull":false},{"name":"reason","type":"text","default":"''''::text","notnull":true},{"name":"actor_real_auth_user_id","type":"uuid","default":null,"notnull":false},{"name":"usuario_contexto_affiliate_id","type":"uuid","default":null,"notnull":false},{"name":"idempotency_key","type":"uuid","default":null,"notnull":true},{"name":"submitted_at","type":"timestamp with time zone","default":"now()","notnull":true},{"name":"reviewed_at","type":"timestamp with time zone","default":null,"notnull":false},{"name":"reviewed_by_auth_user_id","type":"uuid","default":null,"notnull":false},{"name":"settled_at","type":"timestamp with time zone","default":null,"notnull":false},{"name":"data_classification","type":"text","default":"''SHADOW''::text","notnull":true},{"name":"metadata","type":"jsonb","default":"''{}''::jsonb","notnull":true}],"constraints":[{"name":"savings_request_actor_check","definition":"CHECK (((data_classification = ''LEGACY''::text) OR ((actor_real_auth_user_id IS NOT NULL) AND (usuario_contexto_affiliate_id IS NOT NULL))))"},{"name":"savings_request_amount_check","definition":"CHECK (((COALESCE(requested_amount, (0)::numeric) >= (0)::numeric) AND (COALESCE(requested_capital_amount, (0)::numeric) >= (0)::numeric) AND (COALESCE(requested_yield_amount, (0)::numeric) >= (0)::numeric) AND (COALESCE(new_contribution_amount, (0)::numeric) >= (0)::numeric)))"},{"name":"savings_request_change_amount_check","definition":"CHECK (((request_type <> ''CHANGE_AMOUNT''::text) OR ((new_contribution_amount > (0)::numeric) AND (effective_from IS NOT NULL))))"},{"name":"savings_request_class_check","definition":"CHECK ((data_classification = ANY (ARRAY[''LEGACY''::text, ''SHADOW''::text, ''PENDING_REVIEW''::text, ''CANONICAL''::text])))"},{"name":"savings_request_component_check","definition":"CHECK (((component IS NULL) OR (component = ANY (ARRAY[''CAPITAL''::text, ''YIELD''::text, ''BOTH''::text]))))"},{"name":"savings_request_extraordinary_doc_check","definition":"CHECK (((request_type <> ''EXTRAORDINARY_WITHDRAWAL''::text) OR ((supporting_document_id IS NOT NULL) AND (length(btrim(reason)) >= 3))))"},{"name":"savings_request_join_amount_check","definition":"CHECK (((request_type <> ''JOIN''::text) OR (new_contribution_amount > (0)::numeric)))"},{"name":"savings_request_status_check","definition":"CHECK ((status = ANY (ARRAY[''SUBMITTED''::text, ''UNDER_REVIEW''::text, ''APPROVED''::text, ''REJECTED''::text, ''CANCELLED''::text, ''SETTLED''::text])))"},{"name":"savings_request_terminate_check","definition":"CHECK (((request_type <> ''TERMINATE''::text) OR (continue_saving = false)))"},{"name":"savings_request_type_check","definition":"CHECK ((request_type = ANY (ARRAY[''JOIN''::text, ''CHANGE_AMOUNT''::text, ''WITHDRAW''::text, ''TERMINATE''::text, ''EXTRAORDINARY_WITHDRAWAL''::text])))"},{"name":"savings_request_withdrawal_kind_check","definition":"CHECK (((withdrawal_kind IS NULL) OR (withdrawal_kind = ANY (ARRAY[''PARTIAL''::text, ''TOTAL''::text, ''EXTRAORDINARY''::text]))))"},{"name":"savings_requests_actor_real_auth_user_id_fkey","definition":"FOREIGN KEY (actor_real_auth_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT"},{"name":"savings_requests_actor_real_auth_user_id_idempotency_key_key","definition":"UNIQUE (actor_real_auth_user_id, idempotency_key)"},{"name":"savings_requests_enrollment_id_fkey","definition":"FOREIGN KEY (enrollment_id) REFERENCES savings_enrollments(id) ON DELETE RESTRICT"},{"name":"savings_requests_folio_key","definition":"UNIQUE (folio)"},{"name":"savings_requests_participant_id_fkey","definition":"FOREIGN KEY (participant_id) REFERENCES savings_participants(id) ON DELETE RESTRICT"},{"name":"savings_requests_pkey","definition":"PRIMARY KEY (id)"},{"name":"savings_requests_reviewed_by_auth_user_id_fkey","definition":"FOREIGN KEY (reviewed_by_auth_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT"},{"name":"savings_requests_supporting_document_id_fkey","definition":"FOREIGN KEY (supporting_document_id) REFERENCES affiliate_documents(id) ON DELETE RESTRICT"},{"name":"savings_requests_usuario_contexto_affiliate_id_fkey","definition":"FOREIGN KEY (usuario_contexto_affiliate_id) REFERENCES affiliates(id) ON DELETE RESTRICT"}],"triggers":null},{"name":"savings_transactions","owner":"postgres","rls":true,"force_rls":true,"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","columns":[{"name":"id","type":"uuid","default":"extensions.gen_random_uuid()","notnull":true},{"name":"participant_id","type":"uuid","default":null,"notnull":true},{"name":"enrollment_id","type":"uuid","default":null,"notnull":false},{"name":"transaction_type","type":"text","default":null,"notnull":true},{"name":"component","type":"text","default":null,"notnull":true},{"name":"direction","type":"text","default":null,"notnull":true},{"name":"amount","type":"numeric(14,2)","default":null,"notnull":true},{"name":"effective_date","type":"date","default":null,"notnull":true},{"name":"contribution_date","type":"date","default":null,"notnull":false},{"name":"expected_amount","type":"numeric(14,2)","default":null,"notnull":false},{"name":"actual_amount","type":"numeric(14,2)","default":null,"notnull":false},{"name":"difference_amount","type":"numeric(14,2)","default":null,"notnull":false},{"name":"idempotency_key","type":"text","default":null,"notnull":true},{"name":"reversal_of_transaction_id","type":"uuid","default":null,"notnull":false},{"name":"data_classification","type":"text","default":"''SHADOW''::text","notnull":true},{"name":"import_batch_id","type":"uuid","default":null,"notnull":false},{"name":"source_evidence_id","type":"uuid","default":null,"notnull":false},{"name":"created_by_auth_user_id","type":"uuid","default":null,"notnull":false},{"name":"created_at","type":"timestamp with time zone","default":"now()","notnull":true}],"constraints":[{"name":"savings_transaction_actual_check","definition":"CHECK ((((expected_amount IS NULL) AND (actual_amount IS NULL) AND (difference_amount IS NULL)) OR ((expected_amount IS NOT NULL) AND (actual_amount IS NOT NULL) AND (difference_amount = (actual_amount - expected_amount)))))"},{"name":"savings_transaction_amount_check","definition":"CHECK ((amount > (0)::numeric))"},{"name":"savings_transaction_class_check","definition":"CHECK ((data_classification = ANY (ARRAY[''LEGACY''::text, ''SHADOW''::text, ''PENDING_REVIEW''::text, ''CANONICAL''::text])))"},{"name":"savings_transaction_component_check","definition":"CHECK ((component = ANY (ARRAY[''CAPITAL''::text, ''YIELD''::text])))"},{"name":"savings_transaction_direction_check","definition":"CHECK ((direction = ANY (ARRAY[''CREDIT''::text, ''DEBIT''::text])))"},{"name":"savings_transaction_evidence_fk","definition":"FOREIGN KEY (source_evidence_id) REFERENCES savings_legacy_evidence(id) ON DELETE RESTRICT"},{"name":"savings_transaction_reversal_check","definition":"CHECK (((transaction_type <> ''REVERSAL''::text) OR (reversal_of_transaction_id IS NOT NULL)))"},{"name":"savings_transaction_type_check","definition":"CHECK ((transaction_type = ANY (ARRAY[''CONTRIBUTION''::text, ''YIELD_CREDIT''::text, ''WITHDRAWAL''::text, ''REGULARIZATION''::text, ''ADJUSTMENT''::text, ''REVERSAL''::text, ''HOLD_SETTLEMENT''::text])))"},{"name":"savings_transactions_created_by_auth_user_id_fkey","definition":"FOREIGN KEY (created_by_auth_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT"},{"name":"savings_transactions_enrollment_id_fkey","definition":"FOREIGN KEY (enrollment_id) REFERENCES savings_enrollments(id) ON DELETE RESTRICT"},{"name":"savings_transactions_idempotency_key_key","definition":"UNIQUE (idempotency_key)"},{"name":"savings_transactions_import_batch_id_fkey","definition":"FOREIGN KEY (import_batch_id) REFERENCES savings_import_batches(id) ON DELETE RESTRICT"},{"name":"savings_transactions_participant_id_fkey","definition":"FOREIGN KEY (participant_id) REFERENCES savings_participants(id) ON DELETE RESTRICT"},{"name":"savings_transactions_pkey","definition":"PRIMARY KEY (id)"},{"name":"savings_transactions_reversal_of_transaction_id_fkey","definition":"FOREIGN KEY (reversal_of_transaction_id) REFERENCES savings_transactions(id) ON DELETE RESTRICT"}],"triggers":[{"name":"savings_transactions_append_only","definition":"CREATE TRIGGER savings_transactions_append_only BEFORE DELETE OR UPDATE ON public.savings_transactions FOR EACH ROW EXECUTE FUNCTION reject_savings_history_mutation()"}]},{"name":"savings_withdrawal_openings","owner":"postgres","rls":true,"force_rls":true,"acl":"{postgres=arwdDxtm/postgres,service_role=r/postgres}","columns":[{"name":"id","type":"uuid","default":"extensions.gen_random_uuid()","notnull":true},{"name":"availability_id","type":"uuid","default":null,"notnull":true},{"name":"yield_period_id","type":"uuid","default":null,"notnull":true},{"name":"cutoff_on","type":"date","default":null,"notnull":true},{"name":"percentage","type":"numeric(9,6)","default":null,"notnull":true},{"name":"opening_kind","type":"text","default":null,"notnull":true},{"name":"reason","type":"text","default":null,"notnull":true},{"name":"actor_real_auth_user_id","type":"uuid","default":null,"notnull":true},{"name":"created_at","type":"timestamp with time zone","default":"clock_timestamp()","notnull":true},{"name":"client_action_id","type":"uuid","default":null,"notnull":true}],"constraints":[{"name":"savings_withdrawal_openings_actor_real_auth_user_id_fkey","definition":"FOREIGN KEY (actor_real_auth_user_id) REFERENCES auth.users(id)"},{"name":"savings_withdrawal_openings_availability_id_fkey","definition":"FOREIGN KEY (availability_id) REFERENCES savings_action_availability(id)"},{"name":"savings_withdrawal_openings_availability_id_key","definition":"UNIQUE (availability_id)"},{"name":"savings_withdrawal_openings_client_action_id_key","definition":"UNIQUE (client_action_id)"},{"name":"savings_withdrawal_openings_opening_kind_check","definition":"CHECK ((opening_kind = ANY (ARRAY[''ORDINARY''::text, ''EARLY''::text, ''EXCEPTION''::text])))"},{"name":"savings_withdrawal_openings_percentage_check","definition":"CHECK (((percentage >= (0)::numeric) AND (percentage <= (100)::numeric)))"},{"name":"savings_withdrawal_openings_pkey","definition":"PRIMARY KEY (id)"},{"name":"savings_withdrawal_openings_reason_check","definition":"CHECK (((length(btrim(reason)) >= 3) AND (length(btrim(reason)) <= 1000)))"},{"name":"savings_withdrawal_openings_yield_period_id_fkey","definition":"FOREIGN KEY (yield_period_id) REFERENCES savings_yield_periods(id)"}],"triggers":[{"name":"savings_validate_yield_opening","definition":"CREATE TRIGGER savings_validate_yield_opening BEFORE INSERT ON public.savings_withdrawal_openings FOR EACH ROW EXECUTE FUNCTION savings_validate_yield_opening()"}]},{"name":"savings_yield_allocations","owner":"postgres","rls":true,"force_rls":true,"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","columns":[{"name":"id","type":"uuid","default":"extensions.gen_random_uuid()","notnull":true},{"name":"yield_period_id","type":"uuid","default":null,"notnull":true},{"name":"participant_id","type":"uuid","default":null,"notnull":true},{"name":"eligible","type":"boolean","default":null,"notnull":true},{"name":"exclusion_reason","type":"text","default":null,"notnull":false},{"name":"calculation_basis","type":"numeric(14,2)","default":"0","notnull":true},{"name":"calculated_amount","type":"numeric(14,2)","default":"0","notnull":true},{"name":"approved_amount","type":"numeric(14,2)","default":null,"notnull":false},{"name":"status","type":"text","default":"''PENDING_REVIEW''::text","notnull":true},{"name":"approved_by_auth_user_id","type":"uuid","default":null,"notnull":false},{"name":"approved_at","type":"timestamp with time zone","default":null,"notnull":false},{"name":"created_at","type":"timestamp with time zone","default":"now()","notnull":true}],"constraints":[{"name":"savings_yield_allocation_amount_check","definition":"CHECK (((calculation_basis >= (0)::numeric) AND (calculated_amount >= (0)::numeric) AND (COALESCE(approved_amount, (0)::numeric) >= (0)::numeric)))"},{"name":"savings_yield_allocation_status_check","definition":"CHECK ((status = ANY (ARRAY[''PENDING_REVIEW''::text, ''APPROVED''::text, ''EXCLUDED''::text, ''CREDITED''::text])))"},{"name":"savings_yield_allocations_approved_by_auth_user_id_fkey","definition":"FOREIGN KEY (approved_by_auth_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT"},{"name":"savings_yield_allocations_participant_id_fkey","definition":"FOREIGN KEY (participant_id) REFERENCES savings_participants(id) ON DELETE RESTRICT"},{"name":"savings_yield_allocations_pkey","definition":"PRIMARY KEY (id)"},{"name":"savings_yield_allocations_yield_period_id_fkey","definition":"FOREIGN KEY (yield_period_id) REFERENCES savings_yield_periods(id) ON DELETE RESTRICT"},{"name":"savings_yield_allocations_yield_period_id_participant_id_key","definition":"UNIQUE (yield_period_id, participant_id)"}],"triggers":[{"name":"savings_yield_allocations_immutable","definition":"CREATE TRIGGER savings_yield_allocations_immutable BEFORE DELETE OR UPDATE ON public.savings_yield_allocations FOR EACH ROW EXECUTE FUNCTION reject_savings_history_mutation()"}]},{"name":"savings_yield_periods","owner":"postgres","rls":true,"force_rls":true,"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}","columns":[{"name":"id","type":"uuid","default":"extensions.gen_random_uuid()","notnull":true},{"name":"period_year","type":"integer","default":null,"notnull":true},{"name":"semester","type":"integer","default":null,"notnull":true},{"name":"starts_on","type":"date","default":null,"notnull":true},{"name":"ends_on","type":"date","default":null,"notnull":true},{"name":"rate","type":"numeric(9,6)","default":null,"notnull":false},{"name":"eligibility_policy","type":"jsonb","default":"''{}''::jsonb","notnull":true},{"name":"exclusion_policy","type":"jsonb","default":"''{}''::jsonb","notnull":true},{"name":"status","type":"text","default":"''DRAFT''::text","notnull":true},{"name":"productive_enabled","type":"boolean","default":"false","notnull":true},{"name":"approved_by_auth_user_id","type":"uuid","default":null,"notnull":false},{"name":"approved_at","type":"timestamp with time zone","default":null,"notnull":false},{"name":"created_at","type":"timestamp with time zone","default":"now()","notnull":true}],"constraints":[{"name":"savings_yield_dates_check","definition":"CHECK ((ends_on >= starts_on))"},{"name":"savings_yield_period_calendar_check","definition":"CHECK (((EXTRACT(year FROM starts_on) = (period_year)::numeric) AND (EXTRACT(year FROM ends_on) = (period_year)::numeric) AND ((EXTRACT(month FROM starts_on) >= ((((semester - 1) * 6) + 1))::numeric) AND (EXTRACT(month FROM starts_on) <= ((semester * 6))::numeric)) AND ((EXTRACT(month FROM ends_on) >= ((((semester - 1) * 6) + 1))::numeric) AND (EXTRACT(month FROM ends_on) <= ((semester * 6))::numeric))))"},{"name":"savings_yield_periods_approved_by_auth_user_id_fkey","definition":"FOREIGN KEY (approved_by_auth_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT"},{"name":"savings_yield_periods_period_year_semester_key","definition":"UNIQUE (period_year, semester)"},{"name":"savings_yield_periods_pkey","definition":"PRIMARY KEY (id)"},{"name":"savings_yield_productive_rate_check","definition":"CHECK (((NOT productive_enabled) OR (rate IS NOT NULL)))"},{"name":"savings_yield_rate_check","definition":"CHECK (((rate IS NULL) OR (rate >= (0)::numeric)))"},{"name":"savings_yield_semester_check","definition":"CHECK ((semester = ANY (ARRAY[1, 2])))"},{"name":"savings_yield_status_check","definition":"CHECK ((status = ANY (ARRAY[''DRAFT''::text, ''APPROVED''::text, ''CREDITED''::text, ''DISABLED''::text])))"}],"triggers":[{"name":"savings_protect_yield_period","definition":"CREATE TRIGGER savings_protect_yield_period BEFORE DELETE OR UPDATE ON public.savings_yield_periods FOR EACH ROW EXECUTE FUNCTION savings_protect_yield_period()"}]}]'::jsonb) loop
  if not exists(select 1 from pg_class c where c.oid=to_regclass('public.'||(r->>'name')) and c.relrowsecurity=(r->>'rls')::boolean and c.relforcerowsecurity=(r->>'force_rls')::boolean
   and pg_get_userbyid(c.relowner)=r->>'owner' and c.relacl::text is not distinct from r->>'acl') then raise exception 'SAVINGS_AUTO_TABLE_SECURITY_DRIFT' using detail=r->>'name';end if;
  select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'default',pg_get_expr(d.adbin,d.adrelid),'notnull',a.attnotnull) order by a.attnum)
   into actual from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=to_regclass('public.'||(r->>'name')) and a.attnum>0 and not a.attisdropped;
  if actual is distinct from r->'columns' then raise exception 'SAVINGS_AUTO_TABLE_COLUMNS_DRIFT' using detail=r->>'name';end if;
  select jsonb_agg(jsonb_build_object('name',c.conname,'definition',pg_get_constraintdef(c.oid)) order by c.conname) into actual from pg_constraint c where c.conrelid=to_regclass('public.'||(r->>'name')) and c.contype<>'n';
  if actual is distinct from r->'constraints' then raise exception 'SAVINGS_AUTO_TABLE_CONSTRAINTS_DRIFT' using detail=r->>'name';end if;
 end loop;
 if not (select attnotnull from pg_attribute where attrelid='public.savings_contribution_overrides'::regclass and attname='editor_auth_user_id')
  or exists(select 1 from pg_attribute where attrelid='public.savings_contribution_overrides'::regclass and attname='entry_source' and not attisdropped)
  or not exists(select 1 from pg_class where oid='public.savings_contribution_overrides'::regclass and relrowsecurity and relforcerowsecurity)
  then raise exception 'SAVINGS_AUTO_TABLE_CONTRACT_DRIFT';end if;
end $guard$;
create schema savings_automatic_private;
revoke all on schema savings_automatic_private from public,anon,authenticated,service_role;
create table savings_automatic_private.function_backup(signature text primary key,definition text not null,original_owner text not null,original_acl text,installed_md5 text);
insert into savings_automatic_private.function_backup(signature,definition,original_owner,original_acl)
 select p.oid::regprocedure::text,pg_get_functiondef(p.oid),pg_get_userbyid(p.proowner),p.proacl::text
 from pg_proc p where p.oid=any(array['public.admin_confirm_savings_account_receipt(uuid,uuid,date,numeric,integer,text,uuid)'::regprocedure,'public.get_admin_savings_account(uuid,date)'::regprocedure,'public.savings_workspace_person_row(uuid)'::regprocedure,'public.get_admin_savings_workspace_person(uuid,integer,integer)'::regprocedure,'public.get_admin_savings_rh_report(text,integer,integer,integer)'::regprocedure,'public.get_admin_savings_reconciliation(date)'::regprocedure,'savings_period_private.projection_before(uuid)'::regprocedure,'savings_period_private.operation_before(jsonb,uuid)'::regprocedure]::oid[]);
create table savings_automatic_private.policy(
 id boolean primary key default true check(id),enabled boolean not null default false,
 starts_on date not null default '2026-09-30' check(starts_on>='2026-09-30'),version integer not null default 0 check(version>=0),
 authorized_by uuid references auth.users(id) on delete restrict,activated_at timestamptz,reason text not null default '',updated_at timestamptz not null default clock_timestamp(),
 check(not enabled or authorized_by is not null)
);
insert into savings_automatic_private.policy(id) values(true);
create table savings_automatic_private.instructions(
 id uuid primary key default extensions.gen_random_uuid(),enrollment_id uuid not null references public.savings_enrollments(id) on delete restrict,
 contribution_date date not null,amount numeric(14,2) not null check(amount>=0),version integer not null check(version>0),
 plan_id uuid not null references public.savings_contribution_plans(id) on delete restrict,plan_hash text not null,
 actor_real_auth_user_id uuid not null references auth.users(id) on delete restrict,reason text not null check(length(reason)<=1000),
 client_action_id uuid not null unique,created_at timestamptz not null default clock_timestamp(),unique(enrollment_id,contribution_date,version)
);
create index savings_auto_instruction_latest on savings_automatic_private.instructions(enrollment_id,contribution_date,version desc);
create table savings_automatic_private.runs(
 id uuid primary key default extensions.gen_random_uuid(),started_at timestamptz not null default clock_timestamp(),finished_at timestamptz,
 policy_version integer not null,as_of date not null,summary jsonb not null default '{}'
);
create table savings_automatic_private.attempts(
 id bigint generated always as identity primary key,run_id uuid not null references savings_automatic_private.runs(id) on delete restrict,
 participant_id uuid not null references public.savings_participants(id) on delete restrict,enrollment_id uuid not null references public.savings_enrollments(id) on delete restrict,
 contribution_date date not null,status text not null check(status in ('APPLIED','EXISTING','FAILED')),error_code text,created_at timestamptz not null default clock_timestamp()
);
create index savings_auto_attempt_date on savings_automatic_private.attempts(enrollment_id,contribution_date,created_at desc);
create trigger savings_auto_instructions_immutable before update or delete on savings_automatic_private.instructions for each row execute function public.reject_savings_history_mutation();
create trigger savings_auto_attempts_immutable before update or delete on savings_automatic_private.attempts for each row execute function public.reject_savings_history_mutation();
do $private$ declare n text;begin foreach n in array array['function_backup','policy','instructions','runs','attempts'] loop
 execute format('alter table savings_automatic_private.%I enable row level security',n);
 execute format('alter table savings_automatic_private.%I force row level security',n);
 execute format('revoke all on savings_automatic_private.%I from public,anon,authenticated,service_role',n);
end loop;end $private$;
alter table public.savings_contribution_overrides add column entry_source text not null default 'MANUAL';
alter table public.savings_contribution_overrides alter column editor_auth_user_id drop not null;
alter table public.savings_contribution_overrides add constraint savings_override_origin_actor_check check(
 (entry_source='MANUAL' and editor_auth_user_id is not null) or (entry_source='SYSTEM_SCHEDULE' and editor_auth_user_id is null));

CREATE OR REPLACE FUNCTION savings_automatic_private.apply_receipt(p_participant_id uuid, p_enrollment_id uuid, p_date date, p_actual numeric, p_version integer, p_observation text, p_client_action_id uuid, p_origin jsonb DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=case when p_origin is null then auth.uid() else null end; system_entry boolean:=p_origin is not null; en public.savings_enrollments%rowtype; prior public.savings_contribution_overrides%rowtype; old public.savings_audit_events%rowtype;
 c public.savings_balance_certifications%rowtype; bal record; expected numeric; posted numeric; delta numeric; target uuid; result jsonb;
 command jsonb:=jsonb_build_object('participant_id',p_participant_id,'enrollment_id',p_enrollment_id,'date',p_date,'actual',p_actual,'version',p_version,'observation',p_observation);
begin
 if not system_entry and (actor is null or not public.has_admin_permission('savings.write')) then raise exception 'SAVINGS_WRITE_DENIED' using errcode='42501';end if;
 if system_entry then
  if jsonb_typeof(p_origin) is distinct from 'object' or p_origin->>'entry_source' is distinct from 'SYSTEM_SCHEDULE'
   or not exists(select 1 from savings_automatic_private.policy p where p.enabled and p.version::text=p_origin->>'policy_version' and p_date>=p.starts_on)
   then raise exception 'SAVINGS_AUTO_POLICY_INVALID';end if;
  command:=command||jsonb_build_object('origin',p_origin);
 end if;
 if p_participant_id is null or p_enrollment_id is null or p_client_action_id is null or p_date is null or p_date>public.savings_operation_today()
  or p_actual is null or p_actual<0 or p_actual>999999999999.99 or p_actual<>round(p_actual,2) or p_version is null or p_version<0 or length(coalesce(p_observation,''))>1000 then raise exception 'SAVINGS_RECEIPT_INVALID';end if;
 perform pg_advisory_xact_lock(hashtextextended('savings-account-receipt:'||p_client_action_id,0));
 select * into old from public.savings_audit_events where client_action_id=p_client_action_id;
 if found then
  if old.actor_real_auth_user_id is distinct from actor or old.resource<>'savings_account_receipts' or old.after_data->'command' is distinct from command then raise exception 'SAVINGS_IDEMPOTENCY_CONFLICT';end if;
  return old.after_data->'result';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('savings-config',0));
 target:=public.savings_receipt_assert_identity(p_participant_id);
 if not exists(select 1 from public.savings_participants where id=p_participant_id and certification_status='CERTIFIED' and data_classification='CANONICAL') then raise exception 'SAVINGS_OPENING_CONFIRMATION_REQUIRED';end if;
 select * into en from public.savings_enrollments where id=p_enrollment_id and participant_id=p_participant_id and data_classification='CANONICAL' for update;
 if not found then raise exception 'SAVINGS_ENROLLMENT_NOT_FOUND';end if;
 select * into c from public.savings_balance_certifications where participant_id=p_participant_id;
 if c.id is not null and p_date<=c.cutoff_on then raise exception 'SAVINGS_CERTIFIED_PERIOD_PROTECTED';end if;
 -- A received date has an economic date independent of its later audit timestamp.
 -- Posted or final excluded yield decisions must remain immutable.
 if exists(select 1 from public.savings_yield_allocations a join public.savings_withdrawal_openings o on o.yield_period_id=a.yield_period_id
  where a.participant_id=p_participant_id and a.status in ('CREDITED','EXCLUDED') and o.opening_kind in ('ORDINARY','EARLY') and p_date<=o.cutoff_on)
  then raise exception 'SAVINGS_YIELD_PERIOD_PROTECTED';end if;
 select s.expected_amount into expected from public.generate_savings_schedule(en.id,p_date,p_date)s;
 if expected is null then raise exception 'SAVINGS_DATE_NOT_EXPECTED';end if;
 select * into prior from public.savings_contribution_overrides where enrollment_id=en.id and contribution_date=p_date order by version_number desc limit 1;
 if coalesce(prior.version_number,0)<>p_version then raise exception 'SAVINGS_PREVIEW_STALE';end if;
 select coalesce(sum(case direction when 'CREDIT' then amount else -amount end),0) into posted
 from public.savings_transactions where enrollment_id=en.id and contribution_date=p_date and component='CAPITAL' and data_classification='CANONICAL';
 if posted<>coalesce(prior.actual_amount,0) or exists(select 1 from public.savings_transactions where enrollment_id=en.id and contribution_date=p_date and data_classification<>'CANONICAL') then raise exception 'SAVINGS_RECEIPT_HISTORY_MISMATCH';end if;
 delta:=p_actual-coalesce(prior.actual_amount,0);
 if prior.id is not null and delta=0 then raise exception 'SAVINGS_NO_CHANGE';end if;
 select * into bal from public.savings_participant_balance(p_participant_id);
 if bal.capital+delta<bal.held_capital then raise exception 'SAVINGS_RECEIPT_EXCEEDS_AVAILABLE_CAPITAL';end if;
 insert into public.savings_contribution_overrides(enrollment_id,contribution_date,expected_amount,actual_amount,version_number,reason,editor_auth_user_id,client_action_id,entry_source)
 values(en.id,p_date,expected,p_actual,p_version+1,coalesce(nullif(btrim(p_observation),''),'Descuento confirmado'),actor,p_client_action_id,case when system_entry then 'SYSTEM_SCHEDULE' else 'MANUAL' end);
 if delta<>0 then
  insert into public.savings_transactions(participant_id,enrollment_id,transaction_type,component,direction,amount,effective_date,contribution_date,expected_amount,actual_amount,difference_amount,idempotency_key,data_classification,created_by_auth_user_id)
  values(p_participant_id,en.id,case when not exists(select 1 from public.savings_transactions anchor where anchor.enrollment_id=en.id and anchor.contribution_date=p_date and anchor.transaction_type='CONTRIBUTION' and anchor.component='CAPITAL' and anchor.data_classification='CANONICAL') then 'CONTRIBUTION' else 'ADJUSTMENT' end,'CAPITAL',case when delta>0 then 'CREDIT' else 'DEBIT' end,abs(delta),p_date,p_date,expected,p_actual,p_actual-expected,'ACCOUNT_RECEIPT:'||p_client_action_id,'CANONICAL',actor);
 end if;
 update public.savings_enrollments set first_actual_contribution_date=case when c.enrollment_id=en.id then public.savings_panel_date(c.command->>'first_date') else
  (select min(o.contribution_date) from (select distinct on (contribution_date) contribution_date,actual_amount from public.savings_contribution_overrides where enrollment_id=en.id order by contribution_date,version_number desc)o where o.actual_amount>0) end where id=en.id;
 result:=jsonb_build_object('participant_id',p_participant_id,'enrollment_id',en.id,'date',p_date,'expected',expected,'actual',p_actual,'difference',p_actual-expected,'version',p_version+1,'entry_source',case when system_entry then 'SYSTEM_SCHEDULE' else 'MANUAL' end);
 insert into public.savings_audit_events(actor_real_auth_user_id,usuario_contexto_affiliate_id,participant_id,resource,action,target_id,before_data,after_data,reason,client_action_id)
 values(actor,target,p_participant_id,'savings_account_receipts',case when system_entry then 'APPLY_SCHEDULED_RECEIPT' else 'CONFIRM_RECEIPT' end,en.id||':'||p_date,coalesce(to_jsonb(prior),'{}'),jsonb_build_object('command',command,'result',result),coalesce(p_observation,''),p_client_action_id);
 return result;
end $function$
;

create or replace function public.admin_confirm_savings_account_receipt(p_participant_id uuid,p_enrollment_id uuid,p_date date,p_actual numeric,p_version integer,p_observation text,p_client_action_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 return savings_automatic_private.apply_receipt(p_participant_id,p_enrollment_id,p_date,p_actual,p_version,p_observation,p_client_action_id,null);
end $$;
create function savings_automatic_private.plan_hash(p_plan_id uuid) returns text language sql stable security definer set search_path='' as $$
 -- The selected plan must still cover p_date. Closing it after that date does not alter that date's instruction.
 select md5(jsonb_build_array(id,enrollment_id,amount,process_snapshot,effective_from,source_request_id,data_classification,created_by_auth_user_id)::text)
 from public.savings_contribution_plans where id=p_plan_id;
$$;
create function savings_automatic_private.scheduled(p_enrollment_id uuid,p_date date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare s record;i savings_automatic_private.instructions%rowtype;changed boolean;
begin
 select * into s from public.generate_savings_schedule(p_enrollment_id,p_date,p_date);
 select * into i from savings_automatic_private.instructions where enrollment_id=p_enrollment_id and contribution_date=p_date order by version desc limit 1;
 if s.plan_id is null then return jsonb_build_object('scheduled_amount',null,'scheduled_version',coalesce(i.version,0),'scheduled_source',case when i.id is null then 'PLAN' else 'MANUAL_INSTRUCTION' end,'scheduled_status','PLAN_CHANGED');end if;
 changed:=(select count(*)<>1 or bool_or(data_classification<>'CANONICAL') from public.savings_contribution_plans where enrollment_id=p_enrollment_id and effective_from<=p_date and (effective_to is null or effective_to>=p_date))
  or (i.id is not null and (i.plan_id is distinct from s.plan_id or i.plan_hash is distinct from savings_automatic_private.plan_hash(s.plan_id)));
 return jsonb_build_object('scheduled_amount',case when changed then null else coalesce(i.amount,s.expected_amount) end,
  'scheduled_version',coalesce(i.version,0),'scheduled_source',case when i.id is null then 'PLAN' else 'MANUAL_INSTRUCTION' end,
  'scheduled_status',case when changed then 'PLAN_CHANGED' when i.id is null then 'PLAN' else 'EDITED' end,
  'instruction_id',i.id,'plan_id',s.plan_id,'plan_hash',savings_automatic_private.plan_hash(s.plan_id));
end $$;
create function public.admin_configure_savings_automatic_contributions(p_enabled boolean,p_start_date date,p_reason text,p_client_action_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare current_policy savings_automatic_private.policy%rowtype;old public.savings_audit_events%rowtype;result jsonb;
 command jsonb:=jsonb_build_object('enabled',p_enabled,'start_date',p_start_date,'reason',p_reason);
begin
 if auth.uid() is null or not public.has_admin_permission('savings.config') then raise exception 'SAVINGS_CONFIG_DENIED' using errcode='42501';end if;
 if p_enabled is null or p_start_date is null or p_start_date<'2026-09-30' or p_start_date>public.savings_operation_today()+1098
  or p_client_action_id is null or length(btrim(coalesce(p_reason,''))) not between 3 and 1000 then raise exception 'SAVINGS_AUTO_CONFIG_INVALID';end if;
 perform pg_advisory_xact_lock(hashtextextended('savings-config',0));
 select * into old from public.savings_audit_events where client_action_id=p_client_action_id;
 if found then
  if old.actor_real_auth_user_id is distinct from auth.uid() or old.resource<>'savings_automatic_policy' or old.after_data->'command' is distinct from command then raise exception 'SAVINGS_IDEMPOTENCY_CONFLICT';end if;
  return old.after_data->'result';end if;
 select * into current_policy from savings_automatic_private.policy where id for update;
 if current_policy.activated_at is not null and p_start_date<>current_policy.starts_on then raise exception 'SAVINGS_AUTO_START_DATE_IMMUTABLE';end if;
 update savings_automatic_private.policy set enabled=p_enabled,starts_on=p_start_date,version=version+1,authorized_by=auth.uid(),activated_at=case when p_enabled then coalesce(activated_at,clock_timestamp()) else activated_at end,reason=btrim(p_reason),updated_at=clock_timestamp() where id;
 select to_jsonb(p) into result from savings_automatic_private.policy p where id;
 insert into public.savings_audit_events(actor_real_auth_user_id,usuario_contexto_affiliate_id,resource,action,target_id,before_data,after_data,reason,client_action_id)
 values(auth.uid(),public.get_effective_affiliate_id(),'savings_automatic_policy','CONFIGURE','singleton',to_jsonb(current_policy),jsonb_build_object('command',command,'result',result),btrim(p_reason),p_client_action_id);
 return result;
end $$;
create function public.admin_set_savings_scheduled_contribution(p_participant_id uuid,p_enrollment_id uuid,p_date date,p_amount numeric,p_version integer,p_observation text,p_client_action_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare en public.savings_enrollments%rowtype;c public.savings_balance_certifications%rowtype;prior savings_automatic_private.instructions%rowtype;
 old public.savings_audit_events%rowtype;s record;target uuid;result jsonb;
 command jsonb:=jsonb_build_object('participant_id',p_participant_id,'enrollment_id',p_enrollment_id,'date',p_date,'amount',p_amount,'version',p_version,'observation',p_observation);
begin
 if auth.uid() is null or not public.has_admin_permission('savings.write') then raise exception 'SAVINGS_WRITE_DENIED' using errcode='42501';end if;
 if p_participant_id is null or p_enrollment_id is null or p_client_action_id is null or p_date is null or p_date<=public.savings_operation_today() or p_date>public.savings_operation_today()+1098
  or p_amount is null or p_amount<0 or p_amount>999999999999.99 or p_amount<>round(p_amount,2) or p_version is null or p_version<0 or length(coalesce(p_observation,''))>1000 then raise exception 'SAVINGS_SCHEDULE_INSTRUCTION_INVALID';end if;
 perform pg_advisory_xact_lock(hashtextextended('savings-config',0));
 select * into old from public.savings_audit_events where client_action_id=p_client_action_id;
 if found then
  if old.actor_real_auth_user_id is distinct from auth.uid() or old.resource<>'savings_scheduled_instructions' or old.after_data->'command' is distinct from command then raise exception 'SAVINGS_IDEMPOTENCY_CONFLICT';end if;
  return old.after_data->'result';end if;
 target:=public.savings_receipt_assert_identity(p_participant_id);
 if not exists(select 1 from public.savings_participants where id=p_participant_id and certification_status='CERTIFIED' and data_classification='CANONICAL') then raise exception 'SAVINGS_OPENING_CONFIRMATION_REQUIRED';end if;
 select * into en from public.savings_enrollments where id=p_enrollment_id and participant_id=p_participant_id and data_classification='CANONICAL' and status not in ('REQUESTED','REJECTED') for update;
 if not found then raise exception 'SAVINGS_ENROLLMENT_NOT_FOUND';end if;
 select * into c from public.savings_balance_certifications where participant_id=p_participant_id;
 if c.id is not null and p_date<=c.cutoff_on then raise exception 'SAVINGS_CERTIFIED_PERIOD_PROTECTED';end if;
 select * into s from public.generate_savings_schedule(en.id,p_date,p_date);
 if s.plan_id is null or not exists(select 1 from public.savings_contribution_plans where id=s.plan_id and data_classification='CANONICAL') then raise exception 'SAVINGS_DATE_NOT_EXPECTED';end if;
 if (select count(*) from public.savings_contribution_plans where enrollment_id=en.id and effective_from<=p_date and (effective_to is null or effective_to>=p_date))<>1 then raise exception 'SAVINGS_AUTO_PLAN_CONFLICT';end if;
 if exists(select 1 from public.savings_contribution_overrides where enrollment_id=en.id and contribution_date=p_date)
  or exists(select 1 from public.savings_transactions where enrollment_id=en.id and contribution_date=p_date) then raise exception 'SAVINGS_SCHEDULE_ALREADY_POSTED';end if;
 select * into prior from savings_automatic_private.instructions where enrollment_id=en.id and contribution_date=p_date order by version desc limit 1;
 if coalesce(prior.version,0)<>p_version then raise exception 'SAVINGS_PREVIEW_STALE';end if;
 insert into savings_automatic_private.instructions(enrollment_id,contribution_date,amount,version,plan_id,plan_hash,actor_real_auth_user_id,reason,client_action_id)
 values(en.id,p_date,p_amount,p_version+1,s.plan_id,savings_automatic_private.plan_hash(s.plan_id),auth.uid(),coalesce(p_observation,''),p_client_action_id);
 result:=jsonb_build_object('participant_id',p_participant_id,'enrollment_id',en.id,'date',p_date,'expected',s.expected_amount,
  'scheduled_amount',p_amount,'scheduled_version',p_version+1,'scheduled_source','MANUAL_INSTRUCTION','scheduled_status','EDITED');
 insert into public.savings_audit_events(actor_real_auth_user_id,usuario_contexto_affiliate_id,participant_id,resource,action,target_id,before_data,after_data,reason,client_action_id)
 values(auth.uid(),target,p_participant_id,'savings_scheduled_instructions','SET_SCHEDULED_AMOUNT',en.id||':'||p_date,coalesce(to_jsonb(prior),'{}'),jsonb_build_object('command',command,'result',result),coalesce(p_observation,''),p_client_action_id);
 return result;
end $$;
create function savings_automatic_private.due(p_participant_id uuid default null,p_require_enabled boolean default true)
returns table(participant_id uuid,enrollment_id uuid,contribution_date date,expected_amount numeric,plan_id uuid)
language sql stable security definer set search_path='' as $$
 select p.id,e.id,s.contribution_date,s.expected_amount,s.plan_id
 from savings_automatic_private.policy policy cross join public.savings_participants p
 join public.savings_enrollments e on e.participant_id=p.id and e.data_classification='CANONICAL' and e.status not in ('REQUESTED','REJECTED')
 left join public.savings_balance_certifications c on c.participant_id=p.id
 cross join lateral(select greatest(policy.starts_on,e.first_expected_contribution_date,c.cutoff_on+1) first_on,
  least(public.savings_operation_today(),coalesce((e.terminated_at at time zone 'America/Hermosillo')::date-1,public.savings_operation_today())) last_on)b
 cross join lateral generate_series(date_trunc('year',b.first_on::timestamp),date_trunc('year',b.last_on::timestamp),interval '1 year')y(first_on)
 cross join lateral public.generate_savings_schedule(e.id,greatest(b.first_on,y.first_on::date),least(b.last_on,(y.first_on+interval '1 year'-interval '1 day')::date))s
 where policy.id and policy.activated_at is not null and (policy.enabled or not p_require_enabled) and p.data_classification='CANONICAL' and p.certification_status='CERTIFIED'
  and (p_participant_id is null or p.id=p_participant_id) and e.first_expected_contribution_date is not null and b.first_on<=b.last_on
  and not exists(select 1 from public.savings_contribution_overrides o where o.enrollment_id=e.id and o.contribution_date=s.contribution_date);
$$;
create function savings_automatic_private.run_due(p_limit integer default 500) returns jsonb
language plpgsql security definer set search_path='' as $$
declare policy savings_automatic_private.policy%rowtype;d record;en public.savings_enrollments%rowtype;s record;instruction jsonb;origin jsonb;result jsonb;run uuid;
 applied integer:=0;existing integer:=0;failed integer:=0;remaining integer;code text;amount numeric;key uuid;
begin
 if p_limit is null or p_limit not between 1 and 1000 then raise exception 'SAVINGS_AUTO_BATCH_INVALID';end if;
 if not pg_try_advisory_xact_lock(hashtextextended('savings-auto-job',0)) then return jsonb_build_object('status','RUNNING');end if;
 perform pg_advisory_xact_lock(hashtextextended('savings-config',0));
 select * into policy from savings_automatic_private.policy where id;
 if not policy.enabled then return jsonb_build_object('status','DISABLED');end if;
 insert into savings_automatic_private.runs(policy_version,as_of) values(policy.version,public.savings_operation_today()) returning id into run;
 for d in select pending.*,prior.last_attempt from savings_automatic_private.due(null)pending
  left join lateral(select max(a.created_at) last_attempt from savings_automatic_private.attempts a where a.enrollment_id=pending.enrollment_id and a.contribution_date=pending.contribution_date)prior on true
  order by prior.last_attempt nulls first,pending.contribution_date,pending.enrollment_id limit p_limit loop
  begin
   perform public.savings_receipt_assert_identity(d.participant_id);
   select * into en from public.savings_enrollments where id=d.enrollment_id and participant_id=d.participant_id for update;
   if exists(select 1 from public.savings_contribution_overrides where enrollment_id=en.id and contribution_date=d.contribution_date) then
    existing:=existing+1;insert into savings_automatic_private.attempts(run_id,participant_id,enrollment_id,contribution_date,status) values(run,d.participant_id,en.id,d.contribution_date,'EXISTING');continue;end if;
   -- A reversed/net-zero ledger is evidence, never an empty scheduled date to revive.
   if exists(select 1 from public.savings_transactions where enrollment_id=en.id and contribution_date=d.contribution_date) then raise exception 'SAVINGS_RECEIPT_HISTORY_MISMATCH';end if;
   select * into s from public.generate_savings_schedule(en.id,d.contribution_date,d.contribution_date);
   if (select count(*) from public.savings_contribution_plans where enrollment_id=en.id and effective_from<=d.contribution_date and (effective_to is null or effective_to>=d.contribution_date))<>1 then raise exception 'SAVINGS_AUTO_PLAN_CONFLICT';end if;
   if s.plan_id is null or en.approved_at is null or en.status in ('REQUESTED','REJECTED')
    or not exists(select 1 from public.savings_contribution_plans where id=s.plan_id and data_classification='CANONICAL') then raise exception 'SAVINGS_AUTO_PLAN_CHANGED';end if;
   instruction:=savings_automatic_private.scheduled(en.id,d.contribution_date);
   if instruction->>'scheduled_status'='PLAN_CHANGED' then raise exception 'SAVINGS_AUTO_INSTRUCTION_PLAN_CHANGED';end if;
   amount:=(instruction->>'scheduled_amount')::numeric;
   origin:=jsonb_build_object('entry_source','SYSTEM_SCHEDULE','executor','SYSTEM','policy_version',policy.version,'policy_authorized_by',policy.authorized_by,
    'policy_start',policy.starts_on,'policy_reason',policy.reason,'plan_id',s.plan_id,'plan_hash',instruction->>'plan_hash',
    'plan_snapshot',(select to_jsonb(p) from public.savings_contribution_plans p where p.id=s.plan_id),
    'instruction',(select to_jsonb(i) from savings_automatic_private.instructions i where i.id=(instruction->>'instruction_id')::uuid));
   key:=md5('SAVINGS_AUTOMATIC_CONTRIBUTION_V1:'||en.id||':'||d.contribution_date)::uuid;
   result:=savings_automatic_private.apply_receipt(d.participant_id,en.id,d.contribution_date,amount,0,'Aplicación automática del importe programado al vencimiento',key,origin);
   applied:=applied+1;insert into savings_automatic_private.attempts(run_id,participant_id,enrollment_id,contribution_date,status) values(run,d.participant_id,en.id,d.contribution_date,'APPLIED');
  exception when others then
   code:=case when sqlerrm ~ '^SAVINGS_[A-Z0-9_]+$' then sqlerrm else 'SAVINGS_AUTO_INTERNAL_ERROR' end;failed:=failed+1;
   insert into savings_automatic_private.attempts(run_id,participant_id,enrollment_id,contribution_date,status,error_code) values(run,d.participant_id,d.enrollment_id,d.contribution_date,'FAILED',code);
  end;
 end loop;
 select count(*) into remaining from savings_automatic_private.due(null);
 result:=jsonb_build_object('status',case when failed>0 then 'REVIEW_REQUIRED' when remaining>0 then 'MORE_PENDING' else 'COMPLETE' end,'as_of',public.savings_operation_today(),'applied',applied,'existing',existing,'failed',failed,'remaining',remaining,'batch_limit',p_limit,
  'error_codes',coalesce((select jsonb_agg(distinct error_code) from savings_automatic_private.attempts where run_id=run and error_code is not null),'[]'));
 update savings_automatic_private.runs set finished_at=clock_timestamp(),summary=result where id=run;
 return result;
end $$;

CREATE OR REPLACE FUNCTION public.get_admin_savings_account(p_participant_id uuid, p_until date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p public.savings_participants%rowtype; c public.savings_balance_certifications%rowtype; en public.savings_enrollments%rowtype;
 plan public.savings_contribution_plans%rowtype; bal jsonb; schedule jsonb; history jsonb; identity jsonb; until_date date; start_date date; mode text; current_status text;
begin
 if auth.uid() is null or not public.has_admin_permission('savings.read') then raise exception 'SAVINGS_READ_DENIED' using errcode='42501';end if;
 select * into p from public.savings_participants where id=p_participant_id and data_classification='CANONICAL';
 if not found then raise exception 'SAVINGS_CANONICAL_ACCOUNT_REQUIRED';end if;
 select * into c from public.savings_balance_certifications where participant_id=p.id;
 select * into en from public.savings_enrollments where participant_id=p.id and data_classification='CANONICAL' order by sequence_number desc limit 1;
 current_status:=public.savings_enrollment_effective_status(en.status,en.terminated_at,public.savings_operation_today());
 until_date:=coalesce(p_until,public.savings_operation_today()+366);
 if until_date>public.savings_operation_today()+1098 or until_date<coalesce(c.cutoff_on,(p.created_at at time zone 'America/Hermosillo')::date) then raise exception 'SAVINGS_PROJECTION_RANGE_INVALID';end if;
 select coalesce(c.cutoff_on+1,min(first_expected_contribution_date),public.savings_operation_today()) into start_date from public.savings_enrollments where participant_id=p.id and data_classification='CANONICAL';
 select * into plan from public.savings_contribution_plans where enrollment_id=en.id and data_classification='CANONICAL'
  and (effective_to is null or effective_to>=public.savings_operation_today()) order by case when effective_from<=public.savings_operation_today() then 0 else 1 end,effective_from limit 1;
 select to_jsonb(b) into bal from public.savings_participant_balance(p.id)b;
 select coalesce(jsonb_agg(jsonb_build_object('enrollment_id',e.id,'date',s.contribution_date,'expected',s.expected_amount,
  'actual',o.actual_amount,'version',coalesce(o.version_number,0),'confirmed',o.id is not null,'future',s.contribution_date>public.savings_operation_today(),'entry_source',o.entry_source,'can_edit_scheduled',s.contribution_date>public.savings_operation_today() and public.has_admin_permission('savings.write'))||savings_automatic_private.scheduled(e.id,s.contribution_date) order by s.contribution_date,e.sequence_number),'[]') into schedule
 from public.savings_enrollments e cross join lateral public.generate_savings_schedule(e.id,greatest(start_date,e.first_expected_contribution_date),until_date)s
 left join lateral(select * from public.savings_contribution_overrides where enrollment_id=e.id and contribution_date=s.contribution_date order by version_number desc limit 1)o on true
 where e.participant_id=p.id and e.data_classification='CANONICAL' and e.first_expected_contribution_date<=until_date;
 select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'at',a.created_at,'action',a.action,'observation',a.reason,'before',a.before_data,'after',a.after_data,'actor',case when a.action='APPLY_SCHEDULED_RECEIPT' then 'Aplicación automática' when a.actor_real_auth_user_id is not null then 'Encargado autorizado' else 'Sistema' end,'entry_source',case when a.action='APPLY_SCHEDULED_RECEIPT' then 'SYSTEM_SCHEDULE' when a.actor_real_auth_user_id is not null then 'MANUAL' else null end) order by a.id desc),'[]') into history
 from public.savings_audit_events a where a.participant_id=p.id;
 identity:=public.savings_review_identity(p.legacy_folio);
 select s.mode into mode from public.savings_publication_state s where id;
 return jsonb_build_object('participant_id',p.id,'certified',true,'native',c.id is null,
  'context',jsonb_build_object('person',jsonb_build_object('folio',p.legacy_folio,'nombre',identity->>'name','aporte',plan.amount,'inicio',(select min(first_actual_contribution_date) from public.savings_enrollments where participant_id=p.id and data_classification='CANONICAL'),
   'plan_inicio',(en.enrollment_started_at at time zone 'America/Hermosillo')::date,'estado',case when en.id is null then 'Por iniciar' when current_status='ACTIVE' then 'Ahorrando' when current_status='TERMINATED' then 'Dejo de ahorrar' else 'En revision' end,
   'frecuencia',case when plan.process_snapshot='JUB' then 'MONTHLY' else 'TWICE_MONTHLY' end,'identity',identity),'cutoff_on',c.cutoff_on),
  'balance',bal,'latest_enrollment',to_jsonb(en)||jsonb_build_object('status',current_status,'recorded_status',en.status),'schedule',schedule,'history',history,'today',public.savings_operation_today(),'publication',mode,
  'enrollments',coalesce((select jsonb_agg(to_jsonb(e) order by sequence_number desc) from public.savings_enrollments e where participant_id=p.id and data_classification='CANONICAL'),'[]'),
  'can_confirm',false,'can_write',public.has_admin_permission('savings.write') and (identity->>'match_count')::int=1 and (identity->>'active_match_count')::int=1
   and exists(select 1 from public.affiliates a where a.id=p.affiliate_id and a.numero_control=p.legacy_folio and not coalesce(a.is_archived,false)),
  'unconfirmed_dates',(select count(*) from jsonb_array_elements(schedule)x where x->>'future'='false' and x->>'confirmed'='false'),
  'projected_total',case when exists(select 1 from jsonb_array_elements(schedule)x where x->>'future'='true' and x->>'scheduled_status'='PLAN_CHANGED') then null else (bal->>'total')::numeric+coalesce((select sum((x->>'scheduled_amount')::numeric) from jsonb_array_elements(schedule)x where x->>'future'='true'),0) end,
  'balance_version',md5(jsonb_build_array(p.id,bal,(select coalesce(max(id),0) from public.savings_audit_events where participant_id=p.id))::text));
end $function$
;
CREATE OR REPLACE FUNCTION public.savings_workspace_person_row(p_participant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p public.savings_participants%rowtype; e public.savings_enrollments%rowtype; c public.savings_balance_certifications%rowtype;
 plan public.savings_contribution_plans%rowtype; balance jsonb; following jsonb; previous date; pending jsonb; state text; identity_ok boolean; person_name text;
begin
 select * into p from public.savings_participants where id=p_participant_id and data_classification='CANONICAL';
 if not found then raise exception 'SAVINGS_WORKSPACE_PERSON_NOT_FOUND';end if;
 select * into c from public.savings_balance_certifications where participant_id=p.id;
 select * into e from public.savings_enrollments where participant_id=p.id and data_classification='CANONICAL' order by sequence_number desc limit 1;
 select * into plan from public.savings_contribution_plans where enrollment_id=e.id and data_classification='CANONICAL'
  and (effective_to is null or effective_to>=public.savings_operation_today())
  order by case when effective_from<=public.savings_operation_today() then 0 else 1 end,effective_from limit 1;
 identity_ok:=p.identity_status='RESOLVED' and exists(select 1 from public.affiliates a where a.id=p.affiliate_id and a.numero_control=p.legacy_folio and not coalesce(a.is_archived,false))
  and (select count(*) from public.affiliates a where a.numero_control=p.legacy_folio and not coalesce(a.is_archived,false))=1;
 select coalesce(nullif(a.full_name,''),p.display_name) into person_name from public.affiliates a where a.id=p.affiliate_id;
 state:=case when not identity_ok or p.certification_status<>'CERTIFIED' or e.id is null or e.status in ('REQUESTED','REJECTED') then 'revision'
  when public.savings_enrollment_effective_status(e.status,e.terminated_at,public.savings_operation_today())='TERMINATED' then 'baja'
  when plan.id is null then 'pausado' else 'ahorrando' end;
 if p.certification_status='CERTIFIED' and (c.id is not null or e.id is not null) then select to_jsonb(b) into balance from public.savings_participant_balance(p.id)b;end if;
 select jsonb_build_object('date',s.contribution_date,'amount',(savings_automatic_private.scheduled(e.id,s.contribution_date)->>'scheduled_amount')::numeric,'plan_amount',s.expected_amount)||savings_automatic_private.scheduled(e.id,s.contribution_date) into following
 from public.savings_contribution_plans cp
 cross join lateral(select greatest(public.savings_operation_today()+1,cp.effective_from,e.first_expected_contribution_date) first_on)b
 cross join lateral public.generate_savings_schedule(e.id,b.first_on,b.first_on+70)s
 where cp.enrollment_id=e.id and cp.data_classification='CANONICAL' and s.plan_id=cp.id
  and e.status not in ('REQUESTED','REJECTED') and (cp.effective_to is null or cp.effective_to>=b.first_on)
 order by s.contribution_date limit 1;
 select max(h.date) filter(where h.amount>0),jsonb_build_object('count',count(*) filter(where h.status='PENDING'),
  'first_date',min(h.date) filter(where h.status='PENDING'),'expected_amount',sum(h.expected) filter(where h.status='PENDING'),
  'conflict_count',count(*) filter(where h.data_conflict)) into previous,pending from public.savings_workspace_history(p.id)h;
 return jsonb_build_object('id',p.id,'participant_id',p.id,'record_id',c.record_id,'native',c.id is null,
  'folio',p.legacy_folio,'nombre',coalesce(person_name,p.display_name,'Sin nombre'),'estado',state,'aporte',plan.amount,
  'proceso',case coalesce(plan.process_snapshot,p.current_process) when 'PROCESS_1' then '1' when 'PROCESS_3' then '3' else coalesce(plan.process_snapshot,p.current_process) end,
  'saldo',balance->'total','capital_actual',balance->'capital','rendimiento_actual',balance->'yield_amount','balance',balance,
  'certified',balance is not null,'ultimo',previous,'prox',following->'date','porRecibir',following->'amount','next_expected',following,
  'inicio',case when c.id is not null then c.command->>'first_date' else e.first_actual_contribution_date::text end,
  'plan_inicio',(e.enrollment_started_at at time zone 'America/Hermosillo')::date,'bajaAt',(e.terminated_at at time zone 'America/Hermosillo')::date,
  'pending',pending,'identity_conflict',not identity_ok,'certification_pending',p.certification_status<>'CERTIFIED','enrollment_id',e.id,'today',public.savings_operation_today());
end $function$
;
CREATE OR REPLACE FUNCTION public.get_admin_savings_workspace_person(p_participant_id uuid, p_history_offset integer DEFAULT 0, p_history_limit integer DEFAULT 10)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare person jsonb; rows jsonb; total integer;
begin
 if auth.uid() is null or not public.has_admin_permission('savings.read') then raise exception 'SAVINGS_READ_DENIED' using errcode='42501';end if;
 if p_participant_id is null or p_history_offset is null or p_history_offset<0 or p_history_limit is null or p_history_limit not between 1 and 50 then raise exception 'SAVINGS_PAGE_INVALID' using errcode='22023';end if;
 person:=public.savings_workspace_person_row(p_participant_id);
 if person->>'identity_conflict'='true' then raise exception 'SAVINGS_EXACT_IDENTITY_REQUIRED' using errcode='42501';end if;
 with history as materialized(select * from public.savings_workspace_history(p_participant_id)),
 page as(select * from history order by date desc,id offset p_history_offset limit p_history_limit)
 select coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('entry_source',o.entry_source,'actor_label',case when o.entry_source='SYSTEM_SCHEDULE' then 'Aplicación automática' when o.entry_source='MANUAL' then 'Encargado autorizado' else null end) order by p.date desc,p.id) from page p left join lateral(select r.entry_source from public.savings_contribution_overrides r where p.id='receipt:'||r.enrollment_id||':'||r.contribution_date order by r.version_number desc limit 1)o on true),'[]'::jsonb),(select count(*) from history) into rows,total;
 return jsonb_build_object('person',person,'balance',person->'balance','last_received',person->'ultimo','next_expected',person->'next_expected',
  'pending',person->'pending','history',rows,'history_total',total,'record_id',person->'record_id','enrollment_id',person->'enrollment_id',
  'history_offset',p_history_offset,'history_limit',p_history_limit,'today',public.savings_operation_today());
end $function$
;
CREATE OR REPLACE FUNCTION public.get_admin_savings_reconciliation(p_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;
begin
 if auth.uid() is null or not public.has_admin_permission('savings.read') then raise exception 'SAVINGS_READ_DENIED' using errcode='42501'; end if;
 if p_date is null or p_date<'2000-01-01' or p_date>public.savings_operation_today()+1098 then raise exception 'SAVINGS_DATE_INVALID'; end if;
 with imported as (
  select r.*,r.source_data||r.proposed_data d,p.id participant_id,p.identity_status,p.display_name,
   c.id certification_id,c.cutoff_on,field.key field_key,
   public.savings_panel_number((r.source_data||r.proposed_data)->field.key) recorded
  from public.savings_review_records r
  left join public.savings_participants p on p.legacy_folio=r.source_folio
  left join public.savings_balance_certifications c on c.record_id=r.id
  left join lateral(select f->>'key' key from jsonb_array_elements(r.field_defs)f
   where f->>'label' ~ '^\d{4}-\d{2}-\d{2}' and left(f->>'label',10)=p_date::text limit 1)field on true
  where r.source_sheet='Ahorro'
 ), canonical as (
  select p.id participant_id,p.legacy_folio folio,public.savings_affiliate_display_name(p.id) nombre,e.id enrollment_id,
   s.expected_amount,o.actual_amount,o.version_number,o.id receipt_id,o.entry_source,c.cutoff_on
  from public.savings_participants p
  join public.savings_enrollments e on e.participant_id=p.id and e.data_classification='CANONICAL'
  cross join lateral public.generate_savings_schedule(e.id,p_date,p_date)s
  left join public.savings_balance_certifications c on c.participant_id=p.id
  left join lateral(select * from public.savings_contribution_overrides o where o.enrollment_id=e.id
   and o.contribution_date=p_date order by version_number desc limit 1)o on true
  where c.id is null or p_date>c.cutoff_on
 ), rows as (
  select jsonb_build_object('id',c.participant_id||':'||c.enrollment_id,'participant_id',c.participant_id,
   'enrollment_id',c.enrollment_id,'record_id',null,'folio',c.folio,'name',c.nombre,'route','ACCOUNT',
   'expected',c.expected_amount,'actual',c.actual_amount,'suggested',coalesce(c.actual_amount,(savings_automatic_private.scheduled(c.enrollment_id,p_date)->>'scheduled_amount')::numeric),'entry_source',c.entry_source,
   'version',coalesce(c.version_number,0),'confirmed',c.receipt_id is not null,
   'can_write',p_date<=public.savings_operation_today() and public.has_admin_permission('savings.write'),
   'note',null)||savings_automatic_private.scheduled(c.enrollment_id,p_date) row from canonical c
  union all
  select jsonb_build_object('id',i.id::text,'participant_id',i.participant_id,'enrollment_id',null,
   'record_id',i.id,'folio',i.source_folio,'name',coalesce(nullif(i.display_name,''),i.source_data->>'C'),
   'route',case when i.certification_id is not null then 'HISTORICAL' else 'REVIEW' end,
   'expected',coalesce(public.savings_panel_number(i.d->'S'),public.savings_panel_number(i.d->'R')),
   'actual',i.recorded,'suggested',i.recorded,'field',i.field_key,'version',i.version,
   'confirmed',i.certification_id is not null or exists(select 1 from public.savings_review_events ev
     where ev.record_id=i.id and ev.command->'changes'->i.field_key is not distinct from to_jsonb(i.recorded)
     and ev.observation like 'Conciliación bancaria '||p_date::text||':%'
     and ev.after_data->>'version'=i.version::text),
   'can_write',i.certification_id is null and p_date<=public.savings_operation_today() and public.savings_review_edit_allowed()
     and (i.d->>'A')=i.source_folio and i.recorded is not null,
   'note',case when i.identity_status='ORPHAN' then 'no existe en la base de afiliados'
     when i.certification_id is not null then 'Incluido en el saldo histórico certificado'
     else 'Captura histórica: se conserva para certificar el saldo' end) row
  from imported i where i.field_key is not null
   and not exists(select 1 from canonical c where c.participant_id=i.participant_id)
   and (i.certification_id is null or p_date<=i.cutoff_on)
   and public.savings_panel_date(i.d->>'F')<=p_date
   and (public.savings_panel_date(i.d->>'Z') is null or public.savings_panel_date(i.d->>'Z')>=p_date)
   and (upper(i.d->>'D')='JUB' and extract(day from p_date)=5 or i.d->>'D' in ('1','3') and
    (extract(day from p_date) in (15,30) or extract(month from p_date)=2 and extract(day from p_date)=28))
   and coalesce(public.savings_panel_number(i.d->'S'),public.savings_panel_number(i.d->'R'),0)>0
 ) select jsonb_build_object('date',p_date,'today',public.savings_operation_today(),
   'rows',coalesce(jsonb_agg(row order by row->>'name',row->>'folio',row->>'id'),'[]')) into result from rows;
 return result;
end $function$
;
CREATE OR REPLACE FUNCTION public.get_admin_savings_rh_report(p_type text, p_year integer, p_month integer DEFAULT NULL::integer, p_day integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare first_on date; last_on date; result jsonb; history_start date;
begin
 if auth.uid() is null or not public.has_admin_permission('savings.reports') then
  raise exception 'SAVINGS_REPORT_DENIED' using errcode='42501';
 end if;
 if p_type is null or p_type not in ('mensual','anual') or p_year is null or p_year not between 2000 and 2100 then
  raise exception 'SAVINGS_RH_SELECTION_INVALID' using errcode='22023';
 end if;
 if p_type='mensual' then
  if p_month is null or p_month not between 1 and 12 or p_day is null or p_day not in (5,15,28,30) then
   raise exception 'SAVINGS_RH_DATE_INVALID' using errcode='22023';
  end if;
  begin first_on:=make_date(p_year,p_month,p_day);
  exception when datetime_field_overflow then raise exception 'SAVINGS_RH_DATE_INVALID' using errcode='22023';end;
  last_on:=first_on;
 else first_on:=make_date(p_year,1,1);last_on:=make_date(p_year,12,31);end if;

 -- Earlier annual totals cannot reconstruct a payroll date. Never divide balances.
 select min(date_trunc('month',left(f->>'label',10)::date)::date) into history_start
 from public.savings_balance_certifications c join public.savings_review_records r on r.id=c.record_id
 cross join lateral jsonb_array_elements(r.field_defs) f
 where f->>'label' ~ '^\d{4}-\d{2}-\d{2}' and f->>'label' like '%Descuento registrado%';
 if history_start is not null and first_on<history_start then raise exception 'SAVINGS_RH_HISTORY_UNAVAILABLE';end if;

 with certified as materialized (
  select c.*,c.source_snapshot->'source'||coalesce(c.source_snapshot->'proposal','{}'::jsonb) approved,
   r.field_defs,case upper(coalesce(c.command->>'process',c.source_snapshot->'source'->>'D'))
    when '1' then 'PROCESS_1' when '3' then 'PROCESS_3'
    else upper(coalesce(c.command->>'process',c.source_snapshot->'source'->>'D')) end process
  from public.savings_balance_certifications c join public.savings_review_records r on r.id=c.record_id
  join public.savings_participants p on p.id=c.participant_id and p.data_classification='CANONICAL'
 ), historical_cells as (
  select c.participant_id,c.enrollment_id,c.process,left(f->>'label',10)::date date,
   f->>'key' field,c.approved->(f->>'key') raw,
   public.savings_panel_number(c.approved->(f->>'key')) amount,
   public.savings_panel_number(c.approved->'DT') included_yield,
   public.savings_panel_date(c.approved->>'X') jub_start
  from certified c cross join lateral jsonb_array_elements(c.field_defs) f
  where f->>'label' ~ '^\d{4}-\d{2}-\d{2}' and f->>'label' like '%Descuento registrado%'
   -- Owner confirmed AB (15 January 2026) is opening balance, not a payroll deduction.
   and f->>'key'<>'AB'
   and left(f->>'label',10)::date between first_on and least(last_on,c.cutoff_on)
   and (c.process='JUB' and substring(f->>'label',9,2)='05'
    or c.process in ('PROCESS_1','PROCESS_3') and substring(f->>'label',9,2)<>'05')
 ), historical as (
  select participant_id,enrollment_id,process,date,jub_start,
   case when field='AR' and amount>0 then amount-included_yield else amount end amount,
   (amount is null and coalesce(raw#>>'{}','') not in ('','-'))
    or (field='AR' and amount>0 and (included_yield is null or included_yield<0 or included_yield>amount)) invalid,
   false conflict
  from historical_cells
 ), scheduled as (
  select e.participant_id,e.id enrollment_id,cp.process_snapshot process,d.date::date date,(effective.value->>'scheduled_amount')::numeric amount,
   coalesce(public.savings_panel_date(c.approved->>'X'),e.first_expected_contribution_date) jub_start,
   effective.value->>'scheduled_status'='PLAN_CHANGED' or (effective.value->>'scheduled_amount')::numeric is null or (effective.value->>'scheduled_amount')::numeric<0 invalid,
   count(*) over(partition by e.participant_id,d.date)>1 conflict
  from public.savings_enrollments e
  join public.savings_participants p on p.id=e.participant_id and p.data_classification='CANONICAL'
  left join certified c on c.participant_id=p.id
  cross join lateral generate_series(first_on::timestamp,last_on::timestamp,interval '1 day') d(date)
  join public.savings_contribution_plans cp on cp.enrollment_id=e.id and cp.data_classification='CANONICAL'
   and cp.effective_from<=d.date::date and (cp.effective_to is null or cp.effective_to>=d.date::date)
  cross join lateral(select savings_automatic_private.scheduled(e.id,d.date::date) value)effective
  where e.data_classification='CANONICAL' and e.status in ('ACTIVE','TERMINATED')
   and d.date::date>=e.first_expected_contribution_date
   and (e.terminated_at is null or d.date::date<(e.terminated_at at time zone 'America/Hermosillo')::date)
   and (c.id is null or d.date::date>c.cutoff_on)
   and public.savings_next_contribution_date(d.date::date,cp.process_snapshot)=d.date::date
 ), instructions as (
  select participant_id,enrollment_id,process,date,jub_start,amount,invalid,conflict from historical
  union all select participant_id,enrollment_id,process,date,jub_start,amount,invalid,conflict from scheduled
 ), checked as (
  select i.*,p.legacy_folio folio,a.full_name name,
   p.identity_status='RESOLVED' and nullif(btrim(p.legacy_folio),'') is not null
    and a.id is not null and nullif(btrim(a.full_name),'') is not null
    and (select count(*) from public.affiliates other where other.numero_control=p.legacy_folio and not coalesce(other.is_archived,false))=1 identity_ok,
   row_number() over(partition by p.id,i.process order by i.date desc,i.enrollment_id) latest
  from instructions i join public.savings_participants p on p.id=i.participant_id
  left join public.affiliates a on a.id=p.affiliate_id and a.numero_control=p.legacy_folio and not coalesce(a.is_archived,false)
  where i.amount>0 or i.invalid or i.amount<0 or i.conflict
 ), selected as (
  select *,extract(year from date)::integer::text||lpad((extract(month from date)::integer*2-case when extract(day from date)<=15 then 1 else 0 end)::text,3,'0') quincena
  from checked where p_type='mensual' or process='PROCESS_3' or latest=1
 )
 select jsonb_build_object('rows',coalesce((select jsonb_agg(jsonb_build_object(
  'Clave',case when process='JUB' then '580' else '573' end,
  'Proceso',case process when 'JUB' then 'JUB' when 'PROCESS_1' then 'proceso 1' when 'PROCESS_3' then 'proceso 3' end,
  'Folio',folio,'Nombre',btrim(name),'Monto',amount,
  'Inicio',case when process<>'JUB' then quincena when p_type='mensual' then to_char(jub_start,'DD/MM/YYYY')
   else extract(year from jub_start)::integer::text||lpad((extract(month from jub_start)::integer*2-case when extract(day from jub_start)<=15 then 1 else 0 end)::text,3,'0') end,
  'Final',case process when 'JUB' then '' when 'PROCESS_1' then '2999999' else quincena end)
  order by date,name,folio) from selected),'[]'::jsonb),
  'identity_invalid',exists(select 1 from checked where identity_ok is not true),
  'amount_invalid',exists(select 1 from checked where invalid or amount<0 or amount<>round(amount,2)),
  'plan_conflict',exists(select 1 from checked where conflict or process not in ('JUB','PROCESS_1','PROCESS_3') or process='JUB' and jub_start is null)) into result;
 if (result->>'identity_invalid')::boolean then raise exception 'SAVINGS_RH_IDENTITY_INVALID';end if;
 if (result->>'amount_invalid')::boolean then raise exception 'SAVINGS_RH_AMOUNT_INVALID';end if;
 if (result->>'plan_conflict')::boolean then raise exception 'SAVINGS_RH_PLAN_CONFLICT';end if;
 return jsonb_build_object('type',p_type,'year',p_year,'from',first_on,'to',last_on,'rows',result->'rows');
end $function$
;
CREATE OR REPLACE FUNCTION savings_period_private.projection_before(p_participant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p public.savings_participants%rowtype; e public.savings_enrollments%rowtype;
 c public.savings_balance_certifications%rowtype; r public.savings_review_records%rowtype;
 plan public.savings_contribution_plans%rowtype; d jsonb; accepted jsonb; related jsonb:='[]'; transition jsonb; bal jsonb; hist jsonb; annual jsonb;
 withdrawals jsonb; upcoming jsonb; actions jsonb; requests jsonb; changes jsonb;
 today date:=public.savings_operation_today(); published boolean; effective_status text;
begin
 select * into p from public.savings_participants where id=p_participant_id;
 if not found or p.identity_status<>'RESOLVED' or p.certification_status<>'CERTIFIED' or p.data_classification<>'CANONICAL'
  or not exists(select 1 from public.affiliates a where a.id=p.affiliate_id and a.numero_control=p.legacy_folio and not coalesce(a.is_archived,false))
  or (select count(*) from public.affiliates where numero_control=p.legacy_folio and not coalesce(is_archived,false))<>1 then
  raise exception 'SAVINGS_EXACT_IDENTITY_REQUIRED' using errcode='55000';
 end if;
 select * into c from public.savings_balance_certifications where participant_id=p.id;
 if c.id is not null then
  select * into r from public.savings_review_records where id=c.record_id;
  select a.after_data->'source_snapshot' into accepted from public.savings_audit_events a where a.participant_id=p.id and a.action='ADJUST_CONFIRMED_BALANCE' order by a.id desc limit 1;
  accepted:=coalesce(accepted,c.source_snapshot);related:=coalesce(accepted->'related','[]');
  d:=(accepted->'source')||(accepted->'proposal');
  if d->>'A' is distinct from p.legacy_folio then raise exception 'SAVINGS_EXACT_IDENTITY_REQUIRED';end if;
 elsif p.import_batch_id is not null then raise exception 'SAVINGS_CERTIFICATION_REQUIRED';
 end if;
 if exists(select 1 from public.savings_transactions where participant_id=p.id and (data_classification<>'CANONICAL' or effective_date>today)) then
  raise exception 'SAVINGS_NONCANONICAL_MOVEMENTS' using errcode='55000';
 end if;
 select * into e from public.savings_enrollments where participant_id=p.id and data_classification='CANONICAL'
  order by sequence_number desc limit 1;
 -- A future authorized cessation stops deductions only on its effective date.
 -- Keep stored history intact and derive today's state for every user action.
 effective_status:=case when (e.terminated_at at time zone 'America/Hermosillo')::date<=today then 'TERMINATED'
  when e.status='TERMINATED' and (e.terminated_at at time zone 'America/Hermosillo')::date>today then 'ACTIVE' else e.status end;
 select * into plan from public.savings_contribution_plans where enrollment_id=e.id and data_classification='CANONICAL'
  and effective_from<=today and (effective_to is null or effective_to>=today) order by effective_from desc limit 1;
 -- Before the first debit the accepted initial plan is still the person's plan.
 if plan.id is null and effective_status='ACTIVE' then
  select * into plan from public.savings_contribution_plans where enrollment_id=e.id and data_classification='CANONICAL'
   and effective_from>today order by effective_from limit 1;
 end if;
 select to_jsonb(b)||jsonb_build_object('yield',b.yield_amount,'canonical',true,'total_source','CERTIFIED_SAVINGS_TRANSACTIONS')
  into bal from public.savings_participant_balance(p.id)b;
 if (bal->>'capital')::numeric<0 or (bal->>'yield_amount')::numeric<0 then raise exception 'SAVINGS_NEGATIVE_COMPONENT';end if;

 -- Closed source summaries retain their exact period. September receipts never
 -- appear under the old June subtotal. Opening credits are excluded throughout.
 with corrections as (
  select sum(coalesce(public.savings_panel_number(d->(f->>'key')),0)-coalesce(public.savings_panel_number(accepted->'source'->(f->>'key')),0)) amount
  from jsonb_array_elements(coalesce(r.field_defs,'[]'))f
  where f->>'label' ~ '^\d{4}-\d{2}-\d{2}' and f->>'label' like '%Descuento registrado%'
   and left(f->>'label',10)::date between '2026-01-30'::date and '2026-06-30'::date
 ), historical as (
  select 2025 as period_year,2 semester,'2025'::text as year,'2025'::text label,'Subtotal hasta 2025'::text subtotal_label,
   public.savings_panel_number(d->'DP') capital,public.savings_panel_number(d->'DQ') yield_amount,true closed
  union all select 2026,1,'2026','2026 - Enero a junio','Subtotal a junio 2026',
   public.savings_panel_number(d->'DS')+coalesce((select amount from corrections),0),public.savings_panel_number(d->'DT'),true
 ), subsequent_history as (
  select left(f->>'label',10)::date as day,public.savings_panel_number(d->(f->>'key')) amount
  from jsonb_array_elements(coalesce(r.field_defs,'[]'))f where f->>'label' ~ '^\d{4}-\d{2}-\d{2}'
   and f->>'label' like '%Descuento registrado%' and left(f->>'label',10)::date>'2026-06-30'::date
   and public.savings_panel_number(d->(f->>'key')) is not null
 ), new_money as (
  select extract(year from day)::int period_year,case when extract(month from day)<=6 then 1 else 2 end semester,sum(amount) capital
  from (
   select day,amount from subsequent_history
   union all
   select contribution_date,case direction when 'CREDIT' then amount else -amount end from public.savings_transactions
    where participant_id=p.id and data_classification='CANONICAL' and component='CAPITAL' and contribution_date is not null
     and effective_date<=today and (c.id is null or contribution_date>c.cutoff_on)
  ) q group by 1,2
 ), yields as (
  select yp.period_year,yp.semester,a.approved_amount amount,yp.productive_enabled and a.status in ('CREDITED','EXCLUDED') closed
  from public.savings_yield_allocations a join public.savings_yield_periods yp on yp.id=a.yield_period_id
  where a.participant_id=p.id and a.status in ('CREDITED','EXCLUDED')
   and (p.historical_yield_reconciled_through is null or yp.starts_on>p.historical_yield_reconciled_through)
 ), subsequent as (
  select coalesce(n.period_year,y.period_year) period_year,coalesce(n.semester,y.semester) semester,
   coalesce(n.capital,0) capital,y.amount yield_amount,coalesce(y.closed,false) closed
  from new_money n full join yields y using(period_year,semester)
 ), periods as (
  select * from historical where capital is not null or yield_amount is not null
  union all
  select period_year,semester,period_year::text||'-S'||semester,
   period_year::text||case semester when 1 then ' - Enero a junio' else ' - Julio a diciembre' end,
   'Subtotal registrado',capital,yield_amount,closed from subsequent
 ) select coalesce(jsonb_agg(jsonb_build_object('year',year,'label',label,'subtotal_label',subtotal_label,'closed',closed,
   'capital',capital,'yield',yield_amount,'period_state',case when closed then 'CLOSED' else 'RECORDED' end)
   order by period_year desc,semester desc),'[]') into annual from periods;

 with recorded as (
  select r.id::text||':'||(f->>'key') id,left(f->>'label',10)::date effective_date,
   public.savings_panel_number(d->(f->>'key')) amount,'HISTORICAL_RECORDED'::text source,
   case when f->>'key'='AR' then 'CONTRIBUTION_WITH_INCLUDED_YIELD' else 'CONTRIBUTION' end transaction_type
  from jsonb_array_elements(coalesce(r.field_defs,'[]'))f where f->>'label' ~ '^\d{4}-\d{2}-\d{2}'
   and f->>'label' like '%Descuento registrado%' and public.savings_panel_number(d->(f->>'key'))>0
  union all
  select o.id::text,o.contribution_date,o.actual_amount,'CONFIRMED_RECEIPT','CONTRIBUTION' from (
   select distinct on(enrollment_id,contribution_date) o.* from public.savings_contribution_overrides o
   join public.savings_enrollments en on en.id=o.enrollment_id where en.participant_id=p.id
   and (c.id is null or o.contribution_date>c.cutoff_on) and o.contribution_date<=today
   order by enrollment_id,contribution_date,version_number desc
  )o
 ) select coalesce(jsonb_agg(to_jsonb(v) order by effective_date desc,id),'[]') into hist from recorded v;
 with w as (
  select q.id::text id,public.savings_panel_date(v.d->>'D') effective_date,
   public.savings_panel_number(v.d->'G') amount,v.d->>'E' withdrawal_kind,
   v.d->>'F' continue_saving,v.d->>'H' status,'HISTORICAL_RECORDED'::text source
  from public.savings_review_records q join jsonb_array_elements(related) a on a->>'id'=q.id::text
  cross join lateral(select (a->'source')||(a->'proposal') d)v
  where q.source_sheet='Solicitud de retiro' and q.source_folio=p.legacy_folio and v.d->>'A'=p.legacy_folio
  union all
  select q.id::text,(q.settled_at at time zone 'America/Hermosillo')::date,q.requested_amount,q.withdrawal_kind,q.continue_saving::text,q.status,'CANONICAL'
  from public.savings_requests q where q.participant_id=p.id and q.data_classification='CANONICAL' and q.status='SETTLED'
   and q.request_type in ('WITHDRAW','EXTRAORDINARY_WITHDRAWAL','TERMINATE')
 ) select coalesce(jsonb_agg(to_jsonb(w) order by effective_date desc,id),'[]') into withdrawals from w;
 select coalesce(jsonb_agg(jsonb_build_object('contribution_date',s.contribution_date,'expected_amount',s.expected_amount,
  'process_snapshot',s.process_snapshot,'source','DATED_SAVINGS_PLAN')||savings_automatic_private.scheduled(e.id,s.contribution_date) order by s.contribution_date),'[]') into upcoming
  from public.generate_savings_schedule(e.id,today+1,(today+interval '12 months')::date)s where effective_status in ('ACTIVE','TERMINATION_PENDING');
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'folio',q.folio,'request_type',q.request_type,'withdrawal_kind',q.withdrawal_kind,
  'requested_amount',q.requested_amount,'new_contribution_amount',q.new_contribution_amount,'continue_saving',q.continue_saving,
  'status',q.status,'effective_from',q.effective_from,'submitted_at',q.submitted_at,'settled_at',q.settled_at) order by q.submitted_at desc),'[]') into requests
  from public.savings_requests q where q.participant_id=p.id and q.data_classification='CANONICAL';
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'effective_date',public.savings_panel_date(v.d->>'B'),
  'old_amount',public.savings_panel_number(v.d->'C'),'new_amount',public.savings_panel_number(v.d->'D'),
  'applied',v.d->>'E','source','HISTORICAL_RECORDED') order by q.source_row desc),'[]') into changes
  from public.savings_review_records q join jsonb_array_elements(related) a on a->>'id'=q.id::text
  cross join lateral(select (a->'source')||(a->'proposal') d)v
  where q.source_sheet='Solicitud Cambio ahorro' and q.source_folio=p.legacy_folio and v.d->>'A'=p.legacy_folio;
 select jsonb_build_object('event_id',ev.id,'previous_amount',ev.conversion_snapshot->'previous_amount','new_amount',ev.conversion_snapshot->'new_amount',
  'effective_from',ev.effective_from,'first_discount_on',ev.conversion_snapshot->'first_discount_on',
  'status',case when ev.effective_from>today then 'SCHEDULED' else 'ACTIVE' end) into transition
 from public.savings_process_change_events ev where ev.participant_id=p.id and ev.status='APPLIED'
  and ev.conversion_snapshot->>'enrollment_id'=e.id::text and ev.conversion_snapshot->>'conversion_rule'='TWO_FORTNIGHTS_TO_ONE_MONTH'
  and (ev.effective_from>today or plan.id::text=ev.conversion_snapshot->>'new_plan_id') order by ev.effective_from desc,ev.reviewed_at desc limit 1;
 select mode='PUBLISHED' into published from public.savings_publication_state where id;
 actions:=jsonb_build_object('JOIN',(e.id is null or effective_status='TERMINATED') and public.savings_effective_action('JOIN',p.id),'CHANGE_AMOUNT',coalesce(effective_status='ACTIVE',false) and public.savings_effective_action('CHANGE_AMOUNT',p.id),
  'WITHDRAW',coalesce((bal->>'available')::numeric>0,false) and public.savings_effective_action('WITHDRAW',p.id),
  'TERMINATE',coalesce(effective_status='ACTIVE',false));
 return jsonb_build_object('schema_version','SAVINGS_CERTIFIED_SELF_V1','authority','SUPABASE','projection','CERTIFIED_OPERATION',
  'cutover_status',case when published then 'PUBLISHED' else 'PRIVATE_PREVIEW' end,'canonical_ledger_used',true,'yield_calculated',false,
  'participant',jsonb_build_object('id',p.id,'legacy_folio',p.legacy_folio,'identity_status',p.identity_status,'participant_type',p.participant_type,'current_process',p.current_process),
  'enrollment',case when e.id is null then null else jsonb_build_object('id',e.id,'status',case effective_status when 'ACTIVE' then 'Ahorrando' when 'TERMINATED' then 'Dejó de ahorrar' else 'En revisión' end,
   'enrollment_started_at',e.first_actual_contribution_date,'plan_started_at',(e.enrollment_started_at at time zone 'America/Hermosillo')::date,
   'current_contribution_amount',plan.amount,'frequency',case when plan.process_snapshot='JUB' then 'MONTHLY' when plan.process_snapshot in ('PROCESS_1','PROCESS_3') then 'TWICE_MONTHLY' end) end,
  'balances',bal,'annual',annual,'history',hist,'upcoming',upcoming,'withdrawals',withdrawals,'requests',requests,'plan_changes',changes,'retirement_transition',transition,
  'beneficiaries',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'full_name',b.full_name,'relationship',b.relationship,'percentage',b.percentage) order by b.id)
   from public.savings_beneficiary_versions v join public.savings_beneficiaries b on b.version_id=v.id where v.participant_id=p.id and v.status='ACTIVE'),'[]'),
  'actions',actions,'write_capabilities',jsonb_build_object('requests',published,'beneficiaries',published and coalesce(effective_status in ('ACTIVE','TERMINATION_PENDING'),false)));
end $function$
;
CREATE OR REPLACE FUNCTION savings_period_private.operation_before(p_command jsonb, p_client_action_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare k text:=p_command->>'kind'; r public.savings_requests%rowtype; prior public.savings_audit_events%rowtype;
 en public.savings_enrollments%rowtype; plan public.savings_contribution_plans%rowtype; af uuid; result jsonb; before_row jsonb;
 decision text:=upper(p_command->>'decision'); note text:=coalesce(p_command->>'observation',''); proc text; calculated date; effective date; participant uuid;
 bal record; capital numeric; yield_value numeric; component text; amount numeric;
begin
 if auth.uid() is null or not public.has_admin_permission(case when k='SUBMIT' then 'savings.write' else 'savings.approve' end) then raise exception 'SAVINGS_APPROVE_DENIED' using errcode='42501'; end if;
 if p_client_action_id is null or p_command is null or jsonb_typeof(p_command)<>'object' or k is null or k not in ('SUBMIT','REVIEW','SETTLE','CANCEL') or length(note)>1000 then raise exception 'SAVINGS_COMMAND_INVALID'; end if;
 if k='SUBMIT' then
  select id into af from public.affiliates where numero_control=p_command->>'folio' and not coalesce(is_archived,false);
  if af is null or (select count(*) from public.affiliates where numero_control=p_command->>'folio')<>1 then raise exception 'SAVINGS_EXACT_IDENTITY_REQUIRED'; end if;
  return public.savings_runtime_submit(af,p_command,p_client_action_id,true);
 end if;
 perform pg_advisory_xact_lock(hashtextextended('savings-runtime:'||p_client_action_id,0));
 select * into prior from public.savings_audit_events where client_action_id=p_client_action_id;
 if found then
  if prior.actor_real_auth_user_id<>auth.uid() or prior.resource<>'savings_runtime' or prior.after_data->'command' is distinct from p_command then raise exception 'SAVINGS_IDEMPOTENCY_CONFLICT'; end if;
  return prior.after_data->'result';
 end if;
 select participant_id into participant from public.savings_requests where id=(p_command->>'request_id')::uuid;
 af:=public.savings_runtime_assert_identity(participant);
 select * into r from public.savings_requests where id=(p_command->>'request_id')::uuid for update;
 if r.id is null or r.data_classification<>'CANONICAL' or r.metadata->>'origin'<>'SAVINGS_RUNTIME_V1' then raise exception 'SAVINGS_OPERATIONAL_REQUEST_REQUIRED'; end if;
 if not exists(select 1 from public.savings_participants where id=r.participant_id and data_classification='CANONICAL' and certification_status='CERTIFIED') then raise exception 'SAVINGS_OPENING_CONFIRMATION_REQUIRED'; end if;
 before_row:=to_jsonb(r);
 select * into en from public.savings_enrollments where id=r.enrollment_id for update;
 if k='CANCEL' then
  if r.status not in ('SUBMITTED','UNDER_REVIEW') and not (r.status='APPROVED' and r.request_type in ('WITHDRAW','EXTRAORDINARY_WITHDRAWAL')) then raise exception 'SAVINGS_REQUEST_NOT_CANCELABLE'; end if;
  update public.savings_requests set status='CANCELLED',metadata=metadata||jsonb_build_object('cancellation',p_command,'cancelled_at',clock_timestamp()) where id=r.id returning * into r;
 elsif k='REVIEW' then
  if decision is null or decision not in ('APPROVE','REJECT') or r.status not in ('SUBMITTED','UNDER_REVIEW') then raise exception 'SAVINGS_REQUEST_NOT_REVIEWABLE'; end if;
  if decision='REJECT' and length(btrim(note))<3 then raise exception 'SAVINGS_REJECTION_REASON_REQUIRED'; end if;
  if decision='APPROVE' then
   if r.request_type='EXTRAORDINARY_WITHDRAWAL' then raise exception 'SAVINGS_DUAL_APPROVAL_REQUIRED' using errcode='42501'; end if;
   if r.request_type in ('JOIN','CHANGE_AMOUNT') then
    proc:=coalesce(nullif(p_command->>'process',''),r.metadata->>'process');
    calculated:=case when r.request_type='JOIN' then public.savings_next_contribution_date((r.submitted_at at time zone 'America/Hermosillo')::date+30,proc)
     else public.savings_next_enrollment_date(en.id,(r.submitted_at at time zone 'America/Hermosillo')::date+30) end;
    effective:=coalesce(nullif(p_command->>'effective_date','')::date,calculated);
    if effective<=public.savings_operation_today() or (r.request_type='JOIN' and public.savings_next_contribution_date(effective,proc)<>effective)
     or (r.request_type='CHANGE_AMOUNT' and public.savings_next_enrollment_date(en.id,effective)<>effective) then raise exception 'SAVINGS_AUTHORIZED_DATE_INVALID'; end if;
    if effective<>calculated and length(btrim(note))<3 then raise exception 'SAVINGS_DATE_EXCEPTION_REASON_REQUIRED'; end if;
    if r.request_type='JOIN' then
     if exists(select 1 from public.savings_enrollments where participant_id=r.participant_id and (status in ('REQUESTED','ACTIVE','TERMINATION_PENDING') or terminated_at>clock_timestamp())) then raise exception 'SAVINGS_ENROLLMENT_ALREADY_OPEN'; end if;
     select * into en from public.savings_activate_join(r.id,proc,effective);
    else
     if not (en.status='ACTIVE' and (en.terminated_at is null or (en.terminated_at at time zone 'America/Hermosillo')::date>public.savings_operation_today()) or en.status in ('TERMINATED','TERMINATION_PENDING') and (en.terminated_at at time zone 'America/Hermosillo')::date>public.savings_operation_today()) then raise exception 'SAVINGS_ACTIVE_ENROLLMENT_REQUIRED'; end if;
     perform 1 from public.savings_contribution_plans where enrollment_id=en.id for update;
     if exists(select 1 from public.savings_contribution_plans where enrollment_id=en.id and effective_from>=effective)
      or exists(select 1 from public.savings_contribution_overrides where enrollment_id=en.id and contribution_date>=effective)
      or exists(select 1 from public.savings_transactions where enrollment_id=en.id and coalesce(contribution_date,effective_date)>=effective) then raise exception 'SAVINGS_FUTURE_PLAN_CONFLICT'; end if;
     select * into plan from public.savings_contribution_plans where enrollment_id=en.id and effective_from<effective and (effective_to is null or effective_to>=effective) order by effective_from desc limit 1;
     if plan.id is null or plan.data_classification<>'CANONICAL' then raise exception 'SAVINGS_ACTIVE_PLAN_REQUIRED'; end if;
     proc:=plan.process_snapshot;
     update public.savings_contribution_plans set effective_to=effective-1 where id=plan.id;
    end if;
    if r.request_type='CHANGE_AMOUNT' then
    insert into public.savings_contribution_plans(enrollment_id,amount,process_snapshot,effective_from,effective_to,source_request_id,data_classification,created_by_auth_user_id)
     values(en.id,r.new_contribution_amount,proc,effective,case when r.request_type='CHANGE_AMOUNT' then plan.effective_to end,r.id,'CANONICAL',auth.uid());
    end if;
   elsif r.request_type='TERMINATE' then
    effective:=coalesce(nullif(p_command->>'effective_date','')::date,public.savings_operation_today()+1);
    if effective<=public.savings_operation_today() then raise exception 'SAVINGS_AUTHORIZED_DATE_INVALID'; end if;
    if effective<>public.savings_operation_today()+1 and length(btrim(note))<3 then raise exception 'SAVINGS_DATE_EXCEPTION_REASON_REQUIRED'; end if;
    if exists(select 1 from public.savings_contribution_plans where enrollment_id=en.id and effective_from>=effective)
     or exists(select 1 from public.savings_contribution_overrides where enrollment_id=en.id and contribution_date>=effective) then raise exception 'SAVINGS_FUTURE_PLAN_CONFLICT'; end if;
    update public.savings_enrollments set status='TERMINATED',continue_saving=false,terminated_at=effective::timestamp at time zone 'America/Hermosillo' where id=en.id;
   elsif r.request_type='WITHDRAW' then
    select * into bal from public.savings_participant_balance(r.participant_id);
    if r.requested_amount>bal.available then raise exception 'SAVINGS_AVAILABLE_BALANCE_EXCEEDED'; end if;
   end if;
  end if;
  update public.savings_requests set status=case when decision='REJECT' then 'REJECTED' else 'APPROVED' end,reviewed_at=clock_timestamp(),reviewed_by_auth_user_id=auth.uid(),
   enrollment_id=coalesce(en.id,enrollment_id),effective_from=coalesce(effective,effective_from),metadata=metadata||jsonb_build_object('review',p_command,'calculated_date',calculated,'authorized_date',effective)
   where id=r.id returning * into r;
 else
  if r.status<>'APPROVED' or r.request_type not in ('WITHDRAW','EXTRAORDINARY_WITHDRAWAL') then raise exception 'SAVINGS_REQUEST_NOT_SETTLEABLE'; end if;
  if not public.savings_effective_action('WITHDRAW',r.participant_id) then raise exception 'SAVINGS_ACTION_DISABLED' using errcode='42501'; end if;
  -- Participant/enrollment are already locked. Do not invert receipt config->participant lock order.
  -- Independent job must finish first; never hide an unpaid due contribution by terminating.
  if r.continue_saving=false and exists(select 1 from savings_automatic_private.due(r.participant_id,false)) then
   raise exception 'SAVINGS_SCHEDULED_RECEIPTS_PENDING' using hint='Las aportaciones vencidas se están aplicando; actualice el saldo antes de volver a solicitar o liquidar el retiro total.';
  end if;
  if jsonb_typeof(p_command->'capital') is distinct from 'number' or jsonb_typeof(p_command->'yield') is distinct from 'number' then raise exception 'SAVINGS_SETTLEMENT_INVALID'; end if;
  capital:=(p_command->>'capital')::numeric;yield_value:=(p_command->>'yield')::numeric;
  if capital<0 or yield_value<0 or capital<>round(capital,2) or yield_value<>round(yield_value,2) or capital+yield_value<>r.requested_amount then raise exception 'SAVINGS_SETTLEMENT_BREAKDOWN_MISMATCH'; end if;
  select * into bal from public.savings_participant_balance(r.participant_id);
  if capital>greatest(bal.capital-bal.held_capital,0) or yield_value>greatest(bal.yield_amount-bal.held_yield,0) then raise exception 'SAVINGS_AVAILABLE_BALANCE_EXCEEDED'; end if;
  if r.request_type='EXTRAORDINARY_WITHDRAWAL' and yield_value<>0 then raise exception 'SAVINGS_EXTRAORDINARY_CAPITAL_ONLY'; end if;
  if r.continue_saving=false and capital+yield_value<>bal.available then raise exception 'SAVINGS_TOTAL_WITHDRAWAL_AMOUNT_MISMATCH'; end if;
  perform public.savings_runtime_assert_payout(r.participant_id);
  foreach component in array array['CAPITAL','YIELD'] loop
   amount:=case when component='CAPITAL' then capital else yield_value end;
   if amount>0 then insert into public.savings_transactions(participant_id,enrollment_id,transaction_type,component,direction,amount,effective_date,idempotency_key,data_classification,created_by_auth_user_id)
    values(r.participant_id,r.enrollment_id,'WITHDRAWAL',component,'DEBIT',amount,public.savings_operation_today(),'SAVINGS_RUNTIME_PAYMENT:'||r.id||':'||component,'CANONICAL',auth.uid()); end if;
  end loop;
  update public.savings_requests set status='SETTLED',settled_at=clock_timestamp(),requested_capital_amount=capital,requested_yield_amount=yield_value where id=r.id returning * into r;
  if r.continue_saving=false then update public.savings_enrollments set status='TERMINATED',continue_saving=false,terminated_at=(public.savings_operation_today()+1)::timestamp at time zone 'America/Hermosillo' where id=r.enrollment_id; end if;
 end if;
 result:=to_jsonb(r);
 insert into public.savings_audit_events(actor_real_auth_user_id,usuario_contexto_affiliate_id,participant_id,resource,action,target_id,before_data,after_data,reason,client_action_id)
 values(auth.uid(),af,r.participant_id,'savings_runtime',case when k='REVIEW' then decision else k end,r.id::text,before_row,jsonb_build_object('command',p_command,'result',result),note,p_client_action_id);
 return result;
end $function$
;

revoke all on all functions in schema savings_automatic_private from public,anon,authenticated,service_role;
revoke all on all sequences in schema savings_automatic_private from public,anon,authenticated,service_role;
revoke all on function public.admin_configure_savings_automatic_contributions(boolean,date,text,uuid),public.admin_set_savings_scheduled_contribution(uuid,uuid,date,numeric,integer,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.admin_configure_savings_automatic_contributions(boolean,date,text,uuid),public.admin_set_savings_scheduled_contribution(uuid,uuid,date,numeric,integer,text,uuid) to authenticated;
update savings_automatic_private.function_backup set installed_md5=md5(pg_get_functiondef(to_regprocedure(signature)));
select cron.schedule('savings-automatic-contributions','*/5 * * * *','select savings_automatic_private.run_due()');
commit;
