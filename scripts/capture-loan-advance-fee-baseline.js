'use strict';
// Read-only definitions, no user rows or secrets in the saved baseline.
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
async function main(){
 const env=Object.fromEntries(fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/).map(s=>s.trim()).filter(s=>s&&!s.startsWith('#')&&s.includes('=')).map(s=>{const at=s.indexOf('=');return[s.slice(0,at).trim(),s.slice(at+1).trim().replace(/^['"]|['"]$/g,'')];}));
 const ref=new URL(env.SUPABASE_URL).hostname.split('.')[0];
 const query=`begin read only;
 select p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition,md5(pg_get_functiondef(p.oid)) hash,p.proacl::text acl
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in
 ('normalize_suti_financial_key','resolve_suti_loan_quote_contract_v1_engine','resolve_suti_loan_quote_contract','resolve_current_loan_snapshot_quote') order by p.proname;
 commit;`;
 const r=await fetch('https://api.supabase.com/v1/projects/'+ref+'/database/query',{method:'POST',headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query})});
 if(!r.ok)throw Error('READ_ONLY_QUERY_HTTP_'+r.status);
 const definitions=await r.json();if(!Array.isArray(definitions)||definitions.length!==4)throw Error('BASELINE_INCOMPLETE');
 fs.writeFileSync(path.join(root,'scripts/test-loan-advance-fee-baseline.json'),JSON.stringify({captured_at:new Date().toISOString(),definitions},null,2)+'\n');
 console.log(JSON.stringify({status:'PASS',definitions:definitions.length,businessRowsRead:0,writes:0}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
