begin;

-- Match the forward migration's transaction-local maintenance context. This
-- does not persist or broaden any application role or policy.
select set_config('request.jwt.claim.role', 'service_role', true);

-- Execute only after reverting the frontend and only when an explicit rollback
-- accepts restoring the retired legacy URL columns. No object or metadata row is deleted.
do $preflight$
begin
  if exists (
    select 1
    from public.institutional_documents d
    where d.source_sheet in ('Normas y Reglamentos', 'Descargas2')
      and (
        d.document_url is not null
        or d.image_url is not null
        or not exists (
          select 1
          from public.asset_sources s
          where s.asset_id = d.document_asset_id
            and s.source_sheet = d.source_sheet
            and s.source_row_ordinal = d.source_row_ordinal
            and s.source_url is not null
        )
        or not exists (
          select 1
          from public.asset_sources s
          where s.asset_id = d.image_asset_id
            and s.source_sheet = d.source_sheet
            and s.source_row_ordinal = d.source_row_ordinal
            and s.source_url is not null
        )
      )
  ) then
    raise exception 'UNION_DOCUMENT_RECOVERY_PRECONDITION_FAILED';
  end if;
  if not exists (
    select 1 from public.institutional_documents
    where source_sheet = 'Descargas2' and source_row_ordinal = 15 and not enabled
  ) then
    raise exception 'UNION_DOCUMENT_RECOVERY_PUBLICATION_STATE_CHANGED';
  end if;
end
$preflight$;

update public.institutional_documents d
set document_url = (
      select s.source_url
      from public.asset_sources s
      where s.asset_id = d.document_asset_id
        and s.source_sheet = d.source_sheet
        and s.source_row_ordinal = d.source_row_ordinal
        and s.source_url is not null
      order by s.created_at, s.id
      limit 1
    ),
    image_url = (
      select s.source_url
      from public.asset_sources s
      where s.asset_id = d.image_asset_id
        and s.source_sheet = d.source_sheet
        and s.source_row_ordinal = d.source_row_ordinal
        and s.source_url is not null
      order by s.created_at, s.id
      limit 1
    ),
    enabled = case
      when d.source_sheet = 'Descargas2' and d.source_row_ordinal = 15 then true
      else d.enabled
    end
where d.source_sheet in ('Normas y Reglamentos', 'Descargas2');

comment on column public.institutional_documents.document_url is null;
comment on column public.institutional_documents.image_url is null;

do $verify$
begin
  if (select count(*) from public.institutional_documents
      where source_sheet in ('Normas y Reglamentos', 'Descargas2')
        and document_url is not null and image_url is not null and enabled) <> 8 then
    raise exception 'UNION_DOCUMENT_RECOVERY_RECONCILIATION_FAILED';
  end if;
end
$verify$;

commit;
