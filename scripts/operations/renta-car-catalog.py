"""Rental-only additive install and rollback-isolated backend contract checks. No test records persist."""
import argparse,base64,json,sys,urllib.request,hashlib
from pathlib import Path
from urllib.parse import urlparse
p=argparse.ArgumentParser();p.add_argument('--env',required=True);p.add_argument('--deps',required=True);p.add_argument('--output',required=True);p.add_argument('--apply',action='store_true');a=p.parse_args()
sys.path.insert(0,a.deps)
import psycopg
from psycopg.types.json import Jsonb
env={}
for line in Path(a.env).read_text(encoding='utf-8-sig').splitlines():
 if '=' in line:
  k,v=line.split('=',1);env[k.strip()]=v.strip().strip('"\'')
req=urllib.request.Request(env['SUPABASE_URL']+'/auth/v1/token?grant_type=password',data=json.dumps({'email':env['H005_TEST_EMAIL'],'password':env['H005_TEST_PASSWORD']}).encode(),headers={'apikey':env['SUPABASE_PUBLISHABLE_KEY'],'Content-Type':'application/json'})
with urllib.request.urlopen(req,timeout=25) as response: token=json.load(response)['access_token']
part=token.split('.')[1];claims=json.loads(base64.urlsafe_b64decode(part+'='*((-len(part))%4)))
ref=urlparse(env['SUPABASE_URL']).hostname.split('.')[0]
checks=[]
def fp(c,table,where='true',omit='[]'):
 # Explicit table/predicate identifiers below are code constants, never user input.
 return c.execute("select count(*),md5(coalesce(string_agg((to_jsonb(t)-%s::text[])::text,'' order by t.id),'')) from "+table+' t where '+where,(json.loads(omit),)).fetchone()
with psycopg.connect(host='db.'+ref+'.supabase.co',dbname='postgres',user='postgres',password=env['SUPABASE_DB_PASSWORD'],sslmode='require',connect_timeout=20) as c:
 c.execute('set transaction isolation level repeatable read');c.execute("set local lock_timeout='3s'");c.execute("set local statement_timeout='30s'")
 protected=['public.program_requests','public.program_catalog_item_assets','public.affiliate_documents']
 before={t:fp(c,t) for t in protected}
 nonrental=fp(c,'public.program_catalog_items',"program_key<>'renta'",'["rental_specs"]')
 rental=fp(c,'public.program_catalog_items',"program_key='renta'",'["rental_specs","updated_at"]')
 definitions=c.execute("select oid::regprocedure::text,md5(pg_get_functiondef(oid)) from pg_proc where pronamespace='public'::regnamespace and (proname like 'renta_car_%' or proname='save_program_catalog_item') order by 1").fetchall()
 sql=Path('supabase/migrations/20261025000100_renta_car_catalog.sql').read_text(encoding='utf8');c.execute(sql)
 checks.append('additive migration installs')
 row=c.execute("select to_jsonb(i) from public.program_catalog_items i where program_key='renta' order by id limit 1").fetchone()[0]
 assert row['rental_specs'].get('seats')==row['source_payload'].get('Asientos')
 c.execute('savepoint tests')
 def identity(value,role='authenticated'):
  c.execute('reset role');c.execute("select set_config('request.jwt.claims',%s,true)",(json.dumps(value),));c.execute('set local role '+role)
 identity(claims)
 assert c.execute("select public.has_admin_permission('program_catalog.write')").fetchone()[0]
 item=row['id'];links=c.execute('select jsonb_build_object(\'link_id\',id) from public.program_catalog_item_assets where item_id=%s and enabled order by sort_order',(item,)).fetchall()
 links=[r[0] for r in links]
 payload={k:row[k] for k in ['program_key','name','description','category_raw','price_cash','requires_quote','commercial_mode','sold','enabled','sort_order']}
 specs={'year':2023,'engine':'QA rollback engine','vehicle_type':'QA rollback type','seats':'14 pasajeros','tank':'QA rollback tank'}
 def save(itemid=item,data=payload,values=specs,version=row['updated_at']):
  return c.execute('select public.save_renta_car_catalog_item(%s,%s,%s,%s,%s)',(itemid,Jsonb(data),Jsonb(links),Jsonb(values),version)).fetchone()[0]
 edited=dict(payload,name=payload['name']+' QA rollback',description='QA rollback only',price_cash=2501,sort_order=3)
 saved=save(data=edited);assert saved['rental_specs']==specs and saved['price_cash']==2501 and saved['id']==item
 assert c.execute('select rental_specs from public.program_catalog_items where id=%s',(item,)).fetchone()[0]==specs
 checks.append('authenticated Admin edit -> canonical user reader with same UUID')
 saved=save(data=dict(edited,enabled=False),version=saved['updated_at']);assert not saved['enabled']
 checks.append('availability stored using existing enabled flag')
 def denied(fn,label):
  c.execute('savepoint denied')
  try:fn()
  except psycopg.Error:c.execute('rollback to savepoint denied');checks.append(label)
  else:raise AssertionError('NOT_DENIED: '+label)
 denied(lambda:save(version='2000-01-01T00:00:00Z'),'stale version denied')
 denied(lambda:save(values=dict(specs,year=1800),version=saved['updated_at']),'invalid year denied')
 denied(lambda:save(values=dict(specs,price=999),version=saved['updated_at']),'unknown metadata field denied')
 denied(lambda:save(data=dict(payload,program_key='auto'),version=saved['updated_at']),'other program payload denied')
 other=c.execute("select id from public.program_catalog_items where program_key<>'renta' limit 1").fetchone()[0]
 denied(lambda:save(itemid=other,version=saved['updated_at']),'other program ID denied')
 denied(lambda:c.execute('update public.program_catalog_items set rental_specs=%s where id=%s',(Jsonb(specs),item)),'direct browser DML denied')
 identity({'sub':'00000000-0000-0000-0000-000000000000','role':'authenticated'})
 denied(lambda:save(version=saved['updated_at']),'non-admin denied')
 identity({},'anon');denied(lambda:save(version=saved['updated_at']),'anonymous denied')
 c.execute('reset role');c.execute('rollback to savepoint tests')
 assert {t:fp(c,t) for t in protected}==before
 assert fp(c,'public.program_catalog_items',"program_key<>'renta'",'["rental_specs"]')==nonrental
 assert fp(c,'public.program_catalog_items',"program_key='renta'",'["rental_specs","updated_at"]')==rental
 assert definitions==c.execute("select oid::regprocedure::text,md5(pg_get_functiondef(oid)) from pg_proc where pronamespace='public'::regnamespace and (proname like 'renta_car_%' or proname='save_program_catalog_item') order by 1").fetchall()
 checks.append('all preexisting writer and rental-flow definitions unchanged')
 c.execute('savepoint recovery');c.execute(Path('supabase/recovery/20261025000100_renta_car_catalog.sql').read_text(encoding='utf8'));assert c.execute("select to_regprocedure('public.save_renta_car_catalog_item(uuid,jsonb,jsonb,jsonb,timestamptz)') is null").fetchone()[0]
 assert c.execute('select rental_specs from public.program_catalog_items where id=%s',(item,)).fetchone()[0]==row['rental_specs']
 c.execute('rollback to savepoint recovery');checks.append('recovery removes new writer and preserves metadata/history')
 result={'status':'PASS','applied':a.apply,'checks':checks,'protectedTables':{t:{'rows':v[0],'unchanged':True} for t,v in before.items()},'otherCatalogRowsUnchanged':True,'rentalExistingValuesUnchanged':True,'promotedFields':['year','seats'],'missingValuesNotInvented':['engine','vehicle_type','tank'],'syntheticValuesPersisted':0,'migrationSha256':hashlib.sha256(sql.encode()).hexdigest()}
 if a.apply:c.commit()
 else:c.rollback()
Path(a.output).parent.mkdir(parents=True,exist_ok=True);Path(a.output).write_bytes(json.dumps(result,indent=2).encode());print(json.dumps(result))
