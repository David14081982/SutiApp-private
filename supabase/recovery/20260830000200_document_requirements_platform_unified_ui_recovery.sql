begin;

do $$ begin
  if exists(select 1 from public.document_configuration_audit_log) then
    raise exception 'RECOVERY_BLOCKED_DOCUMENT_CONFIGURATION_AUDIT_EXISTS';
  end if;
  if exists(select 1 from public.program_requests where document_requirements_snapshot is not null) then
    raise exception 'RECOVERY_BLOCKED_DOCUMENT_REQUIREMENT_SNAPSHOTS_EXIST';
  end if;
end $$;

drop trigger program_requests_capture_document_requirements on public.program_requests;
drop function public.capture_document_requirements_snapshot();
drop function public.create_program_request_with_documents(uuid,uuid,integer,text,text,boolean,uuid,uuid[]);
drop function public.register_affiliate_document(uuid,text,text,bigint,text,text);
drop function public.save_document_type_configuration(jsonb,text);
drop function public.restore_document_requirement_rule(text,text,uuid,text);
drop function public.save_document_requirement_rule(text,text,uuid,text,boolean,boolean,integer,text);
drop function public.get_document_requirement_impact(text,text);
drop function public.get_document_requirement_configuration(text,text);
drop function public.list_document_requirement_targets();
drop function public.resolve_effective_document_requirements(text,text);
drop function public.assert_document_requirement_scope(text,text);
drop table public.document_configuration_audit_log;

alter table public.program_requests drop constraint program_requests_document_snapshot_check,drop column document_requirements_snapshot;
drop index public.program_document_requirements_scope_order_idx;
drop index public.program_document_requirements_generic_scope_idx;
alter table public.program_document_requirements
  drop constraint program_document_requirements_legacy_membership_check,
  drop constraint program_document_requirements_effect_check,
  drop constraint program_document_requirements_scope_key_check,
  drop constraint program_document_requirements_scope_type_check,
  drop column effect,drop column scope_key,drop column scope_type,
  add constraint program_document_requirements_scope_check check((program_id='membership')=(membership_offering_id is not null)),
  add constraint program_document_requirements_program_id_membership_offerin_key unique(program_id,membership_offering_id,document_type_id);
create unique index program_document_requirements_scope_idx on public.program_document_requirements(program_id,coalesce(membership_offering_id,'00000000-0000-0000-0000-000000000000'::uuid),document_type_id);

alter table public.document_types drop constraint document_types_max_file_check,drop constraint document_types_capture_check,
  drop column max_file_size_bytes,drop column file_upload_allowed,drop column camera_allowed;
grant insert,update,delete on public.document_types,public.program_document_requirements to authenticated;
grant execute on function public.create_program_request(uuid,uuid,integer,text,text,boolean,uuid) to authenticated;
grant execute on function public.register_affiliate_document(uuid,text,text,bigint,text) to authenticated;

commit;
