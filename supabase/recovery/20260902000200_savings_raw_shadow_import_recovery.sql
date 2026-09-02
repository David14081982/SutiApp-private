begin;

-- Exact recovery for H-SAVINGS-RAW-SHADOW-IMPORT-001 only.
-- Run only if post-import verification fails. It never removes the schema,
-- other Savings batches, affiliates, Google data, or another domain.
do $recovery_guard$
declare
  v_batch uuid;
  v_count integer;
begin
  select count(*),min(id) into v_count,v_batch
  from public.savings_import_batches
  where source_snapshot_sha256='3552A321C0864460A9B202AB0783750166935078C604BFF88DD90B9D9D9275B1';

  if v_count<>1 then
    raise exception 'SAVINGS_RAW_RECOVERY_EXACT_BATCH_REQUIRED:%',v_count using errcode='55000';
  end if;
  if not exists(
    select 1 from public.savings_import_batches
    where id=v_batch and status='APPLIED' and certification_status='CERTIFIED'
      and provenance->>'baseline_manifest_sha256'='3552A321C0864460A9B202AB0783750166935078C604BFF88DD90B9D9D9275B1'
      and provenance->>'destination_authority'='SHADOW_ONLY'
      and coalesce((provenance->>'cutover')::boolean,false)=false
  ) then
    raise exception 'SAVINGS_RAW_RECOVERY_BATCH_PROVENANCE_INVALID' using errcode='55000';
  end if;
  if exists(select 1 from public.savings_transactions where import_batch_id=v_batch)
     or exists(select 1 from public.savings_enrollments where import_batch_id=v_batch)
     or exists(select 1 from public.savings_contribution_plans where import_batch_id=v_batch)
     or exists(select 1 from public.savings_process_change_events where import_batch_id=v_batch) then
    raise exception 'SAVINGS_RAW_RECOVERY_CANONICAL_ROWS_PRESENT' using errcode='55000';
  end if;
end $recovery_guard$;

alter table public.savings_legacy_evidence disable trigger savings_legacy_evidence_append_only;
alter table public.savings_audit_events disable trigger savings_audit_events_append_only;

delete from public.savings_legacy_evidence
where import_batch_id=(select id from public.savings_import_batches where source_snapshot_sha256='3552A321C0864460A9B202AB0783750166935078C604BFF88DD90B9D9D9275B1');

delete from public.savings_audit_events
where resource='savings_import_batches'
  and action='IMPORT_CERTIFIED_SHADOW'
  and target_id=(select id::text from public.savings_import_batches where source_snapshot_sha256='3552A321C0864460A9B202AB0783750166935078C604BFF88DD90B9D9D9275B1');

delete from public.savings_participants
where import_batch_id=(select id from public.savings_import_batches where source_snapshot_sha256='3552A321C0864460A9B202AB0783750166935078C604BFF88DD90B9D9D9275B1');

delete from public.savings_import_batches
where source_snapshot_sha256='3552A321C0864460A9B202AB0783750166935078C604BFF88DD90B9D9D9275B1';

alter table public.savings_legacy_evidence enable trigger savings_legacy_evidence_append_only;
alter table public.savings_audit_events enable trigger savings_audit_events_append_only;

do $recovery_verify$
begin
  if exists(select 1 from public.savings_import_batches where source_snapshot_sha256='3552A321C0864460A9B202AB0783750166935078C604BFF88DD90B9D9D9275B1')
     or exists(select 1 from public.savings_participants where import_batch_id in(select id from public.savings_import_batches where source_snapshot_sha256='3552A321C0864460A9B202AB0783750166935078C604BFF88DD90B9D9D9275B1'))
     or exists(select 1 from public.savings_legacy_evidence where import_batch_id in(select id from public.savings_import_batches where source_snapshot_sha256='3552A321C0864460A9B202AB0783750166935078C604BFF88DD90B9D9D9275B1')) then
    raise exception 'SAVINGS_RAW_RECOVERY_INCOMPLETE' using errcode='55000';
  end if;
end $recovery_verify$;

commit;
