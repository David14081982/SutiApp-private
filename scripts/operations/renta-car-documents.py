"""H-RENTA-CAR-DOCUMENTS-002: existing audited configuration writer only.
Default is a rollback-only preflight; --apply commits four rental rules.
No schema change, request creation, file upload or historical update.
"""
import argparse, base64, json, sys, urllib.request
from pathlib import Path
from urllib.parse import urlparse

p=argparse.ArgumentParser();p.add_argument('--env',required=True);p.add_argument('--deps',required=True);p.add_argument('--output',required=True);p.add_argument('--apply',action='store_true');args=p.parse_args()
sys.path.insert(0,args.deps)
import psycopg
env={}
for line in Path(args.env).read_text(encoding='utf-8-sig').splitlines():
 if '=' in line and not line.startswith('#'):
  k,v=line.split('=',1);env[k.strip()]=v.strip().strip('"\'')
key=env.get('SUPABASE_PUBLISHABLE_KEY') or env['SUPABASE_ANON_KEY']
request=urllib.request.Request(env['SUPABASE_URL']+'/auth/v1/token?grant_type=password',data=json.dumps({'email':env['H005_TEST_EMAIL'],'password':env['H005_TEST_PASSWORD']}).encode(),headers={'apikey':key,'Content-Type':'application/json'},method='POST')
with urllib.request.urlopen(request,timeout=20) as r: token=json.load(r)['access_token']
payload=token.split('.')[1];claims=json.loads(base64.urlsafe_b64decode(payload+'='*((-len(payload))%4)))
assert claims['role']=='authenticated' and claims['sub'] and claims['session_id']
vehicle='9fe940a0-616c-555e-839a-63fd20bc9b41'
reference='ffebe743-7f1c-4657-a6ff-5b39cce13672'
codes=['profile_photo','ine_front','ine_back','payroll_latest']
ref=urlparse(env['SUPABASE_URL']).hostname.split('.')[0]
reason='H-RENTA-CAR-DOCUMENTS-002: expediente como Membresias solicitado por propietario'
def fingerprint(c,table,predicate='true',params=()):
 return c.execute('select count(*),md5(coalesce(string_agg(to_jsonb(t)::text,\'\' order by t.id),\'\')) from '+table+' t where '+predicate,params).fetchone()
with psycopg.connect(host='db.'+ref+'.supabase.co',dbname='postgres',user='postgres',password=env['SUPABASE_DB_PASSWORD'],sslmode='require',connect_timeout=15) as c:
 c.execute('set transaction isolation level repeatable read')
 c.execute("set local lock_timeout='1s'");c.execute("set local statement_timeout='15s'")
 c.execute("select pg_advisory_xact_lock(hashtextextended('H-RENTA-CAR-DOCUMENTS-002',0))")
 assert c.execute("select count(*) from public.program_catalog_items where id=%s and program_key='renta' and enabled",(vehicle,)).fetchone()[0]==1
 protected=['public.program_requests','public.affiliate_documents','public.affiliate_files','public.document_types']
 before={t:fingerprint(c,t) for t in protected}
 nonrental=fingerprint(c,'public.program_document_requirements',"not(scope_type='PROGRAM' and scope_key=%s)",(vehicle,))
 original=c.execute("select document_type_id,required,allow_verified_reuse,sort_order,effect,enabled from public.program_document_requirements where scope_type='PROGRAM' and scope_key=%s",(vehicle,)).fetchall()
 types=dict(c.execute('select code,id from public.document_types where enabled and code=any(%s)',(codes,)).fetchall());assert set(types)==set(codes)
 expected={(types[code],True,True,n+1,'INCLUDE',True) for n,code in enumerate(codes)}
 assert not original or set(original)==expected,'RENTAL_CONFIGURATION_DRIFT'
 audit_before=c.execute('select count(*) from public.document_configuration_audit_log').fetchone()[0]
 c.execute("select set_config('request.jwt.claims',%s,true)",(json.dumps(claims),));c.execute('set local role authenticated')
 assert c.execute("select public.has_admin_permission('documents.write')").fetchone()[0],'DOCUMENT_WRITE_DENIED'
 membership=c.execute("select document_type_code,required from public.resolve_effective_document_requirements('MEMBERSHIP',%s)",(reference,)).fetchall()
 assert set(membership)=={(code,True) for code in codes},'MEMBERSHIP_REFERENCE_DRIFT'
 if not original:
  for n,code in enumerate(codes):
   c.execute("select public.save_document_requirement_rule('PROGRAM',%s,%s,'INCLUDE',true,true,%s,%s)",(vehicle,types[code],n+1,reason))
 resolved=c.execute("select document_type_code,required from public.resolve_effective_document_requirements('PROGRAM',%s)",(vehicle,)).fetchall();assert resolved==[(code,True) for code in codes]
 assert c.execute("select document_type_code,required from public.resolve_effective_document_requirements('MEMBERSHIP',%s)",(reference,)).fetchall()==membership
 c.execute('reset role')
 assert {t:fingerprint(c,t) for t in protected}==before,'PROTECTED_DATA_CHANGED'
 assert fingerprint(c,'public.program_document_requirements',"not(scope_type='PROGRAM' and scope_key=%s)",(vehicle,))==nonrental,'OTHER_PROGRAM_CHANGED'
 audits=c.execute('select count(*) from public.document_configuration_audit_log').fetchone()[0]-audit_before
 assert audits==(0 if original else 4)
 result={'status':'PASS','applied':args.apply,'mode':'APPLY' if args.apply else 'ROLLBACK_PREFLIGHT','rulesCreated':0 if original else 4,'scopeType':'PROGRAM','scopeKey':vehicle,'documentCodes':codes,'auditEvents':audits,'actor':'AUTHENTICATED_DOCUMENT_ADMIN','protectedTables':{t:{'rows':v[0],'fingerprintUnchanged':True} for t,v in before.items()},'otherProgramRulesUnchanged':True,'membershipReferenceUnchanged':True,'schemaChanges':0,'uploadedFiles':0,'testRequests':0}
 if args.apply:c.commit()
 else:c.rollback()
Path(args.output).parent.mkdir(parents=True,exist_ok=True);Path(args.output).write_bytes((json.dumps(result,indent=2)+'\n').encode());print(json.dumps(result))
