#!/usr/bin/env python3
"""Dry-run by default; recover the exact Phase 2 historical education import with reference checks."""
import argparse, importlib.util, json, urllib.parse
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];SOURCE=ROOT/'data/phase2-education-source.json'
spec=importlib.util.spec_from_file_location('h0072_import',ROOT/'scripts/import-h0072-visual-content.py');h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--apply',action='store_true');args=parser.parse_args()
    env=h.read_env(ROOT/'supabase.env');base=env['SUPABASE_URL'].rstrip('/');key=env['SUPABASE_SECRET_KEY'];snapshot=h.file_hash(SOURCE)
    rows=h.remote_json(base,key,f'/rest/v1/educational_resources?select=id,image_asset_id&source_snapshot_hash=eq.{snapshot}&limit=100')
    source_rows=h.remote_json(base,key,f'/rest/v1/asset_sources?select=asset_id,storage_bucket:app_assets!asset_id(storage_bucket,storage_path)&source_snapshot_hash=eq.{snapshot}&limit=100')
    assets_by_id={row['asset_id']:row['storage_bucket'] for row in source_rows};asset_ids=sorted(assets_by_id);row_ids={row['id'] for row in rows}
    for asset_id in asset_ids:
        refs=h.remote_json(base,key,f'/rest/v1/educational_resources?select=id&image_asset_id=eq.{asset_id}&limit=100')
        if any(row['id'] not in row_ids for row in refs):raise RuntimeError('Recovery blocked: educational asset has an external reference')
    result={'mode':'apply' if args.apply else 'dry-run','historical_rows':len(rows),'asset_sources':len(source_rows),'assets':len(asset_ids),'snapshot_hash':snapshot,'safe':len(rows)==32}
    if not result['safe']:raise RuntimeError('Recovery blocked: historical row reconciliation mismatch')
    if args.apply:
        h.api(f'{base}/rest/v1/educational_resources?source_snapshot_hash=eq.{snapshot}',key,'DELETE',prefer='return=minimal')
        h.api(f'{base}/rest/v1/asset_sources?source_snapshot_hash=eq.{snapshot}',key,'DELETE',prefer='return=minimal')
        for asset_id,asset in assets_by_id.items():
            path=asset['storage_path'];encoded='/'.join(urllib.parse.quote(part,safe='') for part in path.split('/'))
            h.api(f'{base}/rest/v1/app_assets?id=eq.{asset_id}',key,'DELETE',prefer='return=minimal')
            h.api(f'{base}/storage/v1/object/{asset["storage_bucket"]}/{encoded}',key,'DELETE')
    print(json.dumps(result,sort_keys=True))
if __name__=='__main__':main()
