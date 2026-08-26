#!/usr/bin/env python3
"""Remove only reserved Noticias pilot fixtures after interrupted tests."""
import json,urllib.error,urllib.parse,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def env():
    out={}
    for raw in (ROOT/'supabase.env').read_text(encoding='utf-8-sig').splitlines():
        if raw.strip() and not raw.lstrip().startswith('#') and '=' in raw:
            k,v=raw.split('=',1);out[k.strip()]=v.strip().strip('"').strip("'")
    return out
def call(url,key,method='GET',token=None):
    headers={'apikey':key,'Authorization':'Bearer '+(token or key),'Accept':'application/json','Prefer':'return=representation','User-Agent':'SutiApp-NewsFixtureCleanup/1.0'}
    try:
        with urllib.request.urlopen(urllib.request.Request(url,headers=headers,method=method),timeout=60) as response:
            raw=response.read();return response.status,json.loads(raw) if raw else []
    except urllib.error.HTTPError as error:return error.code,[]
def main():
    v=env();base=v['SUPABASE_URL'].rstrip('/');key=v['SUPABASE_SECRET_KEY'];rest=base+'/rest/v1';removed_news=0;removed_assets=0;removed_objects=0
    status,news=call(rest+'/news_articles?select=id,record_origin&title=like.NEWS_OWNER_*',key)
    if status!=200 or any(x['record_origin']!='ADMIN_PHASE2' for x in news):raise RuntimeError('UNSAFE_NEWS_FIXTURE_SCOPE')
    for row in news:
        status,deleted=call(rest+f"/news_articles?id=eq.{row['id']}&record_origin=eq.ADMIN_PHASE2",key,'DELETE')
        if status==200:removed_news+=len(deleted)
    status,assets=call(rest+'/app_assets?select=id,storage_bucket,storage_path&asset_key=like.admin.news.pilot.*',key)
    if status!=200:raise RuntimeError('ASSET_FIXTURE_READ_FAILED')
    for asset in assets:
        if asset['storage_bucket']!='app-assets' or not asset['storage_path'].startswith('news/'):
            raise RuntimeError('UNSAFE_ASSET_FIXTURE_SCOPE')
        status,deleted=call(rest+f"/app_assets?id=eq.{asset['id']}&asset_key=like.admin.news.pilot.*",key,'DELETE')
        if status==200:removed_assets+=len(deleted)
        status,_=call(base+'/storage/v1/object/app-assets/'+urllib.parse.quote(asset['storage_path'],safe='/'),key,'DELETE')
        if status in(200,204):removed_objects+=1
    print(json.dumps({'status':'PASS','removed_news':removed_news,'removed_assets':removed_assets,'removed_objects':removed_objects,'historical_touched':0,'credentials_exposed':False},sort_keys=True))
if __name__=='__main__':main()
