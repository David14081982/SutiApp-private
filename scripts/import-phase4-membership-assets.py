#!/usr/bin/env python3
"""Import six historical membership logos into Supabase Storage."""
import hashlib,json,urllib.error,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];SNAP=ROOT/'data/phase4-memberships-source.json';SNAP_HASH=hashlib.sha256(SNAP.read_bytes()).hexdigest().upper()
def env():
    out={}
    for raw in (ROOT/'supabase.env').read_text(encoding='utf-8-sig').splitlines():
        if raw.strip() and not raw.lstrip().startswith('#') and '=' in raw:
            k,v=raw.split('=',1);out[k.strip()]=v.strip().strip('"').strip("'")
    return out
def call(url,key,method='GET',body=None,headers=None):
    h={'apikey':key,'Authorization':'Bearer '+key,'Accept':'application/json','User-Agent':'SutiApp-Phase4-Assets/1.0'};h.update(headers or {})
    if body is not None and not isinstance(body,bytes):body=json.dumps(body).encode();h['Content-Type']='application/json'
    try:
        with urllib.request.urlopen(urllib.request.Request(url,data=body,headers=h,method=method),timeout=90) as r:
            raw=r.read();return r.status,(json.loads(raw) if raw and 'json' in r.headers.get('Content-Type','') else raw)
    except urllib.error.HTTPError as e:
        if e.code==409:return e.code,None
        raise RuntimeError(f'Phase 4 asset HTTP {e.code}') from None
def main():
    v=env();base=v['SUPABASE_URL'].rstrip('/');key=v['SUPABASE_SECRET_KEY'];snap=json.loads(SNAP.read_text(encoding='utf-8'));done=0
    for ordinal,row in enumerate(snap['rows'],start=2):
        source=row[2];req=urllib.request.Request(source,headers={'User-Agent':'SutiApp-Importer/1.0'});raw=urllib.request.urlopen(req,timeout=90).read();digest=hashlib.sha256(raw).hexdigest().upper();lower=source.lower();mime='image/webp' if lower.endswith('.webp') else 'image/jpeg' if lower.endswith(('.jpg','.jpeg','.jfif')) else 'image/png';ext={'image/webp':'webp','image/jpeg':'jpg','image/png':'png'}[mime];path=f'memberships/{digest}.{ext}'
        call(f'{base}/storage/v1/object/app-assets/{path}',key,'POST',raw,{'Content-Type':mime,'x-upsert':'false'})
        asset_key='membership.'+row[5].replace('.','-').lower();_,found=call(f'{base}/rest/v1/app_assets?select=id&asset_key=eq.{asset_key}',key)
        if found:asset_id=found[0]['id']
        else:
            _,saved=call(base+'/rest/v1/app_assets',key,'POST',{'asset_key':asset_key,'asset_type':'MEMBERSHIP_LOGO','title':row[0],'alt_text':row[0],'storage_bucket':'app-assets','storage_path':path,'mime_type':mime,'file_size':len(raw),'content_sha256':digest,'status':'READY'},{'Prefer':'return=representation'});asset_id=saved[0]['id']
            call(base+'/rest/v1/asset_sources',key,'POST',{'asset_id':asset_id,'source_url':source,'source_sheet':'Membresias','source_row_ordinal':ordinal,'source_column':'Logotipos','source_snapshot_hash':SNAP_HASH},{'Prefer':'return=minimal'})
        call(f'{base}/rest/v1/membership_offerings?source_row_ordinal=eq.{ordinal}',key,'PATCH',{'logo_asset_id':asset_id},{'Prefer':'return=minimal'});done+=1
    print(json.dumps({'status':'PASS','logos':done,'snapshot_sha256':SNAP_HASH},sort_keys=True))
if __name__=='__main__':main()
