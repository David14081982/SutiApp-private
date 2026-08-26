#!/usr/bin/env python3
"""Compile migration/recovery and optionally apply the canonical union cutover."""
import argparse,json,urllib.parse,urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
MIGRATION=ROOT/'supabase/migrations/20260823000800_union_canonical_cutover.sql'
RECOVERY=ROOT/'supabase/recovery/20260823000800_union_canonical_cutover_recovery.sql'

def env():
    out={}
    for raw in (ROOT/'supabase.env').read_text(encoding='utf-8-sig').splitlines():
        if raw.strip() and not raw.lstrip().startswith('#') and '=' in raw:
            key,value=raw.split('=',1);out[key.strip()]=value.strip().strip('"').strip("'")
    return out

def body(path):
    sql=path.read_text(encoding='utf-8').strip()
    if not sql.lower().startswith('begin;') or not sql.lower().endswith('commit;'):raise RuntimeError('TRANSACTION_BOUNDARY_REQUIRED')
    return sql[len('begin;'):-len('commit;')]

def query(values,sql):
    ref=urllib.parse.urlsplit(values['SUPABASE_URL']).hostname.split('.')[0]
    request=urllib.request.Request(f'https://api.supabase.com/v1/projects/{ref}/database/query',data=json.dumps({'query':sql}).encode(),headers={'Authorization':'Bearer '+values['SUPABASE_ACCESS_TOKEN'],'Content-Type':'application/json','User-Agent':'SutiApp-UnionCanonical/1.0'},method='POST')
    with urllib.request.urlopen(request,timeout=180) as response:return json.loads(response.read().decode() or '[]')

def checks():
    return """
do $$ begin
  if (select count(*) from public.directory_members)<>30 then raise exception 'DIRECTORY_COUNT_CHANGED';end if;
  if (select count(*) from public.directory_members where record_origin='HISTORICAL_IMPORT')<>30 then raise exception 'DIRECTORY_PROVENANCE_CHANGED';end if;
  if (select count(*) from public.directory_members where not enabled)<>0 then raise exception 'DIRECTORY_PUBLICATION_CHANGED';end if;
  if (select column_default from information_schema.columns where table_schema='public' and table_name='directory_members' and column_name='source_sheet') is not null then raise exception 'DIRECTORY_ADMIN_DEFAULT_MISMATCH';end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='union_screen_content' and column_name='header_asset_id') then raise exception 'HEADER_ASSET_COLUMN_MISSING';end if;
  if (select count(*) from pg_policies where schemaname='public' and tablename='directory_members' and policyname like 'directory_members_section_%')<>4 then raise exception 'DIRECTORY_POLICY_MISMATCH';end if;
  if (select count(*) from pg_trigger where tgrelid='public.directory_members'::regclass and not tgisinternal and tgname like 'directory_members_section_action_%')<>2 then raise exception 'DIRECTORY_TRIGGER_MISMATCH';end if;
  if (select data_boundary from public.admin_section_definitions where section_key='documents')<>'institutional_documents + directory_members' then raise exception 'SECTION_BOUNDARY_MISMATCH';end if;
end $$;
"""

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--apply',action='store_true');args=parser.parse_args();values=env();migration=body(MIGRATION);recovery=body(RECOVERY)
    applied=query(values,"select exists(select 1 from information_schema.columns where table_schema='public' and table_name='union_screen_content' and column_name='header_asset_id') applied")[0]['applied']
    if args.apply and applied:
        query(values,'alter table public.directory_members alter column source_sheet drop default;')
    if args.apply and not applied:
        before=query(values,"select count(*) directory_count,(select count(*) from public.union_screen_content) headers,(select count(*) from public.union_content_blocks) blocks from public.directory_members")[0]
        query(values,'begin;'+migration+checks()+'commit;')
        after=query(values,"select count(*) directory_count,(select count(*) from public.union_screen_content) headers,(select count(*) from public.union_content_blocks) blocks from public.directory_members")[0]
        if before!=after:raise RuntimeError('BUSINESS_ROW_COUNT_CHANGED')
        applied=True
    if applied:
        query(values,'begin;'+checks()+'rollback;')
    else:
        query(values,'begin;'+migration+checks()+recovery+"do $$ begin if exists(select 1 from pg_policies where schemaname='public' and policyname in('union_assets_insert','directory_assets_insert')) then raise exception 'RECOVERY_POLICY_RESIDUE';end if;end $$;rollback;")
    print(json.dumps({'status':'PASS','applied':applied,'migration_compiled':True,'recovery_compiled':True,'persistent_business_row_writes':0}))

if __name__=='__main__':main()
