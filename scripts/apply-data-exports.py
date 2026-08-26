#!/usr/bin/env python3
"""Compile/apply the operational-export migration without printing credentials."""
import argparse,json,urllib.error,urllib.parse,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
MIG=ROOT/'supabase/migrations/20260823000700_create_operational_data_exports.sql'
REC=ROOT/'supabase/recovery/20260823000700_create_operational_data_exports_recovery.sql'
def env():
 out={}
 for raw in (ROOT/'supabase.env').read_text(encoding='utf-8-sig').splitlines():
  if raw.strip() and not raw.lstrip().startswith('#') and '=' in raw:
   key,value=raw.split('=',1);out[key.strip()]=value.strip().strip('"').strip("'")
 return out
def body(path):
 sql=path.read_text(encoding='utf-8').strip()
 if not sql.lower().startswith('begin;') or not sql.lower().endswith('commit;'):raise RuntimeError('TRANSACTION_BOUNDARY_REQUIRED')
 return sql[6:-7]
def query(values,sql):
 ref=urllib.parse.urlsplit(values['SUPABASE_URL']).hostname.split('.')[0]
 request=urllib.request.Request(f'https://api.supabase.com/v1/projects/{ref}/database/query',data=json.dumps({'query':sql}).encode(),headers={'Authorization':'Bearer '+values['SUPABASE_ACCESS_TOKEN'],'Content-Type':'application/json','User-Agent':'SutiApp-DataExports/1.0'},method='POST')
 try:
  with urllib.request.urlopen(request,timeout=180) as response:return json.loads(response.read() or b'[]')
 except urllib.error.HTTPError as error:
  detail=error.read().decode(errors='replace');raise RuntimeError(f'MANAGEMENT_SQL_{error.code}:{detail[:1200]}') from None
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--apply',action='store_true');parser.add_argument('--recovery-dry-run',action='store_true');parser.add_argument('--deployed-recovery-dry-run',action='store_true');args=parser.parse_args();values=env()
 if args.apply:sql='begin;\n'+body(MIG)+'\ncommit;';mode='APPLY'
 elif args.recovery_dry_run:sql='begin;\n'+body(MIG)+'\n'+body(REC)+'\nrollback;';mode='MIGRATION_RECOVERY_DRY_RUN'
 elif args.deployed_recovery_dry_run:sql='begin;\n'+body(REC)+'\n'+body(MIG)+'\nrollback;';mode='DEPLOYED_RECOVERY_REAPPLY_DRY_RUN'
 else:sql='begin;\n'+body(MIG)+'\nrollback;';mode='DRY_RUN'
 query(values,sql);print(json.dumps({'status':'PASS','mode':mode,'persistent_writes':1 if args.apply else 0,'credentials_exposed':False},sort_keys=True))
if __name__=='__main__':main()
