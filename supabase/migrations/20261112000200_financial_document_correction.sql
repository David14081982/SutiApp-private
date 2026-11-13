-- PREPARED ONLY. Owner-authorized exception: replace an observed pending-loan attachment.
-- No archive of replaced bytes; technical operation metadata is not an image backup.
begin;
set local lock_timeout='2s';
do $$begin
 if not exists(select 1 from pg_trigger where tgrelid='public.request_documents'::regclass and tgname='evidence_immutable'
 and tgfoid='document_evidence_private.immutable()'::regprocedure and tgenabled='O') then raise exception 'CORRECTION_TRIGGER_DRIFT';end if;
 if not exists(select 1 from pg_constraint where conrelid='document_lab_integrity.assets'::regclass and conname='assets_state_check'
 and pg_get_constraintdef(oid) like '%QUARANTINE_PENDING%' and pg_get_constraintdef(oid) like '%INTEGRITY_ERROR%') then raise exception 'CORRECTION_CONSTRAINT_DRIFT';end if;
end$$;
create table financial_review_private.corrections(
 id uuid primary key,request_id uuid not null references public.program_requests(id) on delete restrict,
 association_id uuid not null,old_document uuid not null,old_asset uuid not null,
 new_document uuid,new_asset uuid,actor uuid not null,session_id text not null,source_hash text not null,
 phase text not null default 'PREPARED' check(phase in('PREPARED','LINKED','COMPLETE','SUPERSEDED','DISCARDED')),
 created_at timestamptz not null default now(),completed_at timestamptz
);
alter table financial_review_private.corrections enable row level security;
alter table financial_review_private.corrections force row level security;
create index open_corrections on financial_review_private.corrections(association_id) where phase='PREPARED';
-- Non-available state blocks all existing document consumers while physical deletion retries.
alter table document_lab_integrity.assets drop constraint assets_state_check;
alter table document_lab_integrity.assets add constraint assets_state_check check(state in('AVAILABLE','QUARANTINE_PENDING','QUARANTINED','INTEGRITY_ERROR','REPLACED'));

create function financial_review_private.assert_exclusive(p_asset uuid,p_association uuid,p_document uuid) returns void language plpgsql security definer set search_path='' as $$begin
 perform pg_advisory_xact_lock(hashtextextended('document-asset:'||p_asset,0));
 if exists(select 1 from document_evidence_private.references_for(p_asset) r
 where not(r.source='request_documents' and r.source_key=p_association::text)
 and not(r.source='affiliate_documents' and r.source_key=p_document::text)) then
 raise exception 'CORRECTION_SHARED_DOCUMENT' using errcode='PT409';end if;
end$$;
create function public.prepare_financial_document_correction(p_id uuid,p_request_id uuid,p_association_id uuid,p_source_hash text,p_mime text,p_size bigint,p_sha text) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.program_requests;d public.request_documents;v financial_review_private.reviews;c financial_review_private.corrections;a public.private_assets;prepared jsonb;begin
 perform document_integration_private.session_required();
 select * into r from public.program_requests where id=p_request_id for update;
 if r.id is null or r.affiliate_id is distinct from public.get_effective_affiliate_id() or r.program_id<>'prestamo' then raise exception 'CORRECTION_DENIED' using errcode='42501';end if;
 if r.status not in('submitted','in_review','requires_financial_processing') then raise exception 'CORRECTION_REQUEST_CLOSED';end if;
 select * into c from financial_review_private.corrections where id=p_id;
 if c.id is null then select j.* into c from financial_review_private.corrections j join document_lab_integrity.operations o on o.id=j.id
 where j.association_id=p_association_id and j.phase='PREPARED' and j.actor=auth.uid() and j.session_id=auth.jwt()->>'session_id'
 and j.source_hash=p_source_hash and o.sha256=lower(p_sha) and o.mime=p_mime and o.size=p_size order by j.created_at desc limit 1;end if;
 if c.id is not null then
 if c.actor<>auth.uid() or c.session_id is distinct from auth.jwt()->>'session_id' or c.request_id<>p_request_id or c.association_id<>p_association_id then raise exception 'CORRECTION_DENIED' using errcode='42501';end if;
 if c.phase in('SUPERSEDED','DISCARDED') then raise exception 'CORRECTION_OBSERVATION_CHANGED';end if;
 prepared:=public.get_document_operation(c.id);
 if prepared->>'sha256' is distinct from lower(p_sha) or prepared->>'mime' is distinct from p_mime or (prepared->>'size')::bigint is distinct from p_size then raise exception 'CORRECTION_UPLOAD_ALREADY_PENDING';end if;
 return prepared||jsonb_build_object('correction_phase',c.phase);end if;
 select * into d from public.request_documents where id=p_association_id and request_id=r.id for update;
 select * into v from financial_review_private.reviews where request_id=r.id for update;
 if d.id is null or v.phase is distinct from 'COMPLETE' or v.source_hash is distinct from p_source_hash
 or v.source_hash is distinct from financial_review_private.fingerprint(r.id)
 or not exists(select 1 from jsonb_array_elements(v.result->'observations') x where x->>'document_id'=d.id::text and x->>'correctable'='true') then raise exception 'CORRECTION_OBSERVATION_CHANGED';end if;
 select * into a from public.private_assets where id=d.private_asset_id;
 if a.storage_bucket<>'private-assets' or a.storage_path not like 'affiliate-documents/%' or a.status<>'READY' then raise exception 'CORRECTION_NATIVE_FILE_REQUIRED';end if;
 perform financial_review_private.assert_exclusive(d.private_asset_id,d.id,d.affiliate_document_id);
 prepared:=public.prepare_document_operation(p_id,'SELF_SERVICE',null,d.document_type_id,p_mime,p_size,p_sha,d.affiliate_document_id,'FILE','Corrección del documento observado');
 insert into financial_review_private.corrections(id,request_id,association_id,old_document,old_asset,actor,session_id,source_hash)
 values(p_id,r.id,d.id,d.affiliate_document_id,d.private_asset_id,auth.uid(),auth.jwt()->>'session_id',p_source_hash);
 return prepared||jsonb_build_object('correction_phase','PREPARED');
end$$;

-- Replace only this trigger, not the shared immutable function protecting other domains.
create function financial_review_private.guard_attachment() returns trigger language plpgsql security definer set search_path='' as $$
declare c financial_review_private.corrections;begin
 if tg_op='DELETE' then raise exception 'EVIDENCE_IMMUTABLE';end if;
 select * into c from financial_review_private.corrections where id=nullif(current_setting('financial.review_correction',true),'')::uuid;
 if c.id is null or c.phase<>'PREPARED' or c.association_id<>old.id or c.request_id<>old.request_id or c.old_asset<>old.private_asset_id
 or c.new_asset is distinct from new.private_asset_id or c.new_document is distinct from new.affiliate_document_id
 or (to_jsonb(new)-array['private_asset_id','affiliate_document_id','asset_sha256']) is distinct from (to_jsonb(old)-array['private_asset_id','affiliate_document_id','asset_sha256'])
 or not exists(select 1 from public.program_requests r where r.id=c.request_id and r.status in('submitted','in_review','requires_financial_processing')) then raise exception 'EVIDENCE_IMMUTABLE';end if;
 return new;
end$$;
drop trigger evidence_immutable on public.request_documents;
create trigger evidence_immutable before update or delete on public.request_documents for each row execute function financial_review_private.guard_attachment();

create function public.complete_financial_document_correction(p_id uuid,p_receipt jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare c financial_review_private.corrections;r public.program_requests;d public.affiliate_documents;a public.private_assets;res jsonb;claims jsonb:=auth.jwt();begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_REQUIRED' using errcode='42501';end if;
 select * into c from financial_review_private.corrections where id=p_id;
 if c.id is null then raise exception 'CORRECTION_NOT_FOUND';end if;
 select * into r from public.program_requests where id=c.request_id for update;
 select * into c from financial_review_private.corrections where id=p_id for update;
 if c.phase in('SUPERSEDED','DISCARDED') then raise exception 'CORRECTION_OBSERVATION_CHANGED';end if;
 if c.phase<>'PREPARED' then select * into a from public.private_assets where id=c.old_asset;return jsonb_build_object('phase',c.phase,'request_id',c.request_id,'bucket',a.storage_bucket,'path',a.storage_path);end if;
 if r.status not in('submitted','in_review','requires_financial_processing') then raise exception 'CORRECTION_REQUEST_CLOSED';end if;
 if financial_review_private.fingerprint(r.id)<>c.source_hash then raise exception 'CORRECTION_OBSERVATION_CHANGED';end if;
 perform financial_review_private.assert_exclusive(c.old_asset,c.association_id,c.old_document);
 res:=public.complete_document_operation(p_id,p_receipt);
 -- Existing completion restores the original authenticated actor for registration.
 select * into strict d from public.affiliate_documents where id=(res->'document'->>'id')::uuid;
 if d.affiliate_id<>r.affiliate_id or d.replaces_document_id is distinct from c.old_document then raise exception 'CORRECTION_DOCUMENT_MISMATCH';end if;
 select * into strict a from public.private_assets where id=d.private_asset_id;
 update financial_review_private.corrections set new_asset=a.id,new_document=d.id where id=p_id;
 perform set_config('financial.review_correction',p_id::text,true);
 update public.request_documents set affiliate_document_id=d.id,private_asset_id=a.id,asset_sha256=a.content_sha256 where id=c.association_id;
 perform set_config('financial.review_correction','',true);
 -- Hide the superseded document without retaining its bytes or exposing an old image.
 insert into document_evidence_private.withdrawals(document_id,actor_id,reason) values(c.old_document,c.actor,'Documento observado sustituido por el solicitante') on conflict do nothing;
 update public.private_assets set status='DISABLED' where id=c.old_asset;
 update document_lab_integrity.assets set state='REPLACED' where id=c.old_asset;
 if not found then raise exception 'CORRECTION_INTEGRITY_RECORD_REQUIRED';end if;
 update financial_review_private.corrections set phase='LINKED' where id=p_id;
 update financial_review_private.corrections j set phase='SUPERSEDED' where j.association_id=c.association_id and j.id<>p_id and j.phase='PREPARED'
 and exists(select 1 from document_lab_integrity.operations o where o.id=j.id and o.document_id is null);
 perform set_config('request.jwt.claims',claims::text,true);perform set_config('request.jwt.claim.role','service_role',true);
 select * into strict a from public.private_assets where id=c.old_asset;
 return jsonb_build_object('phase','LINKED','request_id',c.request_id,'bucket',a.storage_bucket,'path',a.storage_path);
end$$;
create function public.finish_financial_document_purge(p_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare c financial_review_private.corrections;a public.private_assets;candidate_path text;begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_REQUIRED' using errcode='42501';end if;
 select * into strict c from financial_review_private.corrections where id=p_id for update;
 if c.phase in('COMPLETE','DISCARDED') then return true;end if;
 if c.phase='SUPERSEDED' then
 select source into strict candidate_path from document_lab_integrity.operations where id=p_id and document_id is null;
 if exists(select 1 from storage.objects where bucket_id='private-assets' and name=candidate_path) then raise exception 'CORRECTION_PURGE_NOT_CONFIRMED';end if;
 update financial_review_private.corrections set phase='DISCARDED',completed_at=now() where id=p_id;return true;end if;
 if c.phase<>'LINKED' then raise exception 'CORRECTION_NOT_LINKED';end if;
 select * into strict a from public.private_assets where id=c.old_asset;
 if exists(select 1 from storage.objects where bucket_id=a.storage_bucket and name=a.storage_path) then raise exception 'CORRECTION_PURGE_NOT_CONFIRMED';end if;
 update financial_review_private.corrections set phase='COMPLETE',completed_at=now() where id=p_id;return true;
end$$;
create function public.pending_financial_document_purges() returns jsonb language plpgsql security definer set search_path='' as $$declare rows jsonb;begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_REQUIRED' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'bucket',a.storage_bucket,'path',a.storage_path)),'[]') into rows
 from (select * from financial_review_private.corrections where phase='LINKED' order by created_at limit 10) c join public.private_assets a on a.id=c.old_asset;
 return rows || coalesce((select jsonb_agg(jsonb_build_object('id',j.id,'bucket','private-assets','path',o.source)) from
 (select * from financial_review_private.corrections where phase='SUPERSEDED' order by created_at limit 10) j
 join document_lab_integrity.operations o on o.id=j.id and o.document_id is null),'[]');
end$$;
-- Separate guard, leaving the existing immutable-operation guard unchanged.
create function financial_review_private.guard_candidate_completion() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.state='COMPLETE' and exists(select 1 from financial_review_private.corrections where id=new.id and phase in('SUPERSEDED','DISCARDED')) then raise exception 'CORRECTION_OBSERVATION_CHANGED';end if;
 return new;end$$;
create trigger financial_correction_candidate before update on document_lab_integrity.operations for each row execute function financial_review_private.guard_candidate_completion();
create function public.financial_correction_upload_allowed(p_bucket text,p_path text) returns boolean language sql stable security definer set search_path='' as $$
 select p_bucket<>'private-assets' or not exists(select 1 from financial_review_private.corrections j join document_lab_integrity.operations o on o.id=j.id
 where o.source=p_path and j.phase in('SUPERSEDED','DISCARDED'))
$$;
revoke all on function public.financial_correction_upload_allowed(text,text) from public,anon,authenticated;
grant execute on function public.financial_correction_upload_allowed(text,text) to authenticated;
create policy financial_correction_upload_guard on storage.objects as restrictive for insert to authenticated
 with check(public.financial_correction_upload_allowed(bucket_id,name));
revoke all on all functions in schema financial_review_private from public,anon,authenticated,service_role;
revoke all on function public.prepare_financial_document_correction(uuid,uuid,uuid,text,text,bigint,text),public.complete_financial_document_correction(uuid,jsonb),public.finish_financial_document_purge(uuid),public.pending_financial_document_purges() from public,anon,authenticated;
grant execute on function public.prepare_financial_document_correction(uuid,uuid,uuid,text,text,bigint,text) to authenticated;
grant execute on function public.complete_financial_document_correction(uuid,jsonb),public.finish_financial_document_purge(uuid),public.pending_financial_document_purges() to service_role;
commit;
