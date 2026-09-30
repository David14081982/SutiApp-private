begin;
-- Individual availability only. No yield-period, balance, request or payout mutations.
create function public.get_admin_savings_individual_withdrawal(p_folio text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p public.savings_participants%rowtype; a public.savings_action_availability%rowtype;
 individual public.savings_action_availability%rowtype; general public.savings_action_availability%rowtype;
 ready boolean; reason text; enabled boolean; name text;
begin
 if auth.uid() is null or not public.has_admin_permission('savings.read') then raise exception 'SAVINGS_READ_DENIED' using errcode='42501'; end if;
 if p_folio is null or btrim(p_folio)='' then raise exception 'SAVINGS_EXACT_IDENTITY_REQUIRED'; end if;
 if (select count(*) from public.savings_participants where legacy_folio=p_folio)<>1 then
  return jsonb_build_object('folio',p_folio,'ready',false,'enabled',false,'can_configure',false,'can_create',false,'block_reason','IDENTITY');
 end if;
 select * into p from public.savings_participants where legacy_folio=p_folio;
 ready:=p.identity_status='RESOLVED' and p.affiliate_id is not null
  and (select count(*) from public.affiliates where numero_control=p_folio)=1
  and exists(select 1 from public.affiliates where id=p.affiliate_id and numero_control=p_folio and not coalesce(is_archived,false));
 if not ready then reason:='IDENTITY';
 elsif p.certification_status<>'CERTIFIED' or p.data_classification<>'CANONICAL' then ready:=false;reason:='CERTIFICATION';
 elsif not exists(select 1 from public.savings_enrollments where participant_id=p.id and data_classification='CANONICAL') then ready:=false;reason:='ENROLLMENT'; end if;
 select full_name into name from public.affiliates where id=p.affiliate_id;
 select * into individual from public.savings_action_availability where action_code='WITHDRAW' and scope_type='PARTICIPANT' and participant_id=p.id and effective_from<=now() order by effective_from desc,created_at desc,id desc limit 1;
 select * into general from public.savings_action_availability where action_code='WITHDRAW' and scope_type='GLOBAL' and effective_from<=now() order by effective_from desc,created_at desc,id desc limit 1;
 if individual.id is not null and (individual.effective_to is null or now()<individual.effective_to) then a:=individual; else a:=general; end if;
 enabled:=public.savings_effective_action('WITHDRAW',p.id);
 return jsonb_build_object('folio',p_folio,'participant_id',p.id,'name',name,'ready',ready,'block_reason',reason,
  'enabled',enabled,'scope',a.scope_type,'ends_at',case when enabled then a.effective_to else null end,
  'can_configure',public.has_admin_permission('savings.config') and ready,'can_create',public.has_admin_permission('savings.write') and ready,
  'today',(now() at time zone 'America/Hermosillo')::date,'suggested_until',(now() at time zone 'America/Hermosillo')::date+7,
  'version',md5(jsonb_build_object('individual',individual,'general',general,'ready',ready,'participant',p.id,'affiliate',p.affiliate_id)::text));
end $$;

create function public.admin_set_savings_individual_withdrawal(p_folio text,p_enabled boolean,p_until date,p_reason text,p_version text,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare context jsonb; prior public.savings_audit_events%rowtype; participant uuid; affiliate uuid; availability uuid; ends timestamptz;
 command jsonb:=jsonb_build_object('folio',p_folio,'enabled',p_enabled,'until',p_until,'reason',btrim(p_reason),'version',p_version);
begin
 if auth.uid() is null or not public.has_admin_permission('savings.config') or not public.has_admin_permission('savings.read') then raise exception 'SAVINGS_CONFIG_DENIED' using errcode='42501'; end if;
 if p_key is null or p_enabled is null or length(btrim(coalesce(p_reason,''))) not between 3 and 1000 then raise exception 'SAVINGS_REASON_REQUIRED'; end if;
 perform pg_advisory_xact_lock(hashtextextended('savings-config',0));
 select * into prior from public.savings_audit_events where client_action_id=p_key;
 if found then
  if prior.resource<>'savings_individual_withdrawal' or prior.actor_real_auth_user_id<>auth.uid() or prior.after_data->'command' is distinct from command then raise exception 'SAVINGS_IDEMPOTENCY_CONFLICT'; end if;
  return public.get_admin_savings_individual_withdrawal(p_folio);
 end if;
 context:=public.get_admin_savings_individual_withdrawal(p_folio);
 if not coalesce((context->>'ready')::boolean,false) then raise exception 'SAVINGS_INDIVIDUAL_ACCOUNT_NOT_READY'; end if;
 participant:=(context->>'participant_id')::uuid;
 affiliate:=public.savings_runtime_assert_identity(participant);
 -- Re-read after the participant lock, matching the existing financial identity guard.
 context:=public.get_admin_savings_individual_withdrawal(p_folio);
 if not coalesce((context->>'ready')::boolean,false) then raise exception 'SAVINGS_INDIVIDUAL_ACCOUNT_NOT_READY'; end if;
 if p_version is null or context->>'version' is distinct from p_version then raise exception 'SAVINGS_INDIVIDUAL_CHANGED'; end if;
 if p_enabled then
  if p_until is null or p_until<(now() at time zone 'America/Hermosillo')::date then raise exception 'SAVINGS_INDIVIDUAL_DATE_INVALID'; end if;
  ends:=((p_until+1)::timestamp at time zone 'America/Hermosillo');
 elsif p_until is not null then raise exception 'SAVINGS_INDIVIDUAL_DATE_INVALID'; end if;
 insert into public.savings_action_availability(action_code,scope_type,participant_id,enabled,reason,effective_from,effective_to,configured_by_auth_user_id,created_at)
 values('WITHDRAW','PARTICIPANT',participant,p_enabled,btrim(p_reason),now(),ends,auth.uid(),clock_timestamp()) returning id into availability;
 insert into public.savings_audit_events(actor_real_auth_user_id,usuario_contexto_affiliate_id,participant_id,resource,action,target_id,before_data,after_data,reason,client_action_id)
 values(auth.uid(),public.get_effective_affiliate_id(),participant,'savings_individual_withdrawal',case when p_enabled then 'ENABLE' else 'DISABLE' end,availability::text,context,
  jsonb_build_object('command',command,'availability_id',availability,'affiliate_id',affiliate),btrim(p_reason),p_key);
 return public.get_admin_savings_individual_withdrawal(p_folio);
end $$;
revoke all on function public.get_admin_savings_individual_withdrawal(text),public.admin_set_savings_individual_withdrawal(text,boolean,date,text,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_admin_savings_individual_withdrawal(text),public.admin_set_savings_individual_withdrawal(text,boolean,date,text,text,uuid) to authenticated;
comment on function public.admin_set_savings_individual_withdrawal(text,boolean,date,text,text,uuid) is 'Account-scoped withdrawal availability only; existing configuration permission and immutable audit. No yield generation, period setup, request creation, balance or payout changes.';
notify pgrst,'reload schema';
commit;
