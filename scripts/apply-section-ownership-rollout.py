#!/usr/bin/env python3
"""Apply or transactionally compile the mass section-ownership rollout. Secrets are never printed."""
import argparse,json,urllib.error,urllib.parse,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
MIG=ROOT/'supabase/migrations/20260823000600_enforce_remaining_section_ownership.sql'
REC=ROOT/'supabase/recovery/20260823000600_enforce_remaining_section_ownership_recovery.sql'
HARD=ROOT/'supabase/migrations/20260823000601_protect_section_relation_history.sql'
HARD_REC=ROOT/'supabase/recovery/20260823000601_protect_section_relation_history_recovery.sql'
def env():
 out={}
 for raw in (ROOT/'supabase.env').read_text(encoding='utf-8-sig').splitlines():
  if raw.strip() and not raw.lstrip().startswith('#') and '=' in raw:
   k,v=raw.split('=',1);out[k.strip()]=v.strip().strip('"').strip("'")
 return out
def body(path):
 sql=path.read_text(encoding='utf-8').strip()
 if not sql.lower().startswith('begin;') or not sql.lower().endswith('commit;'):raise RuntimeError('TRANSACTION_BOUNDARY_REQUIRED')
 return sql[6:-7]
def query(v,sql):
 ref=urllib.parse.urlsplit(v['SUPABASE_URL']).hostname.split('.')[0]
 req=urllib.request.Request(f'https://api.supabase.com/v1/projects/{ref}/database/query',data=json.dumps({'query':sql}).encode(),headers={'Authorization':'Bearer '+v['SUPABASE_ACCESS_TOKEN'],'Content-Type':'application/json','User-Agent':'SutiApp-SectionRollout/1.0'},method='POST')
 try:
  with urllib.request.urlopen(req,timeout=180) as response:return json.loads(response.read() or b'[]')
 except urllib.error.HTTPError as error:
  detail=error.read().decode(errors='replace')
  raise RuntimeError(f'MANAGEMENT_SQL_{error.code}:{detail[:1200]}') from None
def main():
 p=argparse.ArgumentParser();p.add_argument('--apply',action='store_true');p.add_argument('--recovery-dry-run',action='store_true');p.add_argument('--hardening',action='store_true');a=p.parse_args();v=env();mig,rec=(HARD,HARD_REC) if a.hardening else (MIG,REC)
 if a.apply:sql='begin;\n'+body(mig)+'\ncommit;';mode='HARDENING_APPLY' if a.hardening else 'APPLY'
 elif a.recovery_dry_run:sql='begin;\n'+body(mig)+'\n'+body(rec)+'\nrollback;';mode='HARDENING_RECOVERY_DRY_RUN' if a.hardening else 'MIGRATION_RECOVERY_DRY_RUN'
 else:sql='begin;\n'+body(mig)+'\nrollback;';mode='HARDENING_DRY_RUN' if a.hardening else 'DRY_RUN'
 query(v,sql);print(json.dumps({'status':'PASS','mode':mode,'persistent_writes':1 if a.apply else 0,'credentials_exposed':False},sort_keys=True))
if __name__=='__main__':main()
