begin;

alter table public.program_requests drop constraint program_requests_financial_status_check;
alter table public.program_requests add constraint program_requests_financial_status_check check (
  financial_processing_status is null or financial_processing_status in
    ('pending','ready_for_handoff','in_progress','handed_off','failed','completed')
);

alter table public.financial_session_snapshots
  add column session_purpose text not null default 'LOAN',
  add column program_item_id uuid null references public.program_catalog_items(id) on delete restrict,
  add column authorized_price numeric(14,2) null,
  add column price_source text null,
  add column quote_request_id uuid null references public.program_requests(id) on delete restrict,
  add column product_fingerprint text null,
  add column schedule_anchor_date date null,
  add constraint financial_session_purpose_check check(session_purpose in('LOAN','PROGRAM_PRODUCT_PAYMENT')),
  add constraint financial_session_product_context_check check(
    (session_purpose='LOAN' and program_item_id is null and authorized_price is null and price_source is null
      and quote_request_id is null and product_fingerprint is null and schedule_anchor_date is null)
    or
    (session_purpose='PROGRAM_PRODUCT_PAYMENT' and program_item_id is not null and authorized_price>0
      and price_source in('PRICE_CASH','APPROVED_QUOTE') and product_fingerprint~'^[A-F0-9]{64}$'
      and schedule_anchor_date is not null
      and ((price_source='PRICE_CASH' and quote_request_id is null) or (price_source='APPROVED_QUOTE' and quote_request_id is not null)))
  );

create index financial_session_product_context_idx
  on public.financial_session_snapshots(affiliate_id,actor_real_auth_user_id,program_item_id,expires_at desc)
  where session_purpose='PROGRAM_PRODUCT_PAYMENT';

create function public.generate_program_product_payment_schedule(
  p_start_date date,
  p_process_code text,
  p_number_of_payments integer,
  p_total numeric,
  p_regular_payment numeric
) returns jsonb
language plpgsql immutable security definer set search_path=''
as $$
declare
  v_process text:=upper(btrim(coalesce(p_process_code,'')));
  v_min_date date;
  v_cursor date;
  v_candidate date;
  v_dates date[]:=array[]::date[];
  v_rows jsonb:='[]'::jsonb;
  v_index integer;
  v_payment numeric(14,2);
  v_paid numeric(14,2):=0;
  v_remaining numeric(14,2);
begin
  if p_start_date is null or v_process not in('1','3','JUB') or p_number_of_payments not between 1 and 240
     or p_total is null or p_total<=0 or p_regular_payment is null or p_regular_payment<=0 then
    raise exception 'PAYMENT_SCHEDULE_INPUT_INVALID' using errcode='22023';
  end if;
  v_min_date:=p_start_date+30;
  v_cursor:=date_trunc('month',v_min_date)::date;
  while cardinality(v_dates)<p_number_of_payments loop
    if v_process='JUB' then
      v_candidate:=make_date(extract(year from v_cursor)::integer,extract(month from v_cursor)::integer,5);
      if v_candidate>=v_min_date then v_dates:=array_append(v_dates,v_candidate); end if;
    else
      v_candidate:=make_date(extract(year from v_cursor)::integer,extract(month from v_cursor)::integer,15);
      if v_candidate>=v_min_date then v_dates:=array_append(v_dates,v_candidate); end if;
      if cardinality(v_dates)<p_number_of_payments then
        v_candidate:=make_date(extract(year from v_cursor)::integer,extract(month from v_cursor)::integer,
          case when extract(month from v_cursor)::integer=2 then 28 else 30 end);
        if v_candidate>=v_min_date then v_dates:=array_append(v_dates,v_candidate); end if;
      end if;
    end if;
    v_cursor:=(v_cursor+interval '1 month')::date;
    if v_cursor>p_start_date+interval '30 years' then raise exception 'PAYMENT_SCHEDULE_GENERATION_FAILED'; end if;
  end loop;
  for v_index in 1..p_number_of_payments loop
    v_payment:=case when v_index=p_number_of_payments then round(p_total-v_paid,2) else round(p_regular_payment,2) end;
    if v_payment<=0 then raise exception 'PAYMENT_SCHEDULE_TOTAL_INVALID' using errcode='22023'; end if;
    v_paid:=round(v_paid+v_payment,2);
    v_remaining:=greatest(0,round(p_total-v_paid,2));
    v_rows:=v_rows||jsonb_build_array(jsonb_build_object(
      'number',v_index,'date',v_dates[v_index],'payment',v_payment,'remaining_total',v_remaining,
      'final_payment',v_index=p_number_of_payments
    ));
  end loop;
  if v_paid<>round(p_total,2) then raise exception 'PAYMENT_SCHEDULE_RECONCILIATION_FAILED'; end if;
  return jsonb_build_object(
    'version','PROGRAM_PRODUCT_PAYROLL_CALENDAR_V1','process',v_process,
    'frequency',case when v_process='JUB' then 'mensual' else 'quincenal' end,
    'anchor_date',p_start_date,'minimum_first_payment_date',v_min_date,
    'first_payment_date',v_dates[1],'last_payment_date',v_dates[p_number_of_payments],
    'payment_count',p_number_of_payments,'rows',v_rows,'total',round(p_total,2)
  );
end $$;

create function public.create_validated_program_product_payment_request(
  p_actor_real_auth_user_id uuid,
  p_affiliate_id uuid,
  p_impersonation_session_id uuid,
  p_program_item_id uuid,
  p_notes text,
  p_signature_data text,
  p_terms_version_id uuid,
  p_document_ids uuid[],
  p_idempotency_key uuid,
  p_down_payment numeric,
  p_term integer,
  p_expected_profile_version integer,
  p_schedule_anchor_date date
) returns public.program_requests
language plpgsql security definer set search_path=''
as $$
declare
  v_affiliate public.affiliates%rowtype;
  v_item public.program_catalog_items%rowtype;
  v_ctx public.impersonation_sessions%rowtype;
  v_quote public.program_requests%rowtype;
  v_row public.program_requests%rowtype;
  v_policy public.loan_term_policy%rowtype;
  v_rules jsonb;
  v_rule jsonb;
  v_rule_count integer;
  v_price numeric(14,2);
  v_amount numeric(14,2);
  v_source text;
  v_result jsonb;
  v_schedule jsonb;
  v_process text;
  v_period text;
  v_union_label text;
  v_category_label text;
  v_missing integer;
  v_snapshot jsonb;
  v_business_date date:=(now() at time zone 'America/Hermosillo')::date;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  if p_actor_real_auth_user_id is null or not exists(select 1 from auth.users where id=p_actor_real_auth_user_id) then
    raise exception 'AUTH_ACTOR_REQUIRED' using errcode='42501';
  end if;
  select * into v_affiliate from public.affiliates where id=p_affiliate_id for update;
  if v_affiliate.id is null or v_affiliate.financial_profile_version<>p_expected_profile_version then
    raise exception 'CONDITIONS_CHANGED' using errcode='40001';
  end if;
  if p_impersonation_session_id is null then
    if v_affiliate.auth_user_id is distinct from p_actor_real_auth_user_id then raise exception 'AFFILIATE_CONTEXT_DENIED' using errcode='42501'; end if;
  else
    select * into v_ctx from public.impersonation_sessions where id=p_impersonation_session_id for share;
    if v_ctx.id is null or v_ctx.actor_real_auth_user_id<>p_actor_real_auth_user_id
       or v_ctx.usuario_contexto_affiliate_id<>p_affiliate_id or v_ctx.ended_at is not null or v_ctx.expires_at<=now()
       or not exists(select 1 from public.admin_assignments a join public.admin_roles r on r.id=a.role_id and r.enabled
         where a.auth_user_id=p_actor_real_auth_user_id and a.enabled) then
      raise exception 'IMPERSONATION_CONTEXT_INVALID' using errcode='42501';
    end if;
  end if;
  select * into v_item from public.program_catalog_items where id=p_program_item_id and enabled and request_mode='supabase' for share;
  if v_item.id is null or v_item.program_key='prestamo' then raise exception 'PROGRAM_PRODUCT_NOT_FINANCEABLE' using errcode='22023'; end if;
  if v_item.requires_quote then
    select * into v_quote from public.program_requests
    where affiliate_id=p_affiliate_id and program_item_id=v_item.id and request_type='quote' and status='approved'
      and quoted_amount>0 and (valid_until is null or valid_until>=v_business_date)
    order by responded_at desc nulls last,created_at desc,id desc limit 1 for share;
    if v_quote.id is null then raise exception 'AUTHORIZED_PRODUCT_PRICE_UNAVAILABLE' using errcode='P0001'; end if;
    v_price:=v_quote.quoted_amount;v_source:='APPROVED_QUOTE';
  else
    if v_item.price_cash is null or v_item.price_cash<=0 then raise exception 'AUTHORIZED_PRODUCT_PRICE_UNAVAILABLE' using errcode='P0001'; end if;
    v_price:=v_item.price_cash;v_source:='PRICE_CASH';
  end if;
  if p_down_payment is null or p_down_payment<0 or p_down_payment>=v_price then raise exception 'DOWN_PAYMENT_OUT_OF_RANGE' using errcode='22023'; end if;
  v_amount:=round(v_price-p_down_payment,2);
  select * into v_policy from public.loan_term_policy where id='primary' and enabled;
  if v_policy.id is null then raise exception 'LOAN_TERM_POLICY_UNAVAILABLE' using errcode='P0001'; end if;
  select u.label,c.label into v_union_label,v_category_label
  from public.affiliates a
  left join public.segmentation_catalog_entries u on u.catalog_type='union' and u.code=a.financial_union_code and u.enabled
  left join public.segmentation_catalog_entries c on c.catalog_type='employment_category' and c.code=a.financial_employee_category_code and c.enabled
  where a.id=v_affiliate.id;
  if v_union_label is null or v_category_label is null then raise exception 'AFFILIATE_FINANCIAL_PROFILE_INCOMPLETE' using errcode='P0001'; end if;
  v_rules:=public.get_financial_runtime_rules();
  select count(*) into v_rule_count
  from jsonb_array_elements(v_rules) candidate(value)
  where value->>'program_id'='caja'
    and public.normalize_suti_financial_key(value->>'category')=public.normalize_suti_financial_key(v_category_label)
    and public.normalize_suti_financial_key(value->>'union')=public.normalize_suti_financial_key(v_union_label)
    and case upper(coalesce(value->>'visibility_mode','AUTO'))
      when 'MOSTRAR' then true when 'OCULTAR' then false
      else value->>'available_on' is null or (value->>'available_on')::date between v_business_date
        and (date_trunc('month',v_business_date)+interval '5 months - 1 day')::date end;
  if v_rule_count<>1 then raise exception 'CAJA_CHICA_RULE_NOT_ELIGIBLE' using errcode='P0001'; end if;
  select value into v_rule
  from jsonb_array_elements(v_rules) candidate(value)
  where value->>'program_id'='caja'
    and public.normalize_suti_financial_key(value->>'category')=public.normalize_suti_financial_key(v_category_label)
    and public.normalize_suti_financial_key(value->>'union')=public.normalize_suti_financial_key(v_union_label)
    and case upper(coalesce(value->>'visibility_mode','AUTO'))
      when 'MOSTRAR' then true when 'OCULTAR' then false
      else value->>'available_on' is null or (value->>'available_on')::date between v_business_date
        and (date_trunc('month',v_business_date)+interval '5 months - 1 day')::date end
  limit 1;
  v_rule:=v_rule||jsonb_build_object('status','AVAILABLE');
  v_result:=public.resolve_suti_loan_quote_contract(
    jsonb_build_array(v_rule),v_union_label,v_category_label,
    v_rule->>'id',v_amount,p_term,jsonb_build_object(
      'source','SUPABASE_LOAN_TERM_POLICY','standardTerms',v_policy.standard_terms,
      'customMinTerm',v_policy.custom_min_term,'customStep',v_policy.custom_step,
      'decisionReference',v_policy.decision_reference
    )
  );
  v_process:=case v_affiliate.financial_employee_category_code
    when 'SUPLENTES_VARIABLES' then '3' when 'JUBILADOS_PENSIONADOS' then 'JUB'
    when 'SUPLENTES_FIJOS' then '1' when 'EVENTUALES' then '1' when 'BASE' then '1'
    else null end;
  if v_process is null then raise exception 'PAYROLL_PROCESS_UNRESOLVED' using errcode='P0001'; end if;
  v_period:=case when v_process='JUB' then 'mensual' else 'quincenal' end;
  v_result:=(v_result||jsonb_build_object('paymentPeriod',v_period,'ratePeriod',v_period,'source','SUPABASE_FINANCIAL_CRITERIA'));
  if p_schedule_anchor_date is distinct from v_business_date then raise exception 'SCHEDULE_ANCHOR_CHANGED' using errcode='40001'; end if;
  v_schedule:=public.generate_program_product_payment_schedule(
    p_schedule_anchor_date,v_process,(v_result->>'paymentCount')::integer,
    (v_result->>'total')::numeric,(v_result->>'paymentPerPeriod')::numeric
  );
  if p_idempotency_key is null then raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode='22023'; end if;
  if nullif(btrim(coalesce(p_signature_data,'')),'') is null then raise exception 'SIGNATURE_AND_TERMS_REQUIRED' using errcode='22023'; end if;
  if not exists(select 1 from public.program_terms_versions where id=p_terms_version_id and program_id='prestamo'
    and membership_offering_id is null and published) then raise exception 'TERMS_VERSION_REQUIRED' using errcode='22023'; end if;
  select count(*) into v_missing
  from public.resolve_effective_document_requirements('PROGRAM','prestamo') requirement
  where requirement.required and not exists(
    select 1 from public.affiliate_documents d
    left join public.affiliate_files af on af.id=d.affiliate_file_id
    join public.private_assets pa on pa.id=coalesce(d.private_asset_id,af.private_asset_id) and pa.status='READY'
    join storage.objects so on so.bucket_id=pa.storage_bucket and so.name=pa.storage_path
    where d.id=any(coalesce(p_document_ids,array[]::uuid[])) and d.affiliate_id=p_affiliate_id
      and d.document_type_id=requirement.document_type_id and d.status in('PENDING_REVIEW','UNDER_REVIEW','VERIFIED')
      and not exists(select 1 from public.affiliate_documents newer where newer.affiliate_id=d.affiliate_id
        and newer.document_type_id=d.document_type_id and (newer.created_at,newer.id)>(d.created_at,d.id))
  );
  if v_missing>0 then raise exception 'REQUIRED_DOCUMENTS_MISSING' using errcode='22023'; end if;
  v_snapshot:=jsonb_build_object(
    'contract_version','PROGRAM_PRODUCT_PAYMENT_V1','calculation_contract_version','SUTI_LOAN_QUOTE_V1',
    'calendar_contract_version','PROGRAM_PRODUCT_PAYROLL_CALENDAR_V1','affiliate_id',p_affiliate_id,
    'actor_real_auth_user_id',p_actor_real_auth_user_id,'impersonation_session_id',p_impersonation_session_id,
    'profile_version',v_affiliate.financial_profile_version,'product',jsonb_build_object(
      'program_item_id',v_item.id,'program_key',v_item.program_key,'name',v_item.name
    ),'authorized_price',v_price,'price_source',v_source,'quote_request_id',v_quote.id,
    'down_payment',round(p_down_payment,2),'financed_amount',v_amount,'fund_program_id','caja',
    'fund_rule_id',v_rule->>'rule_id','criterion_identity',v_rule->>'criterion_identity',
    'financial_authority','SUPABASE','financial_rules_source_hash',v_rule->>'source_snapshot_hash',
    'financialResult',v_result,'payment_schedule',v_schedule,'terms_version_id',p_terms_version_id,
    'confirmed_at',now()
  );
  select * into v_row from public.program_requests where affiliate_id=p_affiliate_id and idempotency_key=p_idempotency_key;
  if v_row.id is not null then
    if v_row.actor_real_auth_user_id<>p_actor_real_auth_user_id or v_row.program_item_id<>p_program_item_id
       or v_row.requested_amount<>v_amount or v_row.requested_term<>p_term
       or (v_row.financial_submission_snapshot->>'down_payment')::numeric<>round(p_down_payment,2)
       or v_row.financial_submission_snapshot->>'price_source'<>v_source
       or coalesce(v_row.financial_submission_snapshot->>'quote_request_id','')<>coalesce(v_quote.id::text,'') then
      raise exception 'IDEMPOTENCY_CONTRACT_MISMATCH' using errcode='22023';
    end if;
    return v_row;
  end if;
  insert into public.program_requests(
    actor_real_auth_user_id,affiliate_id,usuario_contexto_affiliate_id,impersonation_session_id,impersonation_reason,
    numero_control,program_id,program_item_id,request_type,status,quantity,notes,signature_data,terms_accepted,
    terms_version_id,source_context,financial_processing_status,idempotency_key,requested_amount,requested_term,
    requested_term_semantics,financial_submission_snapshot
  ) values(
    p_actor_real_auth_user_id,p_affiliate_id,case when v_ctx.id is null then null else p_affiliate_id end,v_ctx.id,v_ctx.reason,
    v_affiliate.numero_control,v_item.program_key,v_item.id,'benefit','requires_financial_processing',1,
    left(nullif(btrim(coalesce(p_notes,'')),''),2000),p_signature_data,true,p_terms_version_id,
    jsonb_build_object('source','sutiapp','flow','PROGRAM_PRODUCT_PAYMENT_V1','price_source',v_source,
      'quote_request_id',v_quote.id,'fund_program_id','caja','assisted',v_ctx.id is not null),
    'pending',p_idempotency_key,v_amount,p_term,v_period,v_snapshot
  ) returning * into v_row;
  insert into public.request_documents(request_id,document_type_id,affiliate_document_id,private_asset_id,asset_sha256,status_at_submission)
  select v_row.id,d.document_type_id,d.id,coalesce(d.private_asset_id,af.private_asset_id),pa.content_sha256,d.status
  from public.affiliate_documents d left join public.affiliate_files af on af.id=d.affiliate_file_id
  join public.private_assets pa on pa.id=coalesce(d.private_asset_id,af.private_asset_id)
  join storage.objects so on so.bucket_id=pa.storage_bucket and so.name=pa.storage_path
  where d.id=any(coalesce(p_document_ids,array[]::uuid[])) and d.affiliate_id=p_affiliate_id
    and d.status in('PENDING_REVIEW','UNDER_REVIEW','VERIFIED')
  on conflict(request_id,document_type_id) do nothing;
  insert into public.sensitive_change_audit(actor_auth_user_id,affiliate_id,resource,action,target_id,metadata)
  values(p_actor_real_auth_user_id,p_affiliate_id,'program_requests','PROGRAM_PRODUCT_PAYMENT_CONFIRMED',v_row.id,
    jsonb_build_object('program_item_id',v_item.id,'price_source',v_source,'quote_request_id',v_quote.id,
      'payment_count',p_term,'payment_period',v_period,'assisted',v_ctx.id is not null));
  return v_row;
exception when unique_violation then
  select * into v_row from public.program_requests where affiliate_id=p_affiliate_id and idempotency_key=p_idempotency_key;
  if v_row.id is not null and v_row.program_item_id=p_program_item_id and v_row.requested_amount=v_amount
     and v_row.requested_term=p_term and (v_row.financial_submission_snapshot->>'down_payment')::numeric=round(p_down_payment,2) then
    return v_row;
  end if;
  raise;
end $$;

create function public.approve_program_product_payment_request(
  p_request_id uuid,
  p_comment text,
  p_client_action_id uuid
) returns public.program_requests
language plpgsql security definer set search_path=''
as $$
declare
  v_row public.program_requests%rowtype;
  v_existing public.program_request_admin_events%rowtype;
  v_actor_label text;
  v_comment text:=nullif(btrim(coalesce(p_comment,'')),'');
  v_from_status text;
begin
  if auth.uid() is null or not public.has_admin_permission('program_requests.write') then
    raise exception 'PROGRAM_REQUEST_WRITE_DENIED' using errcode='42501';
  end if;
  if p_client_action_id is null then raise exception 'CLIENT_ACTION_ID_REQUIRED' using errcode='22023'; end if;
  if v_comment is not null and length(v_comment) not between 3 and 2000 then
    raise exception 'PROGRAM_REQUEST_COMMENT_INVALID' using errcode='22023';
  end if;
  select * into v_existing from public.program_request_admin_events where client_action_id=p_client_action_id;
  if v_existing.id is not null then
    if v_existing.request_id<>p_request_id or v_existing.actor_auth_user_id<>auth.uid() or v_existing.action<>'APPROVE' then
      raise exception 'CLIENT_ACTION_ID_CONFLICT' using errcode='23505';
    end if;
    select * into v_row from public.program_requests where id=p_request_id;
    return v_row;
  end if;
  select * into v_row from public.program_requests where id=p_request_id for update;
  if v_row.id is null or v_row.financial_processing_status is null
     or v_row.program_id='prestamo'
     or v_row.financial_submission_snapshot->>'contract_version'<>'PROGRAM_PRODUCT_PAYMENT_V1' then
    raise exception 'PROGRAM_PRODUCT_PAYMENT_REQUEST_NOT_FOUND' using errcode='P0001';
  end if;
  if v_row.financial_approval_snapshot is not null and v_row.status='approved' and v_row.financial_processing_status='completed' then
    return v_row;
  end if;
  if v_row.status not in('requires_financial_processing','in_review') then
    raise exception 'FINANCIAL_REQUEST_NOT_APPROVABLE' using errcode='P0001';
  end if;
  if not v_row.terms_accepted or nullif(btrim(coalesce(v_row.signature_data,'')),'') is null
     or v_row.terms_version_id is null or jsonb_typeof(v_row.financial_submission_snapshot)<>'object'
     or jsonb_typeof(v_row.financial_submission_snapshot->'financialResult')<>'object'
     or jsonb_typeof(v_row.financial_submission_snapshot->'payment_schedule')<>'object' then
    raise exception 'FINANCIAL_SUBMISSION_CONTRACT_MISMATCH' using errcode='22023';
  end if;
  v_from_status:=v_row.status;
  update public.program_requests set
    status='approved',financial_processing_status='completed',financial_approval_snapshot=
      v_row.financial_submission_snapshot||jsonb_build_object(
        'approval_contract_version','PROGRAM_PRODUCT_PAYMENT_APPROVAL_V1',
        'approved_at',now(),'approved_by',auth.uid(),'comment',v_comment
      ),
    financial_approved_at=now(),financial_approved_by=auth.uid(),updated_at=now()
  where id=v_row.id returning * into v_row;
  select coalesce(nullif(btrim(raw_user_meta_data->>'display_name'),''),
    nullif(btrim(raw_user_meta_data->>'full_name'),''),nullif(btrim(raw_user_meta_data->>'name'),''),
    'Personal autorizado') into v_actor_label from auth.users where id=auth.uid();
  insert into public.program_request_admin_events(
    request_id,actor_auth_user_id,actor_label,action,from_status,to_status,comment,client_action_id
  ) values(v_row.id,auth.uid(),left(v_actor_label,160),'APPROVE',v_from_status,'approved',v_comment,p_client_action_id);
  insert into public.sensitive_change_audit(actor_auth_user_id,affiliate_id,resource,action,target_id,metadata)
  values(auth.uid(),v_row.affiliate_id,'program_requests','PROGRAM_PRODUCT_PAYMENT_APPROVED',v_row.id,
    jsonb_build_object('program_item_id',v_row.program_item_id,'processing_status','completed','google_handoff',false));
  return v_row;
end $$;

create or replace function public.capture_document_requirements_snapshot()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_type text;v_key text;
begin
  if new.document_requirements_snapshot is not null then raise exception 'DOCUMENT_REQUIREMENTS_SNAPSHOT_SERVER_ONLY' using errcode='42501'; end if;
  if new.membership_offering_id is not null then v_type:='MEMBERSHIP';v_key:=new.membership_offering_id::text;
  elsif new.program_id='prestamo' then v_type:='PROGRAM';v_key:='prestamo';
  elsif new.financial_submission_snapshot->>'contract_version'='PROGRAM_PRODUCT_PAYMENT_V1' then v_type:='PROGRAM';v_key:='prestamo';
  elsif new.product_id is not null then v_type:='PRODUCT';v_key:=new.product_id::text;
  elsif new.program_item_id is not null then v_type:='PROGRAM';v_key:=new.program_item_id::text;
  else raise exception 'DOCUMENT_SCOPE_NOT_AVAILABLE' using errcode='22023'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'requirement_id',r.requirement_id,'document_type_id',r.document_type_id,'code',r.document_type_code,'label',r.document_type_label,
    'required',r.required,'allow_verified_reuse',r.allow_verified_reuse,'sort_order',r.sort_order,'inherited',r.inherited,
    'source_scope_type',r.source_scope_type,'source_scope_key',r.source_scope_key,'scope_type',v_type,'scope_key',v_key
  ) order by r.sort_order,r.document_type_label),'[]'::jsonb) into new.document_requirements_snapshot
  from public.resolve_effective_document_requirements(v_type,v_key) r;
  return new;
end $$;

revoke all on function public.generate_program_product_payment_schedule(date,text,integer,numeric,numeric),
  public.create_validated_program_product_payment_request(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,integer,date)
  from public,anon,authenticated;
revoke all on function public.approve_program_product_payment_request(uuid,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.generate_program_product_payment_schedule(date,text,integer,numeric,numeric),
  public.create_validated_program_product_payment_request(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,integer,date)
  to service_role;
grant execute on function public.approve_program_product_payment_request(uuid,text,uuid) to authenticated;

comment on function public.generate_program_product_payment_schedule(date,text,integer,numeric,numeric) is
  'Single server-side payroll calendar: process 1/3 on 15 and 30 (28 in February), JUB monthly on day 5, first payment at least 30 days after anchor.';
comment on function public.create_validated_program_product_payment_request(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,integer,date) is
  'Atomic service-only universal program product financing writer using authoritative product price, Caja Chica, certified math, payroll calendar, documents and terms.';
comment on function public.approve_program_product_payment_request(uuid,text,uuid) is
  'Admin-permission-gated Supabase-only approval for product payment requests; never invokes or prepares a Google handoff.';
comment on column public.financial_session_snapshots.session_purpose is
  'Separates loan sessions from universal program product payment sessions; both remain derived service-only caches.';

notify pgrst, 'reload schema';
commit;
