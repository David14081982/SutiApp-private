-- All changes are isolated by the caller's BEGIN/ROLLBACK. No external deliveries.
create temporary table membership_contract_results(test text,result jsonb);
select set_config('request.jwt.claim.sub',current_setting('test.membership_actor'),true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.membership_actor'),'role','authenticated')::text,true);
do $test$
declare a public.affiliates%rowtype;o public.membership_offerings%rowtype;q jsonb;r public.program_requests%rowtype;
  again public.program_requests%rowtype;t record;cat text;v_amount numeric;n integer;cases integer:=0;
  terms uuid;docs uuid[]:=array[]::uuid[];doc uuid;asset uuid;idem uuid;before_workflow text;step_count integer;
begin
  select * into a from public.affiliates where id=public.get_effective_affiliate_id();
  if a.id is null then raise exception 'CONTROLLED_AFFILIATE_UNAVAILABLE';end if;
  select m.* into o from public.membership_offerings m where m.enabled and exists(select 1 from public.program_terms_versions where membership_offering_id=m.id and published) order by m.sort_order limit 1;
  if o.id is null then raise exception 'MEMBERSHIP_WITH_TERMS_UNAVAILABLE';end if;
  foreach cat in array array['BASE','EVENTUALES','SUPLENTES_FIJOS','SUPLENTES_VARIABLES','JUBILADOS_PENSIONADOS','CONFIANZA'] loop
    update public.affiliates set financial_employee_category_code=cat where id=a.id;
    foreach v_amount in array array[200,350,550,1100,123.45]::numeric[] loop
      foreach n in array array[1,2,3,4] loop
        update public.membership_offerings set amount=v_amount,installments=n where id=o.id;
        q:=public.get_current_membership_payment_quote(o.id);
        if (q->'financialResult'->>'total')::numeric<>v_amount or (q->'financialResult'->>'amount')::numeric<>v_amount
           or (q->'financialResult'->>'capital')::numeric<>v_amount-15*n
           or (q->'financialResult'->>'administrativeFeeTotal')::numeric<>15*n
           or (q->'financialResult'->>'interest')::numeric<>0 or (q->'financialResult'->>'rate')::numeric<>0
           or q->'financialResult'->>'fund'<>'Vales y membresias'
           or q->'financialResult'->>'paymentPeriod'<>(case when cat='JUBILADOS_PENSIONADOS' then 'mensual' else 'quincenal' end)
           or (q->'financialResult'->>'paymentPerPeriod')::numeric*(n-1)+(q->'financialResult'->>'lastPayment')::numeric<>v_amount then
          raise exception 'QUOTE_OR_INCLUDED_FEE_MISMATCH';end if;
        cases:=cases+1;
      end loop;
    end loop;
  end loop;
  insert into membership_contract_results values('commercial amounts / included fees / zero interest / periods / cent reconciliation',jsonb_build_object('status','PASS','cases',cases));
  foreach cat in array array[null]::text[] loop
    update public.affiliates set financial_employee_category_code=cat where id=a.id;
    begin perform public.get_current_membership_payment_quote(o.id);raise exception 'UNRESOLVED_CATEGORY_ACCEPTED';
    exception when invalid_parameter_value then if sqlerrm<>'MEMBERSHIP_PAYROLL_CATEGORY_UNRESOLVED' then raise;end if;end;
  end loop;
  update public.affiliates set financial_employee_category_code='BASE' where id=a.id;
  update public.membership_offerings set amount=20,installments=2 where id=o.id;
  begin perform public.get_current_membership_payment_quote(o.id);raise exception 'NEGATIVE_CAPITAL_ACCEPTED';
  exception when invalid_parameter_value then if sqlerrm<>'MEMBERSHIP_INCLUDED_FEES_EXCEED_TOTAL' then raise;end if;end;
  update public.membership_offerings set amount=o.amount,installments=o.installments where id=o.id;
  select id into terms from public.program_terms_versions where membership_offering_id=o.id and published order by version desc limit 1;
  select coalesce(d.private_asset_id,f.private_asset_id) into asset from public.affiliate_documents d
    left join public.affiliate_files f on f.id=d.affiliate_file_id where d.affiliate_id=a.id and coalesce(d.private_asset_id,f.private_asset_id) is not null limit 1;
  if asset is null then raise exception 'LEGITIMATE_ASSET_FIXTURE_UNAVAILABLE';end if;
  for t in select * from public.resolve_affiliate_document_requirements('MEMBERSHIP',o.id::text,a.id) where required loop
    insert into public.affiliate_documents(affiliate_id,document_type_id,private_asset_id,status,created_by_auth_user_id,reviewed_by_auth_user_id,reviewed_at)
      values(a.id,t.document_type_id,asset,'VERIFIED',auth.uid(),auth.uid(),now()) returning id into doc;
    docs:=array_append(docs,doc);
  end loop;
  q:=public.get_current_membership_payment_quote(o.id);idem:=gen_random_uuid();
  begin
    perform public.create_membership_request(o.id,array[]::uuid[],'6621234567','XAXX010101000','GODE561231HDFRRN09',terms,idem,q->>'quote_hash');
    raise exception 'REQUIRED_DOCUMENTS_BYPASSED';
  exception when invalid_parameter_value then if sqlerrm<>'REQUIRED_DOCUMENTS_MISSING' then raise;end if;end;
  update public.membership_offerings set amount=o.amount+1 where id=o.id;
  begin
    perform public.create_membership_request(o.id,docs,'6621234567','XAXX010101000','GODE561231HDFRRN09',terms,idem,q->>'quote_hash');
    raise exception 'STALE_QUOTE_ACCEPTED';
  exception when serialization_failure then if sqlerrm<>'MEMBERSHIP_CONDITIONS_CHANGED' then raise;end if;end;
  update public.membership_offerings set amount=o.amount where id=o.id;
  q:=public.get_current_membership_payment_quote(o.id);
  r:=public.create_membership_request(o.id,docs,'6621234567','XAXX010101000','GODE561231HDFRRN09',terms,idem,q->>'quote_hash');
  if r.financial_submission_snapshot->>'contract_version'<>'MEMBERSHIP_PAYMENT_V1'
    or r.requested_amount<>o.amount or r.requested_term<>o.installments or r.financial_processing_status is not null
    or r.requested_term_semantics<>'quincenal' or r.financial_profile_snapshot->>'financial_employee_category_code'<>'BASE'
    or r.workflow_snapshot is null then raise exception 'MEMBERSHIP_CAPTURE_OR_WORKFLOW_INVALID';end if;
  again:=public.create_membership_request(o.id,docs,'6621234567','XAXX010101000','GODE561231HDFRRN09',terms,idem,q->>'quote_hash');
  if again.id<>r.id then raise exception 'RETRY_DUPLICATED_REQUEST';end if;
  update public.membership_offerings set amount=o.amount+23,installments=o.installments+1 where id=o.id;
  again:=public.create_membership_request(o.id,docs,'6621234567','XAXX010101000','GODE561231HDFRRN09',terms,idem,q->>'quote_hash');
  if again.financial_submission_snapshot is distinct from r.financial_submission_snapshot then raise exception 'RETRY_REPRICED_HISTORY';end if;
  begin update public.program_requests set financial_submission_snapshot='{}'::jsonb where id=r.id;raise exception 'SNAPSHOT_MUTABLE';
  exception when raise_exception then if sqlerrm<>'FINANCIAL_SUBMISSION_SNAPSHOT_IMMUTABLE' then raise;end if;end;
  before_workflow:=md5(r.workflow_snapshot::text);
  perform public.record_program_request_admin_action(r.id,'MARK_IN_REVIEW','QA rollback only',gen_random_uuid());
  step_count:=0;
  while (select status from public.program_requests where id=r.id)<>'approved' loop
    perform public.transition_program_request_workflow(r.id,'ADVANCE','QA rollback only',gen_random_uuid(),null,null);
    step_count:=step_count+1;if step_count>12 then raise exception 'MEMBERSHIP_WORKFLOW_NOT_COMPLETED';end if;
  end loop;
  select * into again from public.program_requests where id=r.id;
  if again.financial_submission_snapshot is distinct from r.financial_submission_snapshot or md5(again.workflow_snapshot::text)<>before_workflow then raise exception 'APPROVAL_CHANGED_CONTRACT';end if;
  if not exists(select 1 from public.program_request_google_sync where request_id=r.id and desired_status='APROBADO') then raise exception 'GOOGLE_SYNC_NOT_ENQUEUED';end if;
  if (public.get_admin_finance_request_flow_detail(r.id)->'financial_submission_snapshot'->'financialResult') is distinct from q->'financialResult' then raise exception 'ADMIN_CONDITIONS_MISSING';end if;
  insert into membership_contract_results values('submission + documents + stale catalog + retry + immutable history + full approval + Google queue',jsonb_build_object('status','PASS','stages',step_count,'financialResult',q->'financialResult'));
  begin
    perform public.create_membership_request(o.id,docs,'6621234567','XAXX010101000','GODE561231HDFRRN09',terms,idem,repeat('0',64));
    raise exception 'IDEMPOTENCY_MISMATCH_ACCEPTED';
  exception when invalid_parameter_value then if sqlerrm<>'IDEMPOTENCY_CONTRACT_MISMATCH' then raise;end if;end;
  update public.affiliates set financial_employee_category_code='JUBILADOS_PENSIONADOS' where id=a.id;
  q:=public.get_current_membership_payment_quote(o.id);
  again:=public.create_membership_request(o.id,docs,'6621234567','XAXX010101000','GODE561231HDFRRN09',terms,gen_random_uuid());
  if again.requested_term_semantics<>'mensual' or again.financial_submission_snapshot->'financialResult' is distinct from q->'financialResult' then
    raise exception 'OLD_RPC_OR_JUB_CAPTURE_FAILED';end if;
  insert into membership_contract_results values('existing 7-argument writer captures new monthly membership',jsonb_build_object('status','PASS'));
end $test$;
-- API privileges are checked using the actual roles, not only auth claims.
do $$ begin
  if has_function_privilege('anon','public.get_current_membership_payment_quote(uuid)','execute')
    or has_function_privilege('anon','public.create_membership_request(uuid,uuid[],text,text,text,uuid,uuid,text)','execute')
    or has_function_privilege('authenticated','public.membership_payment_contract(uuid,uuid)','execute')
    or has_function_privilege('authenticated','public.capture_membership_payment_contract()','execute') then raise exception 'MEMBERSHIP_PRIVILEGE_LEAK';end if;
end $$;
insert into membership_contract_results values('anonymous/private helper denials',jsonb_build_object('status','PASS'));
select * from membership_contract_results;
