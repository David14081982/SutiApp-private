'use strict';
const fs=require('fs'),crypto=require('crypto'),assert=require('assert').strict,t=require('./request-push-tools');
const mode=process.argv[2]||'inspect',privateDir='C:/tmp/sutiapp-request-push-private';
const migration=fs.readFileSync(t.root+'/supabase/migrations/20260908000700_request_web_push.sql','utf8'),source=fs.readFileSync(t.root+'/supabase/functions/request-push/index.ts','utf8');
async function main(){
 if(mode==='inspect'){const data=await t.sql("select extname from pg_extension where extname in ('supabase_vault','pg_net','pg_cron')");console.log(JSON.stringify({extensions:data.map(r=>r.extname)}));return;}
 if(mode==='compile'||mode==='deploy'){
  if(mode==='deploy'){const p=JSON.parse(fs.readFileSync(t.out+'/edge-compile.json'));assert.equal(p.sourceSha256,t.sha(source));assert.equal(p.status,'PASS');}
  const form=new FormData();form.append('metadata',JSON.stringify({name:'request-push',slug:'request-push',entrypoint_path:'index.ts',verify_jwt:false}));form.append('file',new Blob([source],{type:'application/typescript'}),'index.ts');
  await t.management('/functions/deploy?slug=request-push'+(mode==='compile'?'&bundleOnly=true':''),{method:'POST',body:form});
  t.proof('edge-'+(mode==='compile'?'compile':'deploy'),{status:'PASS',sourceSha256:t.sha(source),auth:'private worker key checked before every dispatch',verifyJwt:false});return;
 }
 if(mode==='apply'){
  const p=JSON.parse(fs.readFileSync(t.out+'/sql.json'));assert.equal(p.status,'PASS');assert.equal(p.migrationSha256,t.sha(migration));
  const installed=await t.sql("select to_regclass('public.request_push_subscriptions') is not null installed");assert.equal(installed[0].installed,false);
  fs.mkdirSync(privateDir,{recursive:true});fs.writeFileSync(privateDir+'/before.json',JSON.stringify(await t.sql(t.business)));
  await t.sql('begin;create temporary table push_before as '+t.business+';'+t.body(migration)+"do $$begin if (select row_to_json(b)::text from push_before b)<>(select row_to_json(a)::text from ("+t.business+") a) then raise exception 'BUSINESS_MUTATED';end if;end $$;insert into supabase_migrations.schema_migrations(version,name,statements) values('20260908000700','request_web_push',array["+t.quote(migration)+']);commit;');
  t.proof('migration-applied',{status:'PASS',migrationSha256:t.sha(migration),businessUnchanged:true});return;
 }
 if(mode==='configure'){
  fs.mkdirSync(privateDir,{recursive:true});const file=privateDir+'/vapid.json';
  if(!fs.existsSync(file)){const pair=crypto.createECDH('prime256v1');pair.generateKeys();fs.writeFileSync(file,JSON.stringify({publicKey:pair.getPublicKey().toString('base64url'),privateKey:pair.getPrivateKey().toString('base64url'),workerKey:crypto.randomBytes(32).toString('base64url')}));}
  const keys=JSON.parse(fs.readFileSync(file));
  await t.management('/secrets',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify([{name:'REQUEST_PUSH_VAPID_PUBLIC_KEY',value:keys.publicKey},{name:'REQUEST_PUSH_VAPID_PRIVATE_KEY',value:keys.privateKey},{name:'REQUEST_PUSH_WORKER_KEY',value:keys.workerKey}])});
  await t.sql("begin;insert into public.request_push_config(public_key,enabled) values("+t.quote(keys.publicKey)+",false) on conflict(singleton) do update set public_key=excluded.public_key;do $$declare sid uuid;begin select id into sid from vault.secrets where name='request_push_worker_key';if sid is null then perform vault.create_secret("+t.quote(keys.workerKey)+",'request_push_worker_key');else perform vault.update_secret(sid,"+t.quote(keys.workerKey)+");end if;select id into sid from vault.secrets where name='request_push_edge_url';if sid is null then perform vault.create_secret("+t.quote(t.env.SUPABASE_URL+'/functions/v1/request-push')+",'request_push_edge_url');else perform vault.update_secret(sid,"+t.quote(t.env.SUPABASE_URL+'/functions/v1/request-push')+");end if;end $$;commit;");
  t.proof('configuration',{status:'PASS',publicKeySha256:t.sha(keys.publicKey),privateKey:'Supabase Edge secret only; private recovery copy outside repository',workerKey:'Edge secret + Vault',manualVapidActionRequired:false});return;
 }
 if(mode==='enable'){
  assert.equal(JSON.parse(fs.readFileSync(t.out+'/edge-deploy.json')).status,'PASS');assert.equal(JSON.parse(fs.readFileSync(t.out+'/configuration.json')).status,'PASS');
  const keys=JSON.parse(fs.readFileSync(privateDir+'/vapid.json'));
  const anonymous=await fetch(t.env.SUPABASE_URL+'/functions/v1/request-push',{method:'POST'});assert.equal(anonymous.status,401);
  const authorized=await fetch(t.env.SUPABASE_URL+'/functions/v1/request-push',{method:'POST',headers:{'x-request-push-key':keys.workerKey}});assert.equal(authorized.status,200);
  await t.sql('update public.request_push_config set enabled=true where singleton');
  t.proof('enabled',{status:'PASS',anonymousDispatchDenied:true,authenticatedWorker:true,enabled:true});return;
 }
 throw Error('Unknown mode');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
