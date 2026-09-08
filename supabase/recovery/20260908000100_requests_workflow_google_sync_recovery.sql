begin;
select cron.unschedule(jobid) from cron.job where jobname='program-request-google-sync';
drop trigger if exists program_requests_google_sync on public.program_requests;
alter publication supabase_realtime drop table public.program_requests;
CREATE OR REPLACE FUNCTION public.sync_program_request_tracking_from_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_stage jsonb;v_first jsonb;v_dates jsonb;v_at timestamptz;
begin
  select s into v_stage from jsonb_array_elements(new.workflow_snapshot->'stages') s
  where s->'status_references'?new.status
    and (case when new.status in('rejected','cancelled') then s->>'outcome'<>'success' else s->>'outcome'<>'failure' end)
  order by (s->>'sort_order')::integer,s->>'id' limit 1;
  if v_stage is null then raise exception 'REQUEST_WORKFLOW_STATUS_UNMAPPED' using errcode='22023'; end if;
  select s into v_first from jsonb_array_elements(new.workflow_snapshot->'stages') s
    order by (s->>'sort_order')::integer,s->>'id' limit 1;
  select coalesce(stage_dates,'{}'::jsonb) into v_dates from public.operational_request_tracking where request_id=new.id;
  v_dates:=coalesce(v_dates,'{}'::jsonb);
  if coalesce((v_first->>'captures_date')::boolean,false) and not(v_dates?(v_first->>'id')) then
    v_dates:=v_dates||jsonb_build_object(v_first->>'id',new.created_at);
  end if;
  v_at:=case when tg_op='INSERT' then new.created_at else now() end;
  if coalesce((v_stage->>'captures_date')::boolean,false) and not(v_dates?(v_stage->>'id')) then
    v_dates:=v_dates||jsonb_build_object(v_stage->>'id',v_at);
  end if;
  perform set_config('app.workflow_change_reason',case when tg_op='INSERT' then 'Alta de solicitud' else 'Estado de solicitud: '||old.status||' -> '||new.status end,true);
  insert into public.operational_request_tracking(request_id,workflow_id,current_stage_id,stage_dates)
  values(new.id,new.workflow_id,(v_stage->>'id')::uuid,v_dates)
  on conflict(request_id) do update set workflow_id=excluded.workflow_id,current_stage_id=excluded.current_stage_id,stage_dates=excluded.stage_dates;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.resolve_program_request_workflow_state(p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.program_requests%rowtype;t public.operational_request_tracking%rowtype;v_stages jsonb;v_current text;v_current_order integer;v_current_stage jsonb;v_resolved jsonb;
begin
  select * into r from public.program_requests where id=p_request_id;
  if r.id is null then raise exception 'REQUEST_NOT_FOUND' using errcode='P0001'; end if;
  if auth.role()<>'service_role' and not(
    auth.uid() is not null and (r.affiliate_id=public.get_effective_affiliate_id() or public.has_admin_permission('workflow.read') or public.has_admin_permission('program_requests.read'))
  ) then raise exception 'REQUEST_WORKFLOW_DENIED' using errcode='42501'; end if;
  if r.workflow_snapshot is null then return jsonb_build_object('available',false,'reason','WORKFLOW_SNAPSHOT_MISSING','message','Seguimiento no disponible'); end if;
  select * into t from public.operational_request_tracking where request_id=r.id;
  select coalesce(jsonb_agg(stage order by (stage->>'sort_order')::integer,stage->>'id'),'[]'::jsonb) into v_stages
  from jsonb_array_elements(r.workflow_snapshot->'stages') stage
  where case when r.status in('rejected','cancelled') then stage->>'outcome'<>'success' else stage->>'outcome'<>'failure' end;
  if t.current_stage_id is not null and exists(select 1 from jsonb_array_elements(v_stages) stage where stage->>'id'=t.current_stage_id::text) then
    v_current:=t.current_stage_id::text;
  else
    select stage->>'id' into v_current from jsonb_array_elements(v_stages) stage
    where stage->'status_references'?r.status order by (stage->>'sort_order')::integer,stage->>'id' limit 1;
  end if;
  if v_current is null then return jsonb_build_object('available',false,'reason','WORKFLOW_STATUS_UNMAPPED','message','Seguimiento no disponible'); end if;
  select (stage->>'sort_order')::integer,stage into v_current_order,v_current_stage from jsonb_array_elements(v_stages) stage where stage->>'id'=v_current;
  select coalesce(jsonb_agg(
    stage||jsonb_build_object(
      'state',case when (stage->>'sort_order')::integer<v_current_order then 'done' when stage->>'id'=v_current then 'current' else 'upcoming' end,
      'date',t.stage_dates->>(stage->>'id')
    ) order by (stage->>'sort_order')::integer,stage->>'id'
  ),'[]'::jsonb) into v_resolved from jsonb_array_elements(v_stages) stage;
  return jsonb_strip_nulls(jsonb_build_object(
    'available',true,'workflow_id',r.workflow_id,'workflow_version',r.workflow_version,
    'workflow_name',r.workflow_snapshot->>'workflow_name','workflow_description',r.workflow_snapshot->>'workflow_description',
    'request_status',r.status,'current_stage_id',v_current,'current_stage',v_current_stage,
    'active_note',nullif(v_current_stage->>'description',''),'stages',v_resolved
  ));
end $function$;

CREATE OR REPLACE FUNCTION public.transition_program_request_workflow(p_request_id uuid, p_action text, p_comment text, p_client_action_id uuid, p_quote_amount numeric DEFAULT NULL::numeric, p_quote_valid_until date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_request public.program_requests%rowtype;v_existing public.program_request_admin_events%rowtype;
  v_event public.program_request_admin_events%rowtype;v_state jsonb;v_current jsonb;v_target jsonb;v_first jsonb;
  v_action text:=upper(btrim(coalesce(p_action,'')));v_event_action text;v_comment text:=nullif(btrim(coalesce(p_comment,'')),'');
  v_to_status text;v_actor_label text;v_dates jsonb;v_expected_existing text[];
begin
  if auth.uid() is null or not public.has_admin_permission('program_requests.write') then
    raise exception 'PROGRAM_REQUEST_WRITE_DENIED' using errcode='42501';
  end if;
  if p_client_action_id is null then raise exception 'CLIENT_ACTION_ID_REQUIRED' using errcode='22023'; end if;
  if v_action not in('ADVANCE','REJECT') then raise exception 'PROGRAM_REQUEST_WORKFLOW_ACTION_INVALID' using errcode='22023'; end if;
  if v_comment is not null and length(v_comment) not between 3 and 2000 then raise exception 'PROGRAM_REQUEST_COMMENT_INVALID' using errcode='22023'; end if;
  if v_action='REJECT' and v_comment is null then raise exception 'PROGRAM_REQUEST_COMMENT_REQUIRED' using errcode='22023'; end if;

  select * into v_existing from public.program_request_admin_events where client_action_id=p_client_action_id;
  if v_existing.id is not null then
    v_expected_existing:=case when v_action='REJECT' then array['REJECT'] else array['APPROVE','ADVANCE_STAGE'] end;
    if v_existing.request_id<>p_request_id or v_existing.actor_auth_user_id<>auth.uid() or not(v_existing.action=any(v_expected_existing)) then
      raise exception 'CLIENT_ACTION_ID_CONFLICT' using errcode='23505';
    end if;
    return jsonb_build_object('idempotent',true,'event',to_jsonb(v_existing)-'actor_auth_user_id'-'client_action_id',
      'workflow_state',public.resolve_program_request_workflow_state(p_request_id));
  end if;

  select * into v_request from public.program_requests where id=p_request_id for update;
  if v_request.id is null then raise exception 'PROGRAM_REQUEST_NOT_FOUND' using errcode='P0001'; end if;
  v_state:=public.resolve_program_request_workflow_state(v_request.id);
  if not coalesce((v_state->>'available')::boolean,false) then raise exception 'REQUEST_WORKFLOW_UNAVAILABLE' using errcode='P0001'; end if;
  v_current:=v_state->'current_stage';
  if v_current is null then raise exception 'REQUEST_WORKFLOW_CURRENT_STAGE_MISSING' using errcode='P0001'; end if;

  if v_action='REJECT' then
    if v_request.status in('approved','rejected','cancelled') then raise exception 'FINANCIAL_REQUEST_TRANSITION_INVALID' using errcode='P0001'; end if;
    select s into v_target from jsonb_array_elements(v_request.workflow_snapshot->'stages') s
      where s->>'outcome'='failure' and s->'status_references'?'rejected'
      order by (s->>'sort_order')::integer,s->>'id' limit 1;
    if v_target is null then raise exception 'REQUEST_WORKFLOW_REJECT_STAGE_MISSING' using errcode='P0001'; end if;
    v_to_status:='rejected';v_event_action:='REJECT';
  else
    if v_request.status in('rejected','cancelled') then raise exception 'FINANCIAL_REQUEST_TRANSITION_INVALID' using errcode='P0001'; end if;
    select s into v_target from jsonb_array_elements(v_state->'stages') s
      where (s->>'sort_order')::integer>(v_current->>'sort_order')::integer and s->>'outcome'<>'failure'
      order by (s->>'sort_order')::integer,s->>'id' limit 1;
    if v_target is null then raise exception 'REQUEST_WORKFLOW_ALREADY_COMPLETE' using errcode='P0001'; end if;
    v_to_status:=v_request.status;
    if v_target->'status_references'?'approved' then
      if v_request.financial_processing_status is not null then
        raise exception 'SPECIALIZED_FINANCIAL_APPROVAL_REQUIRED' using errcode='P0001';
      elsif v_request.request_type='quote' then
        if p_quote_amount is null or p_quote_amount<=0 then raise exception 'QUOTE_AMOUNT_REQUIRED' using errcode='22023'; end if;
      end if;
      v_to_status:='approved';v_event_action:='APPROVE';
    elsif v_target->'status_references'?'in_review' and v_request.status in('submitted','requires_financial_processing') then
      v_to_status:='in_review';v_event_action:='ADVANCE_STAGE';
    else v_event_action:='ADVANCE_STAGE'; end if;
  end if;

  select coalesce(nullif(btrim(raw_user_meta_data->>'display_name'),''),nullif(btrim(raw_user_meta_data->>'full_name'),''),
    nullif(btrim(raw_user_meta_data->>'name'),''),'Personal autorizado') into v_actor_label from auth.users where id=auth.uid();
  perform set_config('app.workflow_change_reason',coalesce(v_comment,case when v_action='REJECT' then 'Rechazo de etapa' else 'Avance de etapa' end),true);

  if v_to_status is distinct from v_request.status then
    if v_request.request_type='quote' and v_to_status='approved' then
      update public.program_requests set status='approved',quoted_amount=round(p_quote_amount,2),quote_note=v_comment,
        valid_until=coalesce(p_quote_valid_until,current_date+15),responded_by_auth_user_id=auth.uid(),responded_at=now(),seen_at=null,updated_at=now()
      where id=v_request.id;
    else
      update public.program_requests set status=v_to_status,updated_at=now() where id=v_request.id;
    end if;
  else
    select coalesce(stage_dates,'{}'::jsonb) into v_dates from public.operational_request_tracking where request_id=v_request.id;
    v_dates:=coalesce(v_dates,'{}'::jsonb);
    select s into v_first from jsonb_array_elements(v_request.workflow_snapshot->'stages') s order by (s->>'sort_order')::integer,s->>'id' limit 1;
    if coalesce((v_first->>'captures_date')::boolean,false) and not(v_dates?(v_first->>'id')) then v_dates:=v_dates||jsonb_build_object(v_first->>'id',v_request.created_at); end if;
    if coalesce((v_target->>'captures_date')::boolean,false) and not(v_dates?(v_target->>'id')) then v_dates:=v_dates||jsonb_build_object(v_target->>'id',now()); end if;
    insert into public.operational_request_tracking(request_id,workflow_id,current_stage_id,stage_dates)
      values(v_request.id,v_request.workflow_id,(v_target->>'id')::uuid,v_dates)
      on conflict(request_id) do update set workflow_id=excluded.workflow_id,current_stage_id=excluded.current_stage_id,stage_dates=excluded.stage_dates;
  end if;

  insert into public.program_request_admin_events(
    request_id,actor_auth_user_id,actor_label,action,from_status,to_status,comment,client_action_id,from_stage_id,to_stage_id
  ) values(v_request.id,auth.uid(),left(coalesce(v_actor_label,'Personal autorizado'),160),v_event_action,v_request.status,v_to_status,
    v_comment,p_client_action_id,(v_current->>'id')::uuid,(v_target->>'id')::uuid) returning * into v_event;
  return jsonb_build_object('idempotent',false,'event',to_jsonb(v_event)-'actor_auth_user_id'-'client_action_id',
    'workflow_state',public.resolve_program_request_workflow_state(v_request.id));
end $function$;

CREATE OR REPLACE FUNCTION public.list_self_program_request_history()
 RETURNS SETOF jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_affiliate_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  v_affiliate_id:=public.get_effective_affiliate_id();
  if v_affiliate_id is null then raise exception 'AFFILIATE_REQUIRED' using errcode='42501'; end if;
  return query
  select jsonb_strip_nulls(jsonb_build_object(
    'id',r.id,'folio',r.folio,'program_id',r.program_id,'program_item_id',r.program_item_id,'product_id',r.product_id,
    'membership_offering_id',r.membership_offering_id,'company_id',r.company_id,'request_type',r.request_type,'status',r.status,
    'quantity',r.quantity,'notes',r.notes,'financial_processing_status',r.financial_processing_status,
    'requested_amount',r.requested_amount,'requested_term',r.requested_term,'requested_term_semantics',r.requested_term_semantics,
    'quoted_amount',r.quoted_amount,'quote_note',r.quote_note,'valid_until',r.valid_until,'responded_at',r.responded_at,
    'created_at',r.created_at,'updated_at',r.updated_at,
    'workflow_state',public.resolve_program_request_workflow_state(r.id),
    'program_item',case when pi.id is null then null else jsonb_build_object('name',pi.name,'program_key',pi.program_key,'price_cash',pi.price_cash) end,
    'product',case when p.id is null then null else jsonb_build_object('name',p.name,'price',p.price) end,
    'membership',case when m.id is null then null else jsonb_build_object('company_raw',m.company_raw,'concept',m.concept,'amount',m.amount) end,
    'company',case when c.id is null then null else jsonb_build_object('display_name',c.display_name) end
  ))
  from public.program_requests r
  left join public.program_catalog_items pi on pi.id=r.program_item_id
  left join public.marketplace_products p on p.id=r.product_id
  left join public.membership_offerings m on m.id=r.membership_offering_id
  left join public.companies c on c.id=r.company_id
  where r.affiliate_id=v_affiliate_id order by r.created_at desc,r.id desc;
end $function$;

CREATE OR REPLACE FUNCTION public.create_program_request(p_program_item_id uuid, p_product_id uuid, p_quantity integer, p_notes text, p_signature_data text, p_terms_accepted boolean, p_idempotency_key uuid)
 RETURNS program_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_affiliate public.affiliates%rowtype;
  v_item public.program_catalog_items%rowtype;
  v_product public.marketplace_products%rowtype;
  v_row public.program_requests%rowtype;
  v_request_type text;
  v_status text;
  v_financial_status text;
begin
  if (p_program_item_id is null) = (p_product_id is null) then
    raise exception 'REQUEST_TARGET_REQUIRED' using errcode='22023';
  end if;
  if p_idempotency_key is null then raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode='22023'; end if;
  if not coalesce(p_terms_accepted,false) or nullif(btrim(coalesce(p_signature_data,'')),'') is null then
    raise exception 'SIGNATURE_AND_TERMS_REQUIRED' using errcode='22023';
  end if;

  select a.* into v_affiliate from public.affiliates a where a.id=public.get_effective_affiliate_id();
  if v_affiliate.id is null then raise exception 'AFFILIATE_REQUIRED' using errcode='P0001'; end if;
  if nullif(btrim(coalesce(v_affiliate.numero_control,'')),'') is null then raise exception 'AFFILIATE_CONTROL_REQUIRED' using errcode='P0001'; end if;

  select * into v_row from public.program_requests
  where affiliate_id=v_affiliate.id and idempotency_key=p_idempotency_key;
  if v_row.id is not null then return v_row; end if;

  if p_program_item_id is not null then
    select * into v_item from public.program_catalog_items where id=p_program_item_id and enabled and request_mode='supabase';
    if v_item.id is null then raise exception 'PROGRAM_NOT_REQUESTABLE' using errcode='P0001'; end if;
    v_request_type:=case when v_item.requires_quote then 'quote' else 'benefit' end;
    v_status:=case when v_item.legacy_boundary then 'requires_financial_processing' else 'submitted' end;
    v_financial_status:=case when v_item.legacy_boundary then 'pending' else null end;
    insert into public.program_requests(
      actor_real_auth_user_id,affiliate_id,numero_control,program_id,program_item_id,request_type,status,
      quantity,notes,signature_data,terms_accepted,source_context,financial_processing_status,idempotency_key
    ) values (
      (select auth.uid()),v_affiliate.id,v_affiliate.numero_control,v_item.program_key,v_item.id,v_request_type,v_status,
      greatest(1,least(coalesce(p_quantity,1),999)),left(nullif(btrim(coalesce(p_notes,'')),''),2000),p_signature_data,true,
      jsonb_build_object('source','sutiapp','catalog','program_catalog_items','requires_quote',v_item.requires_quote),v_financial_status,p_idempotency_key
    ) returning * into v_row;
  else
    select p.* into v_product from public.marketplace_products p
    where p.id=p_product_id and p.enabled and exists(select 1 from public.companies c where c.id=p.company_id and c.enabled);
    if v_product.id is null then raise exception 'PRODUCT_NOT_REQUESTABLE' using errcode='P0001'; end if;
    v_request_type:=case when v_product.requires_quote then 'quote' else 'benefit' end;
    insert into public.program_requests(
      actor_real_auth_user_id,affiliate_id,numero_control,program_id,product_id,company_id,request_type,status,
      quantity,notes,signature_data,terms_accepted,source_context,idempotency_key
    ) values (
      (select auth.uid()),v_affiliate.id,v_affiliate.numero_control,'marketplace',v_product.id,v_product.company_id,v_request_type,'submitted',
      greatest(1,least(coalesce(p_quantity,1),999)),left(nullif(btrim(coalesce(p_notes,'')),''),2000),p_signature_data,true,
      jsonb_build_object('source','sutiapp','catalog','marketplace_products','requires_quote',v_product.requires_quote),p_idempotency_key
    ) returning * into v_row;
  end if;
  return v_row;
exception when unique_violation then
  select * into v_row from public.program_requests where affiliate_id=v_affiliate.id and idempotency_key=p_idempotency_key;
  if v_row.id is not null then return v_row; end if;
  raise;
end $function$;

-- Retain transport rows as audit evidence; recovery never deletes request/Google history.
revoke all on public.program_request_google_sync from authenticated,service_role;
revoke all on function public.request_program_request_google_sync(uuid),public.claim_program_request_google_sync(uuid),public.finish_program_request_google_sync(uuid,bigint,jsonb,integer,text) from authenticated,service_role;
notify pgrst,'reload schema';
commit;
