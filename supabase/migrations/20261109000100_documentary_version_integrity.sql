-- Owner-authorized documentary release. Financial expressions and Google remain unchanged.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='120s';
DO $$BEGIN IF current_setting('document.release_authorized',true) IS DISTINCT FROM 'DOCUMENT_V1' THEN RAISE EXCEPTION 'DOCUMENT_RELEASE_AUTHORIZATION_REQUIRED';END IF;END$$;
-- Source: 20261108000100_verified_operations.sql SHA-256 29ce5bf2cf2330f45184ede60db18a843af440e5b4f4bf8d4c3ec119f0e3d768
do $$begin if current_setting('document.release_authorized',true) is distinct from 'DOCUMENT_V1' then raise exception 'DOCUMENT_RELEASE_AUTHORIZATION_REQUIRED';end if;end$$;
-- Promoted from approved isolated contract; explicit release gate below.
do $$begin if not exists(select 1 from pg_roles where rolname='document_lab_worker') then create role document_lab_worker nologin;elsif exists(select 1 from pg_roles where rolname='document_lab_worker' and (rolcanlogin or rolbypassrls or rolsuper)) then raise exception 'INTEGRITY_WORKER_ROLE_UNSAFE';end if;end$$;
create schema document_lab_integrity;
revoke all on schema document_lab_integrity from public,anon,authenticated,service_role;
grant usage on schema document_lab_integrity to document_lab_worker;

create table document_lab_integrity.assets (
 id uuid primary key, affiliate_id uuid not null, bucket text not null check(bucket='lab-private'),
 path text not null unique, sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 size bigint not null check(size>0 and size<=10485760), mime text not null,
 state text not null default 'AVAILABLE' check(state in ('AVAILABLE','QUARANTINE_PENDING','QUARANTINED','INTEGRITY_ERROR')),
 inventory_complete boolean not null default false, retained_until timestamptz,
 created_at timestamptz not null default clock_timestamp()
);
create table document_lab_integrity.operations (
 id uuid primary key, actor_id uuid not null, affiliate_id uuid not null,
 kind text not null check(kind in ('UPLOAD','QUARANTINE')), asset_id uuid,
 source text not null, destination text, sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 size bigint not null check(size>0 and size<=10485760), mime text not null,
 arguments_hash text not null check(arguments_hash ~ '^[a-f0-9]{64}$'),
 state text not null default 'PREPARED' check(state in ('PREPARED','RUNNING','COMPLETE','RETRY','INTEGRITY_ERROR','HELD')),
 fence bigint not null default 0, attempts integer not null default 0,
 receipt jsonb, last_error text, created_at timestamptz not null default clock_timestamp(), completed_at timestamptz,
 check ((kind='UPLOAD' and destination is null) or (kind='QUARANTINE' and asset_id is not null and destination is not null and destination<>source)),
 check (state<>'COMPLETE' or coalesce((completed_at is not null and receipt is not null
   and receipt->>'sha256'=sha256 and (receipt->>'size')::bigint=size
   and receipt->>'verified'='true'
   and (kind<>'QUARANTINE' or receipt->>'source_absent'='true')),false))
);
create table document_lab_integrity.events (
 id bigint generated always as identity primary key, operation_id uuid not null references document_lab_integrity.operations(id),
 fence bigint not null, event text not null, detail jsonb not null default '{}', happened_at timestamptz not null default clock_timestamp()
);
-- Preparatory retention boundary, not the phase-2 evidence authority.
-- Inventory is explicitly UNKNOWN until all legacy/archive adapters are certified.
create table document_lab_integrity.holds (
 asset_id uuid not null references document_lab_integrity.assets(id), context text not null,
 primary key(asset_id,context), created_at timestamptz not null default clock_timestamp()
);
create function document_lab_integrity.guard_hold() returns trigger language plpgsql set search_path='' as $$
begin
 perform 1 from document_lab_integrity.assets where id=new.asset_id and state='AVAILABLE' for update;
 if not found then raise exception 'ASSET_NOT_AVAILABLE'; end if;
 return new;
end $$;
create trigger guard_hold before insert or update on document_lab_integrity.holds for each row execute function document_lab_integrity.guard_hold();
create function document_lab_integrity.guard_operation() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'OPERATION_HISTORY_IMMUTABLE'; end if;
 if (to_jsonb(new)-array['state','fence','attempts','receipt','last_error','completed_at']) is distinct from
    (to_jsonb(old)-array['state','fence','attempts','receipt','last_error','completed_at']) then raise exception 'OPERATION_ARGUMENTS_IMMUTABLE'; end if;
 if new.fence<old.fence then raise exception 'STALE_FENCE'; end if;
 return new;
end $$;
create trigger guard_operation before update or delete on document_lab_integrity.operations for each row execute function document_lab_integrity.guard_operation();
create function document_lab_integrity.guard_event() returns trigger language plpgsql as $$begin raise exception 'AUDIT_IMMUTABLE';end$$;
create trigger guard_event before update or delete on document_lab_integrity.events for each row execute function document_lab_integrity.guard_event();
do $$declare t text;begin
 foreach t in array array['assets','operations','events','holds'] loop
  execute format('alter table document_lab_integrity.%I enable row level security',t);
  execute format('alter table document_lab_integrity.%I force row level security',t);
  execute format('create policy lab_worker on document_lab_integrity.%I to document_lab_worker using (true) with check (true)',t);
 end loop;
end$$;
grant select,insert,update on document_lab_integrity.assets,document_lab_integrity.operations to document_lab_worker;
grant select,insert on document_lab_integrity.events,document_lab_integrity.holds to document_lab_worker;
grant usage,select on all sequences in schema document_lab_integrity to document_lab_worker;
revoke all on all functions in schema document_lab_integrity from public,anon,authenticated,service_role;

-- Source: 20261108000200_operation_guards.sql SHA-256 e666f606062159abe7b9203ad3fdb5bf4fef8d7161f0e60b0d9982e4208b4896
-- Promoted from approved isolated contract; explicit release gate below.
do $$begin
 if current_setting('document.release_authorized',true) is distinct from 'DOCUMENT_V1' then raise exception 'DOCUMENT_RELEASE_AUTHORIZATION_REQUIRED';end if;
end$$;
create unique index if not exists lab_one_active_quarantine
on document_lab_integrity.operations(asset_id)
where kind='QUARANTINE' and state in ('PREPARED','RUNNING','RETRY','INTEGRITY_ERROR');
do $$begin
 if not exists(select 1 from pg_constraint where conrelid='document_lab_integrity.operations'::regclass and conname='lab_operation_asset_fk') then
  alter table document_lab_integrity.operations add constraint lab_operation_asset_fk foreign key(asset_id) references document_lab_integrity.assets(id) on delete restrict;
 end if;
end$$;
-- Source: 20261108000300_integrity_storage_buckets.sql SHA-256 adc2bf250da7c201537cd5073d159473d0fb4b9388c903b4260cdc9dce8c67f5

do $$begin if current_setting('document.release_authorized',true) is distinct from 'DOCUMENT_V1' then raise exception 'DOCUMENT_RELEASE_AUTHORIZATION_REQUIRED';end if;end$$;
alter table document_lab_integrity.assets drop constraint assets_bucket_check;
alter table document_lab_integrity.assets add constraint assets_bucket_check check(bucket in('lab-private','private-assets','generated-documents'));

-- Source: 20261108000400_durable_document_evidence.sql SHA-256 8fa3ae046fa2e9140c05519f4ef911301b5b0fe3506b8f108de50b5455d3975e
-- Promoted from approved isolated contract; explicit release gate below.

do $$begin
 if current_setting('document.release_authorized',true) is distinct from 'DOCUMENT_V1' then raise exception 'DOCUMENT_RELEASE_AUTHORIZATION_REQUIRED';end if;
 if to_regnamespace('document_evidence_private') is not null then raise exception 'PHASE2_ALREADY_INSTALLED';end if;
end$$;
create schema document_evidence_private;
revoke all on schema document_evidence_private from public,anon,authenticated,service_role;
create table document_evidence_private.contexts(
 id uuid primary key, domain text not null check(domain in('PROGRAM','SAVINGS')),
 affiliate_id uuid not null references public.affiliates(id) on delete restrict,
 state text not null default 'ACTIVE' check(state in('ACTIVE','ARCHIVED')),
 provenance text not null check(provenance in('LIVE','MIGRATION','ARCHIVE')),
 actor_real_auth_user_id uuid,created_at timestamptz not null default clock_timestamp(), archived_at timestamptz,
 check((state='ACTIVE' and archived_at is null) or (state='ARCHIVED' and archived_at is not null))
);
create table document_evidence_private.sets(
 id uuid primary key default extensions.gen_random_uuid(),context_id uuid not null references document_evidence_private.contexts(id) on delete restrict,
 kind text not null check(kind in('ORIGINAL','ANEXO','SUBSANACION','REVISION')),
 sealed_at timestamptz,created_by uuid,sealed_by uuid,created_at timestamptz not null default clock_timestamp(),
 unique(id,context_id)
);
create unique index evidence_one_original on document_evidence_private.sets(context_id) where kind='ORIGINAL';
create table document_evidence_private.savings_documents(
 id uuid primary key default extensions.gen_random_uuid(),context_id uuid not null references document_evidence_private.contexts(id) on delete restrict,
 set_id uuid not null,affiliate_document_id uuid not null references public.affiliate_documents(id) on delete restrict,
 private_asset_id uuid not null references public.private_assets(id) on delete restrict,
 asset_sha256 text not null check(asset_sha256 ~ '^[A-F0-9]{64}$'),created_at timestamptz not null,
 foreign key(set_id,context_id) references document_evidence_private.sets(id,context_id) on delete restrict,
 unique(set_id,affiliate_document_id)
);
create table document_evidence_private.withdrawals(
 document_id uuid primary key references public.affiliate_documents(id) on delete restrict,
 actor_id uuid not null references auth.users(id),reason text not null check(length(btrim(reason))>=3),
 created_at timestamptz not null default clock_timestamp()
);
create table document_evidence_private.exceptions(
 id uuid primary key default extensions.gen_random_uuid(),source text not null,source_key text not null,
 code text not null,known_asset_id uuid references public.private_assets(id) on delete restrict,
 evidence jsonb not null,created_at timestamptz not null default clock_timestamp(),unique(source,source_key,code)
);
-- Existing tuples remain byte-for-byte unchanged. Only the new set_id is populated.
insert into document_evidence_private.contexts(id,domain,affiliate_id,provenance,created_at,actor_real_auth_user_id)
 select distinct r.id,'PROGRAM',r.affiliate_id,'MIGRATION',r.created_at,r.actor_real_auth_user_id from public.program_requests r;
insert into document_evidence_private.contexts(id,domain,affiliate_id,provenance,created_at,actor_real_auth_user_id)
 select r.id,'SAVINGS',p.affiliate_id,'MIGRATION',r.submitted_at,r.actor_real_auth_user_id from public.savings_requests r join public.savings_participants p on p.id=r.participant_id where p.affiliate_id is not null;
insert into document_evidence_private.exceptions(source,source_key,code,known_asset_id,evidence)
 select 'savings_requests',r.id::text,'SAVINGS_HISTORICAL_ASSET_UNPROVEN',coalesce(d.private_asset_id,f.private_asset_id),jsonb_build_object('supporting_document_id',r.supporting_document_id,'submitted_at',r.submitted_at)
 from public.savings_requests r left join public.affiliate_documents d on d.id=r.supporting_document_id left join public.affiliate_files f on f.id=d.affiliate_file_id where r.supporting_document_id is not null;
insert into document_evidence_private.sets(context_id,kind,sealed_at)
 select id,'ORIGINAL',clock_timestamp() from document_evidence_private.contexts;
drop trigger request_delete_guard on public.request_documents;
alter table public.request_documents add column evidence_set_id uuid;
update public.request_documents d set evidence_set_id=s.id from document_evidence_private.sets s where s.context_id=d.request_id;
alter table public.request_documents alter column evidence_set_id set not null;
alter table public.request_documents drop constraint request_documents_request_id_fkey;
alter table public.request_documents add constraint request_documents_context_fkey foreign key(request_id) references document_evidence_private.contexts(id) on delete restrict;
alter table public.request_documents add constraint request_documents_set_context_fkey foreign key(evidence_set_id,request_id) references document_evidence_private.sets(id,context_id) on delete restrict;
alter table public.request_documents drop constraint request_documents_request_id_document_type_id_key;
alter table public.request_documents add constraint request_documents_set_type_key unique(evidence_set_id,document_type_id);
-- Every new operational request receives a durable identity in the same transaction.
create function document_evidence_private.capture_context() returns trigger language plpgsql security definer set search_path='' as $$
declare affiliate uuid;domain_name text;begin
 if tg_table_name='program_requests' then affiliate:=new.affiliate_id;domain_name:='PROGRAM';
 else select affiliate_id into affiliate from public.savings_participants where id=new.participant_id;domain_name:='SAVINGS';end if;
 if affiliate is null then raise exception 'EVIDENCE_AFFILIATE_UNRESOLVED';end if;
 insert into document_evidence_private.contexts(id,domain,affiliate_id,provenance,actor_real_auth_user_id) values(new.id,domain_name,affiliate,'LIVE',new.actor_real_auth_user_id);
 insert into document_evidence_private.sets(context_id,kind,created_by) values(new.id,'ORIGINAL',new.actor_real_auth_user_id);return new;
end$$;
create trigger zz_evidence_context after insert on public.program_requests for each row execute function document_evidence_private.capture_context();
create trigger zz_evidence_context after insert on public.savings_requests for each row execute function document_evidence_private.capture_context();

-- Immutable historical rows may no longer be guarded by the deleted operational parent.
-- Child guard replaced before additive association backfill.
-- Correct only the local administrative response, leaving all financial/Google logic intact.
do $$declare def text;needle text:='''documents_removed'',jsonb_array_length(d.snapshot->''documents'')';begin
 def:=pg_get_functiondef('public.finish_admin_request_delete(uuid)'::regprocedure);
 if position(needle in def)=0 then raise exception 'ARCHIVE_CONTRACT_DRIFT';end if;
 execute replace(def,needle,'''documents_removed'',0,''documents_preserved'',jsonb_array_length(d.snapshot->''documents'')');
end$$;

create function document_evidence_private.immutable() returns trigger language plpgsql set search_path='' as $$begin raise exception 'EVIDENCE_IMMUTABLE';end$$;
create trigger evidence_immutable before update or delete on public.request_documents for each row execute function document_evidence_private.immutable();
create trigger evidence_immutable before update or delete on document_evidence_private.savings_documents for each row execute function document_evidence_private.immutable();
create trigger evidence_immutable before update or delete on document_evidence_private.withdrawals for each row execute function document_evidence_private.immutable();
create trigger evidence_immutable before update or delete on document_evidence_private.exceptions for each row execute function document_evidence_private.immutable();
create function document_evidence_private.guard_context() returns trigger language plpgsql set search_path='' as $$begin
 if tg_op='DELETE' or (to_jsonb(new)-array['state','archived_at']) is distinct from (to_jsonb(old)-array['state','archived_at']) or old.state='ARCHIVED' then raise exception 'CONTEXT_IMMUTABLE';end if;return new;
end$$;
create trigger evidence_context before update or delete on document_evidence_private.contexts for each row execute function document_evidence_private.guard_context();
create function document_evidence_private.guard_set() returns trigger language plpgsql set search_path='' as $$begin
 if tg_op='DELETE' or old.sealed_at is not null or (to_jsonb(new)-array['sealed_at','sealed_by']) is distinct from (to_jsonb(old)-array['sealed_at','sealed_by']) or new.sealed_at is null then raise exception 'SEALED_EVIDENCE_IMMUTABLE';end if;return new;
end$$;
create trigger evidence_set before update or delete on document_evidence_private.sets for each row execute function document_evidence_private.guard_set();
create function document_evidence_private.lock_document(p_id uuid) returns public.affiliate_documents language plpgsql security definer set search_path='' as $$
declare d public.affiliate_documents; a uuid;begin
 select * into strict d from public.affiliate_documents where id=p_id;
 a:=coalesce(d.private_asset_id,(select private_asset_id from public.affiliate_files where id=d.affiliate_file_id));
 perform pg_advisory_xact_lock(hashtextextended('document-asset:'||a,0));
 perform 1 from public.affiliate_documents where id=p_id for update;
 perform 1 from document_lab_integrity.assets where id=a and state='AVAILABLE' for update;
 if not found then raise exception 'PHYSICAL_ASSET_NOT_VERIFIED';end if;return d;
end$$;
create function document_evidence_private.guard_reference() returns trigger language plpgsql security definer set search_path='' as $$
declare c document_evidence_private.contexts;s document_evidence_private.sets;d public.affiliate_documents;a uuid;sid uuid;cid uuid;
begin
 if tg_table_schema='public' then sid:=new.evidence_set_id;cid:=new.request_id;else sid:=new.set_id;cid:=new.context_id;end if;
 select * into strict c from document_evidence_private.contexts where id=cid for update;
 select * into strict s from document_evidence_private.sets where id=sid and context_id=cid for update;
 if c.domain<>(case when tg_table_schema='public' then 'PROGRAM' else 'SAVINGS' end) then raise exception 'CONTEXT_DOMAIN_MISMATCH';end if;
 if s.sealed_at is not null or c.state<>'ACTIVE' then raise exception 'EVIDENCE_SET_CLOSED';end if;
 d:=document_evidence_private.lock_document(new.affiliate_document_id);
 a:=coalesce(d.private_asset_id,(select private_asset_id from public.affiliate_files where id=d.affiliate_file_id));
 if d.affiliate_id<>c.affiliate_id or a<>new.private_asset_id then raise exception 'EVIDENCE_OWNER_OR_ASSET_MISMATCH';end if;
 if exists(select 1 from document_evidence_private.withdrawals where document_id=d.id) or not public.affiliate_document_is_active(d.id)
 or exists(select 1 from public.affiliate_documents n where n.affiliate_id=d.affiliate_id and n.document_type_id=d.document_type_id and (n.created_at,n.id)>(d.created_at,d.id)) then raise exception 'DOCUMENT_NOT_CURRENT';end if;
 if not exists(select 1 from public.private_assets p join document_lab_integrity.assets a on a.id=p.id where p.id=new.private_asset_id and p.content_sha256=new.asset_sha256 and upper(a.sha256)=new.asset_sha256) then raise exception 'EVIDENCE_HASH_MISMATCH';end if;
 return new;
end$$;
create trigger aa_evidence_reference before insert on public.request_documents for each row execute function document_evidence_private.guard_reference();
create trigger aa_evidence_reference before insert on document_evidence_private.savings_documents for each row execute function document_evidence_private.guard_reference();
create function document_evidence_private.lock_logical_document(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare a uuid;begin
 select coalesce(d.private_asset_id,f.private_asset_id) into a from public.affiliate_documents d left join public.affiliate_files f on f.id=d.affiliate_file_id where d.id=p_id;
 if a is not null then perform pg_advisory_xact_lock(hashtextextended('document-asset:'||a,0));end if;
 perform 1 from public.affiliate_documents where id=p_id for update;if not found then raise exception 'DOCUMENT_NOT_FOUND';end if;
end$$;
create function document_evidence_private.guard_withdrawal() returns trigger language plpgsql security definer set search_path='' as $$begin
 perform document_evidence_private.lock_logical_document(new.document_id);return new;end$$;
create trigger evidence_withdrawal before insert on document_evidence_private.withdrawals for each row execute function document_evidence_private.guard_withdrawal();
-- Replacements take the exact same lock as retirement, association and physical move.
create function document_evidence_private.guard_replacement() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.replaces_document_id is not null then perform document_evidence_private.lock_logical_document(new.replaces_document_id);end if;return new;end$$;
create trigger aa_evidence_replacement before insert on public.affiliate_documents for each row execute function document_evidence_private.guard_replacement();
-- Existing savings writers must also reject a newly attached withdrawn version.
create function document_evidence_private.guard_savings_support() returns trigger language plpgsql security definer set search_path='' as $$
declare d public.affiliate_documents;owner_id uuid;begin
 if new.supporting_document_id is null or (tg_op='UPDATE' and new.supporting_document_id is not distinct from old.supporting_document_id) then return new;end if;
 d:=document_evidence_private.lock_document(new.supporting_document_id);
 select affiliate_id into owner_id from public.savings_participants where id=new.participant_id;
 if owner_id is distinct from d.affiliate_id then raise exception 'EVIDENCE_OWNER_OR_ASSET_MISMATCH';end if;
 if exists(select 1 from document_evidence_private.withdrawals where document_id=d.id) or not public.affiliate_document_is_active(d.id)
 or exists(select 1 from public.affiliate_documents n where n.affiliate_id=d.affiliate_id and n.document_type_id=d.document_type_id and (n.created_at,n.id)>(d.created_at,d.id)) then raise exception 'DOCUMENT_NOT_CURRENT';end if;
 return new;
end$$;
create trigger aa_evidence_savings_support before insert or update of supporting_document_id on public.savings_requests for each row execute function document_evidence_private.guard_savings_support();
create function document_evidence_private.archive_context() returns trigger language plpgsql security definer set search_path='' as $$begin
 update document_evidence_private.contexts set state='ARCHIVED',archived_at=clock_timestamp() where id=old.id and state='ACTIVE';return old;
end$$;
create trigger aa_evidence_archive before delete on public.program_requests for each row execute function document_evidence_private.archive_context();
create trigger aa_evidence_archive before delete on public.savings_requests for each row execute function document_evidence_private.archive_context();

-- Recursive JSON token inventory is conservative: matches retain; missing ownership/hash never inferred.
create function document_evidence_private.contains_id(v jsonb,k uuid) returns boolean language sql immutable set search_path='' as $$select coalesce(v::text like '%'||k::text||'%',false)$$;
create function document_evidence_private.references_for(p_asset uuid) returns table(source text,source_key text,classification text) language plpgsql security definer set search_path='' as $$
declare fk record;begin
 return query select 'document_private.records',r.id::text,'HISTORICAL' from document_private.records r join document_lab_integrity.assets a on a.bucket='generated-documents' and a.path=r.path where a.id=p_asset;
 return query select 'request_documents',r.id::text,case when c.state='ARCHIVED' then 'ARCHIVED' else 'HISTORICAL' end from public.request_documents r join document_evidence_private.contexts c on c.id=r.request_id where r.private_asset_id=p_asset;
 return query select 'savings_documents',r.id::text,case when c.state='ARCHIVED' then 'ARCHIVED' else 'HISTORICAL' end from document_evidence_private.savings_documents r join document_evidence_private.contexts c on c.id=r.context_id where r.private_asset_id=p_asset;
 return query select 'affiliate_documents',d.id::text,'CURRENT' from public.affiliate_documents d left join public.affiliate_files f on f.id=d.affiliate_file_id where coalesce(d.private_asset_id,f.private_asset_id)=p_asset and not exists(select 1 from document_evidence_private.withdrawals w where w.document_id=d.id) and public.affiliate_document_is_active(d.id);
 return query select 'savings_requests',r.id::text,'HISTORICAL' from public.savings_requests r join public.affiliate_documents d on d.id=r.supporting_document_id left join public.affiliate_files f on f.id=d.affiliate_file_id where coalesce(d.private_asset_id,f.private_asset_id)=p_asset;
 return query select 'program_request_deletions',r.id::text,'ARCHIVED' from public.program_request_deletions r where document_evidence_private.contains_id(r.snapshot,p_asset) or exists(select 1 from public.affiliate_documents d where coalesce(d.private_asset_id,(select private_asset_id from public.affiliate_files where id=d.affiliate_file_id))=p_asset and document_evidence_private.contains_id(r.snapshot,d.id));
 return query select 'document_private.records',r.id::text,'HISTORICAL' from document_private.records r where document_evidence_private.contains_id(r.source_snapshot,p_asset) or document_evidence_private.contains_id(r.document_snapshot,p_asset) or exists(select 1 from public.private_assets a where a.id=p_asset and r.path=a.storage_path);
 return query select 'exceptions',e.id::text,'PENDING_RECONCILIATION' from document_evidence_private.exceptions e where e.known_asset_id=p_asset or (e.known_asset_id is null and exists(select 1 from public.private_assets where id=p_asset));
 -- Existing FK consumers: profile files, catalogue, terms, isolation old/new assets and future FK consumers.
 for fk in select n.nspname,t.relname,a.attname from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace join pg_attribute a on a.attrelid=t.oid and a.attnum=c.conkey[1]
 where c.contype='f' and c.confrelid='public.private_assets'::regclass and cardinality(c.conkey)=1 and n.nspname not in('document_evidence_private','document_retirement_private') and t.relname not in('request_documents','affiliate_documents') loop
  return query execute format('select %L,to_jsonb(t)::text,%L from %I.%I t where %I=$1',fk.nspname||'.'||fk.relname,'CURRENT',fk.nspname,fk.relname,fk.attname) using p_asset;
 end loop;
end$$;
create function document_evidence_private.guard_physical_move() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.state='QUARANTINE_PENDING' and exists(select 1 from document_evidence_private.references_for(new.id)) then raise exception 'HISTORICAL_EVIDENCE_HELD';end if;return new;
end$$;
create trigger evidence_conservation before update of state on document_lab_integrity.assets for each row execute function document_evidence_private.guard_physical_move();
create function document_evidence_private.guard_archive() returns trigger language plpgsql set search_path='' as $$begin
 if tg_op='DELETE' or new.snapshot is distinct from old.snapshot or new.request_id is distinct from old.request_id then raise exception 'ARCHIVE_EVIDENCE_IMMUTABLE';end if;return new;end$$;
create trigger evidence_archive_snapshot before update or delete on public.program_request_deletions for each row execute function document_evidence_private.guard_archive();
create function document_evidence_private.guard_asset() returns trigger language plpgsql security definer set search_path='' as $$begin
 if (new.storage_bucket,new.storage_path,new.content_sha256,new.file_size,new.owner_affiliate_id) is distinct from (old.storage_bucket,old.storage_path,old.content_sha256,old.file_size,old.owner_affiliate_id)
 and exists(select 1 from document_evidence_private.references_for(old.id) where classification in('HISTORICAL','ARCHIVED','PENDING_RECONCILIATION')) then raise exception 'HISTORICAL_ASSET_IMMUTABLE';end if;return new;end$$;
create trigger evidence_asset before update on public.private_assets for each row execute function document_evidence_private.guard_asset();
create function document_evidence_private.guard_consumer() returns trigger language plpgsql security definer set search_path='' as $$
declare a uuid;payload jsonb:=to_jsonb(new);begin
 if tg_table_name='affiliate_documents' then payload:=payload-'replaces_document_id';end if;
 for a in select p.id from public.private_assets p where document_evidence_private.contains_id(payload,p.id)
 or exists(select 1 from public.affiliate_documents d left join public.affiliate_files f on f.id=d.affiliate_file_id where coalesce(d.private_asset_id,f.private_asset_id)=p.id and document_evidence_private.contains_id(payload,d.id))
 union select id from document_lab_integrity.assets where bucket='generated-documents' and path=payload->>'path' order by 1 loop
  perform pg_advisory_xact_lock(hashtextextended('document-asset:'||a,0));
  if exists(select 1 from document_lab_integrity.assets where id=a and state<>'AVAILABLE') then raise exception 'PHYSICAL_MOVE_IN_PROGRESS';end if;
 end loop;return new;
end$$;
do $$declare t record;begin for t in
 select distinct n.nspname,c.relname from pg_constraint f join pg_class c on c.oid=f.conrelid join pg_namespace n on n.oid=c.relnamespace
 where f.contype='f' and f.confrelid='public.private_assets'::regclass and n.nspname not in('document_evidence_private','document_retirement_private') and c.relname not in('request_documents','affiliate_documents')
 union select 'public','program_request_deletions' union select 'document_private','records' union select 'public','affiliate_documents'
 loop execute format('create trigger aa_evidence_consumer before insert or update on %I.%I for each row execute function document_evidence_private.guard_consumer()',t.nspname,t.relname);end loop;end$$;
create function document_evidence_private.can_read(p_context uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from document_evidence_private.contexts c join public.affiliates a on a.id=c.affiliate_id where c.id=p_context and a.auth_user_id=auth.uid());
$$;
do $$declare t text;begin foreach t in array array['contexts','sets','savings_documents','withdrawals','exceptions'] loop
 execute format('alter table document_evidence_private.%I enable row level security',t);
 execute format('alter table document_evidence_private.%I force row level security',t);
end loop;end$$;
grant usage on schema document_evidence_private to authenticated;
grant select on document_evidence_private.contexts,document_evidence_private.sets,document_evidence_private.savings_documents to authenticated;
create policy evidence_owner on document_evidence_private.contexts for select to authenticated using(document_evidence_private.can_read(id));
create policy evidence_owner on document_evidence_private.sets for select to authenticated using(document_evidence_private.can_read(context_id));
create policy evidence_owner on document_evidence_private.savings_documents for select to authenticated using(document_evidence_private.can_read(context_id));
-- Replace only local request-evidence SELECT policies; existing productive policies are untouched.
do $$declare p record;begin for p in select policyname from pg_policies where schemaname='public' and tablename='request_documents' loop execute format('drop policy %I on public.request_documents',p.policyname);end loop;end$$;
create policy evidence_owner on public.request_documents for select to authenticated using(document_evidence_private.can_read(request_id));
revoke all on all functions in schema document_evidence_private from public,anon,authenticated,service_role;
grant execute on function document_evidence_private.can_read(uuid) to authenticated;
revoke insert,update,delete on public.request_documents from authenticated,anon;

-- Source: 20261108000500_document_access.sql SHA-256 2d8351c9a56c70398706fd583ec0716f5623b474b927bf5b793975af755a5a51
-- Promoted from approved isolated contract; explicit release gate below.

create schema document_access_private;
revoke all on schema document_access_private from public,anon,authenticated;
grant usage on schema document_access_private to service_role;
grant usage on schema document_evidence_private,document_private to service_role;
grant select on document_private.records to service_role;
grant select on document_evidence_private.contexts,document_evidence_private.sets,document_evidence_private.savings_documents to service_role;
create table document_access_private.events(
 id uuid primary key default extensions.gen_random_uuid(), correlation_id uuid not null,
 actor_auth_user_id uuid, effective_affiliate_id uuid, impersonation_session_id uuid,
 association_id uuid, context_id uuid,
 source text check(source in('REQUEST','SAVINGS','GENERATED')),
 operation text not null check(operation in('REQUESTED','DENIED','URL_ISSUED','BYTES_SERVED','FAILED')),
 outcome text not null check(outcome in('PENDING','ALLOWED','DENIED','UNAVAILABLE')),
 mode text check(mode in('SELF_SERVICE','ADMIN')),
 bytes_served bigint not null default 0 check(bytes_served>=0),
 created_at timestamptz not null default clock_timestamp(),
 check(operation='BYTES_SERVED' or bytes_served=0)
);
alter table document_access_private.events enable row level security;
alter table document_access_private.events force row level security;
revoke all on document_access_private.events from public,anon,authenticated;
grant select,insert on document_access_private.events to service_role;
create trigger events_immutable before update or delete on document_access_private.events
 for each row execute function document_evidence_private.immutable();
create index access_events_correlation on document_access_private.events(correlation_id,created_at);

-- Claims are set by the trusted backend only after validating Auth /user and signature.
create function document_access_private.authorize_context(p_context uuid,p_mode text,p_generated boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c document_evidence_private.contexts; actor uuid:=auth.uid(); effective uuid;
 imp uuid; request jsonb; allowed boolean:=false;
begin
 if actor is null or auth.role()<>'authenticated' then raise exception 'ACCESS_DENIED' using errcode='42501';end if;
 if not exists(select 1 from auth.sessions s where s.id::text=auth.jwt()->>'session_id' and s.user_id=actor
   and (s.not_after is null or s.not_after>clock_timestamp())) then raise exception 'ACCESS_DENIED' using errcode='42501';end if;
 select * into c from document_evidence_private.contexts where id=p_context;
 if c.id is null then raise exception 'ACCESS_DENIED' using errcode='42501';end if;
 effective:=public.get_effective_affiliate_id();
 select session_id into imp from public.get_impersonation_context();
 if p_mode='SELF_SERVICE' then allowed:=effective is not null and effective=c.affiliate_id and not(p_generated and c.domain='PROGRAM');
 elsif p_mode='ADMIN' then
  -- Owner directive: the existing source-domain permission authorizes its attachments.
  if c.domain='SAVINGS' then allowed:=public.has_admin_permission('savings.read') and public.admin_module_boundary(array['savings']);
  else
   if exists(select 1 from public.program_requests where id=c.id) then
    allowed:=public.has_admin_permission('program_requests.read') and public.admin_request_module_boundary(c.id);
   else
    select d.snapshot->'request' into request from public.program_request_deletions d
     where d.request_id=c.id and d.snapshot->'request'->>'id'=c.id::text
       and d.snapshot->'request'->>'affiliate_id'=c.affiliate_id::text order by d.created_at desc limit 1;
    -- The snapshot supplies classification, never privileges.
    allowed:=request is not null and public.has_admin_permission('program_requests.read') and
     (not public.is_module_admin() or public.has_admin_module('finanzas') or
      (public.has_admin_module('requests') and request ? 'financial_processing_status' and
       request->>'financial_processing_status' is null));
   end if;
  end if;
 end if;
 if not coalesce(allowed,false) then raise exception 'ACCESS_DENIED' using errcode='42501';end if;
 return jsonb_build_object('actor',actor,'effective',effective,'target',c.affiliate_id,
  'context',c.id,'impersonation',imp,'state',c.state,'domain',c.domain);
end $$;
revoke all on function document_access_private.authorize_context(uuid,text,boolean) from public,anon,authenticated;
grant execute on function document_access_private.authorize_context(uuid,text,boolean) to service_role;
-- Equivalent authorization is mandatory for protected objects even with assets.read.
create function document_access_private.protected_object(p_bucket text,p_path text)
returns boolean language sql stable security definer set search_path='' as $$
 select p_bucket='private-assets' and exists(
  select 1 from public.private_assets a where a.storage_bucket=p_bucket and a.storage_path=p_path and (
   exists(select 1 from public.affiliate_documents d left join public.affiliate_files f on f.id=d.affiliate_file_id where coalesce(d.private_asset_id,f.private_asset_id)=a.id)
   or exists(select 1 from public.request_documents d where d.private_asset_id=a.id)
   or exists(select 1 from document_evidence_private.savings_documents d where d.private_asset_id=a.id)
   or exists(select 1 from document_evidence_private.exceptions e where e.known_asset_id=a.id)
   or exists(select 1 from public.program_request_deletions d where d.snapshot::text like '%'||a.id::text||'%')
  ));
$$;
revoke all on function document_access_private.protected_object(text,text) from public,anon;
grant usage on schema document_access_private to authenticated;
grant execute on function document_access_private.protected_object(text,text) to authenticated,service_role;
create policy phase3_document_access_boundary on storage.objects as restrictive for select to authenticated
 using(not document_access_private.protected_object(bucket_id,name));
-- Current expediente also respects phase-2 logical retirement.
-- Preserve the existing view columns, owner and grants; historical associations do not use this view.
create or replace view document_retirement_private.active_documents as
 select d.id,d.affiliate_id,d.document_type_id,d.affiliate_file_id,d.private_asset_id,
        d.status,d.review_observation,d.reviewed_by_auth_user_id,d.reviewed_at,
        d.created_by_auth_user_id,d.created_at,d.updated_at,d.replaces_document_id
 from public.affiliate_documents d
 where public.affiliate_document_is_active(d.id)
   and not exists(select 1 from document_evidence_private.withdrawals w where w.document_id=d.id);

-- Source: 20261108000600_document_operations.sql SHA-256 fe8da7eed24cbc4ad6bfe5fe9a4dd017c0a8da548a1c5789afa450bf43688322
-- Promoted from approved isolated contract; explicit release gate below.

do $$begin
 if current_setting('document.release_authorized',true) is distinct from 'DOCUMENT_V1' then raise exception 'DOCUMENT_RELEASE_AUTHORIZATION_REQUIRED';end if;
 if to_regnamespace('document_evidence_private') is null or to_regnamespace('document_access_private') is null then raise exception 'PHASE_2_3_REQUIRED';end if;
end$$;
create schema document_integration_private;
revoke all on schema document_integration_private from public,anon,authenticated;

alter table document_lab_integrity.operations add column registration_context jsonb;
alter table document_lab_integrity.operations add column document_id uuid references public.affiliate_documents(id) on delete restrict;
alter table document_lab_integrity.operations add constraint document_registration_complete check(registration_context is null or state<>'COMPLETE' or document_id is not null);
-- Preserve the phase-1 envelope; only the one-time registration result is added.
create or replace function document_lab_integrity.guard_operation() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'OPERATION_HISTORY_IMMUTABLE';end if;
 if (to_jsonb(new)-array['state','fence','attempts','receipt','last_error','completed_at','document_id']) is distinct from (to_jsonb(old)-array['state','fence','attempts','receipt','last_error','completed_at','document_id']) then raise exception 'OPERATION_ARGUMENTS_IMMUTABLE';end if;
 if old.document_id is not null and new.document_id is distinct from old.document_id then raise exception 'OPERATION_RESULT_IMMUTABLE';end if;
 if new.fence<old.fence then raise exception 'STALE_FENCE';end if;return new;
end$$;
create function document_integration_private.session_required() returns void language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is null or auth.role()<>'authenticated' or not exists(select 1 from auth.sessions where id::text=auth.jwt()->>'session_id' and user_id=auth.uid() and (not_after is null or not_after>clock_timestamp())) then raise exception 'AUTH_INVALID' using errcode='42501';end if;
end$$;
create function document_integration_private.writer(p_affiliate uuid,p_mode text) returns void language plpgsql security definer set search_path='' as $$begin
 perform document_integration_private.session_required();
 if p_mode='SELF_SERVICE' then
  if public.get_effective_affiliate_id() is distinct from p_affiliate then raise exception 'DOCUMENT_CONTEXT_DENIED' using errcode='42501';end if;
 elsif p_mode='ADMIN' then
  if not public.has_admin_permission('documents.write') then raise exception 'DOCUMENT_WRITE_DENIED' using errcode='42501';end if;
 else raise exception 'INVALID_MODE';end if;
end$$;
create function document_integration_private.current_document(p_affiliate uuid,p_type uuid) returns uuid language sql stable security definer set search_path='' as $$
 select d.id from public.affiliate_documents d where d.affiliate_id=p_affiliate and d.document_type_id=p_type
 and public.affiliate_document_is_active(d.id) and not exists(select 1 from document_evidence_private.withdrawals w where w.document_id=d.id)
 and not exists(select 1 from public.affiliate_documents n where n.affiliate_id=d.affiliate_id and n.document_type_id=d.document_type_id and (n.created_at,n.id)>(d.created_at,d.id))
 order by d.created_at desc,d.id desc limit 1;
$$;
-- Do not resurrect an older version when the latest version is withdrawn.
create or replace view document_retirement_private.active_documents as
 select d.id,d.affiliate_id,d.document_type_id,d.affiliate_file_id,d.private_asset_id,d.status,d.review_observation,d.reviewed_by_auth_user_id,d.reviewed_at,d.created_by_auth_user_id,d.created_at,d.updated_at,d.replaces_document_id
 from public.affiliate_documents d where public.affiliate_document_is_active(d.id)
 and not exists(select 1 from document_evidence_private.withdrawals w where w.document_id=d.id)
 and not exists(select 1 from public.affiliate_documents n where n.affiliate_id=d.affiliate_id and n.document_type_id=d.document_type_id and (n.created_at,n.id)>(d.created_at,d.id));

create function public.prepare_document_operation(p_id uuid,p_mode text,p_affiliate uuid,p_type uuid,p_mime text,p_size bigint,p_sha text,p_expected uuid,p_source text default 'FILE',p_reason text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid;t public.document_types;o document_lab_integrity.operations;ctx jsonb;args jsonb;fp text;ext text;begin
 a:=case when p_mode='SELF_SERVICE' then public.get_effective_affiliate_id() else p_affiliate end;
 if a is null or (p_mode='SELF_SERVICE' and p_affiliate is not null and p_affiliate<>a) then raise exception 'DOCUMENT_CONTEXT_DENIED' using errcode='42501';end if;
 perform document_integration_private.writer(a,p_mode);
 select * into t from public.document_types where id=p_type and enabled;
 if t.id is null or p_size<1 or p_size>least(t.max_file_size_bytes,10485760) or lower(p_sha)!~'^[a-f0-9]{64}$' or not(p_mime=any(t.accepted_mime_types)) or p_mime not in('image/png','image/jpeg','application/pdf') or p_source not in('FILE','CAMERA') or (p_source='FILE' and not t.file_upload_allowed) or (p_source='CAMERA' and (not t.camera_allowed or p_mime not like 'image/%')) then raise exception 'INVALID_DOCUMENT_FILE';end if;
 if p_id is null or length(p_reason)>500 then raise exception 'INVALID_OPERATION';end if;
 args:=jsonb_build_object('affiliate',a,'type',p_type,'mode',p_mode,'mime',p_mime,'size',p_size,'sha',lower(p_sha),'expected',p_expected,'source',p_source,'reason',p_reason);
 fp:=encode(extensions.digest(args::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended('document-operation:'||p_id,0));
 select * into o from document_lab_integrity.operations where id=p_id for update;
 if o.id is not null then
  if o.actor_id<>auth.uid() or o.arguments_hash<>fp or o.registration_context->'claims'->>'session_id' is distinct from auth.jwt()->>'session_id' then raise exception 'IDEMPOTENCY_ARGUMENT_MISMATCH' using errcode='42501';end if;
 else
  perform pg_advisory_xact_lock(hashtextextended('document-slot:'||a||':'||p_type,0));
  if document_integration_private.current_document(a,p_type) is distinct from p_expected then raise exception 'DOCUMENT_VERSION_CONFLICT' using errcode='40001';end if;
  ext:=case p_mime when 'image/png' then '.png' when 'image/jpeg' then '.jpg' else '.pdf' end;
  ctx:=args||jsonb_build_object('claims',auth.jwt());
  insert into document_lab_integrity.operations(id,actor_id,affiliate_id,kind,source,sha256,size,mime,arguments_hash,registration_context)
   values(p_id,auth.uid(),a,'UPLOAD','affiliate-documents/'||a||'/'||p_id||ext,lower(p_sha),p_size,p_mime,fp,ctx) returning * into o;
  insert into document_lab_integrity.events(operation_id,fence,event) values(p_id,0,'PREPARED');
 end if;
 return jsonb_build_object('operation_id',o.id,'state',o.state,'path',o.source,'bucket','private-assets','sha256',o.sha256,'size',o.size,'mime',o.mime,'document_id',o.document_id);
end$$;
create function public.get_document_operation(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare o document_lab_integrity.operations;begin
 perform document_integration_private.session_required();select * into o from document_lab_integrity.operations where id=p_id;
 if o.id is null or o.registration_context is null or o.actor_id<>auth.uid() or o.registration_context->'claims'->>'session_id' is distinct from auth.jwt()->>'session_id' then raise exception 'OPERATION_ACCESS_DENIED' using errcode='42501';end if;
 perform document_integration_private.writer(o.affiliate_id,o.registration_context->>'mode');
 return jsonb_build_object('operation_id',o.id,'state',o.state,'path',o.source,'bucket','private-assets','sha256',o.sha256,'size',o.size,'mime',o.mime,'document_id',o.document_id);
end$$;

-- Harden the existing registration writers, retaining their behavior and audit.
-- The service finalizer supplies an immutable operation ID, never a browser asset selector.
do $$declare n text;sig text;def text;needle text;replacement text;begin
 for n,sig in select * from (values
 ('register_affiliate_document','public.register_affiliate_document(uuid,text,text,bigint,text,text)'),
 ('register_admin_affiliate_document','public.register_admin_affiliate_document(uuid,uuid,text,text,bigint,text,text)')) v(n,sig) loop
  def:=pg_get_functiondef(sig::regprocedure);
  if position('insert into public.private_assets(asset_key,' in def)=0 then raise exception 'REGISTRATION_CONTRACT_DRIFT';end if;
  def:=replace(def,E'begin\n',E'begin\n  if coalesce(current_setting(''document.integration_operation'',true),'''')='''' then raise exception ''VERIFIED_UPLOAD_REQUIRED'' using errcode=''42501'';end if;\n');
  def:=replace(def,'insert into public.private_assets(asset_key,','insert into public.private_assets(id,asset_key,');
  def:=replace(def,'values(''affiliate_document_''','values(current_setting(''document.integration_operation'')::uuid,''affiliate_document_''');
  execute def;
 end loop;
end$$;
create function public.complete_document_operation(p_id uuid,p_receipt jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare o document_lab_integrity.operations;c jsonb;d public.affiliate_documents;r jsonb;f bigint;begin
 if auth.role()<>'service_role' then raise exception 'SERVICE_REQUIRED' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('document-operation:'||p_id,0));
 select * into o from document_lab_integrity.operations where id=p_id for update;
 if o.id is null or o.registration_context is null then raise exception 'OPERATION_NOT_FOUND';end if;
 c:=o.registration_context;
 perform set_config('request.jwt.claims',(c->'claims')::text,true);perform set_config('request.jwt.claim.sub',o.actor_id::text,true);perform set_config('request.jwt.claim.role','authenticated',true);
 perform document_integration_private.writer(o.affiliate_id,c->>'mode');
 if p_receipt->>'verified' is distinct from 'true' or p_receipt->>'sha256' is distinct from o.sha256 or (p_receipt->>'size')::bigint is distinct from o.size or p_receipt->>'mime' is distinct from o.mime then raise exception 'VERIFICATION_RECEIPT_INVALID';end if;
 if not exists(select 1 from storage.objects where bucket_id='private-assets' and name=o.source and owner_id=o.actor_id::text) then raise exception 'UPLOAD_NOT_FOUND';end if;
 if o.document_id is not null then select * into d from public.affiliate_documents where id=o.document_id;return jsonb_build_object('operation_id',o.id,'status','COMPLETE','document',to_jsonb(d),'replayed',true);end if;
 perform pg_advisory_xact_lock(hashtextextended('document-slot:'||o.affiliate_id||':'||(c->>'type'),0));
 if document_integration_private.current_document(o.affiliate_id,(c->>'type')::uuid) is distinct from (c->>'expected')::uuid then raise exception 'DOCUMENT_VERSION_CONFLICT' using errcode='40001';end if;
 perform pg_advisory_xact_lock(hashtextextended('document-asset:'||p_id,0));
 insert into document_lab_integrity.assets(id,affiliate_id,bucket,path,sha256,size,mime) values(o.id,o.affiliate_id,'private-assets',o.source,o.sha256,o.size,o.mime);
 perform set_config('document.integration_operation',o.id::text,true);
 if c->>'mode'='SELF_SERVICE' then d:=public.register_affiliate_document((c->>'type')::uuid,o.source,o.mime,o.size,upper(o.sha256),c->>'source');
 else r:=public.register_admin_affiliate_document(o.affiliate_id,(c->>'type')::uuid,o.source,o.mime,o.size,upper(o.sha256),c->>'reason');select * into d from public.affiliate_documents where id=(r->'document'->>'id')::uuid;end if;
 if d.id is null or d.private_asset_id<>o.id then raise exception 'REGISTRATION_RESULT_MISMATCH';end if;
 f:=o.fence+1;
 update document_lab_integrity.operations set state='COMPLETE',fence=f,attempts=attempts+1,receipt=p_receipt,completed_at=clock_timestamp(),last_error=null,document_id=d.id where id=o.id;
 insert into document_lab_integrity.events(operation_id,fence,event,detail) values(o.id,f,'COMPLETE',jsonb_build_object('document_id',d.id,'receipt',p_receipt));
 return jsonb_build_object('operation_id',o.id,'status','COMPLETE','document',to_jsonb(d));
end$$;

-- Logical withdrawal uses existing administrative capabilities or the affiliate's own context.
create function public.withdraw_document(p_document uuid,p_operation uuid,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.affiliate_documents;o document_retirement_private.operations;fp text;begin
 perform document_integration_private.session_required();select * into d from public.affiliate_documents where id=p_document;
 if d.id is null or (public.get_effective_affiliate_id() is distinct from d.affiliate_id and not document_retirement_private.authorized()) then raise exception 'DOCUMENT_CONTEXT_DENIED' using errcode='42501';end if;
 if p_operation is null or length(btrim(p_reason)) not between 8 and 500 then raise exception 'WITHDRAWAL_REASON_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended('document-slot:'||d.affiliate_id||':'||d.document_type_id,0));
 perform document_evidence_private.lock_logical_document(d.id);
 fp:=md5(d.id::text||':'||d.affiliate_id::text);
 select * into o from document_retirement_private.operations where id=p_operation;
 if o.id is not null then
  if o.actor_auth_user_id<>auth.uid() or o.document_id<>d.id or o.reason<>btrim(p_reason) then raise exception 'IDEMPOTENCY_ARGUMENT_MISMATCH';end if;
 else
  insert into document_retirement_private.operations(id,affiliate_id,document_id,actor_auth_user_id,effective_affiliate_id,reason,fingerprint,completed_at)
   values(p_operation,d.affiliate_id,d.id,auth.uid(),public.get_effective_affiliate_id(),btrim(p_reason),fp,clock_timestamp());
  insert into document_retirement_private.documents(document_id,operation_id,affiliate_file_id,asset_id) values(d.id,p_operation,d.affiliate_file_id,d.private_asset_id) on conflict(document_id) do nothing;
  insert into document_evidence_private.withdrawals(document_id,actor_id,reason) values(d.id,auth.uid(),btrim(p_reason)) on conflict do nothing;
  insert into public.sensitive_change_audit(actor_auth_user_id,affiliate_id,resource,action,target_id,metadata) values(auth.uid(),d.affiliate_id,'affiliate_documents','LOGICAL_WITHDRAWAL',d.id,jsonb_build_object('operation_id',p_operation,'reason',btrim(p_reason),'physical_move',false));
 end if;
 return jsonb_build_object('operation_id',p_operation,'status','COMPLETE','document_id',d.id,'physical_move',false);
end$$;

-- Physical retention is deliberately conservative. Clients cannot mutate stored document bytes.
create policy phase4_no_document_update on storage.objects as restrictive for update to authenticated using(bucket_id not in('private-assets','generated-documents')) with check(bucket_id not in('private-assets','generated-documents'));
create policy phase4_no_document_delete on storage.objects as restrictive for delete to authenticated using(bucket_id not in('private-assets','generated-documents'));

revoke all on all functions in schema document_integration_private from public,anon,authenticated;
revoke all on function public.prepare_document_operation(uuid,text,uuid,uuid,text,bigint,text,uuid,text,text),public.get_document_operation(uuid),public.withdraw_document(uuid,uuid,text) from public,anon;
grant execute on function public.prepare_document_operation(uuid,text,uuid,uuid,text,bigint,text,uuid,text,text),public.get_document_operation(uuid),public.withdraw_document(uuid,uuid,text) to authenticated;
revoke all on function public.complete_document_operation(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.complete_document_operation(uuid,jsonb) to service_role;

-- Source: 20261108000700_document_consumers.sql SHA-256 e56de20da06a50b719a584383c16bce704252d4864210ae4a86b514c0bfef211
-- Promoted from approved isolated contract; explicit release gate below.

do $$begin if current_setting('document.release_authorized',true) is distinct from 'DOCUMENT_V1' then raise exception 'DOCUMENT_RELEASE_AUTHORIZATION_REQUIRED';end if;end$$;
create function document_integration_private.request_tuple(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare r jsonb;items jsonb[];begin
 select to_jsonb(d) into r from public.request_documents d where d.id=p_id;
 if r is not null then return r;end if;
 select array_agg(distinct e.value) into items from public.program_request_deletions a cross join lateral jsonb_array_elements(case when jsonb_typeof(a.snapshot->'documents')='array' then a.snapshot->'documents' else '[]'::jsonb end) e
 where e.value->>'id'=p_id::text and e.value->>'request_id'=a.request_id::text and a.snapshot->'request'->>'id'=a.request_id::text;
 if coalesce(array_length(items,1),0)<>1 then raise exception 'HISTORICAL_ASSOCIATION_UNRESOLVED' using errcode='42501';end if;
 return items[1];
end$$;
create function public.resolve_document_access(p_source text,p_association uuid,p_mode text) returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb;i jsonb;a public.private_assets;d public.affiliate_documents;c uuid;preview record;meta jsonb;begin
 perform document_integration_private.session_required();
 if p_source='EXPEDIENTE' then
  select * into d from public.affiliate_documents where id=p_association;
  if d.id is null then raise exception 'DOCUMENT_CONTEXT_DENIED' using errcode='42501';end if;
  if p_mode='SELF_SERVICE' then select * into preview from public.authorize_self_document_preview(d.id,'SELF_SERVICE_EXPEDIENTE');
  elsif p_mode='ADMIN' then select * into preview from public.authorize_admin_document_preview(d.id,d.affiliate_id,'ADMIN_AFFILIATE_PROFILE');
  else raise exception 'INVALID_ACCESS_MODE';end if;
  select * into a from public.private_assets where storage_bucket=preview.storage_bucket and storage_path=preview.storage_path;
  if a.id is null or a.owner_affiliate_id is distinct from d.affiliate_id or a.status<>'READY' then raise exception 'HISTORICAL_EVIDENCE_UNAVAILABLE';end if;
  return jsonb_build_object('actor',preview.actor_auth_user_id,'effective',preview.effective_affiliate_id,'target',d.affiliate_id,'impersonation',preview.impersonation_session_id,'bucket',a.storage_bucket,'path',a.storage_path,'mime',a.mime_type,'size',a.file_size,'sha256',lower(a.content_sha256),'asset',a.id,'association_id',p_association);
 elsif p_source='REQUEST' then
  r:=document_integration_private.request_tuple(p_association);c:=(r->>'request_id')::uuid;
  if r->>'evidence_set_id' is not null and not exists(select 1 from document_evidence_private.sets where id=(r->>'evidence_set_id')::uuid and context_id=c and sealed_at is not null) then raise exception 'EVIDENCE_NOT_SEALED';end if;
 elsif p_source='SAVINGS' then
  select to_jsonb(x) into r from document_evidence_private.savings_documents x where id=p_association;c:=(r->>'context_id')::uuid;
  if not exists(select 1 from document_evidence_private.sets where id=(r->>'set_id')::uuid and context_id=c and sealed_at is not null) then raise exception 'EVIDENCE_NOT_SEALED';end if;
 elsif p_source='GENERATED' then
  select to_jsonb(x) into r from document_private.records x where id=p_association;c:=(r->>'operation_id')::uuid;
 else raise exception 'INVALID_DOCUMENT_SOURCE';end if;
 if r is null or c is null then raise exception 'DOCUMENT_CONTEXT_DENIED' using errcode='42501';end if;
 i:=document_access_private.authorize_context(c,p_mode,p_source='GENERATED');
 if p_source='GENERATED' then
  if r->>'affiliate_id' is distinct from i->>'target' or r->>'status'<>'READY' or coalesce(r->>'sha256','')!~'^[a-f0-9]{64}$' then raise exception 'HISTORICAL_EVIDENCE_UNAVAILABLE';end if;
  select metadata into meta from storage.objects where bucket_id='generated-documents' and name=r->>'path';
  return i||jsonb_build_object('bucket','generated-documents','path',r->>'path','mime','application/pdf','size',(meta->>'size')::bigint,'sha256',r->>'sha256','association_id',p_association);
 end if;
 select * into a from public.private_assets where id=(r->>'private_asset_id')::uuid;
 if a.id is null or a.owner_affiliate_id::text is distinct from i->>'target' or a.storage_bucket<>'private-assets' or a.status<>'READY' or a.content_sha256 is distinct from r->>'asset_sha256' then raise exception 'HISTORICAL_EVIDENCE_UNAVAILABLE';end if;
 return i||jsonb_build_object('bucket',a.storage_bucket,'path',a.storage_path,'mime',a.mime_type,'size',a.file_size,'sha256',lower(r->>'asset_sha256'),'asset',a.id,'association_id',p_association);
end$$;
create function public.list_document_evidence(p_context uuid,p_source text,p_mode text) returns jsonb language plpgsql security definer set search_path='' as $$
declare i jsonb;rows jsonb:='[]';r jsonb;a public.private_assets;t public.document_types;begin
 perform document_integration_private.session_required();i:=document_access_private.authorize_context(p_context,p_mode,p_source='GENERATED');
 if p_source='REQUEST' then
  select coalesce(jsonb_agg(to_jsonb(d) order by d.created_at,d.id),'[]') into rows from public.request_documents d where d.request_id=p_context;
  if rows='[]' then
   select coalesce(jsonb_agg(distinct e.value),'[]') into rows from public.program_request_deletions x cross join lateral jsonb_array_elements(case when jsonb_typeof(x.snapshot->'documents')='array' then x.snapshot->'documents' else '[]'::jsonb end) e where x.request_id=p_context and e.value->>'request_id'=p_context::text and x.snapshot->'request'->>'affiliate_id'=i->>'target';
  end if;
 elsif p_source='SAVINGS' then select coalesce(jsonb_agg(to_jsonb(d) order by d.created_at,d.id),'[]') into rows from document_evidence_private.savings_documents d where d.context_id=p_context;
 else raise exception 'INVALID_DOCUMENT_SOURCE';end if;
 -- Only pinned metadata is used; the current dossier is never consulted.
 select coalesce(jsonb_agg(x.value||jsonb_build_object('mimeType',pa.mime_type,'sha256',x.value->>'asset_sha256','available',pa.status='READY','document_type',jsonb_build_object('id',dt.id,'label',dt.label,'code',dt.code))),'[]') into rows
 from jsonb_array_elements(rows) x left join public.private_assets pa on pa.id=(x.value->>'private_asset_id')::uuid left join public.document_types dt on dt.id=(x.value->>'document_type_id')::uuid;
 return rows;
end$$;

-- Preserve the signature used by existing financial writers. Only evidence changes.
create or replace function public.attach_request_documents(p_request_id uuid,p_affiliate_document_ids uuid[]) returns integer language plpgsql security definer set search_path='' as $$
declare a uuid;s document_evidence_private.sets;d public.affiliate_documents;asset public.private_assets;cnt integer:=0;doc uuid;begin
 perform document_integration_private.session_required();a:=public.get_effective_affiliate_id();
 if not exists(select 1 from public.program_requests where id=p_request_id and affiliate_id=a and actor_real_auth_user_id=auth.uid()) then raise exception 'REQUEST_ACCESS_DENIED' using errcode='42501';end if;
 select * into s from document_evidence_private.sets where context_id=p_request_id and kind='ORIGINAL' for update;
 if s.id is null then raise exception 'EVIDENCE_CONTEXT_MISSING';end if;
 if s.sealed_at is not null then
  if (select array_agg(affiliate_document_id order by affiliate_document_id) from public.request_documents where evidence_set_id=s.id) is distinct from (select array_agg(distinct x order by x) from unnest(p_affiliate_document_ids) x) then raise exception 'SEALED_EVIDENCE_IMMUTABLE';end if;return 0;
 end if;
 for doc in select distinct x from unnest(p_affiliate_document_ids) x order by x loop
  d:=document_evidence_private.lock_document(doc);
  if d.affiliate_id<>a or d.status not in('PENDING_REVIEW','UNDER_REVIEW','VERIFIED') then raise exception 'DOCUMENT_CONTEXT_DENIED' using errcode='42501';end if;
  select * into asset from public.private_assets where id=coalesce(d.private_asset_id,(select private_asset_id from public.affiliate_files where id=d.affiliate_file_id));
  insert into public.request_documents(request_id,evidence_set_id,document_type_id,affiliate_document_id,private_asset_id,asset_sha256,status_at_submission)
   values(p_request_id,s.id,d.document_type_id,d.id,asset.id,asset.content_sha256,d.status);cnt:=cnt+1;
 end loop;
 update document_evidence_private.sets set sealed_at=clock_timestamp(),sealed_by=auth.uid() where id=s.id;
 return cnt;
end$$;

-- Existing administrative modal keeps its contract, but never plans a physical move.
create or replace function public.preview_admin_affiliate_document_delete(p_affiliate_id uuid,p_document_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare d public.affiliate_documents;t public.document_types;begin
 perform document_integration_private.session_required();if not document_retirement_private.authorized() then raise exception 'AFFILIATE_DOCUMENT_DELETE_DENIED' using errcode='42501';end if;
 select * into d from public.affiliate_documents where id=p_document_id and affiliate_id=p_affiliate_id;
 if d.id is null then raise exception 'DOCUMENT_CONTEXT_MISMATCH' using errcode='42501';end if;
 select * into t from public.document_types where id=d.document_type_id;
 return jsonb_build_object('affiliate_id',d.affiliate_id,'document_id',d.id,'documents',jsonb_build_array(to_jsonb(d)||jsonb_build_object('label',t.label)),'fingerprint',md5(d.id::text||':'||d.affiliate_id::text),'blocked',false,'logical_only',true);
end$$;
create or replace function public.prepare_admin_affiliate_document_delete(p_affiliate_id uuid,p_document_id uuid,p_fingerprint text,p_reason text,p_action_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare r jsonb;begin
 r:=public.preview_admin_affiliate_document_delete(p_affiliate_id,p_document_id);
 if r->>'fingerprint' is distinct from p_fingerprint then raise exception 'DOCUMENT_DELETE_PREVIEW_STALE';end if;
 return public.withdraw_document(p_document_id,p_action_id,p_reason);
end$$;
-- No prepared endpoint may execute legacy physical retirement, including a resume.
create or replace function public.affiliate_document_delete_storage(p_operation_id uuid,p_actor_id uuid,p_finish boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$begin raise exception 'PHYSICAL_PURGE_DISABLED';end$$;

revoke all on all functions in schema document_integration_private from public,anon,authenticated;
revoke all on function public.resolve_document_access(text,uuid,text),public.list_document_evidence(uuid,text,text) from public,anon;
grant execute on function public.resolve_document_access(text,uuid,text),public.list_document_evidence(uuid,text,text) to authenticated;

-- Source: 20261108000800_upload_context.sql SHA-256 a752e1011a5052d48e7fb81718429af001688c70841f98a66413f3c5c7e45942
-- Writer metadata needed for optimistic replacement; no new read permission.

do $$begin if current_setting('document.release_authorized',true) is distinct from 'DOCUMENT_V1' then raise exception 'DOCUMENT_RELEASE_AUTHORIZATION_REQUIRED';end if;end$$;
create function public.document_upload_context(p_mode text,p_affiliate uuid,p_type uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare a uuid;begin
 a:=case when p_mode='SELF_SERVICE' then public.get_effective_affiliate_id() else p_affiliate end;
 perform document_integration_private.writer(a,p_mode);
 return jsonb_build_object('document_id',document_integration_private.current_document(a,p_type));
end$$;
revoke all on function public.document_upload_context(text,uuid,uuid) from public,anon;
grant execute on function public.document_upload_context(text,uuid,uuid) to authenticated;

-- Source: 20261108000900_submission_verification.sql SHA-256 a8b9217d2ce96c34ed5a18ccaebd34c342bcc6624787f6b9cb957ac2647e4795
-- Promoted from approved isolated contract; explicit release gate below.

do $$begin if current_setting('document.release_authorized',true) is distinct from 'DOCUMENT_V1' then raise exception 'DOCUMENT_RELEASE_AUTHORIZATION_REQUIRED';end if;end$$;
create table document_integration_private.submissions(
 id uuid primary key,actor uuid not null,claims jsonb not null,function_name text not null,arguments jsonb not null,documents jsonb not null,
 created_at timestamptz not null default clock_timestamp(),completed_at timestamptz,result jsonb,
 check((completed_at is null)=(result is null))
);
revoke all on document_integration_private.submissions from public,anon,authenticated;
create function public.prepare_document_submission(p_id uuid,p_function text,p_arguments jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare o document_integration_private.submissions;ids uuid[];id uuid;d public.affiliate_documents;a public.private_assets;docs jsonb:='[]';begin
 perform document_integration_private.session_required();
 if p_id is null or p_function not in('attach_request_documents','create_program_request_with_documents','create_membership_request','submit_self_savings_request','finalize_program_request_context','renta_car_submit') or jsonb_typeof(p_arguments)<>'object' then raise exception 'SUBMISSION_CONTRACT_DENIED' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('document-submission:'||p_id,0));
 select * into o from document_integration_private.submissions where submissions.id=p_id;
 if o.id is not null then
  if o.actor<>auth.uid() or o.claims->>'session_id' is distinct from auth.jwt()->>'session_id' or o.function_name<>p_function or o.arguments<>p_arguments then raise exception 'IDEMPOTENCY_ARGUMENT_MISMATCH';end if;
  return jsonb_build_object('id',o.id,'documents',o.documents,'completed',o.completed_at is not null);
 end if;
 if p_function='submit_self_savings_request' then ids:=case when p_arguments->>'p_supporting_document_id' is null then '{}'::uuid[] else array[(p_arguments->>'p_supporting_document_id')::uuid] end;
 else select coalesce(array_agg(x::uuid),'{}') into ids from jsonb_array_elements_text(coalesce(p_arguments->'p_document_ids',p_arguments->'p_affiliate_document_ids',p_arguments->'p_documents','[]'::jsonb)) x;end if;
 for id in select distinct unnest(ids) order by 1 loop
  d:=document_evidence_private.lock_document(id);
  if d.affiliate_id is distinct from public.get_effective_affiliate_id() or document_integration_private.current_document(d.affiliate_id,d.document_type_id) is distinct from id then raise exception 'DOCUMENT_NOT_CURRENT' using errcode='42501';end if;
  select * into a from public.private_assets where private_assets.id=coalesce(d.private_asset_id,(select private_asset_id from public.affiliate_files where affiliate_files.id=d.affiliate_file_id));
  if a.owner_affiliate_id is distinct from d.affiliate_id or a.status<>'READY' then raise exception 'DOCUMENT_CONTEXT_DENIED' using errcode='42501';end if;
  docs:=docs||jsonb_build_array(jsonb_build_object('document_id',id,'asset',a.id,'bucket',a.storage_bucket,'path',a.storage_path,'mime',a.mime_type,'size',a.file_size,'sha256',lower(a.content_sha256)));
 end loop;
 insert into document_integration_private.submissions(id,actor,claims,function_name,arguments,documents) values(p_id,auth.uid(),auth.jwt(),p_function,p_arguments,docs);
 return jsonb_build_object('id',p_id,'documents',docs,'completed',false);
end$$;
create function document_integration_private.require_submission(p_document uuid) returns void language plpgsql security definer set search_path='' as $$declare o document_integration_private.submissions;begin
 select * into o from document_integration_private.submissions where id=nullif(current_setting('document.verified_submission',true),'')::uuid;
 if o.id is null or o.actor<>auth.uid() or o.claims->>'session_id' is distinct from auth.jwt()->>'session_id' or not exists(select 1 from jsonb_array_elements(o.documents) x where x->>'document_id'=p_document::text) then raise exception 'PHYSICAL_VERIFICATION_REQUIRED' using errcode='42501';end if;
end$$;
create function public.complete_document_submission(p_id uuid,p_receipts jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare o document_integration_private.submissions;d jsonb;r jsonb;proc record;calls text;result jsonb;matches integer;begin
 if auth.role()<>'service_role' then raise exception 'SERVICE_REQUIRED' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('document-submission:'||p_id,0));
 select * into o from document_integration_private.submissions where id=p_id for update;
 if o.id is null then raise exception 'SUBMISSION_NOT_FOUND';end if;
 perform set_config('request.jwt.claims',o.claims::text,true);perform set_config('request.jwt.claim.sub',o.actor::text,true);perform set_config('request.jwt.claim.role','authenticated',true);
 perform document_integration_private.session_required();
 if jsonb_typeof(p_receipts) is distinct from 'array' or jsonb_array_length(p_receipts)<>jsonb_array_length(o.documents) then raise exception 'VERIFICATION_RECEIPT_INVALID';end if;
 for d in select value from jsonb_array_elements(o.documents) loop
  select value into r from jsonb_array_elements(p_receipts) where value->>'document_id'=d->>'document_id';
  if r->>'verified' is distinct from 'true' or r->>'sha256' is distinct from d->>'sha256' or r->>'size' is distinct from d->>'size' or r->>'mime' is distinct from d->>'mime' then raise exception 'VERIFICATION_RECEIPT_INVALID';end if;
 end loop;
 if o.completed_at is not null then return o.result;end if;
 -- Dispatch only to an existing allowlisted public signature whose complete named arguments match.
 select count(*) into matches from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=o.function_name and p.proargnames is not null
 and (select array_agg(k order by k) from jsonb_object_keys(o.arguments) k)=(select array_agg(k order by k) from unnest(p.proargnames) k);
 if matches<>1 then raise exception 'SUBMISSION_SIGNATURE_DRIFT';end if;
 select p.* into proc from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=o.function_name
 and (select array_agg(k order by k) from jsonb_object_keys(o.arguments) k)=(select array_agg(k order by k) from unnest(p.proargnames) k);
 select string_agg(format('%I => %s',proc.proargnames[k+1],case when proc.proargtypes[k]='uuid[]'::regtype then format('(select array_agg(v::uuid) from jsonb_array_elements_text($1->%L) v)',proc.proargnames[k+1]) else format('($1->>%L)::%s',proc.proargnames[k+1],format_type(proc.proargtypes[k],null)) end),', ' order by k) into calls from generate_series(0,proc.pronargs-1) k;
 perform set_config('document.verified_submission',o.id::text,true);
 execute format('select to_jsonb(public.%I(%s))',o.function_name,calls) into result using o.arguments;
 update document_integration_private.submissions set result=coalesce(result,'null'::jsonb),completed_at=clock_timestamp() where id=o.id;
 return result;
end$$;
-- Gate the shared evidence writer, without modifying financial functions.
do $$declare def text;begin def:=pg_get_functiondef('public.attach_request_documents(uuid,uuid[])'::regprocedure);if position('d:=document_evidence_private.lock_document(doc);' in def)=0 then raise exception 'ATTACH_CONTRACT_DRIFT';end if;execute replace(def,'d:=document_evidence_private.lock_document(doc);','perform document_integration_private.require_submission(doc);d:=document_evidence_private.lock_document(doc);');end$$;
create function document_integration_private.pin_savings() returns trigger language plpgsql security definer set search_path='' as $$declare d public.affiliate_documents;a public.private_assets;s uuid;begin
 if new.supporting_document_id is null then return new;end if;
 perform document_integration_private.require_submission(new.supporting_document_id);
 d:=document_evidence_private.lock_document(new.supporting_document_id);
 select id into s from document_evidence_private.sets where context_id=new.id and kind='ORIGINAL';
 select * into a from public.private_assets where id=coalesce(d.private_asset_id,(select private_asset_id from public.affiliate_files where id=d.affiliate_file_id));
 insert into document_evidence_private.savings_documents(context_id,set_id,affiliate_document_id,private_asset_id,asset_sha256,created_at) values(new.id,s,d.id,a.id,a.content_sha256,clock_timestamp());
 update document_evidence_private.sets set sealed_at=clock_timestamp(),sealed_by=auth.uid() where id=s;
 return new;
end$$;
create trigger zzz_phase4_savings_pin after insert on public.savings_requests for each row execute function document_integration_private.pin_savings();
revoke all on all functions in schema document_integration_private from public,anon,authenticated;
revoke all on function public.prepare_document_submission(uuid,text,jsonb),public.complete_document_submission(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.prepare_document_submission(uuid,text,jsonb) to authenticated;
grant execute on function public.complete_document_submission(uuid,jsonb) to service_role;

-- Source: 20261108001000_consumer_guards.sql SHA-256 0fe9e5549a127cd745404bd17c2bda7f6d6b72a702725e7c8f9c3c5be87fc4d1
-- Promoted from approved isolated contract; explicit release gate below.

do $$begin if current_setting('document.release_authorized',true) is distinct from 'DOCUMENT_V1' then raise exception 'DOCUMENT_RELEASE_AUTHORIZATION_REQUIRED';end if;end$$;
create function document_integration_private.assert_registration(p_type uuid,p_path text,p_mime text,p_size bigint,p_sha text) returns void language plpgsql security definer set search_path='' as $$declare o document_lab_integrity.operations;begin
 select * into o from document_lab_integrity.operations where id=nullif(current_setting('document.integration_operation',true),'')::uuid;
 if o.id is null or o.document_id is not null or o.actor_id<>auth.uid() or o.registration_context->'claims'->>'session_id' is distinct from auth.jwt()->>'session_id'
 or o.registration_context->>'type' is distinct from p_type::text or o.source is distinct from p_path or o.mime is distinct from p_mime or o.size is distinct from p_size or o.sha256 is distinct from lower(p_sha)
 or not exists(select 1 from document_lab_integrity.assets a where a.id=o.id and a.affiliate_id=o.affiliate_id and a.path=o.source and a.bucket='private-assets' and a.sha256=o.sha256 and a.size=o.size and a.mime=o.mime and a.state='AVAILABLE') then raise exception 'VERIFIED_UPLOAD_REQUIRED' using errcode='42501';end if;
end$$;
do $$declare sig text;def text;needle text;begin
 needle:='if coalesce(current_setting(''document.integration_operation'',true),'''')='''' then raise exception ''VERIFIED_UPLOAD_REQUIRED'' using errcode=''42501'';end if;';
 foreach sig in array array['public.register_affiliate_document(uuid,text,text,bigint,text,text)','public.register_admin_affiliate_document(uuid,uuid,text,text,bigint,text,text)'] loop
  def:=pg_get_functiondef(sig::regprocedure);if position(needle in def)=0 then raise exception 'REGISTRATION_GUARD_DRIFT';end if;
  execute replace(def,needle,'perform document_integration_private.assert_registration(p_document_type_id,p_storage_path,p_mime_type,p_file_size,p_sha256);');
 end loop;
end$$;
create function document_integration_private.guard_submission() returns trigger language plpgsql set search_path='' as $$begin
 if tg_op='DELETE' or (to_jsonb(new)-array['completed_at','result']) is distinct from (to_jsonb(old)-array['completed_at','result']) or (old.completed_at is not null and to_jsonb(new) is distinct from to_jsonb(old)) then raise exception 'SUBMISSION_HISTORY_IMMUTABLE';end if;return new;
end$$;
create trigger submission_immutable before update or delete on document_integration_private.submissions for each row execute function document_integration_private.guard_submission();
create function public.list_current_document_reviews() returns jsonb language plpgsql security definer set search_path='' as $$declare rows jsonb;begin
 perform document_integration_private.session_required();if not public.has_admin_permission('documents.read') then raise exception 'DOCUMENT_CONTEXT_DENIED' using errcode='42501';end if;
 select coalesce(jsonb_agg(v.row order by v.created_at),'[]') into rows from (
 select d.created_at,to_jsonb(d)||jsonb_build_object('document_type',jsonb_build_object('id',t.id,'code',t.code,'label',t.label,'icon',t.icon),'affiliate',jsonb_build_object('display_name',a.display_name,'full_name',a.full_name,'numero_control',a.numero_control),'mimeType',p.mime_type) row
 from document_retirement_private.active_documents d join public.document_types t on t.id=d.document_type_id join public.affiliates a on a.id=d.affiliate_id
 left join public.affiliate_files f on f.id=d.affiliate_file_id left join public.private_assets p on p.id=coalesce(d.private_asset_id,f.private_asset_id)
 where d.status in('PENDING_REVIEW','UNDER_REVIEW','REUPLOAD_REQUIRED') order by d.created_at limit 100) v;return rows;
end$$;
create function public.list_archived_document_contexts(p_mode text) returns jsonb language plpgsql security definer set search_path='' as $$declare rows jsonb:='[]';c document_evidence_private.contexts;i jsonb;begin
 perform document_integration_private.session_required();
 for c in select * from document_evidence_private.contexts where state='ARCHIVED' order by created_at desc loop
  begin i:=document_access_private.authorize_context(c.id,p_mode,false);
   rows:=rows||jsonb_build_array(jsonb_build_object('id',c.id,'source',case c.domain when 'SAVINGS' then 'SAVINGS' else 'REQUEST' end,'label',coalesce(c.folio,c.id::text)));
  exception when insufficient_privilege then null;end;
 end loop;return rows;
end$$;
revoke all on all functions in schema document_integration_private from public,anon,authenticated;
revoke all on function public.list_current_document_reviews(),public.list_archived_document_contexts(text) from public,anon;
grant execute on function public.list_current_document_reviews(),public.list_archived_document_contexts(text) to authenticated;

-- Source: 20261108001100_pinned_metadata.sql SHA-256 571c9f84f7a6e7d04fd3e42330927037493855718c00d6b57b3a9d4d2db9ab08
-- Promoted from approved isolated contract; explicit release gate below.

do $$declare def text;begin
 if current_setting('document.release_authorized',true) is distinct from 'DOCUMENT_V1' then raise exception 'DOCUMENT_RELEASE_AUTHORIZATION_REQUIRED';end if;
 def:=pg_get_functiondef('public.list_archived_document_contexts(text)'::regprocedure);
 execute replace(def,'coalesce(c.folio,c.id::text)','coalesce((select a.folio from public.program_request_deletions a where a.request_id=c.id order by a.created_at limit 1),(select r.folio from public.savings_requests r where r.id=c.id),c.id::text)');
 def:=pg_get_functiondef('public.list_document_evidence(uuid,text,text)'::regprocedure);
 execute replace(def,$old$left join public.document_types dt on dt.id=(x.value->>'document_type_id')::uuid$old$, $new$left join public.affiliate_documents pinned on pinned.id=(x.value->>'affiliate_document_id')::uuid left join public.document_types dt on dt.id=coalesce((x.value->>'document_type_id')::uuid,pinned.document_type_id)$new$);
 def:=pg_get_functiondef('public.complete_document_submission(uuid,jsonb)'::regprocedure);
 def:=replace(def,'result jsonb;matches','v_result jsonb;matches');
 def:=replace(def,'into result using','into v_result using');
 def:=replace(def,'set result=coalesce(result,','set result=coalesce(v_result,');
 def:=replace(def,'return result;','return v_result;');execute def;
end$$;

-- Source: 20261108001200_controlled_conflicts.sql SHA-256 0c372d970f2501d64a4e294d7817d7408ad1c85e0b0b80f0bbb57b2c5eb6383a
-- Promoted from approved isolated contract; explicit release gate below.

do $$declare sig text;def text;begin
 if current_setting('document.release_authorized',true) is distinct from 'DOCUMENT_V1' then raise exception 'DOCUMENT_RELEASE_AUTHORIZATION_REQUIRED';end if;
 foreach sig in array array['public.prepare_document_operation(uuid,text,uuid,uuid,text,bigint,text,uuid,text,text)','public.complete_document_operation(uuid,jsonb)'] loop
  def:=pg_get_functiondef(sig::regprocedure);execute replace(def,'errcode=''40001''','errcode=''PT409''');
 end loop;
end$$;

-- Source: 20261108001300_financial_evidence_adapter.sql SHA-256 baae55a915fb397d04bf87eb9b06519b4fefeddc9a4cf64732fbbcd5ba44128b
-- Promoted from approved isolated contract; explicit release gate below.

do $$begin if current_setting('document.release_authorized',true) is distinct from 'DOCUMENT_V1' then raise exception 'DOCUMENT_RELEASE_AUTHORIZATION_REQUIRED';end if;end$$;
create table document_integration_private.writer_patch_evidence(signature text primary key,before_sha256 text not null,after_sha256 text not null,unchanged_remainder_sha256 text not null);
revoke all on document_integration_private.writer_patch_evidence from public,anon,authenticated;
create function document_integration_private.attach_verified_financial(p_request uuid,p_documents uuid[]) returns integer language plpgsql security definer set search_path='' as $$declare o document_integration_private.submissions;saved jsonb;result integer;begin
 select * into o from document_integration_private.submissions where id=nullif(current_setting('document.verified_submission',true),'')::uuid;
 if o.id is null or o.function_name not in('create_validated_financial_program_request','confirm_program_product_financing') then raise exception 'PHYSICAL_VERIFICATION_REQUIRED' using errcode='42501';end if;
 saved:=auth.jwt();perform set_config('request.jwt.claims',o.claims::text,true);perform set_config('request.jwt.claim.sub',o.actor::text,true);perform set_config('request.jwt.claim.role','authenticated',true);
 result:=public.attach_request_documents(p_request,p_documents);
 perform set_config('request.jwt.claims',saved::text,true);perform set_config('request.jwt.claim.role','service_role',true);return result;
end$$;
do $$declare def text;changed text;pattern text;replacement text;f record;begin
 def:=pg_get_functiondef('public.prepare_document_submission(uuid,text,jsonb)'::regprocedure);
 def:=replace(def,'''finalize_program_request_context'',''renta_car_submit'')','''finalize_program_request_context'',''renta_car_submit'',''create_validated_financial_program_request'',''confirm_program_product_financing'')');
 def:=replace(def,'coalesce(p_arguments->''p_document_ids''','coalesce(p_arguments->''p_submission''->''p_document_ids'',p_arguments->''p_document_ids''');execute def;
 def:=pg_get_functiondef('public.complete_document_submission(uuid,jsonb)'::regprocedure);
 def:=replace(def,'CREATE OR REPLACE FUNCTION public.complete_document_submission(', 'CREATE OR REPLACE FUNCTION public.complete_document_financial_submission(');
 def:=replace(def,'perform document_integration_private.session_required();',
 $guard$perform document_integration_private.session_required();
 if o.function_name not in('create_validated_financial_program_request','confirm_program_product_financing')
 or coalesce(o.arguments->'p_submission'->>'p_actor_real_auth_user_id',o.arguments->>'p_actor_real_auth_user_id') is distinct from o.actor::text
 or coalesce(o.arguments->'p_submission'->>'p_affiliate_id',o.arguments->>'p_affiliate_id') is distinct from public.get_effective_affiliate_id()::text then raise exception 'FINANCIAL_DOCUMENT_CONTEXT_DENIED' using errcode='42501';end if;$guard$);
 def:=replace(def,'execute format(''select to_jsonb(public.%I(%s))''',
 $role$perform set_config('request.jwt.claims',(o.claims||jsonb_build_object('role','service_role'))::text,true);perform set_config('request.jwt.claim.role','service_role',true);
 execute format('select to_jsonb(public.%I(%s))'$role$);execute def;
 -- The ordinary document endpoint must never dispatch a protected financial writer.
 def:=pg_get_functiondef('public.complete_document_submission(uuid,jsonb)'::regprocedure);
 execute replace(def,'perform document_integration_private.session_required();',
 $deny$perform document_integration_private.session_required();if o.function_name in('create_validated_financial_program_request','confirm_program_product_financing') then raise exception 'FINANCIAL_WRITER_REQUIRED' using errcode='42501';end if;$deny$);
 pattern:='insert into public\.request_documents\(request_id,document_type_id,affiliate_document_id,private_asset_id,asset_sha256,status_at_submission\)[\s\S]*?on conflict\(request_id,document_type_id\) do nothing;';
 replacement:='perform document_integration_private.attach_verified_financial(v_row.id,p_document_ids);';
 for f in select p.oid,p.oid::regprocedure::text signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('create_validated_financial_program_request','create_validated_financial_program_request_bank_required','create_validated_financial_program_request_v1_engine','create_validated_program_product_payment_request') loop
  def:=pg_get_functiondef(f.oid);if regexp_count(def,pattern,'1','i')<>1 then raise exception 'FINANCIAL_DOCUMENT_FRAGMENT_DRIFT: %',f.signature;end if;
  changed:=regexp_replace(def,pattern,replacement,'i');
  if replace(changed,replacement,'') is distinct from regexp_replace(def,pattern,'','i') then raise exception 'FINANCIAL_REMAINDER_CHANGED';end if;
  execute changed;
  insert into document_integration_private.writer_patch_evidence values(f.signature,encode(extensions.digest(def,'sha256'),'hex'),encode(extensions.digest(changed,'sha256'),'hex'),encode(extensions.digest(regexp_replace(def,pattern,'','i'),'sha256'),'hex'));
 end loop;
end$$;
revoke all on all functions in schema document_integration_private from public,anon,authenticated;
revoke all on function public.complete_document_financial_submission(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.complete_document_financial_submission(uuid,jsonb) to service_role;

-- Source: 20261108001400_savings_support.sql SHA-256 f55307b9942ef17581ed60fb09ad16c25832ca4140836ab06d6e9786815cf5d2
-- Promoted from approved isolated contract; explicit release gate below.

do $$declare def text;changed text;sig text:='public.savings_runtime_submit(uuid,jsonb,uuid,boolean)';needle text:='kind text; doc uuid; note text:=';replacement text:='kind text; doc uuid:=nullif(p_command->>''document_id'','''')::uuid; note text:=';begin
 if current_setting('document.release_authorized',true) is distinct from 'DOCUMENT_V1' then raise exception 'DOCUMENT_RELEASE_AUTHORIZATION_REQUIRED';end if;
 def:=pg_get_functiondef(sig::regprocedure);if position(needle in def)=0 then raise exception 'SAVINGS_DOCUMENT_CONTRACT_DRIFT';end if;
 changed:=replace(def,needle,replacement);
 if replace(changed,replacement,'') is distinct from replace(def,needle,'') then raise exception 'SAVINGS_FINANCIAL_REMAINDER_CHANGED';end if;
 execute changed;
 insert into document_integration_private.writer_patch_evidence values(sig,encode(extensions.digest(def,'sha256'),'hex'),encode(extensions.digest(changed,'sha256'),'hex'),encode(extensions.digest(replace(def,needle,''),'sha256'),'hex'));
end$$;

-- Source: 20261108001500_private_ledgers.sql SHA-256 b73057670d5273917176ba1f9275d4aaeb1b6d10a49ae36e5fd2a01bc6947133
-- Promoted from approved isolated contract; explicit release gate below.

do $$begin if current_setting('document.release_authorized',true) is distinct from 'DOCUMENT_V1' then raise exception 'DOCUMENT_RELEASE_AUTHORIZATION_REQUIRED';end if;end$$;
alter table document_integration_private.submissions enable row level security;
alter table document_integration_private.submissions force row level security;
alter table document_integration_private.writer_patch_evidence enable row level security;
alter table document_integration_private.writer_patch_evidence force row level security;

-- Source: 20261108001600_metadata_access.sql SHA-256 7bf8ea75c0a1f00aa5ad55d33852f6bf6b912031e4a10e6bdf6cc8d8d7bd28c0
-- Promoted from approved isolated contract; explicit release gate below.

do $$begin if current_setting('document.release_authorized',true) is distinct from 'DOCUMENT_V1' then raise exception 'DOCUMENT_RELEASE_AUTHORIZATION_REQUIRED';end if;end$$;
-- Retain every identity/capability check. Viewing does not depend on a logging insert.
do $$declare signature text; definition text; replacement text;
begin
 foreach signature in array array['public.list_effective_affiliate_documents(text)','public.list_admin_affiliate_documents(uuid,text)'] loop
  definition:=pg_get_functiondef(signature::regprocedure);
  replacement:=regexp_replace(definition,'[ \t]*insert into public.document_access_audit_log[(][^;]*;[ \t\r\n]*','','gi');
  if replacement=definition then raise exception 'VIEW_AUDIT_BASELINE_DRIFT: %',signature;end if;
  execute replacement;
 end loop;
end$$;
create function public.list_document_version_ordinals(p_affiliate uuid) returns table(document_id uuid,version bigint)
language plpgsql security definer set search_path='' as $$begin
 perform document_integration_private.session_required();
 if not(public.get_effective_affiliate_id()=p_affiliate or public.has_admin_permission('documents.read')) then raise exception 'DOCUMENT_CONTEXT_DENIED' using errcode='42501';end if;
 return query select d.id,row_number() over(partition by d.document_type_id order by d.created_at,d.id) from public.affiliate_documents d where d.affiliate_id=p_affiliate;
end$$;
revoke all on function public.list_document_version_ordinals(uuid) from public,anon;
grant execute on function public.list_document_version_ordinals(uuid) to authenticated;

-- Source: 20261108001700_generated_history_listing.sql SHA-256 1501c67dd43968f07233464c8db4e2094f567842242995877aa1ff8160f9e712
-- Read-only listing of original generated records through durable contexts.

do $$begin if current_setting('document.release_authorized',true) is distinct from 'DOCUMENT_V1' then raise exception 'DOCUMENT_RELEASE_AUTHORIZATION_REQUIRED';end if;end$$;
create function public.list_generated_document_evidence(p_context uuid,p_domain text,p_mode text) returns jsonb language plpgsql security definer set search_path='' as $$
declare identity jsonb;result jsonb;begin
 perform document_integration_private.session_required();identity:=document_access_private.authorize_context(p_context,p_mode,true);
 if p_domain not in('program','savings') or not exists(select 1 from document_evidence_private.contexts where id=p_context and domain=upper(p_domain)) then raise exception 'DOCUMENT_CONTEXT_DENIED' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'domain',q.domain,'operation_id',q.operation_id,'business_version',q.business_version,'document_type',q.document_type,'program',q.program,'folio',q.folio,'occurred_at',q.occurred_at,'status',q.status,'error_code',q.error_code,
 'can_retry',p_mode='ADMIN' and document_private.visible(q,true) and public.has_admin_permission('document_generation.retry') and q.status='FAILED',
 'can_reissue',p_mode='ADMIN' and document_private.visible(q,true) and public.has_admin_permission('document_generation.retry') and public.has_admin_permission('document_generation.config.write') and q.status='READY' and not exists(select 1 from document_private.records newer where newer.domain=q.domain and newer.operation_id=q.operation_id and newer.final_event_id=q.final_event_id and newer.document_type=q.document_type and newer.business_version>q.business_version)) order by q.occurred_at desc,q.id),'[]'::jsonb) into result
 from document_private.records q where q.operation_id=p_context and q.domain=p_domain and q.affiliate_id::text=identity->>'target';
 return result;
end$$;
revoke all on function public.list_generated_document_evidence(uuid,text,text) from public,anon;
grant execute on function public.list_generated_document_evidence(uuid,text,text) to authenticated;

-- Source: 20261108001800_existing_webp_support.sql SHA-256 edfac7832b6cd870ca295a1f35bc77b93c24877ec96326171d74c21437821d44

do $$
declare body text; next_body text;
begin
 if current_setting('document.release_authorized',true) is distinct from 'DOCUMENT_V1' then raise exception 'DOCUMENT_RELEASE_AUTHORIZATION_REQUIRED';end if;
 body:=pg_get_functiondef('public.prepare_document_operation(uuid,text,uuid,uuid,text,bigint,text,uuid,text,text)'::regprocedure);
 next_body:=replace(body,'''image/png'',''image/jpeg'',''application/pdf''','''image/png'',''image/jpeg'',''application/pdf'',''image/webp''');
 next_body:=replace(next_body,'when ''image/jpeg'' then ''.jpg'' else ''.pdf''','when ''image/jpeg'' then ''.jpg'' when ''image/webp'' then ''.webp'' else ''.pdf''');
 if next_body=body or position('''.webp''' in next_body)=0 then raise exception 'WEBP_ADAPTER_SOURCE_MISMATCH';end if;
 execute next_body;
end$$;

-- Legacy assets retain their NULL owner. Authorization follows the exact existing
-- document/context association, never an equal hash or a caller-supplied asset.
do $$declare body text;next_body text;begin
 body:=pg_get_functiondef('public.resolve_document_access(text,uuid,text)'::regprocedure);
 next_body:=replace(body,
  'a.owner_affiliate_id is distinct from d.affiliate_id',
  '(a.owner_affiliate_id is not null and a.owner_affiliate_id<>d.affiliate_id) or coalesce(d.private_asset_id,(select private_asset_id from public.affiliate_files where id=d.affiliate_file_id)) is distinct from a.id');
 next_body:=replace(next_body,
  'a.owner_affiliate_id::text is distinct from i->>''target''',
  '(a.owner_affiliate_id is not null and a.owner_affiliate_id::text<>i->>''target'') or not exists(select 1 from public.affiliate_documents pinned where pinned.id=(r->>''affiliate_document_id'')::uuid and pinned.affiliate_id::text=i->>''target'')');
 if next_body=body then raise exception 'LEGACY_ACCESS_ADAPTER_DRIFT';end if;execute next_body;
 body:=pg_get_functiondef('public.prepare_document_submission(uuid,text,jsonb)'::regprocedure);
 next_body:=replace(body,'a.owner_affiliate_id is distinct from d.affiliate_id','(a.owner_affiliate_id is not null and a.owner_affiliate_id<>d.affiliate_id)');
 if next_body=body then raise exception 'LEGACY_SUBMISSION_ADAPTER_DRIFT';end if;execute next_body;
end$$;
-- Archive snapshots already preserve request/document identity. Add durable
-- contexts without modifying snapshots, associations, assets or ownership.
insert into document_evidence_private.contexts(id,domain,affiliate_id,state,provenance,created_at,archived_at)
 select distinct on(x.request_id) x.request_id,'PROGRAM',a.id,'ARCHIVED','ARCHIVE',x.created_at,coalesce(x.completed_at,x.created_at)
 from public.program_request_deletions x join public.affiliates a on a.id::text=x.snapshot->'request'->>'affiliate_id'
 where x.snapshot->'request'->>'id'=x.request_id::text
 order by x.request_id,x.created_at desc
 on conflict(id) do nothing;
insert into document_evidence_private.sets(context_id,kind,sealed_at)
 select c.id,'ORIGINAL',c.archived_at from document_evidence_private.contexts c where c.state='ARCHIVED'
 on conflict do nothing;
-- Service-backed logical retirement is the only published withdrawal path.
-- No physical worker, purge scheduler, deletion or quarantine is deployed.

NOTIFY pgrst, 'reload schema';
COMMIT;
