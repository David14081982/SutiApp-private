'use strict';
// H-SAVINGS-JC-REPORT-001 release: additive read RPC, savings-jc-report Edge, live verification.
// Modes: db-apply | db-verify | edge-compile | edge-deploy | live <private-output.xlsx>
// Env: SUTIAPP_ENV_FILE / SUTIAPP_PG_DIR as in voting-consultas-db.js. Evidence keeps counts and hashes only (no PII).
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const {query,env}=require('./voting-consultas-db.js');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/savings-jc-report');
const version='20261127000100',name='savings_jc_report',slug='savings-jc-report';
const migrationPath='supabase/migrations/'+version+'_'+name+'.sql',edgePath='supabase/functions/'+slug+'/index.ts';
const read=f=>fs.readFileSync(path.join(root,f),'utf8').replace(/\r\n/g,'\n'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const e=env(),ref=new URL(e.SUPABASE_URL).hostname.split('.')[0],api='https://api.supabase.com/v1/projects/'+ref;
function proof(key,data){fs.mkdirSync(out,{recursive:true});const file=path.join(out,'release.json');const all=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{};all[key]={...data,at:new Date().toISOString()};fs.writeFileSync(file,JSON.stringify(all,null,2)+'\n');console.log(key,JSON.stringify(all[key]));}
const installed=sql=>query(`select md5(p.prosrc) md5,p.prosecdef secdef,p.provolatile vol,p.proacl::text acl,(select count(*) from supabase_migrations.schema_migrations where version='${version}' and name='${name}')::int recorded from pg_proc p where p.oid=to_regprocedure('public.get_admin_savings_jc_report()')`+(sql||''));
async function adminUid(){const r=await query(`select id::text from auth.users where lower(email)=lower('${e.H005_TEST_EMAIL.replace(/'/g,"''")}')`);assert.equal(r.length,1);return r[0].id;}
const claims=uid=>`set local request.jwt.claims='{"sub":"${uid}","role":"authenticated"}';set local request.jwt.claim.sub='${uid}';`;
function form(index){const f=new FormData();f.append('metadata',JSON.stringify({name:slug,slug,entrypoint_path:'index.ts',verify_jwt:true}));f.append('file',new Blob([index],{type:'application/typescript'}),'index.ts');return f;}
async function management(url,init={}){const r=await fetch(api+url,{...init,headers:{Authorization:'Bearer '+e.SUPABASE_ACCESS_TOKEN,...(init.headers||{})}});const text=await r.text();if(!r.ok)throw Error('MANAGEMENT_'+r.status+':'+text.slice(0,300));return text?JSON.parse(text):null;}
async function main(){
 const mode=process.argv[2];
 if(mode==='db-apply'){
  const sql=read(migrationPath),body=sql.replace(/^\s*begin;/i,'').replace(/commit;\s*$/i,'');assert(!/\$jcmigration\$/.test(body));
  assert.equal((await installed()).length,0,'FUNCTION_ALREADY_INSTALLED');
  const counts=`select (select count(*) from public.savings_transactions)::int tx,(select count(*) from public.savings_requests)::int req,(select count(*) from public.savings_participants)::int part,(select count(*) from public.savings_review_records)::int rec`;
  const before=(await query(counts))[0];
  await query(`begin;do $g$ begin if exists(select 1 from supabase_migrations.schema_migrations where version='${version}') then raise exception 'MIGRATION_VERSION_TAKEN'; end if; end $g$;${body}insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name}',array[$jcmigration$${body}$jcmigration$]);commit;`,{write:true});
  const after=(await query(counts))[0],fn=(await installed())[0];
  assert.deepEqual(after,before,'FINANCIAL_ROWS_CHANGED');assert.equal(fn.recorded,1);assert.equal(fn.secdef,true);assert.equal(fn.vol,'s');assert.equal(fn.acl,'{postgres=X/postgres,authenticated=X/postgres}');
  proof('db-apply',{status:'PASS',migrationSha256:sha(sql),functionMd5:fn.md5,acl:fn.acl,securityDefiner:fn.secdef,volatility:fn.vol,rowCountsUnchanged:after});return;
 }
 if(mode==='db-verify'){
  const fn=(await installed())[0];assert(fn&&fn.recorded===1,'NOT_INSTALLED');
  const uid=await adminUid(),rows=await query('begin;'+claims(uid)+'select public.get_admin_savings_jc_report() r;rollback;');const r=rows.find(x=>x.r).r;
  let denied;try{await query('begin;'+claims('00000000-0000-0000-0000-000000000001')+'select public.get_admin_savings_jc_report() r;rollback;');}catch(x){denied=x.message;}
  assert.equal(denied,'SAVINGS_REPORT_DENIED');
  const total=r.people.reduce((s,p)=>s+Math.round(p.saldo*100),0),ledger=(await query(`select round(sum(case when t.direction='CREDIT' then t.amount else -t.amount end)*100)::bigint c from public.savings_transactions t join public.savings_participants p on p.id=t.participant_id and p.data_classification='CANONICAL'`))[0].c;
  assert.equal(String(total),String(ledger),'TOTAL_DIFFERS_FROM_LEDGER');
  proof('db-verify',{status:'PASS',functionMd5:fn.md5,acl:fn.acl,people:r.people.length,withdrawals:r.withdrawals.length,dates:r.dates.length,firstDate:r.dates[0],lastDate:r.dates.at(-1),totalCentsEqualsLedger:true,deniedWithoutPermission:denied});return;
 }
 if(mode==='edge-compile'||mode==='edge-deploy'){
  const index=read(edgePath);
  const result=await management('/functions/deploy?slug='+slug+(mode==='edge-compile'?'&bundleOnly=true':''),{method:'POST',body:form(index)});
  if(mode==='edge-deploy'){assert.equal(result.verify_jwt,true,'DEPLOY_JWT_REQUIRED');assert.equal(result.status,'ACTIVE');}
  proof(mode,{status:'PASS',sourceSha256:sha(index),verifyJwt:true,...(mode==='edge-deploy'?{version:result.version}:{})});return;
 }
 if(mode==='live'){
  const target=process.argv[3];assert(target&&!path.resolve(target).startsWith(root),'PRIVATE_OUTPUT_OUTSIDE_REPO_REQUIRED');
  const fnUrl=e.SUPABASE_URL+'/functions/v1/'+slug,origin='https://sutiapp.com';
  const anon=await fetch(fnUrl,{method:'POST',headers:{apikey:e.SUPABASE_PUBLISHABLE_KEY,Origin:origin,'Content-Type':'application/json'},body:'{}'});
  const preflight=await fetch(fnUrl,{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization, x-client-info, apikey, content-type'}});
  const login=await fetch(e.SUPABASE_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:e.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:e.H005_TEST_EMAIL,password:e.H005_TEST_PASSWORD})});
  assert.equal(login.status,200,'LOGIN_FAILED');const token=(await login.json()).access_token;
  const t0=Date.now(),res=await fetch(fnUrl,{method:'POST',headers:{apikey:e.SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+token,Origin:origin,'Content-Type':'application/json'},body:'{}'});
  const bytes=Buffer.from(await res.arrayBuffer());assert.equal(res.status,200,'EDGE_'+res.status+':'+bytes.toString('utf8').slice(0,200));
  assert.deepEqual([...bytes.subarray(0,4)],[80,75,3,4]);fs.writeFileSync(target,bytes);
  await fetch(e.SUPABASE_URL+'/auth/v1/logout',{method:'POST',headers:{apikey:e.SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+token}});
  proof('live',{status:'PASS',anonymousStatus:anon.status,preflightStatus:preflight.status,allowOrigin:preflight.headers.get('access-control-allow-origin'),downloadStatus:res.status,contentDisposition:res.headers.get('content-disposition'),bytes:bytes.length,ms:Date.now()-t0});
  assert.equal(anon.status,401);assert.equal(preflight.headers.get('access-control-allow-origin'),origin);return;
 }
 throw Error('MODE_INVALID');
}
main().catch(x=>{console.error(/^[A-Z0-9_:]+/.test(x.message)?x.message:'SAVINGS_JC_RELEASE_FAILED '+x.message);process.exitCode=1;});
