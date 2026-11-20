begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
-- Recovery for 20261120000100_affiliate_loan_dossier_access (H-AFFILIATE-EXPEDIENTE-MODAL-001).
-- Restores the exact production get_admin_affiliate_workbench of 2026-11-20 (md5 30aaa263327efe2069b1350a063e8a1b) and
-- removes the three-person list. No business row is touched. Run together with a frontend revert of the release commit.
CREATE OR REPLACE FUNCTION public.get_admin_affiliate_workbench(p_affiliate_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_profile jsonb;v_options jsonb;v_documents jsonb;v_requests jsonb;v_audit jsonb;
  v_can_documents boolean;v_can_requests boolean;
begin
  if not public.has_admin_permission('affiliates.read') then raise exception 'AFFILIATE_READ_DENIED' using errcode='42501'; end if;
  v_can_documents:=document_retirement_private.authorized() or public.has_admin_permission('documents.read') or public.has_admin_permission('assets.read');
  v_can_requests:=public.has_admin_permission('program_requests.read');
  select (to_jsonb(a)-array['auth_user_id','historical_email_normalized','source_file_hash','source_row_ordinal','financial_profile_updated_by','financial_profile_seed_source_hash','financial_profile_seed_row_ordinal']::text[])
    || jsonb_build_object('auth_linked',a.auth_user_id is not null)
  into v_profile from public.affiliates a where a.id=p_affiliate_id;
  if v_profile is null then raise exception 'AFFILIATE_NOT_FOUND' using errcode='P0001'; end if;
  select coalesce(jsonb_object_agg(catalog_type,items),'{}'::jsonb) into v_options from (
    select catalog_type,jsonb_agg(jsonb_build_object('code',code,'label',label) order by sort_order,label) items
    from public.segmentation_catalog_entries where enabled and catalog_type in('union','employment_category') group by catalog_type
  ) q;
  if v_can_documents then
    select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'type_id',d.document_type_id,'type_code',t.code,'type_label',t.label,
      'required',t.required_by_default,'status',d.status,'observation',d.review_observation,'created_at',d.created_at,'updated_at',d.updated_at)
      order by d.created_at desc),'[]'::jsonb) into v_documents
    from document_retirement_private.active_documents d join public.document_types t on t.id=d.document_type_id where d.affiliate_id=p_affiliate_id;
  end if;
  if v_can_requests then
    select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'folio',x.folio,'program_id',x.program_id,'request_type',x.request_type,
      'status',x.status,'financial_processing_status',x.financial_processing_status,'created_at',x.created_at,'updated_at',x.updated_at)
      order by x.created_at desc),'[]'::jsonb) into v_requests
    from (select * from public.program_requests where affiliate_id=p_affiliate_id order by created_at desc limit 50) x;
  end if;
  select coalesce(jsonb_agg(event order by event_at desc),'[]'::jsonb) into v_audit from (
    select e.created_at event_at,jsonb_build_object('id',e.event_id,'at',e.created_at,'action',e.action,'reason',e.reason,
      'actor',e.actor_auth_user_id,'changed_fields',e.changed_fields,'before',e.before_values,'after',e.after_values) event
    from public.affiliate_admin_events e where e.affiliate_id=p_affiliate_id
    union all
    select l.changed_at,jsonb_build_object('id',l.id,'at',l.changed_at,'action','PROFILE_FIELD_CHANGE','reason',l.reason,
      'actor',l.changed_by,'changed_fields',array[l.field_name],'before',jsonb_build_object(l.field_name,l.old_value),
      'after',jsonb_build_object(l.field_name,l.new_value))
    from public.affiliate_profile_audit_log l where l.affiliate_id=p_affiliate_id
    union all
    select o.created_at,jsonb_build_object('id',o.id,'at',o.created_at,'action','ADMIN_DOCUMENT_DELETE','reason',o.reason,'actor',o.actor_auth_user_id,'changed_fields',array['documents'],'before',jsonb_build_object('document_id',o.document_id),'after',jsonb_build_object('status',case when o.completed_at is null then 'PENDING_STORAGE' else 'COMPLETE' end)) from document_retirement_private.operations o where o.affiliate_id=p_affiliate_id
  ) q;
  return jsonb_build_object('profile',v_profile,'options',v_options,'documents',v_documents,'requests',v_requests,'audit',v_audit,
    'document_summary',jsonb_build_object('required_count',(select count(*) from public.document_types where enabled and required_by_default),'verified_required_count',(select count(*) from public.document_types t join lateral (select d.* from document_retirement_private.active_documents d where d.affiliate_id=p_affiliate_id and d.document_type_id=t.id order by d.created_at desc,d.id desc limit 1) latest on true left join public.affiliate_files af on af.id=latest.affiliate_file_id join public.private_assets pa on pa.id=coalesce(latest.private_asset_id,af.private_asset_id) and pa.status='READY' where t.enabled and t.required_by_default and latest.status='VERIFIED' and exists(select 1 from storage.objects so where so.bucket_id=pa.storage_bucket and so.name=pa.storage_path))),'empty_document_slots',coalesce((select jsonb_agg(s) from (select distinct d.document_type_id type_id,t.label type_label from document_retirement_private.documents r join public.affiliate_documents d on d.id=r.document_id join public.document_types t on t.id=d.document_type_id where d.affiliate_id=p_affiliate_id and not exists(select 1 from document_retirement_private.active_documents current_doc where current_doc.affiliate_id=p_affiliate_id and current_doc.document_type_id=d.document_type_id)) s),'[]'::jsonb),'pending_document_deletions',case when document_retirement_private.authorized() then coalesce((select jsonb_agg(jsonb_build_object('operation_id',o.id,'document_id',o.document_id,'created_at',o.created_at)) from document_retirement_private.operations o where o.affiliate_id=p_affiliate_id and o.completed_at is null),'[]'::jsonb) else '[]'::jsonb end,'capabilities',jsonb_build_object('documents',v_can_documents,'requests',v_can_requests));
end $function$;
drop function if exists affiliate_loan_dossier_private.allowed();
drop table if exists affiliate_loan_dossier_private.viewers;
drop schema if exists affiliate_loan_dossier_private;
do $post$ begin
 if md5(pg_get_functiondef('public.get_admin_affiliate_workbench(uuid)'::regprocedure)) is distinct from '30aaa263327efe2069b1350a063e8a1b' then raise exception 'AFFILIATE_LOAN_DOSSIER_RECOVERY_POSTCONDITION'; end if;
end $post$;
commit;
