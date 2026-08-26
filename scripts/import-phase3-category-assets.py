#!/usr/bin/env python3
"""Import the three proven Marketplace category images into Supabase Storage."""
import hashlib,json,mimetypes,urllib.error,urllib.parse,urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1];SNAP=ROOT/'data/phase3-marketplace-categories-source.json';SNAP_HASH=hashlib.sha256(SNAP.read_bytes()).hexdigest().upper()
def env():
    out={}
    for raw in (ROOT/'supabase.env').read_text(encoding='utf-8-sig').splitlines():
        if raw.strip() and not raw.lstrip().startswith('#') and '=' in raw:
            k,v=raw.split('=',1);out[k.strip()]=v.strip().strip('"').strip("'")
    return out
def call(url,key,method='GET',body=None,headers=None):
    h={'apikey':key,'Authorization':'Bearer '+key,'User-Agent':'SutiApp-Phase3-Assets/1.0','Accept':'application/json'};h.update(headers or {})
    if body is not None and not isinstance(body,bytes):body=json.dumps(body).encode();h['Content-Type']='application/json'
    req=urllib.request.Request(url,data=body,headers=h,method=method)
    try:
        with urllib.request.urlopen(req,timeout=90) as response:
            raw=response.read();return response.status,(json.loads(raw) if raw and 'json' in response.headers.get('Content-Type','') else raw)
    except urllib.error.HTTPError as error:
        if error.code==409:return error.code,None
        raise RuntimeError(f'Category asset request failed HTTP {error.code}') from None
def main():
    values=env();base=values['SUPABASE_URL'].rstrip('/');key=values['SUPABASE_SECRET_KEY'];snap=json.loads(SNAP.read_text(encoding='utf-8'))
    slugs=['electronica','moda','salud-y-belleza'];done=0
    for index,(row,slug) in enumerate(zip(snap['rows'],slugs),start=2):
        source=row[1];raw=urllib.request.urlopen(urllib.request.Request(source,headers={'User-Agent':'SutiApp-Importer/1.0'}),timeout=90).read();digest=hashlib.sha256(raw).hexdigest().upper();mime='image/jpeg' if source.lower().endswith(('.jpg','.jpeg','.jfif')) else 'image/png';ext='jpg' if mime=='image/jpeg' else 'png';path=f'marketplace/categories/{digest}.{ext}'
        call(f'{base}/storage/v1/object/app-assets/{path}',key,'POST',raw,{'Content-Type':mime,'x-upsert':'false'})
        _,found=call(f'{base}/rest/v1/app_assets?select=id&asset_key=eq.marketplace.category.{slug}',key)
        if found:asset_id=found[0]['id']
        else:
            _,saved=call(base+'/rest/v1/app_assets',key,'POST',{'asset_key':f'marketplace.category.{slug}','asset_type':'MARKETPLACE_CATEGORY','title':row[0],'alt_text':row[0],'storage_bucket':'app-assets','storage_path':path,'mime_type':mime,'file_size':len(raw),'content_sha256':digest,'status':'READY'},{'Prefer':'return=representation'});asset_id=saved[0]['id']
            call(base+'/rest/v1/asset_sources',key,'POST',{'asset_id':asset_id,'source_url':source,'source_sheet':'Categorías SutiCompras','source_row_ordinal':index,'source_column':'Imagen Categoría','source_snapshot_hash':SNAP_HASH},{'Prefer':'return=minimal'})
        call(f'{base}/rest/v1/marketplace_categories?slug=eq.{slug}',key,'PATCH',{'image_asset_id':asset_id},{'Prefer':'return=minimal'});done+=1
    print(json.dumps({'status':'PASS','category_assets':done,'snapshot_sha256':SNAP_HASH},sort_keys=True))
if __name__=='__main__':main()
