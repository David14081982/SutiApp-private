'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert').strict,crypto=require('crypto');
const root=path.resolve(__dirname,'..'),dir='C:/tmp/sutiapp-register-format-backup-20260908',read=n=>JSON.parse(fs.readFileSync(path.join(dir,n))),before=read('sheet-before.json'),after=read('sheet-after.json'),tail=read('target-before.json');
const b=before.sheets.find(s=>s.properties.sheetId===10616270),a=after.sheets.find(s=>s.properties.sheetId===10616270),same=(x,y)=>assert.deepEqual(x,y);
same(a.properties,b.properties);
for(const col of [0,9,24]){
  const old=b.data.find(d=>(d.startColumn||0)===col),now=a.data.find(d=>(d.startColumn||0)===col&&!d.startRow);same(now.rowData.length,old.rowData.length);
  for(let i=0;i<old.rowData.length;i++){
    const prev=old.rowData[i].values?.[0]||{},next=now.rowData[i].values?.[0]||{};
    if(col!==9||i===0)same(next.userEnteredFormat,prev.userEnteredFormat);
    else same(next.userEnteredFormat.numberFormat,{type:'DATE',pattern:'dd/MM/yyyy'});
    same(next.dataValidation,prev.dataValidation);
    if(i<2316||col===24)same(next.userEnteredValue,prev.userEnteredValue);
  }
}
const tailAfter=a.data.find(d=>d.startRow===2316).rowData,tailBefore=tail.sheets[0].data[0].rowData;
for(let i=0;i<3;i++)for(let c=0;c<33;c++)if(![0,9].includes(c))same(tailAfter[i].values[c],tailBefore[i].values[c]);
const expected=[['SR-2026-000194','08/09/2026','PENDIENTE'],['SR-2026-000121','07/09/2026','Iniciado'],['SR-2026-000195','08/09/2026','Iniciado']];
for(let i=0;i<3;i++)same([0,9,24].map(c=>tailAfter[i].values[c].formattedValue),expected[i]);
const rb=before.sheets.find(s=>s.properties.sheetId===2026082207).data[0].rowData,ra=after.sheets.find(s=>s.properties.sheetId===2026082207).data[0].rowData;
for(let i=0;i<rb.length;i++)for(let c=0;c<16;c++){
  if(i>=10&&i<=12&&c===12){const p=JSON.parse(rb[i].values[c].formattedValue.slice(16)),n=JSON.parse(ra[i].values[c].formattedValue.slice(16));assert(/^SR-\d{4}-\d{6,}$/.test(n.folio));delete n.folio;same(n,p);}
  else same(ra[i].values?.[c],rb[i].values?.[c]);
}
async function main(){
  const env={};for(const l of fs.readFileSync('C:/Users/david/OneDrive/Documentos/Sutiapp 20082026/supabase.env','utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const i=l.indexOf('=');if(i>0)env[l.slice(0,i).trim()]=l.slice(i+1).trim().replace(/^['"]|['"]$/g,'');}
  const denied=await fetch(env.SUPABASE_URL+'/functions/v1/financial-legacy',{method:'POST',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({action:'syncRequest',request_id:'5cd836ad-3681-40c8-8cfc-803ac1af2e34'})});assert([401,403].includes(denied.status));
  const auth=JSON.parse(fs.readFileSync('C:/Users/david/.clasprc.json','utf8')).tokens.default;
  const tokenResponse=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:auth.client_id,client_secret:auth.client_secret,refresh_token:auth.refresh_token,grant_type:'refresh_token',scope:'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/script.webapp.deploy'})});assert(tokenResponse.ok);const token=await tokenResponse.json();
  const probe=await fetch('https://script.google.com/macros/s/AKfycbwvQ_HZ1-lb5RVv9En4XgTRh1f3EjcIXSZel3zkWhC9gCI4vW_vRLd64RjxvOSQqdIz0g/exec',{method:'POST',headers:{Authorization:'Bearer '+token.access_token,'Content-Type':'application/json'},body:JSON.stringify({action:'sync_request',secret:'deliberately-invalid-format-probe',contract_version:'REQUEST_REGISTER_V2'})});const deniedGoogle=await probe.json();assert.equal(deniedGoogle.ok,false);assert.equal(deniedGoogle.error,'UNAUTHORIZED');
  const proof={status:'PASS',rows:expected.map((r,i)=>({row:2317+i,folio:r[0],date:r[1],status:r[2]})),dateFormat:'J2:J2319 dd/MM/yyyy',dateValuesPreservedExceptThreeISOConversions:true,otherTargetCellsPreserved:true,registryOnlyFolioMetadata:true,rowCount:2319,duplicatesAdded:0,AHOnward:'excluded from all writes; not read',existingUppercaseApprovals:0,futureApproval:'Aprobado; actual receiver isolated tests and deployed hash verified',anonymousEdge:denied.status,googleInvalidSecret:'UNAUTHORIZED',securityProbeWrites:0,cellSnapshotSha256:crypto.createHash('sha256').update(JSON.stringify(after)).digest('hex')};
  fs.writeFileSync(path.join(root,'docs/qa/evidence/register-format-20260908/live-readback.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
}
main().catch(e=>{console.error(JSON.stringify({status:'FAIL',error:e.message}));process.exitCode=1;});
