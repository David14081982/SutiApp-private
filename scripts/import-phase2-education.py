#!/usr/bin/env python3
"""Import the approved historical education/tutorial snapshot, unpublished, with Storage assets."""
import hashlib, importlib.util, json, urllib.parse, uuid
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'data/phase2-education-source.json'
MIGRATION=ROOT/'supabase/migrations/20260821000801_phase2_education_provenance.sql'
NS=uuid.UUID('603f6f12-81ea-48e8-b84c-07d194a3482d')
spec=importlib.util.spec_from_file_location('h0072_import',ROOT/'scripts/import-h0072-visual-content.py')
h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
def stable(value):return str(uuid.uuid5(NS,value))
def source_rows(block):
    headers=block['values'][0]
    for ordinal,values in enumerate(block['values'][1:],start=2):
        padded=values+[None]*(len(headers)-len(values));yield ordinal,dict(zip(headers,padded))
def apply_schema(env):
    ref=urllib.parse.urlsplit(env['SUPABASE_URL']).hostname.split('.')[0]
    endpoint=f'https://api.supabase.com/v1/projects/{ref}/database/query'
    check=json.dumps({'query':"select exists(select 1 from information_schema.columns where table_schema='public' and table_name='educational_resources' and column_name='source_payload') as applied"}).encode()
    applied=json.loads(h.api(endpoint,env['SUPABASE_ACCESS_TOKEN'],'POST',check,bearer=True))[0]['applied']
    if applied:return
    body=json.dumps({'query':MIGRATION.read_text(encoding='utf-8')},separators=(',',':')).encode()
    h.api(endpoint,env['SUPABASE_ACCESS_TOKEN'],'POST',body,bearer=True)
def main():
    env=h.read_env(ROOT/'supabase.env');base=env['SUPABASE_URL'].rstrip('/');key=env['SUPABASE_SECRET_KEY']
    snapshot=json.loads(SOURCE.read_text(encoding='utf-8'));snapshot_hash=h.file_hash(SOURCE)
    apply_schema(env);assets=[];sources=[];uploads={};rows=[];canonical={}
    for kind,block in [('education',snapshot['sheets']['education']),('tutorial',snapshot['sheets']['tutorials'])]:
        for ordinal,raw in source_rows(block):
            title=raw.get('INSTITUCIÓN ACADÉMICA') if kind=='education' else raw.get('Título')
            image_url=raw.get('Imagen');asset_id=None
            if image_url:
                data,mime,ext=h.download({'source_url':image_url});digest=hashlib.sha256(data).hexdigest().upper();pair=('app-assets',digest)
                if pair not in canonical:
                    asset_id=stable('asset:'+digest);path=f'education/{digest[:2].lower()}/{digest.lower()}.{ext}';canonical[pair]=(asset_id,path)
                    assets.append({'id':asset_id,'asset_key':f'education.{kind}.{ordinal}.image','asset_type':'EDUCATIONAL_IMAGE','title':title,'alt_text':title,'storage_bucket':'app-assets','storage_path':path,'mime_type':mime,'file_size':len(data),'content_sha256':digest,'status':'READY'});uploads[path]=data
                else:asset_id,_=canonical[pair]
                sources.append({'asset_id':asset_id,'source_sheet':block['sheet_name'],'source_row_ordinal':ordinal,'source_column':'Imagen','source_url':image_url,'source_snapshot_hash':snapshot_hash})
            description=(raw.get('Descripción') if kind=='tutorial' else raw.get('Niveles educativos')) or raw.get('TAG IMAGEN') or None
            link=(raw.get('URL') if kind=='tutorial' else raw.get('PÁGINA WEB')) or None
            if link and not str(link).startswith('https://'):link=None
            rows.append({'id':stable(f"{block['sheet_name']}:{ordinal}"),'resource_kind':kind,'title':title,'description':description,'image_asset_id':asset_id,'document_asset_id':None,'external_url':link,'published':False,'sort_order':ordinal-1,'provenance':'HISTORICAL_IMPORT','source_sheet':block['sheet_name'],'source_row_ordinal':ordinal,'source_snapshot_hash':snapshot_hash,'source_payload':raw})
    for path,data in uploads.items():
        asset=next(row for row in assets if row['storage_path']==path);encoded='/'.join(urllib.parse.quote(part,safe='') for part in path.split('/'))
        h.api(f'{base}/storage/v1/object/app-assets/{encoded}',key,'POST',data,content_type=asset['mime_type'],extra_headers={'x-upsert':'true'})
    h.upsert(base,key,'app_assets',assets)
    source_payload=json.dumps(sources,ensure_ascii=False,separators=(',',':')).encode()
    conflict='asset_id,source_sheet,source_row_ordinal,source_column,source_url,source_snapshot_hash'
    h.api(base+'/rest/v1/asset_sources?'+urllib.parse.urlencode({'on_conflict':conflict}),key,'POST',source_payload,prefer='resolution=ignore-duplicates,return=minimal')
    h.upsert(base,key,'educational_resources',rows)
    remote=h.remote_json(base,key,f'/rest/v1/educational_resources?select=id,published,image_asset_id,source_snapshot_hash&source_snapshot_hash=eq.{snapshot_hash}&limit=100')
    if len(remote)!=32 or any(row['published'] for row in remote) or sum(bool(row['image_asset_id']) for row in remote)!=len(sources):raise RuntimeError('Phase 2 education reconciliation failed')
    for asset in assets:
        encoded='/'.join(urllib.parse.quote(part,safe='') for part in asset['storage_path'].split('/'));data=h.api(f"{base}/storage/v1/object/public/app-assets/{encoded}",'','GET')
        if hashlib.sha256(data).hexdigest().upper()!=asset['content_sha256']:raise RuntimeError('Phase 2 education object hash mismatch')
    print(json.dumps({'status':'PASS','snapshot_hash':snapshot_hash,'historical_rows':len(remote),'education':28,'tutorials':4,'published':0,'asset_sources':len(sources),'objects_verified':len(assets)},sort_keys=True))
if __name__=='__main__':main()
