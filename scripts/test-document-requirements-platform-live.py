#!/usr/bin/env python3
"""Read-only/rollback production certification for the document requirements platform."""
import json
import importlib.util
import urllib.error
import urllib.request
from pathlib import Path

MODULE_PATH = Path(__file__).with_name('apply-document-requirements-platform.py')
SPEC = importlib.util.spec_from_file_location('document_requirements_apply', MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)
query, env = MODULE.query, MODULE.env


def http(url, key, token, body):
    request = urllib.request.Request(url, data=json.dumps(body).encode(), method='POST', headers={
        'apikey': key, 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'Accept': 'application/json'})
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return response.status, json.loads(response.read() or b'{}')
    except urllib.error.HTTPError as error:
        raw = error.read().decode('utf-8', 'replace')
        try: return error.code, json.loads(raw)
        except json.JSONDecodeError: return error.code, {'message': raw[:300]}


def http_get(url, key, token):
    request = urllib.request.Request(url, headers={
        'apikey': key, 'Authorization': 'Bearer ' + token, 'Accept': 'application/json'})
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return response.status, json.loads(response.read() or b'[]')
    except urllib.error.HTTPError as error:
        raw = error.read().decode('utf-8', 'replace')
        try: return error.code, json.loads(raw)
        except json.JSONDecodeError: return error.code, {'message': raw[:300]}


def login(values):
    base=values['SUPABASE_URL'].rstrip('/');key=values['SUPABASE_PUBLISHABLE_KEY']
    status,data=http(base+'/auth/v1/token?grant_type=password',key,key,{'email':values['H005_TEST2_EMAIL'],'password':values['H005_TEST2_PASSWORD']})
    if status!=200: raise RuntimeError('QA_LOGIN_FAILED')
    return base,key,data['access_token']


def main():
    values = env()
    summary = query(values, """select
      (select count(*) from public.program_document_requirements where program_id='prestamo') as loan_stored,
      (select count(*) from public.program_document_requirements where program_id='membership') as membership_stored,
      (select count(*) from public.document_types) as document_types,
      (select count(*) from public.program_requests where document_requirements_snapshot is null) as historical_null_snapshots,
      (select count(*) from public.program_requests) as program_requests,
      (select count(*) from public.document_configuration_audit_log) as audit_events,
      (select count(*) from public.financial_rules) as financial_rules,
      (select count(*) from public.financial_funds) as financial_funds,
      (select count(*) from public.financial_programs) as financial_programs,
      not has_table_privilege('authenticated','public.document_types','insert,update,delete') as type_direct_writes_denied,
      not has_table_privilege('authenticated','public.program_document_requirements','insert,update,delete') as requirement_direct_writes_denied,
      not has_function_privilege('authenticated','public.create_program_request(uuid,uuid,integer,text,text,boolean,uuid)','execute') as request_bypass_denied,
      not has_function_privilege('anon','public.resolve_effective_document_requirements(text,text)','execute') as anon_resolver_denied;""")[0]
    if summary['loan_stored'] != 8:
        raise RuntimeError('LOAN_REQUIREMENTS_CHANGED')
    if summary['membership_stored'] != 24 or summary['document_types'] != 13:
        raise RuntimeError('EXISTING_CONFIGURATION_CHANGED')
    if summary['historical_null_snapshots'] != summary['program_requests']:
        raise RuntimeError('HISTORICAL_REQUESTS_REWRITTEN')
    if [summary['financial_rules'], summary['financial_funds'], summary['financial_programs']] != [146, 35, 3]:
        raise RuntimeError('FINANCIAL_BOUNDARY_CHANGED')
    for key in ('type_direct_writes_denied','requirement_direct_writes_denied','request_bypass_denied','anon_resolver_denied'):
        if not summary[key]: raise RuntimeError(key.upper())

    base,key,token=login(values)
    membership_status,membership_rows=http_get(
      base+'/rest/v1/membership_offerings?select=id,enabled&enabled=eq.true',key,token)
    if membership_status != 200 or not membership_rows:
        raise RuntimeError('MEMBERSHIP_CATALOG_UNAVAILABLE:'+json.dumps({
          'status':membership_status,'body':membership_rows})[:500])
    resolver_status,resolver_rows=http(
      base+'/rest/v1/rpc/resolve_effective_document_requirements',key,token,{
        'p_scope_type':'MEMBERSHIP','p_scope_key':membership_rows[0]['id']})
    if resolver_status != 200 or not resolver_rows:
        raise RuntimeError('MEMBERSHIP_REQUIREMENTS_UNAVAILABLE:'+json.dumps({
          'status':resolver_status,'body':resolver_rows})[:500])
    legacy_status,legacy_body=http(base+'/rest/v1/rpc/register_affiliate_document',key,token,{
      'p_document_type_id':'00000000-0000-0000-0000-000000000000','p_storage_path':'invalid','p_mime_type':'image/png','p_file_size':1,'p_sha256':'0'*64})
    if legacy_status not in (401,403,404) or 'permission' not in json.dumps(legacy_body).lower() and 'schema cache' not in json.dumps(legacy_body).lower():
        raise RuntimeError('LEGACY_UPLOAD_RPC_STILL_EXECUTABLE:'+json.dumps({'status':legacy_status,'body':legacy_body})[:500])

    rollback = query(values, """begin;
      do $$ declare
        v_actor uuid;v_admin uuid;v_affiliate uuid;v_item uuid;v_document uuid;v_document_type uuid;v_second_type uuid;
        v_company uuid;v_product uuid;v_types uuid[];v_request public.program_requests%rowtype;
        v_before jsonb;v_after jsonb;v_resolved integer;v_linked integer;v_inherited integer;
      begin
        select a.auth_user_id,a.id,d.id,d.document_type_id into v_actor,v_affiliate,v_document,v_document_type
        from public.affiliate_documents d
        join public.affiliates a on a.id=d.affiliate_id and a.auth_user_id is not null
        left join public.affiliate_files af on af.id=d.affiliate_file_id
        join public.private_assets pa on pa.id=coalesce(d.private_asset_id,af.private_asset_id) and pa.status='READY'
        join storage.objects so on so.bucket_id=pa.storage_bucket and so.name=pa.storage_path
        where d.status in('PENDING_REVIEW','UNDER_REVIEW','VERIFIED')
          and not exists(select 1 from public.affiliate_documents newer where newer.affiliate_id=d.affiliate_id and newer.document_type_id=d.document_type_id and (newer.created_at,newer.id)>(d.created_at,d.id))
        order by d.created_at desc,d.id desc limit 1;
        select i.id into v_item from public.program_catalog_items i
        where i.enabled and i.request_mode='supabase' and i.program_key<>'prestamo'
          and not exists(select 1 from public.program_document_requirements r where r.scope_type='PROGRAM' and r.scope_key=i.id::text)
        order by i.sort_order,i.id limit 1;
        select id into v_second_type from public.document_types where enabled and id<>v_document_type order by sort_order,id limit 1;
        select aa.auth_user_id into v_admin from public.admin_assignments aa where aa.enabled order by aa.created_at,aa.id limit 1;
        if v_actor is null or v_admin is null or v_affiliate is null or v_document is null or v_item is null or v_second_type is null then raise exception 'QA_PREREQUISITE_MISSING'; end if;

        insert into public.program_document_requirements(program_id,membership_offering_id,document_type_id,required,allow_verified_reuse,sort_order,enabled,scope_type,scope_key,effect)
        values('program:'||v_item::text,null,v_document_type,true,true,1,true,'PROGRAM',v_item::text,'INCLUDE');

        select c.id into v_company from public.companies c where c.enabled order by c.sort_order,c.id limit 1;
        perform set_config('request.jwt.claims',jsonb_build_object('sub',v_admin::text,'role','authenticated')::text,true);
        set local role authenticated;
        insert into public.marketplace_products(company_id,name,description,price,requires_quote,enabled,sort_order)
        values(v_company,'QA rollback document inheritance','Temporary rollback-only fixture',1,false,true,999999) returning id into v_product;
        reset role;
        select array_agg(x.id order by x.sort_order,x.id) into v_types from (
          select d.id,d.sort_order from public.document_types d where d.enabled order by d.sort_order,d.id limit 4
        ) x;
        if coalesce(array_length(v_types,1),0)<>4 then raise exception 'QA_DOCUMENT_TYPES_MISSING'; end if;
        insert into public.program_document_requirements(program_id,membership_offering_id,document_type_id,required,allow_verified_reuse,sort_order,enabled,scope_type,scope_key,effect)
        select 'company:'||v_company::text,null,v_types[n],true,true,n,true,'COMPANY',v_company::text,'INCLUDE' from generate_series(1,3) n;
        insert into public.program_document_requirements(program_id,membership_offering_id,document_type_id,required,allow_verified_reuse,sort_order,enabled,scope_type,scope_key,effect)
        values
          ('product:'||v_product::text,null,v_types[4],true,true,4,true,'PRODUCT',v_product::text,'INCLUDE'),
          ('product:'||v_product::text,null,v_types[3],false,true,3,true,'PRODUCT',v_product::text,'EXCLUDE');

        perform set_config('request.jwt.claims',jsonb_build_object('sub',v_actor::text,'role','authenticated')::text,true);
        set local role authenticated;
        select count(*) into v_resolved from public.resolve_effective_document_requirements('PROGRAM','prestamo');
        if v_resolved<>8 then raise exception 'LOAN_RESOLVER_MISMATCH'; end if;
        select count(*),count(*) filter(where inherited) into v_resolved,v_inherited
        from public.resolve_effective_document_requirements('PRODUCT',v_product::text);
        if v_resolved<>3 or v_inherited<>2 then raise exception 'PRODUCT_INHERITANCE_OR_EXCLUSION_MISMATCH'; end if;

        v_request:=public.create_program_request_with_documents(v_item,null,1,'QA rollback snapshot','QA_ROLLBACK_SIGNATURE',true,extensions.gen_random_uuid(),array[v_document]);
        if jsonb_array_length(v_request.document_requirements_snapshot)<>1 then raise exception 'SNAPSHOT_NOT_CAPTURED'; end if;
        select count(*) into v_linked from public.request_documents where request_id=v_request.id and affiliate_document_id=v_document;
        if v_linked<>1 then raise exception 'REQUEST_DOCUMENT_NOT_LINKED'; end if;
        v_before:=v_request.document_requirements_snapshot;
        reset role;

        delete from public.program_document_requirements where scope_type='PRODUCT' and scope_key=v_product::text and document_type_id=v_types[3] and effect='EXCLUDE';
        set local role authenticated;
        select count(*),count(*) filter(where inherited) into v_resolved,v_inherited
        from public.resolve_effective_document_requirements('PRODUCT',v_product::text);
        if v_resolved<>4 or v_inherited<>3 then raise exception 'PRODUCT_RESTORE_MISMATCH'; end if;
        reset role;

        insert into public.program_document_requirements(program_id,membership_offering_id,document_type_id,required,allow_verified_reuse,sort_order,enabled,scope_type,scope_key,effect)
        values('program:'||v_item::text,null,v_second_type,true,true,2,true,'PROGRAM',v_item::text,'INCLUDE');
        select document_requirements_snapshot into v_after from public.program_requests where id=v_request.id;
        if v_after is distinct from v_before then raise exception 'SNAPSHOT_MUTATED_AFTER_CONFIG_CHANGE'; end if;
      end $$;
      rollback; select true as rollback_snapshot_link_inheritance_test;""")
    print(json.dumps({'status':'PASS','summary':summary,'membershipCatalog':{
      'status':membership_status,'enabled':len(membership_rows),
      'resolvedRequirements':len(resolver_rows)},'legacyUploadBypassDenied':True,
      'rollback':rollback,'secretLogged':False}, indent=2))


if __name__ == '__main__':
    main()
