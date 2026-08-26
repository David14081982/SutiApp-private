#!/usr/bin/env python3
"""Reversible multi-user proof for the Noticias ownership pilot."""
import base64,hashlib,json,urllib.error,urllib.parse,urllib.request,uuid
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
PNG=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=')

def env():
    out={}
    for raw in (ROOT/'supabase.env').read_text(encoding='utf-8-sig').splitlines():
        if raw.strip() and not raw.lstrip().startswith('#') and '=' in raw:
            k,v=raw.split('=',1);out[k.strip()]=v.strip().strip('"').strip("'")
    return out

def call(url,key,method='GET',body=None,token=None,prefer=None,content_type='application/json'):
    headers={'apikey':key,'Accept':'application/json','User-Agent':'SutiApp-NewsOwnershipLive/1.0'}
    if token:headers['Authorization']='Bearer '+token
    data=None
    if body is not None:
        data=json.dumps(body,separators=(',',':')).encode() if content_type=='application/json' else body
        headers['Content-Type']=content_type
    if prefer:headers['Prefer']=prefer
    try:
        with urllib.request.urlopen(urllib.request.Request(url,data=data,headers=headers,method=method),timeout=60) as response:
            raw=response.read();
            try:parsed=json.loads(raw) if raw else []
            except json.JSONDecodeError:parsed=raw.decode('utf-8','replace')
            return response.status,parsed
    except urllib.error.HTTPError as error:
        raw=error.read()
        try:parsed=json.loads(raw) if raw else []
        except json.JSONDecodeError:parsed=[]
        return error.code,parsed

def login(base,key,email,password):
    status,data=call(base+'/auth/v1/token?grant_type=password',key,'POST',{'email':email,'password':password})
    if status!=200:raise RuntimeError('LOGIN_FAILED')
    return data['access_token'],data['user']['id']

def rpc(base,key,name,payload,token):return call(base+'/rest/v1/rpc/'+name,key,'POST',payload,token)
def denied(status,data):return status in(401,403) or (status in(200,204) and data==[])
def management_query(values,sql):
    ref=urllib.parse.urlsplit(values['SUPABASE_URL']).hostname.split('.')[0]
    request=urllib.request.Request(f'https://api.supabase.com/v1/projects/{ref}/database/query',
      data=json.dumps({'query':sql}).encode(),headers={'Authorization':'Bearer '+values['SUPABASE_ACCESS_TOKEN'],'Content-Type':'application/json','Accept':'application/json','User-Agent':'SutiApp-NewsOwnershipAudit/1.0'},method='POST')
    with urllib.request.urlopen(request,timeout=60) as response:return json.loads(response.read())

def main():
    v=env();base=v['SUPABASE_URL'].rstrip('/');key=v['SUPABASE_PUBLISHABLE_KEY'];secret=v['SUPABASE_SECRET_KEY'];rest=base+'/rest/v1'
    admin,admin_id=login(base,key,v['H005_TEST_EMAIL'],v['H005_TEST_PASSWORD'])
    owner,owner_id=login(base,key,v['H005_TEST2_EMAIL'],v['H005_TEST2_PASSWORD'])
    normal,_=login(base,key,v['H005_TEST3_EMAIL'],v['H005_TEST3_PASSWORD'])
    marker='NEWS_OWNER_'+uuid.uuid4().hex[:12];created=[];asset_id=None;storage_path=None;results={}
    baseline_status,baseline=call(rest+'/news_articles?select=id',secret,token=secret)
    if baseline_status!=200:raise RuntimeError('BASELINE_FAILED')
    try:
        # Resolve exact confirmed user, ensure a clean assignment, then assign restricted actions.
        status,resolved=rpc(base,key,'resolve_section_responsibility_user',{'p_email':v['H005_TEST2_EMAIL']},admin)
        results['email_resolution']=status==200 and len(resolved)==1 and resolved[0]['auth_user_id']==owner_id
        rpc(base,key,'revoke_section_responsibilities',{'p_auth_user_id':owner_id,'p_section_key':'news'},admin)
        restricted=['read','create','update','publish','order']
        status,_=rpc(base,key,'set_section_responsibilities',{'p_email':v['H005_TEST2_EMAIL'],'p_section_key':'news','p_actions':restricted},admin)
        results['admin_assignment']=status==200
        status,listed=rpc(base,key,'list_section_responsibilities',{'p_section_key':'news'},admin)
        if status!=200 or not isinstance(listed,list):
            detail=listed.get('code','UNKNOWN') if isinstance(listed,dict) else type(listed).__name__
            raise RuntimeError(f'LIST_RESPONSIBILITIES_FAILED:{status}:{detail}')
        active=[x for x in listed if x['enabled'] and x['auth_user_id']==owner_id]
        results['uuid_persistence']=status==200 and {x['action'] for x in active}==set(restricted) and all(x['assignment_id'] for x in active)

        # Self/direct escalation paths are backend-denied.
        status,data=rpc(base,key,'set_section_responsibilities',{'p_email':v['H005_TEST2_EMAIL'],'p_section_key':'news','p_actions':['delete']},owner)
        direct_status,direct=call(rest+f'/admin_section_responsibilities?auth_user_id=eq.{owner_id}',key,'PATCH',{'enabled':True},owner,'return=representation')
        self_status,_=rpc(base,key,'set_section_responsibilities',{'p_email':v['H005_TEST_EMAIL'],'p_section_key':'news','p_actions':['read']},admin)
        results['self_escalation_denied']=denied(status,data) and denied(direct_status,direct) and self_status in(401,403)

        # Full unpublished read and create/update/publish/order.
        status,context=rpc(base,key,'get_admin_access_context',{},owner)
        results['owner_read']=status==200 and len(context.get('section_actions',[]))==len(restricted)
        status,rows=call(rest+'/news_articles',key,'POST',{'title':marker,'body':'pilot create','published':False,'sort_order':900001,'record_origin':'ADMIN_PHASE2'},owner,'return=representation')
        if status!=201:raise RuntimeError('OWNER_CREATE_FAILED:'+str(status))
        news_id=rows[0]['id'];created.append(news_id);results['create']=True
        status,rows=call(rest+f'/news_articles?id=eq.{news_id}',key,'PATCH',{'title':marker+'_EDIT','body':'pilot update'},owner,'return=representation')
        results['update']=status==200 and rows and rows[0]['title'].endswith('_EDIT')
        status,rows=call(rest+f'/news_articles?id=eq.{news_id}',key,'PATCH',{'sort_order':900002},owner,'return=representation')
        results['order']=status==200 and rows and rows[0]['sort_order']==900002
        status,rows=call(rest+f'/news_articles?id=eq.{news_id}',key,'PATCH',{'published':True},owner,'return=representation')
        results['publish']=status==200 and rows and rows[0]['published'] is True
        status,visible=call(rest+f'/news_articles?select=id,title,published&id=eq.{news_id}',key,token=normal)
        results['frontend_authority_reflection']=status==200 and len(visible)==1 and visible[0]['title'].endswith('_EDIT') and visible[0]['published']

        # Delete and assets are denied before being granted.
        status,data=call(rest+f'/news_articles?id=eq.{news_id}',key,'DELETE',{},owner,'return=representation')
        denied_asset_status,denied_asset=call(rest+'/app_assets',key,'POST',{'asset_key':'admin.news.denied.'+marker,'asset_type':'NEWS_IMAGE','storage_bucket':'app-assets','storage_path':f'news/{owner_id}/denied.png','mime_type':'image/png','file_size':len(PNG),'content_sha256':hashlib.sha256(PNG).hexdigest().upper(),'status':'READY'},owner,'return=representation')
        results['delete_denied_without_capability']=denied(status,data)
        results['assets_denied_without_capability']=denied(denied_asset_status,denied_asset)

        # Add delete/assets explicitly, then prove each boundary.
        full=restricted+['delete','assets']
        status,_=rpc(base,key,'set_section_responsibilities',{'p_email':v['H005_TEST2_EMAIL'],'p_section_key':'news','p_actions':full},admin)
        if status!=200:raise RuntimeError('FULL_ASSIGNMENT_FAILED')
        storage_path=f'news/{owner_id}/{marker.lower()}.png';digest=hashlib.sha256(PNG).hexdigest().upper()
        status,_=call(base+'/storage/v1/object/app-assets/'+storage_path,key,'POST',PNG,owner,content_type='image/png')
        if status not in(200,201):raise RuntimeError('NEWS_STORAGE_UPLOAD_FAILED:'+str(status))
        status,rows=call(rest+'/app_assets',key,'POST',{'asset_key':'admin.news.pilot.'+uuid.uuid4().hex,'asset_type':'NEWS_IMAGE','title':'news.image','alt_text':'pilot','storage_bucket':'app-assets','storage_path':storage_path,'mime_type':'image/png','file_size':len(PNG),'content_sha256':digest,'status':'READY'},owner,'return=representation')
        if status!=201:raise RuntimeError('NEWS_ASSET_ROW_FAILED:'+str(status))
        asset_id=rows[0]['id']
        status,_=call(rest+'/asset_sources',key,'POST',{'asset_id':asset_id,'source_sheet':'ADMIN_NEWS_OWNER','source_column':'news.image','source_snapshot_hash':digest},owner,'return=minimal')
        if status!=201:raise RuntimeError('NEWS_ASSET_SOURCE_FAILED:'+str(status))
        status,rows=call(rest+f'/news_articles?id=eq.{news_id}',key,'PATCH',{'image_asset_id':asset_id},owner,'return=representation')
        results['assets']=status==200 and rows and rows[0]['image_asset_id']==asset_id

        # Cross-domain, normal and anonymous writers remain denied.
        cross=[]
        for table,payload in [
          ('educational_resources',{'resource_kind':'education','title':marker,'published':False,'sort_order':900001}),
          ('companies',{'display_name':marker,'enabled':False,'sort_order':900001,'record_origin':'ADMIN_H009'})]:
            status,data=call(rest+'/'+table,key,'POST',payload,owner,'return=representation');cross.append(denied(status,data))
        normal_status,normal_data=call(rest+'/news_articles',key,'POST',{'title':marker+'_NORMAL','body':'denied','published':False,'sort_order':900003},normal,'return=representation')
        anon_status,anon_data=call(rest+'/news_articles',key,'POST',{'title':marker+'_ANON','body':'denied','published':False,'sort_order':900004},prefer='return=representation')
        results['cross_domain_isolation']=all(cross)
        results['normal_denied']=denied(normal_status,normal_data)
        results['anonymous_denied']=denied(anon_status,anon_data)

        # No historical fixture is created. Inspect the live enforcement read-only.
        protection=management_query(v,"""
          select
            exists(select 1 from pg_policies where schemaname='public' and tablename='news_articles'
              and policyname='news_admin_delete' and qual like '%record_origin%ADMIN_PHASE2%') as policy_guard,
            pg_get_functiondef('public.enforce_news_section_action()'::regprocedure) like '%NEWS_HISTORICAL_DELETE_DENIED%' as trigger_guard,
            (select count(*) from public.news_articles where record_origin='HISTORICAL_IMPORT') as historical_rows
        """)[0]
        results['historical_protection']=bool(protection['policy_guard'] and protection['trigger_guard'])

        # Delete an owner-created second fixture with explicit capability.
        status,rows=call(rest+'/news_articles',key,'POST',{'title':marker+'_DELETE','body':'delete fixture','published':False,'sort_order':900006,'record_origin':'ADMIN_PHASE2'},owner,'return=representation')
        delete_id=rows[0]['id'];created.append(delete_id)
        status,rows=call(rest+f'/news_articles?id=eq.{delete_id}',key,'DELETE',{},owner,'return=representation')
        results['delete_with_capability']=status==200 and len(rows)==1
        if results['delete_with_capability']:created.remove(delete_id)

        # Clean asset while capability is active.
        call(rest+f'/news_articles?id=eq.{news_id}',key,'PATCH',{'image_asset_id':None},owner,'return=representation')
        status,_=call(rest+f'/app_assets?id=eq.{asset_id}',key,'DELETE',{},owner,'return=representation')
        results['asset_cleanup']=status==200
        asset_id=None
        status,_=call(base+'/storage/v1/object/app-assets/'+storage_path,key,'DELETE',token=owner)
        results['storage_cleanup']=status in(200,204)
        storage_path=None

        # Revoke, verify immediate and fresh-session loss, then audit coverage.
        status,_=rpc(base,key,'revoke_section_responsibilities',{'p_auth_user_id':owner_id,'p_section_key':'news'},admin)
        results['revocation']=status==204 or status==200
        status,context=rpc(base,key,'get_admin_access_context',{},owner)
        after_status,after_data=call(rest+f'/news_articles?id=eq.{news_id}',key,'PATCH',{'title':marker+'_AFTER'},owner,'return=representation')
        fresh,_=login(base,key,v['H005_TEST2_EMAIL'],v['H005_TEST2_PASSWORD'])
        fresh_status,fresh_context=rpc(base,key,'get_admin_access_context',{},fresh)
        fresh_write_status,fresh_write=call(rest+f'/news_articles?id=eq.{news_id}',key,'PATCH',{'title':marker+'_FRESH'},fresh,'return=representation')
        results['revocation_immediate']=status==200 and context.get('section_actions',[])==[] and denied(after_status,after_data)
        results['refresh_after_revocation']=fresh_status==200 and fresh_context.get('section_actions',[])==[] and denied(fresh_write_status,fresh_write)
        status,audit=call(rest+'/admin_audit_log?select=action,details&resource=eq.news_articles&order=created_at.desc&limit=100',key,token=admin)
        seen={row['details'].get('section_action') for row in audit if isinstance(row.get('details'),dict)}
        status2,assignment_audit=rpc(base,key,'list_section_responsibility_audit',{'p_section_key':'news'},admin)
        results['audit_log']=status==200 and {'create','update','publish','order','delete','assets'}<=seen and status2==200 and any(x['action']=='SET' for x in assignment_audit) and any(x['action']=='REVOKE' for x in assignment_audit)
    finally:
        rpc(base,key,'revoke_section_responsibilities',{'p_auth_user_id':owner_id,'p_section_key':'news'},admin)
        if asset_id:call(rest+f'/app_assets?id=eq.{asset_id}',secret,'DELETE',{},secret,'return=minimal')
        if storage_path:call(base+'/storage/v1/object/app-assets/'+storage_path,secret,'DELETE',token=secret)
        for row_id in created:call(rest+f'/news_articles?id=eq.{row_id}',secret,'DELETE',{},secret,'return=minimal')
    final_status,final=call(rest+'/news_articles?select=id',secret,token=secret)
    results['fixture_cleanup']=final_status==200 and len(final)==len(baseline)
    failed=[k for k,val in results.items() if not val]
    if failed:raise RuntimeError('NEWS_OWNERSHIP_ASSERT_FAILED:'+','.join(failed))
    print(json.dumps({'status':'PASS',**results,'baseline_news':len(baseline),'credentials_exposed':False},sort_keys=True))

if __name__=='__main__':main()
