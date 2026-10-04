'use strict';
// Focal reader/Edge release. Financial rows are locked and fingerprinted, never edited.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const env=Object.fromEntries(read('supabase.env').replace(/^\uFEFF/,'').split(/\r?\n/).map(l=>l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map(m=>[m[1],m[2].trim().replace(/^['"]|['"]$/g,'')]));
const base='https://api.supabase.com/v1/projects/'+new URL(env.SUPABASE_URL).hostname.split('.')[0];
const out=path.join(root,'docs/qa/evidence/sicof-evidence-integration'),privateDir=path.join(root,'.tmp/sicof-evidence-integration');
const quote=s=>"'"+String(s).replace(/'/g,"''")+"'";
const proof=(name,value)=>{fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(value,null,2)+'\n');console.log(JSON.stringify(value));};
async function api(route,options={}){const r=await fetch(base+route,{...options,headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN,...options.headers},signal:AbortSignal.timeout(180000)});if(!r.ok)throw Error('SICOF_RELEASE_HTTP_'+r.status);return r;}
async function query(sql){return(await api('/database/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:sql})})).json();}
const tables=['savings_transactions','savings_requests','savings_participants','savings_enrollments','savings_holds','savings_yield_periods','savings_yield_allocations','savings_contribution_plans','savings_audit_events','savings_balance_certifications','savings_review_records','savings_source_observations','savings_source_acceptances'];
const fp=tables.map(t=>`select '${t}' resource,count(*)::int count,md5(coalesce(string_agg(to_jsonb(t)::text,'|' order by id),'')) fingerprint from public.${t} t`).join(' union all ');
function requireTests(){for(const f of ['engine','sql','ui','build'])assert.equal(JSON.parse(read('docs/qa/evidence/sicof-evidence-integration/'+f+'.json')).status,'PASS','REQUIRED_EVIDENCE_'+f);}
async function main(){const mode=process.argv[2];requireTests();
 if(mode==='backup'){
  const metadata=await(await api('/functions/sicof')).json();
  const bytes=Buffer.from(await(await api('/functions/sicof/body')).arrayBuffer());
  assert(metadata.verify_jwt===true);assert(bytes.length>1000);
  for(const [file,data] of [['edge-before.json',JSON.stringify(metadata,null,2)],['edge-before.eszip',bytes]]){const target=path.join(privateDir,file);assert(!fs.existsSync(target),'BACKUP_EXISTS');fs.writeFileSync(target,data);}
  proof('release-backup',{status:'PASS',version:metadata.version,verifyJwt:true,bodySha256:sha(bytes),bodyBytes:bytes.length});return;
 }
 if(mode==='apply-reader'){
  const file='20261004000100_sicof_evidence_integration.sql',source=read('supabase/migrations/'+file),body=source.replace(/^begin;/,'').replace(/commit;\s*$/,'');
  const result=await query(`begin isolation level repeatable read;set local lock_timeout='2s';set local statement_timeout='60s';
   lock table ${tables.map(t=>'public.'+t).join(',')} in share mode;
   create temp table sicof_evidence_before on commit drop as ${fp};
   ${body}
   do $guard$ begin if exists((select * from sicof_evidence_before) except (${fp})) then raise exception 'SICOF_EVIDENCE_FINANCIAL_DATA_CHANGED';end if;end $guard$;
   insert into supabase_migrations.schema_migrations(version,name,statements) values('20261004000100','sicof_evidence_integration',array[${quote('H-SICOF-EVIDENCE-INTEGRATION-001 sha256:'+sha(source))}]);
   select jsonb_build_object('before',(select jsonb_agg(t order by resource) from sicof_evidence_before t),'after',(select jsonb_agg(t order by resource) from (${fp})t)) evidence;
   commit;`);
  proof('reader-applied',{status:'PASS',version:'20261004000100',migrationSha256:sha(source),protectedTables:tables.length,financialWrites:0,result});return;
 }
 if(mode==='compile'||mode==='deploy'){
  const backup=JSON.parse(read('.tmp/sicof-evidence-integration/edge-before.json'));
  const current=await(await api('/functions/sicof')).json();assert.equal(current.version,backup.version,'EDGE_DRIFT');assert.equal(current.verify_jwt,true);
  const names=fs.readdirSync(path.join(root,'supabase/functions/sicof')).filter(n=>/\.(ts|mjs)$/.test(n)),form=new FormData(),hashes={};
  for(const name of names){const content=read('supabase/functions/sicof/'+name);hashes[name]=sha(content);form.append('file',new Blob([content],{type:name.endsWith('.ts')?'application/typescript':'application/javascript'}),name);}
  if(mode==='deploy'){
   assert.equal(JSON.parse(read('docs/qa/evidence/sicof-evidence-integration/reader-applied.json')).status,'PASS');
   assert.deepEqual(hashes,JSON.parse(read('docs/qa/evidence/sicof-evidence-integration/edge-compile.json')).hashes,'COMPILED_SOURCE_DRIFT');
  }
  form.append('metadata',JSON.stringify({name:'sicof',slug:'sicof',entrypoint_path:'index.ts',verify_jwt:true}));
  const result=await(await api('/functions/deploy?slug=sicof'+(mode==='compile'?'&bundleOnly=true':''),{method:'POST',body:form})).json();
  const after=await(await api('/functions/sicof')).json();assert.equal(after.verify_jwt,true);if(mode==='compile')assert.equal(after.version,backup.version);else assert(after.version>backup.version&&after.status==='ACTIVE');
  proof('edge-'+mode,{status:'PASS',version:after.version,cloudStatus:after.status,verifyJwt:true,hashes,financialWrites:0});return;
 }
 throw Error('MODE_REQUIRED');
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
