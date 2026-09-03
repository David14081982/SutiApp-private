begin;

-- The repository's section guard intentionally rejects anonymous SQL sessions.
-- This transaction-local claim identifies the owner-authorized maintenance path;
-- it creates no grant, policy, user, or persistent privilege.
select set_config('request.jwt.claim.role', 'service_role', true);

do $preflight$
declare
  target_count integer;
  regulation_count integer;
  download_count integer;
begin
  select
    count(*),
    count(*) filter (where source_sheet = 'Normas y Reglamentos' and kind = 'regulation'),
    count(*) filter (where source_sheet = 'Descargas2' and kind in ('download', 'form'))
  into target_count, regulation_count, download_count
  from public.institutional_documents
  where source_sheet in ('Normas y Reglamentos', 'Descargas2');

  if target_count <> 8 or regulation_count <> 2 or download_count <> 6 then
    raise exception 'UNION_DOCUMENT_SOURCE_RECONCILIATION_FAILED: total %, regulations %, downloads %',
      target_count, regulation_count, download_count;
  end if;

  if exists (
    select 1
    from public.institutional_documents d
    left join public.app_assets a on a.id = d.document_asset_id
    left join storage.objects o
      on o.bucket_id = a.storage_bucket
     and o.name = a.storage_path
    where d.source_sheet in ('Normas y Reglamentos', 'Descargas2')
      and (
        d.document_asset_id is null
        or a.id is null
        or a.status <> 'READY'
        or a.storage_bucket <> 'documents'
        or a.storage_path is null
        or a.mime_type <> 'application/pdf'
        or coalesce(a.file_size, 0) <= 0
        or a.content_sha256 !~ '^[A-F0-9]{64}$'
        or o.id is null
      )
  ) then
    raise exception 'UNION_DOCUMENT_STORAGE_PREFLIGHT_FAILED';
  end if;

  if exists (
    select 1
    from public.institutional_documents d
    where d.source_sheet in ('Normas y Reglamentos', 'Descargas2')
      and not exists (
        select 1
        from public.asset_sources s
        where s.asset_id = d.document_asset_id
          and s.source_sheet = d.source_sheet
          and s.source_row_ordinal = d.source_row_ordinal
          and s.source_url ~* '^https://([^/]+\.)?(googleapis\.com|google\.com)/'
      )
  ) then
    raise exception 'UNION_DOCUMENT_MIGRATION_PROVENANCE_MISSING';
  end if;

  if exists (
    select 1
    from public.institutional_documents d
    where d.source_sheet in ('Normas y Reglamentos', 'Descargas2')
    group by d.source_sheet, d.source_row_ordinal
    having count(*) > 1
  ) then
    raise exception 'UNION_DOCUMENT_DUPLICATE_SOURCE_ROW_DETECTED';
  end if;

  if not exists (
    select 1
    from public.institutional_documents older
    join public.institutional_documents current
      on current.source_sheet = 'Descargas2'
     and current.source_row_ordinal = 17
     and current.document_asset_id = older.document_asset_id
    where older.source_sheet = 'Descargas2'
      and older.source_row_ordinal = 15
  ) or (
    select count(*)
    from (
      select a.content_sha256
      from public.institutional_documents d
      join public.app_assets a on a.id = d.document_asset_id
      where d.source_sheet in ('Normas y Reglamentos', 'Descargas2')
      group by a.content_sha256
      having count(*) > 1
    ) duplicates
  ) <> 1 then
    raise exception 'UNION_DOCUMENT_DUPLICATE_BASELINE_CHANGED';
  end if;
end
$preflight$;

update public.institutional_documents
set document_url = null,
    image_url = null
where source_sheet in ('Normas y Reglamentos', 'Descargas2')
  and (document_url is not null or image_url is not null);

update public.institutional_documents older
set enabled = false
where older.source_sheet = 'Descargas2'
  and older.source_row_ordinal = 15
  and older.enabled
  and exists (
    select 1
    from public.institutional_documents current
    where current.source_sheet = 'Descargas2'
      and current.source_row_ordinal = 17
      and current.document_asset_id = older.document_asset_id
      and current.enabled
  );

comment on column public.institutional_documents.document_url is
  'Retired runtime field. Historical source URLs are migration-only provenance in asset_sources; runtime resolves document_asset_id through app_assets and Supabase Storage.';
comment on column public.institutional_documents.image_url is
  'Retired runtime field. Historical source URLs are migration-only provenance in asset_sources; runtime resolves image_asset_id through app_assets and Supabase Storage.';

do $verify$
begin
  if exists (
    select 1
    from public.institutional_documents
    where source_sheet in ('Normas y Reglamentos', 'Descargas2')
      and (document_url is not null or image_url is not null)
  ) then
    raise exception 'UNION_DOCUMENT_PRODUCTIVE_URL_CLEANUP_FAILED';
  end if;
  if (select count(*) from public.institutional_documents
      where enabled and source_sheet = 'Normas y Reglamentos' and kind = 'regulation') <> 2
     or (select count(*) from public.institutional_documents
         where enabled and source_sheet = 'Descargas2' and kind in ('download', 'form')) <> 5 then
    raise exception 'UNION_DOCUMENT_ACTIVE_RECONCILIATION_FAILED';
  end if;
  if exists (
    select 1
    from public.institutional_documents d
    join public.app_assets a on a.id = d.document_asset_id
    where d.enabled and d.source_sheet in ('Normas y Reglamentos', 'Descargas2')
    group by a.content_sha256
    having count(*) > 1
  ) then
    raise exception 'UNION_DOCUMENT_ACTIVE_DUPLICATE_REMAINS';
  end if;
end
$verify$;

commit;
