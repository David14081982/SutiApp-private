'use strict';
// Management credentials stay in ignored local configuration; never print SQL responses with PII.
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),privateDir=path.join(root,'.tmp/inversores');
function environment(){const env={};for(const line of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m)env[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}return env;}
async function query(sql,write=false){const env=environment();
 if(process.env.INVESTORS_DB_TRANSPORT==='postgres'){
  const {Client}=require(path.join(privateDir,'deps/node_modules/pg')),ref=new URL(env.SUPABASE_URL).hostname.split('.')[0];
  const client=new Client({host:'db.'+ref+'.supabase.co',port:5432,user:'postgres',database:'postgres',password:env.SUPABASE_DB_PASSWORD,ssl:{rejectUnauthorized:true,ca:fs.readFileSync(path.join(privateDir,'prod-ca-2021.crt'),'utf8')},connectionTimeoutMillis:15000,query_timeout:90000});
  try{await client.connect();if(!write)await client.query('set default_transaction_read_only=on');const result=await client.query(sql);return (Array.isArray(result)?result:[result]).flatMap(r=>r.rows||[]);}catch(e){fs.writeFileSync(path.join(privateDir,'database-error.txt'),String(e.message));throw Error('INVESTORS_SQL_'+(e.code||'FAILED'));}finally{await client.end();}
 }
 const url='https://api.supabase.com/v1/projects/'+new URL(env.SUPABASE_URL).hostname.split('.')[0]+'/database/query';const r=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query:sql,read_only:!write}),signal:AbortSignal.timeout(90000)});if(!r.ok){fs.mkdirSync(privateDir,{recursive:true});fs.writeFileSync(path.join(privateDir,'database-error.txt'),await r.text());throw Error('INVESTORS_SQL_HTTP_'+r.status);}return r.json();}
module.exports={query,environment,root,privateDir};
if(require.main===module){
 const sql=`select n.nspname||'.'||p.proname name,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='public' and p.proname in('has_admin_permission','admin_module_boundary','get_effective_affiliate_id')) or (n.nspname='admin_support_private' and p.proname='module_visible')`;
 query(sql).then(rows=>{fs.mkdirSync(privateDir,{recursive:true});fs.writeFileSync(path.join(privateDir,'backend-dependencies.json'),JSON.stringify(rows,null,2));console.log(JSON.stringify({status:'PASS',readOnly:true,dependencies:rows.map(r=>r.name)}));}).catch(e=>{console.error(e.message);process.exitCode=1;});
}
