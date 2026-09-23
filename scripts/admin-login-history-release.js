'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto'),vm=require('vm'),cp=require('child_process');
const {query}=require('./savings-admin-review-db');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/admin-login-history-20260923'),version='20260923000100';
const file='supabase/migrations/'+version+'_admin_login_history.sql',read=f=>fs.readFileSync(path.join(root,f),'utf8');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex'),quote=s=>"'"+s.replace(/'/g,"''")+"'";
const save=(name,value)=>{fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(value,null,2));};
function env(){const values={};for(const line of read('supabase.env').replace(/^\uFEFF/,'').split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m)values[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}return values;}
async function config(method='GET',body){const e=env(),ref=new URL(e.SUPABASE_URL).hostname.split('.')[0];const response=await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`,{method,headers:{Authorization:'Bearer '+e.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});assert(response.ok,'AUTH_CONFIG_'+response.status);return response.json();}
async function main(){
 const mode=process.argv[2];
 if(mode==='build'){
  // Preserve every unrelated published chunk byte-for-byte, including its compiler formatting.
  const base=cp.execFileSync('git',['show','HEAD:app/bundle.js'],{cwd:root,maxBuffer:25000000}).toString().replace(/\r\n/g,'\n');
  const box={};vm.createContext(box);vm.runInContext(fs.readFileSync('C:/tmp/babel-standalone-7.29.0.min.js','utf8'),box);
  const chunk=name=>{const source=read('app/'+name).replace(/\r\n/g,'\n');return `/* @@file ${name} */\n(function(){\n${name.endsWith('.jsx')?box.Babel.transform(source,{presets:['react'],filename:name}).code:source.trimEnd()}\n})();\n`;};
  const parts=[...base.matchAll(/\/\* @@file ([^\n]+) \*\/\n([\s\S]*?)(?=\/\* @@file |$)/g)];assert(parts.some(x=>x[1]==='screens-admin.jsx'));
  const result=chunk('login-history-repository.js')+chunk('screens-admin-login-history.jsx')+parts.filter(x=>!['login-history-repository.js','screens-admin-login-history.jsx'].includes(x[1])).map(x=>x[1]==='screens-admin.jsx'?chunk(x[1]):x[0]).join('');
  new vm.Script(result);fs.writeFileSync(path.join(root,'app/bundle.js'),result);
  save('build',{status:'PASS',changedChunks:['screens-admin.jsx'],addedChunks:['login-history-repository.js','screens-admin-login-history.jsx'],preservedChunks:parts.length-1,sha256:hash(result)});
 }else if(mode==='build-site'){
  const e=env();cp.execFileSync(process.execPath,['scripts/build-pages-site.js','tmp/login-history-site'],{cwd:root,env:{...process.env,SUTIAPP_SUPABASE_URL:e.SUPABASE_URL,SUTIAPP_SUPABASE_PUBLISHABLE_KEY:e.SUPABASE_PUBLISHABLE_KEY},stdio:'inherit'});
  normalizeVendors();
 }else if(mode==='normalize-local-vendors'){
  normalizeVendors();
 }else if(mode==='global-local'){
  process.env.SUTIAPP_MODULE_SITE_ROOT=path.join(root,'tmp/login-history-site');
  const server=await require('./test-admin-user-modules-browser').serve();
  await new Promise(resolve=>server.close(resolve));
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(8080,'127.0.0.1',resolve);});
  try{
   const child=cp.spawn(process.execPath,['scripts/test-global-image-regression-production-live.js'],{cwd:root,env:{...process.env,SUTIAPP_IMAGE_E2E_URL:'http://localhost:8080/SutiApp.html'},windowsHide:true});
   let stdout='',stderr='';child.stdout.on('data',x=>stdout+=x);child.stderr.on('data',x=>stderr+=x);
   const code=await new Promise(resolve=>child.on('exit',resolve));save('global-local',{status:code===0?'PASS':'FAIL',exitCode:code,stdout,stderr});assert.equal(code,0,stderr);console.log(stdout.trim());
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
 }else if(mode==='apply'){
  assert.equal(JSON.parse(read('docs/qa/evidence/admin-login-history-20260923/isolated.json')).status,'PASS');
  const source=read(file);assert.equal(hash(source),JSON.parse(read('docs/qa/evidence/admin-login-history-20260923/isolated.json')).migrationSha256,'Tested migration hash');assert.equal((await query(`select version from supabase_migrations.schema_migrations where version='${version}'`)).length,0,'Already installed');
  const digest=`jsonb_build_object('affiliates',(select md5(coalesce(string_agg(to_jsonb(a)::text,'' order by id),'')) from public.affiliates a),'assignments',(select md5(coalesce(string_agg(to_jsonb(a)::text,'' order by auth_user_id),'')) from public.admin_assignments a))`;
  const result=await query(`begin isolation level repeatable read;create temporary table login_history_before on commit drop as select ${digest} value;
   ${source.replace(/^begin;/,'').replace(/commit;\s*$/,'')}
   do $$begin if (select value from login_history_before) is distinct from ${digest} then raise exception 'EXISTING_DATA_CHANGED';end if;end $$;
   insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','admin_login_history',array[${quote(source)}]);
   select 'PASS' status;commit;`);
  save('applied',{status:'PASS',migration:version,sha256:hash(source),businessAndAssignmentsUnchanged:true,result});
 }else if(mode==='enable-history'){
  const before=await config();save('audit-config-before',{audit_log_disable_postgres:before.audit_log_disable_postgres,recordedAt:new Date().toISOString()});
  await config('PATCH',{audit_log_disable_postgres:false});const after=await config();assert.equal(after.audit_log_disable_postgres,false);
  save('audit-config-enabled',{status:'PASS',audit_log_disable_postgres:false,enabledAt:new Date().toISOString(),changedFields:['audit_log_disable_postgres']});
 }else if(mode==='verify'){
  const e=env();async function login(prefix){const r=await fetch(e.SUPABASE_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:e.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:e[prefix+'_EMAIL'],password:e[prefix+'_PASSWORD']})});assert.equal(r.status,200,'Test login');return(await r.json()).access_token;}
  const call=(token,body={})=>fetch(e.SUPABASE_URL+'/rest/v1/rpc/list_admin_login_history',{method:'POST',headers:{apikey:e.SUPABASE_PUBLISHABLE_KEY,...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json'},body:JSON.stringify(body)});
  const anon=await call();assert([401,403].includes(anon.status));
  // A real non-admin principal under the real database role; no synthetic production data.
  await query(`begin read only;
   do $$declare subject uuid;begin select u.id into subject from auth.users u where not exists(select 1 from public.admin_assignments a where a.auth_user_id=u.id) and not exists(select 1 from public.admin_section_responsibilities r where r.auth_user_id=u.id) limit 1;
    if subject is null then raise exception 'NONADMIN_TEST_SUBJECT_MISSING';end if;
    perform set_config('request.jwt.claim.sub',subject::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',subject,'role','authenticated')::text,true);end $$;
   set local role authenticated;
   do $$begin begin perform public.list_admin_login_history();exception when insufficient_privilege then return;end;raise exception 'NONADMIN_WAS_ALLOWED';end $$;
   rollback;`);
  const admin=await login('H005_TEST');let r=await call(admin);assert.equal(r.status,200);const data=await r.json();assert(data.total>0);assert(data.items.length<=25);
  r=await call(admin,{p_mode:'history'});assert.equal(r.status,200);const history=await r.json();
  const c=await config(),capturing=c.audit_log_disable_postgres===false&&history.total>0;
  save('live',{status:capturing?'PASS':'BLOCKED',anonRestDenied:true,nonAdminDatabaseRoleDenied:true,adminRestRead:true,nativeLoginCapture:capturing,totalUsers:data.total,historyEvents:history.total,personalDataStored:false});
  assert(capturing,'NATIVE_AUDIT_REQUIRES_DASHBOARD_ACTIVATION');
 }else throw Error('Expected build|build-site|apply|enable-history|verify');
 console.log(JSON.stringify({status:'PASS',mode}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
function normalizeVendors(){
 // Windows autocrlf changes bytes checked by SRI. Match the LF checkout used by Pages CI.
 const html=read('SutiApp.html');
 for(const match of html.matchAll(/src="(app\/vendor\/[^"\n]+)"\s+integrity="sha384-([^"\n]+)"/g)){
  const target=path.join(root,'tmp/login-history-site',match[1]);
  const source=fs.readFileSync(target,'utf8').replace(/\r\n/g,'\n');
  assert.equal(crypto.createHash('sha384').update(source).digest('base64'),match[2],'Canonical vendor SRI');fs.writeFileSync(target,source);
 }
}
