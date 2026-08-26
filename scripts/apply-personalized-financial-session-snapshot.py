#!/usr/bin/env python3
"""Apply the owner-authorized personalized loan session snapshot migration once."""
import json, sys, urllib.parse, urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
MIGRATION=ROOT/'supabase/migrations/20260825000400_personalized_financial_session_snapshots.sql'
RECOVERY=ROOT/'supabase/recovery/20260825000400_personalized_financial_session_snapshots_recovery.sql'

def env():
    values={}
    for raw in (ROOT/'supabase.env').read_text(encoding='utf-8-sig').splitlines():
        if raw.strip() and not raw.lstrip().startswith('#') and '=' in raw:
            key,value=raw.split('=',1);values[key.strip()]=value.strip().strip('"').strip("'")
    return values

def query(values,sql):
    ref=urllib.parse.urlsplit(values['SUPABASE_URL']).hostname.split('.')[0]
    request=urllib.request.Request(
        f'https://api.supabase.com/v1/projects/{ref}/database/query',
        data=json.dumps({'query':sql}).encode(),
        headers={'Authorization':'Bearer '+values['SUPABASE_ACCESS_TOKEN'],'Content-Type':'application/json',
                 'Accept':'application/json','User-Agent':'SutiApp-Personalized-Loan-Session/1.0'},method='POST')
    with urllib.request.urlopen(request,timeout=120) as response:return json.loads(response.read())

def one(values,sql):
    rows=query(values,sql)
    if len(rows)!=1:raise RuntimeError('UNEXPECTED_QUERY_RESULT')
    return rows[0]

def main():
    values=env()
    if '--dry-run' in sys.argv:
        sql=MIGRATION.read_text(encoding='utf-8').strip()
        if not sql.lower().startswith('begin;') or not sql.lower().endswith('commit;'):
            raise RuntimeError('MIGRATION_TRANSACTION_BOUNDARY_MISSING')
        body=sql[len('begin;'):len(sql)-len('commit;')]
        rows=query(values,'begin;'+body+'rollback; select true as dry_run;')
        if len(rows)!=1 or rows[0].get('dry_run') is not True:raise RuntimeError('DRY_RUN_FAILED')
        print(json.dumps({'status':'PASS','dry_run':True,'persistent_changes':0},sort_keys=True));return
    if '--recovery-dry-run' in sys.argv:
        sql=RECOVERY.read_text(encoding='utf-8').strip()
        if not sql.lower().startswith('begin;') or not sql.lower().endswith('commit;'):
            raise RuntimeError('RECOVERY_TRANSACTION_BOUNDARY_MISSING')
        body=sql[len('begin;'):len(sql)-len('commit;')]
        rows=query(values,'begin;'+body+'rollback; select true as recovery_dry_run;')
        if len(rows)!=1 or rows[0].get('recovery_dry_run') is not True:raise RuntimeError('RECOVERY_DRY_RUN_FAILED')
        print(json.dumps({'status':'PASS','recovery_dry_run':True,'persistent_changes':0},sort_keys=True));return
    if '--readiness' in sys.argv:
        ids=[values['H005_TEST2_AFFILIATE_ID'],values['H005_TEST3_AFFILIATE_ID']]
        rows=query(values,f"""select a.id,
          count(distinct case when ad.status in ('PENDING_REVIEW','UNDER_REVIEW','VERIFIED') then r.document_type_id end)::integer ready,
          count(distinct r.document_type_id)::integer required
          from public.affiliates a cross join public.program_document_requirements r
          left join public.affiliate_documents ad on ad.affiliate_id=a.id and ad.document_type_id=r.document_type_id
          where a.id in ('{ids[0]}'::uuid,'{ids[1]}'::uuid) and r.program_id='prestamo' and r.enabled and r.required group by a.id""")
        metadata=one(values,"""select
          (select count(*) from public.program_terms_versions where program_id='prestamo' and membership_offering_id is null and published)::integer published_terms,
          (select count(*) from public.program_catalog_items where program_key='prestamo' and enabled and request_mode='supabase' and legacy_boundary)::integer request_targets""")
        print(json.dumps({'status':'PASS','controlled_affiliates':[{'ready':int(row['ready']),'required':int(row['required'])} for row in rows],**metadata,'pii_reported':False},sort_keys=True));return
    if '--status' in sys.argv:
        row=one(values,"""select
          (select relrowsecurity and relforcerowsecurity from pg_class where oid='public.financial_session_snapshots'::regclass) as forced_rls,
          (select count(*)=0 from pg_policies where schemaname='public' and tablename='financial_session_snapshots') as browser_policies_zero,
          not has_table_privilege('authenticated','public.financial_session_snapshots','select,insert,update,delete') as browser_crud_denied,
          has_table_privilege('service_role','public.financial_session_snapshots','select,insert,update,delete') as service_crud,
          (select count(*) from public.financial_session_snapshots)::integer as snapshot_rows,
          (select count(*) from public.financial_session_snapshots where expires_at>now() and invalidated_at is null)::integer as valid_rows,
          (select count(*) from public.financial_session_snapshots where expires_at<=now() or invalidated_at is not null)::integer as unusable_rows,
          (select count(*) from public.financial_session_snapshots where affiliate_id is null)::integer as global_snapshot_rows,
          (select max(extract(epoch from (expires_at-created_at))/60)<=15 from public.financial_session_snapshots) as runtime_ttl_within_limit,
          not has_function_privilege('authenticated','public.create_validated_financial_program_request(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,text,integer,jsonb)','execute') as browser_atomic_rpc_denied""")
        ttl_ok=row['runtime_ttl_within_limit'] is not False
        required=['forced_rls','browser_policies_zero','browser_crud_denied','service_crud','browser_atomic_rpc_denied']
        if not all(row[key] for key in required) or not ttl_ok or int(row['global_snapshot_rows'])!=0:
            raise RuntimeError('SNAPSHOT_RUNTIME_STATUS_FAILED:'+json.dumps(row,sort_keys=True))
        print(json.dumps({'status':'PASS','ttl_minutes':15,**row,'runtime_ttl_within_limit':ttl_ok},sort_keys=True));return
    if '--atomic-dry-run' in sys.argv:
        rows=query(values,"""begin;
          set local request.jwt.claim.role='service_role';
          do $$ declare
            v_affiliate public.affiliates%rowtype; v_item public.program_catalog_items%rowtype;
            v_terms uuid:=extensions.gen_random_uuid(); v_idem uuid:=extensions.gen_random_uuid();
            v_docs uuid[]; v_first public.program_requests%rowtype; v_second public.program_requests%rowtype;
            v_before integer; v_required integer; v_attached integer; v_snapshot jsonb;
          begin
            select a.* into v_affiliate from public.affiliates a where a.auth_user_id is not null and
              (select count(distinct r.document_type_id) from public.program_document_requirements r where r.program_id='prestamo' and r.enabled and r.required)=
              (select count(distinct r.document_type_id) from public.program_document_requirements r join public.affiliate_documents d on d.affiliate_id=a.id and d.document_type_id=r.document_type_id and d.status in('PENDING_REVIEW','UNDER_REVIEW','VERIFIED') where r.program_id='prestamo' and r.enabled and r.required)
              limit 1;
            if v_affiliate.id is null then raise exception 'CONTROLLED_READY_AFFILIATE_MISSING'; end if;
            select * into v_item from public.program_catalog_items where program_key='prestamo' and enabled and request_mode='supabase' and legacy_boundary limit 1;
            if v_item.id is null then raise exception 'LOAN_REQUEST_TARGET_MISSING'; end if;
            select array_agg(id),count(*) into v_docs,v_required from (
              select distinct on(r.document_type_id) d.id from public.program_document_requirements r
              join public.affiliate_documents d on d.affiliate_id=v_affiliate.id and d.document_type_id=r.document_type_id and d.status in('PENDING_REVIEW','UNDER_REVIEW','VERIFIED')
              where r.program_id='prestamo' and r.enabled and r.required order by r.document_type_id,d.updated_at desc
            ) ready;
            insert into public.program_terms_versions(id,program_id,version,title,body,published,published_at,created_by_auth_user_id)
            values(v_terms,'prestamo',(select coalesce(max(version),0)+1 from public.program_terms_versions where program_id='prestamo' and membership_offering_id is null),
              'QA transaccional','Se revierte íntegramente.',true,now(),v_affiliate.auth_user_id);
            v_snapshot=jsonb_build_object('affiliate_id',v_affiliate.id,'actor_real_auth_user_id',v_affiliate.auth_user_id,
              'impersonation_session_id',null,'profile_version',v_affiliate.financial_profile_version,
              'profile_fingerprint',repeat('A',64),'criteria_source_fingerprint',repeat('B',64),
              'term_policy_fingerprint',repeat('C',64),'calculation_contract_version','SUTI_LOAN_QUOTE_V1',
              'criterion_identity','QA_TRANSACTIONAL','confirmed_at',now(),
              'financialResult',jsonb_build_object('fund','QA','amount',5000,'paymentCount',6,'rate',2,'interest',600,
                'administrativeFeeTotal',90,'total',5690,'paymentPerPeriod',948.33,'paymentPeriod','quincenal'));
            select count(*) into v_before from public.program_requests;
            v_first=public.create_validated_financial_program_request(v_affiliate.auth_user_id,v_affiliate.id,null,v_item.id,
              'QA atómica','QA_SIGNATURE',v_terms,v_docs,v_idem,5000,6,'quincenal',v_affiliate.financial_profile_version,v_snapshot);
            v_second=public.create_validated_financial_program_request(v_affiliate.auth_user_id,v_affiliate.id,null,v_item.id,
              'QA atómica','QA_SIGNATURE',v_terms,v_docs,v_idem,5000,6,'quincenal',v_affiliate.financial_profile_version,v_snapshot);
            select count(*) into v_attached from public.request_documents where request_id=v_first.id;
            if v_first.id is null or v_second.id<>v_first.id or (select count(*) from public.program_requests)<>v_before+1 or v_attached<>v_required then
              raise exception 'ATOMIC_REQUEST_CONTRACT_FAILED';
            end if;
          end $$;
          rollback;
          select true as atomic_success,true as duplicate_requests_zero,true as persistent_changes_zero;""")
        if len(rows)!=1 or not all(rows[0].values()):raise RuntimeError('ATOMIC_DRY_RUN_FAILED')
        print(json.dumps({'status':'PASS','atomic_request_creation':True,'idempotent_retry':True,'duplicate_requests':0,'persistent_changes':0,'fixture_scope':'TRANSACTION_ROLLBACK'},sort_keys=True));return
    before=one(values,"""select
      to_regclass('public.financial_session_snapshots') is not null as applied,
      (select count(*) from public.program_requests) as requests,
      (select count(*) from public.program_requests where financial_processing_status is not null) as financial_requests,
      (select count(*) from public.affiliates) as affiliates,
      (select count(*) from public.request_documents) as request_documents""")
    if not before['applied']:query(values,MIGRATION.read_text(encoding='utf-8'))
    after=one(values,"""select
      to_regclass('public.financial_session_snapshots') is not null as snapshot_table,
      (select relrowsecurity and relforcerowsecurity from pg_class where oid='public.financial_session_snapshots'::regclass) as forced_rls,
      (select count(*)=0 from pg_policies where schemaname='public' and tablename='financial_session_snapshots') as browser_policies_zero,
      not has_table_privilege('authenticated','public.financial_session_snapshots','select') as browser_select_denied,
      not has_table_privilege('authenticated','public.financial_session_snapshots','insert') as browser_insert_denied,
      not has_table_privilege('authenticated','public.financial_session_snapshots','update') as browser_update_denied,
      not has_table_privilege('authenticated','public.financial_session_snapshots','delete') as browser_delete_denied,
      has_table_privilege('service_role','public.financial_session_snapshots','select,insert,update,delete') as service_crud,
      to_regprocedure('public.create_validated_financial_program_request(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,text,integer,jsonb)') is not null as atomic_rpc,
      has_function_privilege('service_role','public.create_validated_financial_program_request(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,text,integer,jsonb)','execute') as service_execute,
      not has_function_privilege('authenticated','public.create_validated_financial_program_request(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,text,integer,jsonb)','execute') as browser_execute_denied,
      not has_function_privilege('authenticated','public.set_financial_program_request_terms(uuid,numeric,numeric,text)','execute') as old_financial_writer_denied,
      exists(select 1 from pg_attribute where attrelid='public.program_requests'::regclass and attname='financial_submission_snapshot' and not attisdropped) as submission_snapshot,
      exists(select 1 from pg_trigger where tgrelid='public.program_requests'::regclass and tgname='program_requests_02_personalized_financial_submission' and not tgisinternal) as immutable_trigger,
      (select count(*) from public.financial_session_snapshots) as snapshot_rows,
      (select count(*) from public.program_requests) as requests,
      (select count(*) from public.program_requests where financial_processing_status is not null) as financial_requests,
      (select count(*) from public.affiliates) as affiliates,
      (select count(*) from public.request_documents) as request_documents""")
    required=['snapshot_table','forced_rls','browser_policies_zero','browser_select_denied','browser_insert_denied',
      'browser_update_denied','browser_delete_denied','service_crud','atomic_rpc','service_execute',
      'browser_execute_denied','old_financial_writer_denied','submission_snapshot','immutable_trigger']
    if not all(after[key] for key in required):raise RuntimeError('SNAPSHOT_SCHEMA_SECURITY_FAILED:'+json.dumps(after,sort_keys=True))
    for key in ['requests','financial_requests','affiliates','request_documents']:
        if int(after[key])!=int(before[key]):raise RuntimeError('PROTECTED_DATA_CHANGED:'+key)
    if int(after['snapshot_rows'])!=0:raise RuntimeError('SNAPSHOT_NOT_EMPTY_AFTER_MIGRATION')
    print(json.dumps({'status':'PASS','applied':not before['applied'],'ttl_minutes':15,'forced_rls':True,
      'browser_direct_writes':0,'browser_read':0,'service_only_writer':True,'snapshot_rows':0,
      'requests_preserved':int(after['requests']),'financial_requests_preserved':int(after['financial_requests']),
      'affiliates_preserved':int(after['affiliates']),'request_documents_preserved':int(after['request_documents'])},sort_keys=True))

if __name__=='__main__':main()
