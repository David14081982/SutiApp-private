'use strict';
// Add only the authorized read-only RPC. Never write affiliate or financial rows.
const C=require('./common.cjs'),assert=require('assert/strict');
const area=C.path.join(C.root,'.tmp/seniority'),out=C.path.join(C.root,'docs/qa/evidence/seniority');
const migration='supabase/migrations/20261125000100_affiliate_seniority.sql';
const fingerprint=`select count(*)::int total,md5(coalesce(jsonb_agg(to_jsonb(a) order by id)::text,'[]')) fingerprint from public.affiliates a`;
const security=`select jsonb_build_object('rls',(select jsonb_build_object('enabled',relrowsecurity,'forced',relforcerowsecurity,'acl',relacl::text) from pg_class where oid='public.affiliates'::regclass),'policies',(select jsonb_agg(to_jsonb(p) order by policyname) from pg_policies p where schemaname='public' and tablename='affiliates'),'functions',(select jsonb_agg(jsonb_build_object('name',p.proname,'definition',md5(pg_get_functiondef(p.oid)),'acl',p.proacl::text,'owner',p.proowner) order by p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('get_effective_affiliate_id','get_current_affiliate_access_state','has_admin_permission','get_impersonation_context'))) data`;
function proof(name,data){C.fs.mkdirSync(out,{recursive:true});C.fs.writeFileSync(C.path.join(out,name+'.json'),JSON.stringify(data,null,2));console.log(JSON.stringify(data));}
async function login(env,prefix){const r=await fetch(env.SUPABASE_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:env[prefix+'_EMAIL'],password:env[prefix+'_PASSWORD']})});assert(r.ok,'CONTROLLED_LOGIN_'+r.status);return(await r.json()).access_token;}
async function rpc(env,token,offset=0,limit=50){return fetch(env.SUPABASE_URL+'/rest/v1/rpc/get_affiliate_seniority',{method:'POST',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({p_offset:offset,p_limit:limit})});}
async function apply(){
 const isolated=JSON.parse(C.fs.readFileSync(C.path.join(out,'isolated.json')));assert.equal(isolated.status,'PASS');
 const sql=C.fs.readFileSync(C.path.join(C.root,migration),'utf8');assert(sql.includes("= 'SUTISSSTESON'"));assert(!sql.includes('SUTISSSSTESON'));
 const db=C.connection(C.environment(),{readonly:false});await db.connect();
 try{
  await db.query('begin');await db.query("select pg_advisory_xact_lock(hashtext('H-AFFILIATE-SENIORITY-001'))");
  const exists=(await db.query("select to_regprocedure('public.get_affiliate_seniority(integer,integer)') fn,to_regnamespace('seniority_private') ns")).rows[0];assert(!exists.fn&&!exists.ns,'MIGRATION_ALREADY_PRESENT');
  assert.equal((await db.query("select version from supabase_migrations.schema_migrations where version='20261125000100'")).rows.length,0,'MIGRATION_VERSION_COLLISION');
  const before=(await db.query(fingerprint)).rows[0],beforeSecurity=(await db.query(security)).rows[0];
  C.fs.writeFileSync(C.path.join(area,'backend-before.json'),JSON.stringify({before,beforeSecurity},null,2));
  await db.query(sql.replace(/^begin;\s*/i,'').replace(/\s*commit;\s*$/i,''));
  assert.deepEqual((await db.query(fingerprint)).rows[0],before,'AFFILIATES_CHANGED');assert.deepEqual((await db.query(security)).rows[0],beforeSecurity,'EXISTING_SECURITY_CHANGED');
  await db.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',['20261125000100','affiliate_seniority',[sql]]);
  await db.query('commit');
  proof('backend-applied',{status:'PASS',migration:'20261125000100',sha256:C.sha(sql),affiliateRows:before.total,affiliateRowsUnchanged:true,existingRlsAndPermissionsUnchanged:true,newTables:0,businessWrites:0,at:new Date().toISOString()});
 }catch(e){await db.query('rollback');throw e;}finally{await db.end();}
}
function date(raw){if(!raw)return null;const m=raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:, (\d{1,2}):(\d{2}):(\d{2}))?$/);if(!m||m[4]&&(+m[4]>23||+m[5]>59||+m[6]>59))return null;const dt=new Date(0);dt.setUTCFullYear(+m[3],+m[2]-1,+m[1]);dt.setUTCHours(0,0,0,0);return dt.getUTCFullYear()===+m[3]&&dt.getUTCMonth()===+m[2]-1&&dt.getUTCDate()===+m[1]?dt.toISOString().slice(0,10):null;}
async function verify(){
 const env=C.environment(),token=await login(env,'H005_TEST'),db=C.connection(env);await db.connect();
 try{
  const expected=(await db.query("select id,numero_control,full_name,display_name,city_raw,unit_raw,employment_entry_date_raw from public.affiliates where upper(btrim(financial_union_code))='SUTISSSTESON' and upper(btrim(affiliate_status_raw))='ACTIVO' and upper(btrim(financial_employee_category_code)) not in ('BASE','JUBILADOS_PENSIONADOS')")).rows;
  let result,rows=[],offset=0,revision;do{const response=await rpc(env,token,offset,50);assert.equal(response.status,200);result=await response.json();if(revision)assert.equal(result.revision,revision,'SOURCE_CHANGED_DURING_VERIFY');revision=result.revision;rows.push(...result.items);assert.equal(result.total,expected.length);offset=result.next_offset;}while(offset<result.total);
  assert.equal(new Set(rows.map(x=>x.id)).size,expected.length);assert.deepEqual(rows.map(x=>x.id).sort(),expected.map(x=>x.id).sort());
  const byId=new Map(expected.map(x=>[x.id,x])),groups=new Map(),today=result.as_of;let valid=0,missing=0,invalid=0,future=0;
  for(const row of rows){const raw=byId.get(row.id),entry=date(raw.employment_entry_date_raw),status=!raw.employment_entry_date_raw?.trim()?'MISSING':!entry?'INVALID':entry>today?'FUTURE':'VALID';assert.equal(row.date_status,status);assert.equal(row.entry_date,entry);assert.equal(row.numero_control,raw.numero_control);assert.equal(row.unit,raw.unit_raw?.trim().toUpperCase()||null);
   assert.deepEqual(Object.keys(row).sort(),['id','numero_control','name','city','unit','entry_date','date_status','tenure_months','unit_total','rank'].sort());
   if(!groups.has(row.unit))groups.set(row.unit,[]);groups.get(row.unit).push(row);
   if(status==='VALID'){valid++;const[y,m,d]=today.split('-').map(Number),[ey,em,ed]=entry.split('-').map(Number);assert.equal(row.tenure_months,(y-ey)*12+m-em-(d<ed?1:0));}else{assert.equal(row.tenure_months,null);if(status==='MISSING')missing++;else if(status==='INVALID')invalid++;else future++;}
  }
  for(const items of groups.values()){let previous='',nonvalid=false;items.forEach((r,i)=>{assert.equal(r.rank,i+1);assert.equal(r.unit_total,items.length);if(r.date_status==='VALID'){assert(!nonvalid);assert(r.entry_date>=previous);previous=r.entry_date;}else nonvalid=true;});}
  const anon=await rpc(env,null);assert([401,403].includes(anon.status));
  const invalidPage=await rpc(env,token,-1);assert.equal(invalidPage.status,400);
  let ordinary='NOT_CONFIGURED';if(env.H005_TEST2_EMAIL&&env.H005_TEST2_PASSWORD){const t=await login(env,'H005_TEST2');const r=await rpc(env,t);assert.equal(r.status,200,'ORDINARY_AFFILIATE_ACCESS');ordinary=200;}
  const rawRls=(await db.query("select relrowsecurity,relforcerowsecurity from pg_class where oid='public.affiliates'::regclass")).rows[0];assert(rawRls.relrowsecurity&&rawRls.relforcerowsecurity);
  proof('backend-live',{status:'PASS',total:rows.length,groups:groups.size,validDates:valid,missingDates:missing,invalidDates:invalid,futureDates:future,asOf:today,anonymousStatus:anon.status,invalidPageStatus:invalidPage.status,ordinaryAffiliateStatus:ordinary,uniqueIds:rows.length,exactFilteredSet:true,oldestFirstWithinEveryUnit:true,completedMonthsVerified:true,minimalFields:true,businessWrites:0,at:new Date().toISOString()});
 }finally{await db.end();}
}
(process.argv[2]==='apply'?apply():verify()).catch(e=>{C.fs.writeFileSync(C.path.join(area,'backend-error-private.json'),JSON.stringify({message:e.message,stack:e.stack,actual:e.actual,expected:e.expected},null,2));console.error(JSON.stringify({status:'FAIL',error:e.code||e.message}));process.exitCode=1;});
