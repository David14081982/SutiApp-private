-- PREPARED ONLY. No OpenAI activation, financial calculation or Google write.
begin;
set local lock_timeout='2s';
create schema financial_review_private;
revoke all on schema financial_review_private from public,anon,authenticated;
create table financial_review_private.settings(id boolean primary key default true check(id),enabled boolean not null default false);
insert into financial_review_private.settings values(true,false);
-- Explicit payroll schedule; no guessed 15/30 defaults and no imported financial values.
create table financial_review_private.payroll_periods(
 employee_category text not null,period_start date not null,period_end date not null,available_on date not null,
 primary key(employee_category,period_start,period_end),check(period_start<=period_end)
);
create table financial_review_private.reviews(
 request_id uuid primary key references public.program_requests(id) on delete cascade,
 phase text not null default 'QUEUED' check(phase in('QUEUED','PROCESSING','COMPLETE','ERROR','CLOSED')),
 source_hash text,lease uuid,lease_until timestamptz,attempts integer not null default 0,
 result jsonb,error_code text,model text,usage jsonb,updated_at timestamptz not null default now()
);
create index review_queue on financial_review_private.reviews(phase,updated_at);
do $$declare t text;begin foreach t in array array['settings','payroll_periods','reviews'] loop
 execute format('alter table financial_review_private.%I enable row level security',t);
 execute format('alter table financial_review_private.%I force row level security',t);
end loop;end$$;
create function financial_review_private.context(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.program_requests;a jsonb;docs jsonb;requirements jsonb;periods jsonb;day date;begin
 select * into strict r from public.program_requests where id=p_id;
 select to_jsonb(x) into a from public.affiliates x where id=r.affiliate_id;
 day:=(r.created_at at time zone 'America/Hermosillo')::date;
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'document_id',d.affiliate_document_id,'document_type_id',d.document_type_id,
 'code',t.code,'label',t.label,'asset_id',d.private_asset_id,'sha256',lower(d.asset_sha256),'bucket',p.storage_bucket,'path',p.storage_path,
 'mime',p.mime_type,'size',p.file_size,'asset_status',p.status) order by d.id),'[]') into docs
 from public.request_documents d join public.document_types t on t.id=d.document_type_id
 join public.private_assets p on p.id=d.private_asset_id where d.request_id=r.id;
 select coalesce(jsonb_agg(jsonb_build_object('document_type_id',x->>'document_type_id','label',coalesce(x->>'document_type_label',x->'document_type'->>'label',t.label),'required',coalesce((x->>'required')::boolean,true))),'[]') into requirements
 from jsonb_array_elements(coalesce(r.document_requirements_snapshot,'[]')) x
 left join public.document_types t on t.id::text=x->>'document_type_id';
 select jsonb_agg(jsonb_build_object('start',v.period_start,'end',v.period_end) order by v.period_end desc) into periods
 from (select * from financial_review_private.payroll_periods where employee_category=coalesce(r.financial_profile_snapshot->>'financial_employee_category_code',a->>'financial_employee_category_code') and available_on<=day order by period_end desc limit 2) v;
 return jsonb_build_object('request_id',r.id,'folio',r.folio,'status',r.status,'affiliate_id',r.affiliate_id,'numero_control',r.numero_control,
 'applicant_name',coalesce(r.applicant_profile_snapshot->>'full_name',a->>'full_name',a->>'display_name'),'submission_day',day,'requirements',requirements,'documents',docs,
 'signature_data',r.signature_data,'signature_available',coalesce(length(r.signature_data)>0,false),'expected_periods',periods);
end$$;
create function financial_review_private.fingerprint(p_id uuid) returns text language sql stable security definer set search_path='' as $$
 select encode(extensions.digest((financial_review_private.context(p_id)-'status')::text,'sha256'),'hex')
$$;
create function financial_review_private.enqueue() returns trigger language plpgsql security definer set search_path='' as $$
declare rid uuid;begin
 if tg_table_name='program_requests' then rid:=new.id;else rid:=new.request_id;end if;
 if exists(select 1 from public.program_requests where id=rid and program_id='prestamo' and status in('submitted','in_review','requires_financial_processing')) then
 insert into financial_review_private.reviews(request_id) values(rid) on conflict(request_id) do update
 set phase='QUEUED',result=null,source_hash=null,lease=null,lease_until=null,attempts=0,error_code=null,updated_at=now();
 end if;return new;
end$$;
create trigger financial_review_enqueue after insert on public.program_requests for each row execute function financial_review_private.enqueue();
create trigger financial_review_documents after insert or update on public.request_documents for each row execute function financial_review_private.enqueue();
insert into financial_review_private.reviews(request_id) select id from public.program_requests
 where program_id='prestamo' and status in('submitted','in_review','requires_financial_processing') on conflict do nothing;

create function public.list_financial_document_reviews(p_request_ids uuid[]) returns jsonb language plpgsql security definer set search_path='' as $$
declare rows jsonb;begin
 if auth.uid() is null or not public.has_admin_permission('program_requests.read') then raise exception 'REVIEW_ACCESS_DENIED' using errcode='42501';end if;
 if cardinality(p_request_ids)>500 then raise exception 'REVIEW_BATCH_TOO_LARGE';end if;
 select coalesce(jsonb_agg(jsonb_build_object('request_id',r.id,'phase',case when v.phase='COMPLETE' and v.source_hash is distinct from financial_review_private.fingerprint(r.id) then 'STALE' else coalesce(v.phase,'QUEUED') end,
 'source_hash',v.source_hash,'result',case when v.phase='COMPLETE' and v.source_hash=financial_review_private.fingerprint(r.id) then v.result else null end,
 'updated_at',v.updated_at,'error_code',v.error_code)),'[]') into rows
 from public.program_requests r left join financial_review_private.reviews v on v.request_id=r.id
 where r.id=any(p_request_ids) and r.program_id='prestamo' and public.admin_request_module_boundary(r.id);return rows;
end$$;
create function public.get_self_financial_document_review(p_request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.program_requests;v financial_review_private.reviews;docs jsonb;current_result jsonb;begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501';end if;
 select * into r from public.program_requests where id=p_request_id and affiliate_id=public.get_effective_affiliate_id() and program_id='prestamo';
 if r.id is null then raise exception 'REVIEW_ACCESS_DENIED' using errcode='42501';end if;
 select * into v from financial_review_private.reviews where request_id=r.id;
 if v.phase='COMPLETE' and v.source_hash=financial_review_private.fingerprint(r.id) then current_result:=v.result;end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'document_type_id',t.id,'label',t.label,'code',t.code,
 'accepted_mime_types',t.accepted_mime_types,'max_file_size_bytes',t.max_file_size_bytes,'file_upload_allowed',t.file_upload_allowed,'camera_allowed',t.camera_allowed)),'[]') into docs
 from public.request_documents d join public.document_types t on t.id=d.document_type_id where d.request_id=r.id
 and exists(select 1 from jsonb_array_elements(coalesce(current_result->'observations','[]')) o where o->>'document_id'=d.id::text and o->>'correctable'='true');
 return jsonb_build_object('request_id',r.id,'phase',case when v.phase='COMPLETE' and current_result is null then 'STALE' else coalesce(v.phase,'QUEUED') end,
 'result',current_result,'source_hash',v.source_hash,'documents',docs,'can_correct',r.status in('submitted','in_review','requires_financial_processing'));
end$$;
create function public.claim_financial_document_review() returns jsonb language plpgsql security definer set search_path='' as $$
declare v financial_review_private.reviews;ctx jsonb;begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_REQUIRED' using errcode='42501';end if;
 if not (select enabled from financial_review_private.settings where id) then return null;end if;
 -- Configuration/identity changes invalidate derived results even without a new upload.
 update financial_review_private.reviews q set phase='QUEUED',result=null,attempts=0,source_hash=null,updated_at=now()
 from public.program_requests r where r.id=q.request_id and r.program_id='prestamo'
 and r.status in('submitted','in_review','requires_financial_processing') and q.phase='COMPLETE'
 and q.source_hash is distinct from financial_review_private.fingerprint(q.request_id);
 select q.* into v from financial_review_private.reviews q join public.program_requests r on r.id=q.request_id
 where r.program_id='prestamo' and r.status in('submitted','in_review','requires_financial_processing') and q.attempts<3
 and (q.phase='QUEUED' or q.phase='ERROR' and q.updated_at<now()-interval '5 minutes' or q.phase='PROCESSING' and q.lease_until<now())
 order by q.updated_at for update of q skip locked limit 1;
 if v.request_id is null then return null;end if;
 ctx:=financial_review_private.context(v.request_id);
 update financial_review_private.reviews set phase='PROCESSING',lease=extensions.gen_random_uuid(),lease_until=now()+interval '4 minutes',
 source_hash=financial_review_private.fingerprint(v.request_id),attempts=attempts+1,error_code=null,updated_at=now() where request_id=v.request_id returning * into v;
 return jsonb_build_object('context',ctx,'lease',v.lease,'source_hash',v.source_hash);
end$$;
create function public.finish_financial_document_review(p_request_id uuid,p_lease uuid,p_source_hash text,p_result jsonb,p_error text,p_model text,p_usage jsonb) returns boolean language plpgsql security definer set search_path='' as $$
declare v financial_review_private.reviews;r public.program_requests;begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_REQUIRED' using errcode='42501';end if;
 select * into r from public.program_requests where id=p_request_id for update;
 select * into v from financial_review_private.reviews where request_id=p_request_id for update;
 if v.lease is distinct from p_lease or v.source_hash is distinct from p_source_hash or v.phase<>'PROCESSING' then return false;end if;
 if r.status not in('submitted','in_review','requires_financial_processing') then update financial_review_private.reviews set phase='CLOSED',lease=null,lease_until=null where request_id=p_request_id;return false;end if;
 if financial_review_private.fingerprint(p_request_id)<>p_source_hash then
 update financial_review_private.reviews set phase='QUEUED',result=null,attempts=0,lease=null,lease_until=null where request_id=p_request_id;return false;end if;
 if p_error is null and (p_result->>'version' is distinct from 'FINANCIAL_DOCUMENT_REVIEW_V1' or coalesce(p_result->>'status','') not in('PASS','FAIL','MANUAL')) then raise exception 'REVIEW_RESULT_INVALID';end if;
 update financial_review_private.reviews set phase=case when p_error is null then 'COMPLETE' else 'ERROR' end,result=case when p_error is null then p_result else null end,
 error_code=p_error,model=p_model,usage=p_usage,lease=null,lease_until=null,updated_at=now() where request_id=p_request_id;
 return true;
end$$;
-- Guard only the freshness of a proposed documentary rejection. The existing writer
-- retains permissions, workflow, idempotency and events. Approval has no review gate.
create function public.reject_with_financial_document_review(p_request_id uuid,p_source_hash text,p_comment text,p_client_action_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is null or not(public.has_admin_permission('program_requests.write') and public.admin_request_module_boundary(p_request_id)) then raise exception 'PROGRAM_REQUEST_WRITE_DENIED' using errcode='42501';end if;
 perform 1 from public.program_requests where id=p_request_id and program_id='prestamo' for update;
 if not found then raise exception 'PROGRAM_REQUEST_NOT_FOUND';end if;
 if not exists(select 1 from public.program_request_admin_events where client_action_id=p_client_action_id)
 and financial_review_private.fingerprint(p_request_id) is distinct from p_source_hash then raise exception 'REVIEW_SOURCE_CHANGED' using errcode='PT409';end if;
 return public.transition_program_request_workflow(p_request_id,'REJECT',p_comment,p_client_action_id,null,null);
end$$;
revoke all on function public.reject_with_financial_document_review(uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.reject_with_financial_document_review(uuid,text,text,uuid) to authenticated;
revoke all on all functions in schema financial_review_private from public,anon,authenticated,service_role;
revoke all on function public.list_financial_document_reviews(uuid[]),public.get_self_financial_document_review(uuid),public.claim_financial_document_review(),public.finish_financial_document_review(uuid,uuid,text,jsonb,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.list_financial_document_reviews(uuid[]),public.get_self_financial_document_review(uuid) to authenticated;
grant execute on function public.claim_financial_document_review(),public.finish_financial_document_review(uuid,uuid,text,jsonb,text,text,jsonb) to service_role;
-- Reuse existing pg_cron/pg_net infrastructure. Disabled configuration sends no requests.
create function public.wake_financial_document_review() returns bigint language plpgsql security definer set search_path='' as $$
declare endpoint text;gateway text;secret text;job bigint;begin
 if not (select enabled from financial_review_private.settings where id) then return null;end if;
 select decrypted_secret into endpoint from vault.decrypted_secrets where name='financial_review_edge_url';
 select decrypted_secret into gateway from vault.decrypted_secrets where name='financial_review_gateway_jwt';
 select decrypted_secret into secret from vault.decrypted_secrets where name='financial_review_worker_secret';
 if endpoint is null or gateway is null or secret is null then return null;end if;
 select net.http_post(url:=endpoint,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||gateway,'x-review-worker-key',secret),body:='{"action":"RUN"}'::jsonb,timeout_milliseconds:=120000) into job;
 return job;
end$$;
revoke all on function public.wake_financial_document_review() from public,anon,authenticated,service_role;
do $$begin
 if to_regprocedure('cron.schedule(text,text,text)') is not null then
 perform cron.schedule('financial-document-review','* * * * *','select public.wake_financial_document_review()');
 end if;
end$$;
commit;
