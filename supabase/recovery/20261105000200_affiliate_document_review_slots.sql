begin;
set local lock_timeout='3s';
set local statement_timeout='90s';
lock table public.affiliate_documents,document_retirement_private.documents,document_retirement_private.review_slots in share row exclusive mode;
-- Restore the old invariant only when history already satisfies it. Never alter
-- a retired document's original status or remove history to make recovery pass.
do $preflight$
begin
 if to_regclass('public.affiliate_documents_current_review_idx') is not null then raise exception 'DOCUMENT_REVIEW_RECOVERY_INDEX_DRIFT';end if;

 if md5(pg_get_functiondef(to_regprocedure('document_retirement_private.sync_review_slots()'))) is distinct from 'fde084f6a293ff5d74c0330d2ff622a1'
 then raise exception 'DOCUMENT_REVIEW_RECOVERY_FUNCTION_DRIFT';end if;
 if (select pg_get_triggerdef(oid) from pg_trigger where tgrelid='public.affiliate_documents'::regclass and tgname='affiliate_documents_sync_review_slots') is distinct from
  'CREATE TRIGGER affiliate_documents_sync_review_slots AFTER INSERT OR DELETE OR UPDATE OF id, affiliate_id, document_type_id, status ON public.affiliate_documents FOR EACH ROW EXECUTE FUNCTION document_retirement_private.sync_review_slots(''id'')'
 or (select pg_get_triggerdef(oid) from pg_trigger where tgrelid='document_retirement_private.documents'::regclass and tgname='retirement_documents_sync_review_slots') is distinct from
  'CREATE TRIGGER retirement_documents_sync_review_slots AFTER INSERT OR DELETE OR UPDATE OF document_id ON document_retirement_private.documents FOR EACH ROW EXECUTE FUNCTION document_retirement_private.sync_review_slots(''document_id'')'
 then raise exception 'DOCUMENT_REVIEW_RECOVERY_TRIGGER_DRIFT';end if;
 if (select array_agg(attname::text order by attnum) from pg_attribute where attrelid='document_retirement_private.review_slots'::regclass and attnum>0 and not attisdropped)
 is distinct from array['document_id','affiliate_id','document_type_id']
 or exists(select 1 from pg_attribute where attrelid='document_retirement_private.review_slots'::regclass and attnum>0 and not attisdropped and (atttypid<>'uuid'::regtype or not attnotnull))
 or not exists(select 1 from pg_class where oid='document_retirement_private.review_slots'::regclass and relrowsecurity and relforcerowsecurity)
 or (select count(*) from pg_constraint where conrelid='document_retirement_private.review_slots'::regclass and contype in('p','u','f'))<>5
 or exists(select 1 from pg_constraint where conrelid='document_retirement_private.review_slots'::regclass and contype not in('p','u','f','n'))
 then raise exception 'DOCUMENT_REVIEW_RECOVERY_TABLE_DRIFT';end if;
 if exists(select 1 from public.affiliate_documents where status in('PENDING_REVIEW','UNDER_REVIEW','REUPLOAD_REQUIRED') group by affiliate_id,document_type_id having count(*)>1)
 then raise exception 'DOCUMENT_REVIEW_RECOVERY_BLOCKED_BY_HISTORY';end if;
 if exists(
  (select d.id,d.affiliate_id,d.document_type_id from public.affiliate_documents d where d.status in('PENDING_REVIEW','UNDER_REVIEW','REUPLOAD_REQUIRED') and not exists(select 1 from document_retirement_private.documents r where r.document_id=d.id)
   except select document_id,affiliate_id,document_type_id from document_retirement_private.review_slots)
  union all
  (select document_id,affiliate_id,document_type_id from document_retirement_private.review_slots
   except select d.id,d.affiliate_id,d.document_type_id from public.affiliate_documents d where d.status in('PENDING_REVIEW','UNDER_REVIEW','REUPLOAD_REQUIRED') and not exists(select 1 from document_retirement_private.documents r where r.document_id=d.id))
 ) then raise exception 'DOCUMENT_REVIEW_RECOVERY_SLOT_DRIFT';end if;
end $preflight$;
create temporary table document_review_slots_before on commit drop as
 select 'documents'::text relation,count(*) row_count,md5(coalesce(string_agg(to_jsonb(d)::text,'|' order by d.id),'')) fingerprint from public.affiliate_documents d
 union all
 select 'retirements',count(*),md5(coalesce(string_agg(to_jsonb(r)::text,'|' order by r.document_id),'')) from document_retirement_private.documents r;
CREATE UNIQUE INDEX affiliate_documents_current_review_idx ON public.affiliate_documents USING btree (affiliate_id, document_type_id) WHERE (status = ANY (ARRAY['PENDING_REVIEW'::text, 'UNDER_REVIEW'::text, 'REUPLOAD_REQUIRED'::text]));
drop trigger affiliate_documents_sync_review_slots on public.affiliate_documents;
drop trigger retirement_documents_sync_review_slots on document_retirement_private.documents;
drop function document_retirement_private.sync_review_slots();
drop table document_retirement_private.review_slots;
do $integrity$
begin
 if exists(select * from document_review_slots_before except
  (select 'documents'::text,count(*),md5(coalesce(string_agg(to_jsonb(d)::text,'|' order by d.id),'')) from public.affiliate_documents d
   union all select 'retirements',count(*),md5(coalesce(string_agg(to_jsonb(r)::text,'|' order by r.document_id),'')) from document_retirement_private.documents r))
 then raise exception 'DOCUMENT_REVIEW_RECOVERY_HISTORY_CHANGED';end if;
end $integrity$;
commit;
