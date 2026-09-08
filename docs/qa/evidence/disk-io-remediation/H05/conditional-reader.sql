-- Candidate additive endpoint. It never changes the original financial getter.
create function public.get_self_savings_if_changed(p_known_version text default null)
returns jsonb language plpgsql stable security definer set search_path='' as $function$
declare
 v_actor uuid:=auth.uid();
 v_affiliate uuid:=public.get_effective_affiliate_id();
 v_session text:=auth.jwt()->>'session_id';
 v_participant uuid;
 v_participant_mark text;
 v_batch_mark text;
 v_evidence_mark text;
 v_versions_mark text;
 v_beneficiaries_mark text;
 v_action_mark text;
 v_actions jsonb;
 v_impersonation jsonb;
 v_context jsonb;
 v_version text;
 v_cacheable boolean;
begin
 if v_actor is null or v_affiliate is null then
  raise exception 'SAVINGS_AFFILIATE_REQUIRED' using errcode='42501';
 end if;
 select to_jsonb(i) into v_impersonation from public.get_impersonation_context() i;
 v_context:=jsonb_build_object('actor_auth_user_id',v_actor,'effective_affiliate_id',v_affiliate,
  'actor_session_id',v_session,'impersonation_id',v_impersonation->>'session_id');

 -- An unfamiliar dependency graph must be read afresh, never reused.
 select md5(pg_get_functiondef('public.get_self_savings_live_readonly()'::regprocedure))='74f504337e4f336e6b12da3ab32f30a6'
  and md5(pg_get_functiondef('public.savings_effective_action(text,uuid)'::regprocedure))='407fefd589bc4f840a0fc36d988e831b'
 into v_cacheable;
 if not v_cacheable then
  return jsonb_build_object('version',null,'modified',true,'cacheable',false,'context',v_context,
   'data',public.get_self_savings_live_readonly());
 end if;

 select p.id,md5(row_to_json(p)::text),md5(row_to_json(b)::text)
 into v_participant,v_participant_mark,v_batch_mark
 from public.savings_participants p join public.savings_import_batches b on b.id=p.import_batch_id
 where p.affiliate_id=v_affiliate and p.identity_status='RESOLVED'
 and b.certification_status='CERTIFIED' and b.status='APPLIED';

 select md5(string_agg(md5(row_to_json(e)::text),'' order by e.id)) into v_evidence_mark
 from public.savings_legacy_evidence e where e.participant_id=v_participant;
 select md5(string_agg(md5(row_to_json(v)::text),'' order by v.id)) into v_versions_mark
 from public.savings_beneficiary_versions v where v.participant_id=v_participant;
 select md5(string_agg(md5(row_to_json(b)::text),'' order by b.id)) into v_beneficiaries_mark
 from public.savings_beneficiaries b join public.savings_beneficiary_versions v on v.id=b.version_id
 where v.participant_id=v_participant;
 select md5(string_agg(md5(row_to_json(a)::text),'' order by a.id)) into v_action_mark
 from public.savings_action_availability a where a.scope_type='GLOBAL' or a.participant_id=v_participant;
 v_actions:=jsonb_build_object(
  'JOIN',public.savings_effective_action('JOIN',v_participant),
  'CHANGE_AMOUNT',public.savings_effective_action('CHANGE_AMOUNT',v_participant),
  'WITHDRAW',public.savings_effective_action('WITHDRAW',v_participant),
  'TERMINATE',public.savings_effective_action('TERMINATE',v_participant));

 -- Every dependency is read in this statement's STABLE snapshot. Date and
 -- effective actions cover time boundaries even when no row was written.
 v_version:=md5(jsonb_build_array('H05_V1',v_context,v_impersonation,public.get_admin_access_context(),
  current_date,current_setting('TimeZone'),v_participant_mark,v_batch_mark,v_evidence_mark,
  v_versions_mark,v_beneficiaries_mark,v_action_mark,v_actions)::text);
 if p_known_version=v_version then
  return jsonb_build_object('version',v_version,'modified',false,'cacheable',true,'context',v_context);
 end if;
 return jsonb_build_object('version',v_version,'modified',true,'cacheable',true,'context',v_context,
  'data',public.get_self_savings_live_readonly());
end;
$function$;
alter function public.get_self_savings_if_changed(text) owner to postgres;
revoke all on function public.get_self_savings_if_changed(text) from public,anon,authenticated;
grant execute on function public.get_self_savings_if_changed(text) to authenticated;
