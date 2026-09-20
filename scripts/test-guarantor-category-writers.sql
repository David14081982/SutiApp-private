-- Isolated metadata fixtures and idempotent replay. Caller must ROLLBACK.
-- No Storage uploads, new requests, financial actions or external deliveries.
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select set_config('request.jwt.claim.role','service_role',true);
select set_config('request.jwt.claim.sub','',true);
create temporary table guarantor_writer_results(category text,without_guarantor text,with_guarantor text,missing_own_document text);
do $test$
declare req public.program_requests%rowtype;a public.affiliates%rowtype;t record;
  category text;asset uuid;doc uuid;own_docs uuid[]:=array[]::uuid[];aval_docs uuid[]:=array[]::uuid[];
  all_docs uuid[];expected_required boolean;terms uuid;result public.program_requests%rowtype;snapshot jsonb;
  v_without text;v_with text;v_missing text;
begin
  select r.* into req from public.program_requests r join public.affiliates linked on linked.id=r.affiliate_id
    and linked.auth_user_id=r.actor_real_auth_user_id and not linked.is_archived
    where r.program_id='prestamo' and r.financial_submission_snapshot is not null
    and r.impersonation_session_id is null and r.idempotency_key is not null
    order by r.created_at desc limit 1;
  if req.id is null then raise exception 'LEGITIMATE_IDEMPOTENT_LOAN_FIXTURE_UNAVAILABLE';end if;
  select * into a from public.affiliates where id=req.affiliate_id;
  select id into terms from public.program_terms_versions where program_id='prestamo' and published order by created_at desc limit 1;
  select coalesce(d.private_asset_id,f.private_asset_id) into asset from public.affiliate_documents d
    left join public.affiliate_files f on f.id=d.affiliate_file_id
    where d.affiliate_id=a.id and coalesce(d.private_asset_id,f.private_asset_id) is not null limit 1;
  if asset is null then raise exception 'LEGITIMATE_AFFILIATE_ASSET_UNAVAILABLE';end if;
  for t in select id,code from public.document_types
    where code in ('profile_photo','ine_front','ine_back','payroll_previous','payroll_latest','guarantor_ine_front','guarantor_ine_back','guarantor_photo') loop
    insert into public.affiliate_documents(affiliate_id,document_type_id,private_asset_id,status,created_by_auth_user_id,reviewed_by_auth_user_id,reviewed_at)
      values(a.id,t.id,asset,'VERIFIED',a.auth_user_id,a.auth_user_id,now()) returning id into doc;
    if t.code like 'guarantor_%' then aval_docs:=array_append(aval_docs,doc);else own_docs:=array_append(own_docs,doc);end if;
  end loop;
  if cardinality(own_docs)<>5 or cardinality(aval_docs)<>3 then raise exception 'DOCUMENT_FIXTURE_INCOMPLETE';end if;
  all_docs:=own_docs||aval_docs;
  foreach category in array array['BASE','CONFIANZA','EVENTUALES','JUBILADOS_PENSIONADOS','SUPLENTES_FIJOS','SUPLENTES_VARIABLES',null] loop
    update public.affiliates set financial_employee_category_code=category where id=a.id;
    select * into a from public.affiliates where id=a.id;
    expected_required:=coalesce(category in ('SUPLENTES_FIJOS','SUPLENTES_VARIABLES'),false);
    snapshot:=(req.financial_submission_snapshot-'impersonation_session_id')||jsonb_build_object(
      'affiliate_id',a.id,'actor_real_auth_user_id',a.auth_user_id,'profile_version',a.financial_profile_version);
    begin
      result:=public.create_validated_financial_program_request_v1_engine(a.auth_user_id,a.id,null,req.program_item_id,req.notes,req.signature_data,
        terms,own_docs,req.idempotency_key,req.requested_amount,req.requested_term::integer,req.requested_term_semantics,a.financial_profile_version,snapshot);
      if expected_required then raise exception 'LOAN_ACCEPTED_MISSING_GUARANTOR';end if;
      if result.id<>req.id then raise exception 'IDEMPOTENT_REPLAY_CREATED_REQUEST';end if;
      v_without:='ACCEPTED';
    exception when invalid_parameter_value then
      if sqlerrm<>'REQUIRED_DOCUMENTS_MISSING' or not expected_required then raise;end if;
      v_without:='REQUIRED_DOCUMENTS_MISSING';
    end;
    result:=public.create_validated_financial_program_request_v1_engine(a.auth_user_id,a.id,null,req.program_item_id,req.notes,req.signature_data,
      terms,all_docs,req.idempotency_key,req.requested_amount,req.requested_term::integer,req.requested_term_semantics,a.financial_profile_version,snapshot);
    if result.id<>req.id then raise exception 'IDEMPOTENT_REPLAY_CREATED_REQUEST';end if;
    v_with:='ACCEPTED';
    begin
      perform public.create_validated_financial_program_request_v1_engine(a.auth_user_id,a.id,null,req.program_item_id,req.notes,req.signature_data,
        terms,own_docs[2:5]||aval_docs,req.idempotency_key,req.requested_amount,req.requested_term::integer,req.requested_term_semantics,a.financial_profile_version,snapshot);
      raise exception 'LOAN_ACCEPTED_MISSING_OWN_DOCUMENT';
    exception when invalid_parameter_value then
      if sqlerrm<>'REQUIRED_DOCUMENTS_MISSING' then raise;end if;v_missing:='REQUIRED_DOCUMENTS_MISSING';
    end;
    insert into guarantor_writer_results values(category,v_without,v_with,v_missing);
  end loop;
end $test$;
select * from guarantor_writer_results order by category;
