begin;
set local lock_timeout='3s';
set local statement_timeout='90s';
-- This private table is a derived uniqueness index, never document authority.
-- Canonical documents and retirement history are not rewritten.
lock table public.affiliate_documents,document_retirement_private.documents in share row exclusive mode;
do $preflight$
begin
 if to_regclass('document_retirement_private.review_slots') is not null then
  raise exception 'DOCUMENT_REVIEW_SLOTS_ALREADY_INSTALLED';
 end if;
 if pg_get_indexdef(to_regclass('public.affiliate_documents_current_review_idx')) is distinct from
  'CREATE UNIQUE INDEX affiliate_documents_current_review_idx ON public.affiliate_documents USING btree (affiliate_id, document_type_id) WHERE (status = ANY (ARRAY[''PENDING_REVIEW''::text, ''UNDER_REVIEW''::text, ''REUPLOAD_REQUIRED''::text]))'
 then raise exception 'DOCUMENT_REVIEW_INDEX_BASE_DRIFT';end if;
 if not exists(select 1 from pg_index where indexrelid='public.affiliate_documents_current_review_idx'::regclass and indisunique and indisvalid and indisready) then
  raise exception 'DOCUMENT_REVIEW_INDEX_NOT_VALID';
 end if;
end $preflight$;
create temporary table document_review_slots_before on commit drop as
 select 'documents'::text relation,count(*) row_count,md5(coalesce(string_agg(to_jsonb(d)::text,'|' order by d.id),'')) fingerprint from public.affiliate_documents d
 union all
 select 'retirements',count(*),md5(coalesce(string_agg(to_jsonb(r)::text,'|' order by r.document_id),'')) from document_retirement_private.documents r;
create table document_retirement_private.review_slots(
 document_id uuid primary key references public.affiliate_documents(id) on update cascade on delete cascade,
 affiliate_id uuid not null references public.affiliates(id),
 document_type_id uuid not null references public.document_types(id),
 constraint affiliate_document_active_review_slot_unique unique(affiliate_id,document_type_id)
);
comment on table document_retirement_private.review_slots is 'Derived enforcement index for active pending/review/reupload documents. Rebuild only from affiliate_documents and document_retirement_private.documents; not a source for application reads.';
alter table document_retirement_private.review_slots enable row level security;
alter table document_retirement_private.review_slots force row level security;
revoke all on document_retirement_private.review_slots from public,anon,authenticated,service_role;
insert into document_retirement_private.review_slots(document_id,affiliate_id,document_type_id)
 select d.id,d.affiliate_id,d.document_type_id from public.affiliate_documents d
 where d.status in('PENDING_REVIEW','UNDER_REVIEW','REUPLOAD_REQUIRED')
 and not exists(select 1 from document_retirement_private.documents r where r.document_id=d.id);
create function document_retirement_private.sync_review_slots() returns trigger
language plpgsql security definer set search_path='' as $sync$
declare v_ids uuid[]:='{}';
begin
 -- The caller is a database trigger; no API role may execute this function.
 if tg_op<>'INSERT' then v_ids:=array_append(v_ids,(to_jsonb(old)->>tg_argv[0])::uuid);end if;
 if tg_op<>'DELETE' then v_ids:=array_append(v_ids,(to_jsonb(new)->>tg_argv[0])::uuid);end if;
 -- Serialize retirement changes with document status changes using real row locks.
 perform 1 from public.affiliate_documents d where d.id=any(v_ids) order by d.id for update;
 -- Release obsolete keys before reserving new ones (also handles identity edits).
 delete from document_retirement_private.review_slots s where s.document_id=any(v_ids)
 and not exists(select 1 from public.affiliate_documents d where d.id=s.document_id
  and d.affiliate_id=s.affiliate_id and d.document_type_id=s.document_type_id
  and d.status in('PENDING_REVIEW','UNDER_REVIEW','REUPLOAD_REQUIRED')
  and not exists(select 1 from document_retirement_private.documents r where r.document_id=d.id));
 insert into document_retirement_private.review_slots(document_id,affiliate_id,document_type_id)
 select d.id,d.affiliate_id,d.document_type_id from public.affiliate_documents d where d.id=any(v_ids)
  and d.status in('PENDING_REVIEW','UNDER_REVIEW','REUPLOAD_REQUIRED')
  and not exists(select 1 from document_retirement_private.documents r where r.document_id=d.id)
 on conflict(document_id) do update set affiliate_id=excluded.affiliate_id,document_type_id=excluded.document_type_id;
 return null;
end $sync$;
revoke all on function document_retirement_private.sync_review_slots() from public,anon,authenticated,service_role;
create trigger affiliate_documents_sync_review_slots after insert or delete or update of id,affiliate_id,document_type_id,status
 on public.affiliate_documents for each row execute function document_retirement_private.sync_review_slots('id');
create trigger retirement_documents_sync_review_slots after insert or delete or update of document_id
 on document_retirement_private.documents for each row execute function document_retirement_private.sync_review_slots('document_id');
do $integrity$
begin
 if exists(
  (select d.id,d.affiliate_id,d.document_type_id from public.affiliate_documents d where d.status in('PENDING_REVIEW','UNDER_REVIEW','REUPLOAD_REQUIRED') and not exists(select 1 from document_retirement_private.documents r where r.document_id=d.id)
   except select document_id,affiliate_id,document_type_id from document_retirement_private.review_slots)
  union all
  (select document_id,affiliate_id,document_type_id from document_retirement_private.review_slots
   except select d.id,d.affiliate_id,d.document_type_id from public.affiliate_documents d where d.status in('PENDING_REVIEW','UNDER_REVIEW','REUPLOAD_REQUIRED') and not exists(select 1 from document_retirement_private.documents r where r.document_id=d.id))
 ) then raise exception 'DOCUMENT_REVIEW_SLOT_PARITY_FAILED';end if;
 if exists(select * from document_review_slots_before except
  (select 'documents'::text,count(*),md5(coalesce(string_agg(to_jsonb(d)::text,'|' order by d.id),'')) from public.affiliate_documents d
   union all select 'retirements',count(*),md5(coalesce(string_agg(to_jsonb(r)::text,'|' order by r.document_id),'')) from document_retirement_private.documents r))
 then raise exception 'DOCUMENT_REVIEW_HISTORY_CHANGED';end if;
end $integrity$;
drop index public.affiliate_documents_current_review_idx;
commit;
