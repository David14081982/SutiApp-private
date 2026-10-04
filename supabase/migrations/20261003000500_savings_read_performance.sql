begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
-- H-FINANCE-READ-PERFORMANCE-001. Canonical readers only; no financial DML,
-- mirror, cache table, counters, writers, triggers or permission changes.
do $guard$ declare r jsonb;proc oid;begin
 if to_regnamespace('savings_read_private') is not null then raise exception 'SAVINGS_READ_ALREADY_INSTALLED';end if;
 for r in select value from jsonb_array_elements('[{"signature":"public.get_self_savings_if_changed(text)","md5":"714a5e8be86fa9f4330af6b8f3afb869","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres}"},{"signature":"public.get_admin_savings_workspace_summary()","md5":"55332c1a3a2f36969143fff373de79ee","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres}"},{"signature":"public.get_self_savings_live_readonly()","md5":"e2a011d3b17abe25b1cb20b10daf72a9","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres}"},{"signature":"public.savings_effective_action(text,uuid)","md5":"5ba8b427454141a3a6d716f05e4423fd","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres}"},{"signature":"public.savings_canonical_user_projection(uuid)","md5":"66c49ac7c5cca872e4affb3c93e0d5e2","owner":"postgres","acl":"{postgres=X/postgres}"},{"signature":"savings_period_private.projection_before(uuid)","md5":"2a9dedcc4dfb517d2d14530298e7dfa6","owner":"postgres","acl":"{postgres=X/postgres}"},{"signature":"savings_period_private.composition(uuid,date)","md5":"52e9f396117a5a4c6826eff24a490383","owner":"postgres","acl":"{postgres=X/postgres}"},{"signature":"public.savings_operation_today()","md5":"4ee2502b345656286154c58e2a5ca63a","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres}"},{"signature":"public.savings_participant_balance(uuid)","md5":"60370b8c60a9311b5172a09dd4b116ca","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres}"},{"signature":"public.savings_panel_number(jsonb)","md5":"34d32cdefea29402d70ce01e4e985f6c","owner":"postgres","acl":"{postgres=X/postgres}"},{"signature":"public.savings_panel_date(text)","md5":"c1dc69be739c393bcb21d12c4b436165","owner":"postgres","acl":"{postgres=X/postgres}"},{"signature":"savings_automatic_private.scheduled(uuid,date)","md5":"c89fae83b7a6c29f463914d2589222c5","owner":"postgres","acl":"{postgres=X/postgres}"},{"signature":"public.generate_savings_schedule(uuid,date,date)","md5":"3783b5c5ff59f512775c446d6d4b2379","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres}"},{"signature":"savings_period_private.origins(uuid,date)","md5":"943099f75b833be24442e5465d20608b","owner":"postgres","acl":"{postgres=X/postgres}"},{"signature":"savings_automatic_private.plan_hash(uuid)","md5":"9946003b7f8ad82c0f32221a6c4ca9d7","owner":"postgres","acl":"{postgres=X/postgres}"},{"signature":"public.savings_next_contribution_date(date,text)","md5":"e715929b802cb3ef78ce2808bdfc8814","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres}"},{"signature":"savings_period_private.resolve_origin(uuid,date,uuid[])","md5":"89fb9161a57223e8a8c4652aff624357","owner":"postgres","acl":"{postgres=X/postgres}"},{"signature":"public.get_admin_savings_panel(text,text,text,integer,integer)","md5":"5e8ae5350fdd5a088bbfbdbe40324b93","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres}"},{"signature":"public.savings_workspace_receipts(uuid)","md5":"c97fd6e9832d898ac963d81516758d44","owner":"postgres","acl":"{postgres=X/postgres}"},{"signature":"public.savings_panel_people(uuid)","md5":"0a31fe2083ba2e42f4b87e0119267664","owner":"postgres","acl":"{postgres=X/postgres}"},{"signature":"public.savings_panel_before_current_summary(text,text,text,integer,integer,jsonb)","md5":"25f57c2bff9d381caf00444f99c837e2","owner":"postgres","acl":"{postgres=X/postgres}"},{"signature":"public.savings_admin_current_summary(jsonb)","md5":"2c604445c1a9f9fffca2ae2f65edac26","owner":"postgres","acl":"{postgres=X/postgres}"},{"signature":"public.savings_admin_filtered_people(text,text,text,jsonb)","md5":"c78a7585ea704102bc716b7dad41158f","owner":"postgres","acl":"{postgres=X/postgres}"},{"signature":"public.savings_review_identity(text)","md5":"05f113ec1671696af981cb246724d1a4","owner":"postgres","acl":"{postgres=X/postgres}"},{"signature":"public.savings_enrollment_effective_status(text,timestamp with time zone,date)","md5":"616594d4a030f139863d86ab1693adb1","owner":"postgres","acl":"{postgres=X/postgres}"}]'::jsonb) loop
  proc:=to_regprocedure(r->>'signature');
  if proc is null or md5(pg_get_functiondef(proc)) is distinct from r->>'md5'
   or (select pg_get_userbyid(proowner) from pg_proc where oid=proc) is distinct from r->>'owner'
   or (select proacl::text from pg_proc where oid=proc) is distinct from r->>'acl'
   then raise exception 'SAVINGS_READ_BASELINE_DRIFT' using detail=r->>'signature';end if;
 end loop;
end $guard$;
create schema savings_read_private;
revoke all on schema savings_read_private from public,anon,authenticated,service_role;
create table savings_read_private.function_backup(signature text primary key,definition text not null,owner_name text not null,original_acl text,installed_md5 text);
alter table savings_read_private.function_backup enable row level security;
alter table savings_read_private.function_backup force row level security;
revoke all on savings_read_private.function_backup from public,anon,authenticated,service_role;
insert into savings_read_private.function_backup(signature,definition,owner_name,original_acl)
 select p.oid::regprocedure::text,pg_get_functiondef(p.oid),pg_get_userbyid(p.proowner),p.proacl::text
 from pg_proc p where p.oid=any(array['public.get_self_savings_if_changed(text)'::regprocedure,'public.get_admin_savings_workspace_summary()'::regprocedure]::oid[]);
create function savings_read_private.self_version(p_affiliate uuid,p_context jsonb,p_today date) returns text
language plpgsql stable security definer set search_path='' as $version$
declare control text; participants uuid[]; enrollments uuid[]; transactions uuid[]; mark jsonb; action_state jsonb;
begin
 -- A changed reader may introduce a dependency absent from this graph. In that
 -- case keep the canonical fresh read, but never validate an old client value.
 if exists(select 1 from jsonb_array_elements('[{"signature":"public.get_self_savings_live_readonly()","md5":"e2a011d3b17abe25b1cb20b10daf72a9","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres}"},{"signature":"public.savings_effective_action(text,uuid)","md5":"5ba8b427454141a3a6d716f05e4423fd","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres}"},{"signature":"public.savings_canonical_user_projection(uuid)","md5":"66c49ac7c5cca872e4affb3c93e0d5e2","owner":"postgres","acl":"{postgres=X/postgres}"},{"signature":"savings_period_private.projection_before(uuid)","md5":"2a9dedcc4dfb517d2d14530298e7dfa6","owner":"postgres","acl":"{postgres=X/postgres}"},{"signature":"savings_period_private.composition(uuid,date)","md5":"52e9f396117a5a4c6826eff24a490383","owner":"postgres","acl":"{postgres=X/postgres}"},{"signature":"public.savings_operation_today()","md5":"4ee2502b345656286154c58e2a5ca63a","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres}"},{"signature":"public.savings_participant_balance(uuid)","md5":"60370b8c60a9311b5172a09dd4b116ca","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres}"},{"signature":"public.savings_panel_number(jsonb)","md5":"34d32cdefea29402d70ce01e4e985f6c","owner":"postgres","acl":"{postgres=X/postgres}"},{"signature":"public.savings_panel_date(text)","md5":"c1dc69be739c393bcb21d12c4b436165","owner":"postgres","acl":"{postgres=X/postgres}"},{"signature":"savings_automatic_private.scheduled(uuid,date)","md5":"c89fae83b7a6c29f463914d2589222c5","owner":"postgres","acl":"{postgres=X/postgres}"},{"signature":"public.generate_savings_schedule(uuid,date,date)","md5":"3783b5c5ff59f512775c446d6d4b2379","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres}"},{"signature":"savings_period_private.origins(uuid,date)","md5":"943099f75b833be24442e5465d20608b","owner":"postgres","acl":"{postgres=X/postgres}"},{"signature":"savings_automatic_private.plan_hash(uuid)","md5":"9946003b7f8ad82c0f32221a6c4ca9d7","owner":"postgres","acl":"{postgres=X/postgres}"},{"signature":"public.savings_next_contribution_date(date,text)","md5":"e715929b802cb3ef78ce2808bdfc8814","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres}"},{"signature":"savings_period_private.resolve_origin(uuid,date,uuid[])","md5":"89fb9161a57223e8a8c4652aff624357","owner":"postgres","acl":"{postgres=X/postgres}"}]'::jsonb) f
  where to_regprocedure(f->>'signature') is null
   or md5(pg_get_functiondef(to_regprocedure(f->>'signature'))) is distinct from f->>'md5'
   or (select pg_get_userbyid(p.proowner) from pg_proc p where p.oid=to_regprocedure(f->>'signature')) is distinct from f->>'owner'
   or (select p.proacl::text from pg_proc p where p.oid=to_regprocedure(f->>'signature')) is distinct from f->>'acl') then return null;end if;
 select numero_control into control from public.affiliates where id=p_affiliate;
 select coalesce(array_agg(id),'{}'::uuid[]) into participants from public.savings_participants where affiliate_id=p_affiliate or legacy_folio=control;
 select coalesce(array_agg(id),'{}'::uuid[]) into enrollments from public.savings_enrollments where participant_id=any(participants);
 select coalesce(array_agg(id),'{}'::uuid[]) into transactions from public.savings_transactions where participant_id=any(participants);
 -- Hash selected subject rows; locating reversal references can require an
 -- index or table scan. Ordered hashes detect deletion and correction too.
 select jsonb_object_agg(k,v) into mark from (
 select 'affiliates' k,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) v from public.affiliates t where t.id=p_affiliate or t.numero_control=control
 union all
 select 'participants' k,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) v from public.savings_participants t where t.affiliate_id=p_affiliate or t.legacy_folio=control
 union all
 select 'publication' k,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) v from public.savings_publication_state t where true
 union all
 select 'certifications' k,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) v from public.savings_balance_certifications t where t.participant_id=any(participants)
 union all
 select 'review' k,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) v from public.savings_review_records t where t.source_folio=control or t.id in(select record_id from public.savings_balance_certifications where participant_id=any(participants))
 union all
 select 'adjusted_snapshot' k,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) v from public.savings_audit_events t where t.participant_id=any(participants) and t.action='ADJUST_CONFIRMED_BALANCE'
 union all
 select 'enrollments' k,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) v from public.savings_enrollments t where t.participant_id=any(participants)
 union all
 select 'plans' k,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) v from public.savings_contribution_plans t where t.enrollment_id=any(enrollments)
 union all
 select 'receipts' k,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) v from public.savings_contribution_overrides t where t.enrollment_id=any(enrollments)
 union all
 select 'instructions' k,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) v from savings_automatic_private.instructions t where t.enrollment_id=any(enrollments)
 union all
 select 'transactions' k,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) v from public.savings_transactions t where t.participant_id=any(participants) or t.reversal_of_transaction_id=any(transactions) or t.id in(select reversal_of_transaction_id from public.savings_transactions where id=any(transactions))
 union all
 select 'holds' k,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) v from public.savings_holds t where t.participant_id=any(participants)
 union all
 select 'requests' k,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) v from public.savings_requests t where t.participant_id=any(participants)
 union all
 select 'beneficiary_versions' k,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) v from public.savings_beneficiary_versions t where t.participant_id=any(participants)
 union all
 select 'beneficiaries' k,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) v from public.savings_beneficiaries t where t.version_id in(select id from public.savings_beneficiary_versions where participant_id=any(participants))
 union all
 select 'process_changes' k,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) v from public.savings_process_change_events t where t.participant_id=any(participants)
 union all
 select 'yield_allocations' k,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) v from public.savings_yield_allocations t where t.participant_id=any(participants)
 union all
 select 'yield_periods' k,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) v from public.savings_yield_periods t where t.id in(select yield_period_id from public.savings_yield_allocations where participant_id=any(participants))
 union all
 select 'attributions' k,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) v from savings_period_private.attribution_events t where t.transaction_id=any(transactions)
 union all
 select 'attribution_slices' k,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) v from savings_period_private.attribution_slices t where t.event_id in(select id from savings_period_private.attribution_events where transaction_id=any(transactions))
 union all
 select 'action_availability' k,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) v from public.savings_action_availability t where t.scope_type='GLOBAL' or t.participant_id=any(participants)
 union all
 select 'operation_settings' k,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) v from public.savings_operation_settings t where true
 ) parts;
 -- Action windows may open/close within a day, without a data mutation.
 select coalesce(jsonb_agg(jsonb_build_array(x.id,
  public.savings_effective_action('JOIN',x.id),public.savings_effective_action('CHANGE_AMOUNT',x.id),public.savings_effective_action('WITHDRAW',x.id)) order by x.id),'[]')
 into action_state from (select unnest(participants) id union all select null::uuid where cardinality(participants)=0)x;
 return md5(jsonb_build_array('SAVINGS_CANONICAL_READ_V1',p_context,p_today,current_setting('TimeZone'),mark,action_state)::text);
end $version$;
revoke all on function savings_read_private.self_version(uuid,jsonb,date) from public,anon,authenticated,service_role;
create or replace function public.get_self_savings_if_changed(p_known_version text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $self$
declare actor uuid:=auth.uid(); af uuid:=public.get_effective_affiliate_id(); context jsonb; imp jsonb; version text; control text;
begin
 if actor is null or af is null then raise exception 'SAVINGS_AFFILIATE_REQUIRED' using errcode='42501';end if;
 if exists(select 1 from public.savings_publication_state where id and mode='PRIVATE') then
  return public.savings_if_changed_before_publication(p_known_version);
 end if;
 select to_jsonb(i) into imp from public.get_impersonation_context()i;
 context:=jsonb_build_object('actor_auth_user_id',actor,'effective_affiliate_id',af,'actor_session_id',auth.jwt()->>'session_id','impersonation_id',imp->>'session_id');
 if not exists(select 1 from public.savings_publication_state where id and mode='PUBLISHED') then raise exception 'SAVINGS_PUBLICATION_STATE_REQUIRED';end if;
 select a.numero_control into control from public.affiliates a where a.id=af and not coalesce(a.is_archived,false);
 if nullif(btrim(control),'') is null or (select count(*) from public.affiliates where numero_control=control and not coalesce(is_archived,false))<>1
  or exists(select 1 from public.savings_participants p where (p.affiliate_id=af or p.legacy_folio=control)
   and (p.affiliate_id is distinct from af or p.legacy_folio is distinct from control))
 then raise exception 'SAVINGS_EXACT_IDENTITY_REQUIRED' using errcode='55000';end if;
 version:=savings_read_private.self_version(af,context,public.savings_operation_today());
 -- Context, authority, identity, all data dependencies and timed actions were
 -- checked in this same STABLE statement snapshot, before any DTO construction.
 if version is not null and version=p_known_version and nullif(context->>'actor_session_id','') is not null then
  return jsonb_build_object('version',version,'modified',false,'cacheable',true,'context',context);
 end if;
 return jsonb_build_object('version',version,'modified',true,'cacheable',version is not null and nullif(context->>'actor_session_id','') is not null,
  'context',context,'data',public.get_self_savings_live_readonly());
end $self$;
CREATE OR REPLACE FUNCTION public.get_admin_savings_workspace_summary()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare summary jsonb; people jsonb; legacy_kpis jsonb; pending bigint; conflicts bigint; periods jsonb; requests bigint; decisions bigint; deliveries bigint;
begin
 if auth.uid() is null or not public.has_admin_permission('savings.read') then raise exception 'SAVINGS_READ_DENIED' using errcode='42501';end if;
 if (select count(distinct batch_id) from public.savings_review_records where source_sheet='Ahorro')>1 then raise exception 'SAVINGS_PANEL_MULTIPLE_BASELINES';end if;
 -- Only these four legacy counters survive the canonical KPI override. Do not
 -- construct the legacy collection history, sorted page or neighbour rows.
 people:=coalesce((select jsonb_agg(v) from public.savings_panel_people()v),'[]'::jsonb);
 select jsonb_build_object('afiliados',(select count(*) from public.affiliates where not coalesce(is_archived,false)),
  'incidencias',count(*) filter(where (a->>'needs_review')::boolean and a->>'status'<>'RESOLVED'),
  'pendientes',(select count(*) from public.savings_review_records r where r.status<>'RESOLVED' and r.source_sheet in ('Solicitud Cambio ahorro','Solicitud de retiro')),
  'solicitudes_estado_pendiente',(select count(*) from public.savings_review_records r where r.status<>'RESOLVED' and
   (r.source_sheet='Solicitud Cambio ahorro' and (r.source_data||r.proposed_data)->>'E' is distinct from 'TRUE'
    or r.source_sheet='Solicitud de retiro' and (r.source_data||r.proposed_data)->>'H' is distinct from 'Completado')))
 into legacy_kpis from jsonb_array_elements(people)a;
 summary:=public.savings_admin_current_summary(people);
 summary:=summary||jsonb_build_object('kpis',legacy_kpis||(summary->'kpis'),'publication_mode',(select mode from public.savings_publication_state where id));
 with due as materialized(select * from public.savings_workspace_receipts(null)),
 grouped as(select contribution_date date,count(*) count,sum(expected_amount) expected_amount from due where not has_actual group by contribution_date)
 select (select count(*) from due where not has_actual),(select count(*) from due where conflict),
  coalesce((select jsonb_agg(to_jsonb(g) order by g.date) from grouped g),'[]'::jsonb) into pending,conflicts,periods;
 select count(*) filter(where r.status in ('SUBMITTED','UNDER_REVIEW')),
  count(*) filter(where r.status='APPROVED' and r.request_type in ('WITHDRAW','EXTRAORDINARY_WITHDRAWAL')) into decisions,deliveries
 from public.savings_requests r join public.savings_participants p on p.id=r.participant_id
 where p.data_classification='CANONICAL' and r.data_classification='CANONICAL' and r.metadata->>'origin'='SAVINGS_RUNTIME_V1';
 -- An approved TERMINATE already schedules cessation; it has no delivery step.
 requests:=decisions+deliveries;
 return jsonb_build_object('kpis',summary->'kpis','collection_status',summary->'collection_status','publication_mode',summary->'publication_mode',
  'attention',jsonb_build_object('pending_receipts',pending,'receipt_conflicts',conflicts,'request_count',requests,
   'pending_decisions',decisions,'awaiting_delivery',deliveries,'periods',periods),'today',public.savings_operation_today());
end $function$
;
update savings_read_private.function_backup set installed_md5=md5(pg_get_functiondef(to_regprocedure(signature)));
notify pgrst,'reload schema';
commit;
