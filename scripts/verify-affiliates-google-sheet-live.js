'use strict';
// H-AFFILIATES-GOOGLE-SHEET-001 live check (run only after deploy + the sheet is shared with the service account).
// Proves: anonymous is refused, the admin refresh returns exactly the SUTISSSTESON count, and public.affiliates is
// byte-for-byte unchanged (fingerprint before/after). Prints counts and hashes only — never rows or PII.
const assert=require('assert').strict;
const fs=require('fs');
const path=require('path');
const {query}=require('./voting-consultas-db.js');
const root=path.resolve(__dirname,'..');
const evidenceDir=path.join(root,'docs','qa','evidence','affiliates-google-sheet-20261119');
function env(){const file=process.env.SUTIAPP_ENV_FILE||path.join(root,'supabase.env'),out={};for(const raw of fs.readFileSync(file,'utf8').replace(/^﻿/,'').split(/\r?\n/)){const line=raw.trim();if(!line||line.startsWith('#')||!line.includes('='))continue;const at=line.indexOf('=');out[line.slice(0,at).trim()]=line.slice(at+1).trim().replace(/^['"]|['"]$/g,'');}return out;}
const FINGERPRINT="select count(*)::int as total, count(*) filter (where financial_union_code='SUTISSSTESON')::int as sutissteson, md5(string_agg(id::text||'|'||coalesce(updated_at::text,'')||'|'||md5(row_to_json(a)::text),',' order by id)) as digest from public.affiliates a";

async function main(){
  const values=env(),base=values.SUPABASE_URL.replace(/\/$/,''),key=values.SUPABASE_PUBLISHABLE_KEY,fn=base+'/functions/v1/affiliates-google-sheet';
  const result={status:'FAIL',anonymous:null,admin:null,before:null,after:null};
  try{
    result.before=(await query(FINGERPRINT))[0];
    const anon=await fetch(fn,{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:'{}'});result.anonymous=anon.status;assert.equal(anon.status,401);
    const login=await fetch(base+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({email:values.H005_TEST_EMAIL,password:values.H005_TEST_PASSWORD})});
    const session=await login.json();assert(login.ok&&session.access_token,'ADMIN_LOGIN_FAILED');
    const started=Date.now();
    const response=await fetch(fn,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:'{}'});
    const body=await response.json().catch(()=>({}));result.admin={httpStatus:response.status,status:body.status||null,error:body.error||null,rows:body.rows,sheetGid:body.sheet_gid,ms:Date.now()-started};
    assert.equal(response.status,200,'ADMIN_REFRESH_'+(body.error||response.status));assert.equal(body.status,'OK');
    result.after=(await query(FINGERPRINT))[0];
    assert.equal(body.rows,result.before.sutissteson,'ROW_COUNT_MISMATCH');
    assert.deepEqual(result.after,result.before,'SUPABASE_CHANGED');
    result.status='PASS';
  }finally{fs.mkdirSync(evidenceDir,{recursive:true});fs.writeFileSync(path.join(evidenceDir,'live.json'),JSON.stringify(result,null,2)+'\n');}
  console.log(JSON.stringify(result,null,2));
}
main().catch((error)=>{console.error(JSON.stringify({status:'FAIL',error:error.message}));process.exitCode=1;});
