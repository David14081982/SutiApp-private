begin;
set local lock_timeout='2s';
set local statement_timeout='60s';

-- NULL is explicit inheritance of the affiliate's existing Caja Chica rule.
alter table public.program_catalog_items add column financing_config jsonb;
grant select(financing_config) on public.program_catalog_items to authenticated;
create schema if not exists program_financing_private;
revoke all on schema program_financing_private from public,anon,authenticated;
create table program_financing_private.function_backup(signature text primary key,definition text not null,applied_definition text);
alter table program_financing_private.function_backup enable row level security;
alter table program_financing_private.function_backup force row level security;
revoke all on program_financing_private.function_backup from public,anon,authenticated;
insert into program_financing_private.function_backup(signature,definition)
select oid::regprocedure::text,pg_get_functiondef(oid) from pg_proc
where oid='public.create_validated_program_product_payment_request(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,integer,date)'::regprocedure;

create function public.validate_program_product_financing(p_config jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare r jsonb; d jsonb; n numeric;
begin
 if p_config is null then return; end if;
 if jsonb_typeof(p_config)<>'object' or not (p_config ?& array['default_rate','rules','down_payment'])
 or exists(select 1 from jsonb_object_keys(p_config) k where k not in('default_rate','rules','down_payment'))
 or jsonb_typeof(p_config->'rules')<>'array' then raise exception 'PRODUCT_FINANCING_CONFIG_INVALID'; end if;
 if p_config->'default_rate'<>'null'::jsonb then
  if jsonb_typeof(p_config->'default_rate')<>'number' then raise exception 'PRODUCT_RATE_INVALID'; end if;
  n:=(p_config->>'default_rate')::numeric;
  if n<0 or n<>round(n,6) then raise exception 'PRODUCT_RATE_INVALID'; end if;
 end if;
 if jsonb_array_length(p_config->'rules')>200 then raise exception 'PRODUCT_RATE_RULE_LIMIT'; end if;
 for r in select value from jsonb_array_elements(p_config->'rules') loop
  if jsonb_typeof(r)<>'object' or not(r ?& array['union_code','category_code','rate'])
  or exists(select 1 from jsonb_object_keys(r) k where k not in('union_code','category_code','rate'))
  or jsonb_typeof(r->'rate')<>'number' or (r->>'rate')::numeric<0
  or (r->>'rate')::numeric<>round((r->>'rate')::numeric,6)
  or (r->>'union_code' is null and r->>'category_code' is null) then raise exception 'PRODUCT_RATE_RULE_INVALID'; end if;
  if r->>'union_code' is not null and not exists(select 1 from public.segmentation_catalog_entries where catalog_type='union' and code=r->>'union_code' and enabled)
  or r->>'category_code' is not null and not exists(select 1 from public.segmentation_catalog_entries where catalog_type='employment_category' and code=r->>'category_code' and enabled)
  then raise exception 'PRODUCT_RATE_AUDIENCE_INVALID'; end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(p_config->'rules') entry group by entry->>'union_code',entry->>'category_code' having count(*)>1)
 then raise exception 'PRODUCT_RATE_RULE_DUPLICATE'; end if;
 -- Independent audience rules with different rates require the explicit intersection.
 if exists(select 1 from jsonb_array_elements(p_config->'rules') u cross join jsonb_array_elements(p_config->'rules') c
  where u->>'union_code' is not null and u->>'category_code' is null
  and c->>'union_code' is null and c->>'category_code' is not null and u->'rate'<>c->'rate'
  and not exists(select 1 from jsonb_array_elements(p_config->'rules') x
    where x->>'union_code'=u->>'union_code' and x->>'category_code'=c->>'category_code'))
 then raise exception 'PRODUCT_RATE_AUDIENCE_CONFLICT'; end if;
 d:=p_config->'down_payment';
 if jsonb_typeof(d)<>'object' or not(d ?& array['required','type','value'])
 or exists(select 1 from jsonb_object_keys(d) k where k not in('required','type','value'))
 or jsonb_typeof(d->'required')<>'boolean' or jsonb_typeof(d->'type')<>'string' or d->>'type' not in('AMOUNT','PERCENT')
 or jsonb_typeof(d->'value')<>'number' then raise exception 'PRODUCT_DOWN_PAYMENT_INVALID'; end if;
 n:=(d->>'value')::numeric;
 if n<0 or n<>round(n,2) or ((d->>'required')::boolean and n<=0)
 or (d->>'type'='PERCENT' and n>=100) then raise exception 'PRODUCT_DOWN_PAYMENT_INVALID'; end if;
end $$;

create function public.resolve_program_product_financing(p_item_id uuid,p_affiliate_id uuid,p_base_rule jsonb,p_price numeric)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare cfg jsonb; a public.affiliates%rowtype; rate numeric; matches jsonb; chosen jsonb; specificity integer;
 source text:='CAJA_CHICA'; minimum numeric:=0; result_rule jsonb:=p_base_rule;
begin
 select financing_config into cfg from public.program_catalog_items where id=p_item_id and enabled and commercial_mode<>'DIRECT_CONTACT' and not sold;
 if not found then raise exception 'PROGRAM_PRODUCT_NOT_FINANCEABLE'; end if;
 select * into a from public.affiliates where id=p_affiliate_id;
 if a.id is null or p_base_rule->>'program_id' is distinct from 'caja' or p_base_rule->>'status' is distinct from 'AVAILABLE'
 or p_price is null or p_price<=0 then raise exception 'CAJA_CHICA_RULE_NOT_ELIGIBLE'; end if;
 perform public.validate_program_product_financing(cfg);
 if cfg is not null then
  select max((r->>'union_code' is not null)::integer+(r->>'category_code' is not null)::integer) into specificity
  from jsonb_array_elements(cfg->'rules') r
  where (r->>'union_code' is null or r->>'union_code'=a.financial_union_code)
    and (r->>'category_code' is null or r->>'category_code'=a.financial_employee_category_code);
  select jsonb_agg(r) into matches from jsonb_array_elements(cfg->'rules') r
  where (r->>'union_code' is null or r->>'union_code'=a.financial_union_code)
    and (r->>'category_code' is null or r->>'category_code'=a.financial_employee_category_code)
    and (r->>'union_code' is not null)::integer+(r->>'category_code' is not null)::integer=specificity;
  if matches is not null then
   if (select count(distinct r->'rate') from jsonb_array_elements(matches) r)>1 then raise exception 'PRODUCT_RATE_AUDIENCE_CONFLICT'; end if;
   chosen:=matches->0;rate:=(chosen->>'rate')::numeric;source:='PRODUCT_AUDIENCE';
  elsif cfg->'default_rate'<>'null'::jsonb then rate:=(cfg->>'default_rate')::numeric;source:='PRODUCT_DEFAULT'; end if;
  if (cfg->'down_payment'->>'required')::boolean then
   minimum:=case cfg->'down_payment'->>'type' when 'PERCENT' then ceil(p_price*(cfg->'down_payment'->>'value')::numeric)/100
   else (cfg->'down_payment'->>'value')::numeric end;
  end if;
 end if;
 if rate is not null then result_rule:=p_base_rule||jsonb_build_object('rate',rate,'rate_factor',rate/100); end if;
 minimum:=greatest(minimum,ceil((p_price-(p_base_rule->>'max_amount')::numeric)*100)/100,0);
 if minimum>=p_price then raise exception 'PRODUCT_DOWN_PAYMENT_EXCEEDS_PRICE'; end if;
 return jsonb_build_object('rule',result_rule,'minimum_down_payment',minimum,'conditions',jsonb_build_object(
  'version','PROGRAM_PRODUCT_FINANCING_V1','config',cfg,'rate_source',source,'matched_rules',matches,
  'effective_rate',result_rule->'rate','minimum_down_payment',minimum,'fund_program_id','caja'));
end $$;

create function public.get_program_product_financing_options() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.has_admin_permission('program_catalog.write') then raise exception 'PROGRAM_CATALOG_WRITE_REQUIRED' using errcode='42501'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('type',catalog_type,'code',code,'label',label) order by catalog_type,label),'[]'::jsonb)
 from public.segmentation_catalog_entries where catalog_type in('union','employment_category') and enabled);
end $$;

create function public.save_program_catalog_item_financing(p_item_id uuid,p_payload jsonb,p_asset_links jsonb,p_config jsonb,p_expected_config jsonb,p_bootstrap boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare item public.program_catalog_items%rowtype; previous jsonb; saved jsonb;
begin
 if auth.uid() is null or not public.has_admin_permission('program_catalog.write') then raise exception 'PROGRAM_CATALOG_WRITE_REQUIRED' using errcode='42501'; end if;
 if p_item_id is not null then
  select * into item from public.program_catalog_items where id=p_item_id for update;
  if item.id is null then raise exception 'PROGRAM_CATALOG_ITEM_NOT_FOUND'; end if;
  previous:=item.financing_config;
  if previous is distinct from p_expected_config then raise exception 'PRODUCT_FINANCING_CHANGED' using errcode='PT409'; end if;
 end if;
 perform public.validate_program_product_financing(p_config);
 -- Delegate every existing catalog/media/section permission check to the original writer.
 if p_bootstrap and p_item_id is null then saved:=public.create_first_cirugias_program_catalog_item(p_payload,p_asset_links);
 else saved:=public.save_program_catalog_item(p_item_id,p_payload,p_asset_links); end if;
 select * into item from public.program_catalog_items where id=(saved->>'id')::uuid;
 if item.commercial_mode='PAYROLL_FIXED' and item.price_cash>0 and (p_config->'down_payment'->>'required')::boolean
 and p_config->'down_payment'->>'type'='AMOUNT' and (p_config->'down_payment'->>'value')::numeric>=item.price_cash
 then raise exception 'PRODUCT_DOWN_PAYMENT_EXCEEDS_PRICE'; end if;
 if previous is distinct from p_config then
  update public.program_catalog_items set financing_config=p_config,updated_at=now() where id=item.id returning * into item;
  insert into public.admin_audit_log(actor_auth_user_id,resource,action,target_id,result,details)
  values(auth.uid(),'program_catalog_items','UPDATE',item.id::text,'SUCCESS',jsonb_build_object('operation','PRODUCT_FINANCING','before',previous,'after',p_config));
 end if;
 return saved||jsonb_build_object('financing_config',item.financing_config);
end $$;

-- Exact focal changes to the installed writer preserve intervening document/identity fixes.
do $$
declare original text; changed text;
begin
 select definition into original from program_financing_private.function_backup;
 if md5(original)<>'57e93a27997124f94aea2146f2854dfb' then raise exception 'PRODUCT_FINANCING_WRITER_DRIFT'; end if;
 if original not like '%  v_rule jsonb;%' or original not like '%  v_result:=public.resolve_suti_loan_quote_contract(%'
 or original not like '%    ''financialResult'',v_result,''payment_schedule'',v_schedule,%' then raise exception 'PRODUCT_FINANCING_WRITER_DRIFT'; end if;
 changed:=replace(original,'  v_rule jsonb;','  v_rule jsonb; v_financing jsonb;');
 changed:=replace(changed,'  v_result:=public.resolve_suti_loan_quote_contract(',
 '  v_financing:=public.resolve_program_product_financing(v_item.id,v_affiliate.id,v_rule,v_price);
  v_rule:=v_financing->''rule'';
  if p_down_payment<>(round(p_down_payment,2)) or p_down_payment<(v_financing->>''minimum_down_payment'')::numeric then raise exception ''DOWN_PAYMENT_OUT_OF_RANGE'' using errcode=''22023''; end if;
  v_result:=public.resolve_suti_loan_quote_contract(');
 changed:=replace(changed,'''financialResult'',v_result,''payment_schedule'',v_schedule,',
 '''financing_conditions'',v_financing->''conditions'',''financialResult'',v_result,''payment_schedule'',v_schedule,');
 execute changed;
 update program_financing_private.function_backup set applied_definition=pg_get_functiondef(signature::regprocedure);
end $$;

-- Compare the sealed result inside the same transaction. A concurrent edit rolls back
-- the request, documents, audit and Google outbox instead of accepting a different quote.
create function public.confirm_program_product_financing(p_submission jsonb,p_expected_result jsonb,p_expected_conditions jsonb)
returns public.program_requests language plpgsql security definer set search_path='' as $$
declare r public.program_requests%rowtype;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
 if p_expected_result is null or p_expected_conditions is null then raise exception 'CONDITIONS_CHANGED' using errcode='PT409'; end if;
 r:=public.create_validated_program_product_payment_request(
 (p_submission->>'p_actor_real_auth_user_id')::uuid,(p_submission->>'p_affiliate_id')::uuid,
 (p_submission->>'p_impersonation_session_id')::uuid,(p_submission->>'p_program_item_id')::uuid,
 p_submission->>'p_notes',p_submission->>'p_signature_data',(p_submission->>'p_terms_version_id')::uuid,
 array(select jsonb_array_elements_text(p_submission->'p_document_ids'))::uuid[],
 (p_submission->>'p_idempotency_key')::uuid,(p_submission->>'p_down_payment')::numeric,
 (p_submission->>'p_term')::integer,(p_submission->>'p_expected_profile_version')::integer,
 (p_submission->>'p_schedule_anchor_date')::date);
 if ((r.financial_submission_snapshot->'financialResult')-'resolved_at') is distinct from (p_expected_result-'resolved_at')
 or r.financial_submission_snapshot->'financing_conditions' is distinct from p_expected_conditions
 then raise exception 'CONDITIONS_CHANGED' using errcode='PT409'; end if;
 return r;
end $$;

revoke all on function public.validate_program_product_financing(jsonb),public.resolve_program_product_financing(uuid,uuid,jsonb,numeric),
 public.get_program_product_financing_options(),public.save_program_catalog_item_financing(uuid,jsonb,jsonb,jsonb,jsonb,boolean),
 public.confirm_program_product_financing(jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.resolve_program_product_financing(uuid,uuid,jsonb,numeric),public.confirm_program_product_financing(jsonb,jsonb,jsonb) to service_role;
grant execute on function public.get_program_product_financing_options(),public.save_program_catalog_item_financing(uuid,jsonb,jsonb,jsonb,jsonb,boolean) to authenticated;
comment on column public.program_catalog_items.financing_config is 'Per-item rate percent per existing payroll period and minimum down payment. NULL inherits current Caja Chica. Immutable requests seal resolved conditions.';
commit;
