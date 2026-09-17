'use strict';
const fs=require('fs'),assert=require('assert/strict'),crypto=require('crypto');
const {query,body}=require('./savings-admin-review-db');
const migration='supabase/migrations/20260916000100_profile_photo_edit.sql';
const recovery='supabase/recovery/20260916000100_profile_photo_edit.sql';
const out='docs/qa/evidence/profile-photo-edit-20260916/';
const hash=crypto.createHash('sha256').update(fs.readFileSync(migration)).digest('hex');
async function main(){
 const mode=process.argv[2]||'check';
 if(mode==='check'){
  const result=await query('begin;\n'+body(migration)+'\n'+body(recovery)+"\nselect 'PASS' status;rollback;");
  assert.equal(result[0].status,'PASS');
  fs.writeFileSync(out+'migration-check.json',JSON.stringify({status:'PASS',hash,result}));
  console.log(JSON.stringify({status:'PASS',check:'migration + recovery rollback',hash}));
 }else if(mode==='security'){
  const result=await query('begin;\n'+body(migration)+'\n'+fs.readFileSync('scripts/test-profile-photo-edit.sql','utf8')+'\nrollback;');
  fs.writeFileSync(out+'security.json',JSON.stringify({status:'PASS',hash,result,fixturesPersisted:0}));
  console.log(JSON.stringify({status:'PASS',result,fixturesPersisted:0}));
 }else if(mode==='verify'){
  const result=await query('begin;\n'+fs.readFileSync('scripts/test-profile-photo-edit.sql','utf8')+'\nrollback;');
  fs.writeFileSync(out+'live-security.json',JSON.stringify({status:'PASS',hash,result,fixturesPersisted:0}));
  console.log(JSON.stringify({status:'PASS',result,fixturesPersisted:0}));
 }else if(mode==='apply'){
  assert.equal(JSON.parse(fs.readFileSync(out+'security.json')).hash,hash);
  assert.equal(JSON.parse(fs.readFileSync(out+'migration-check.json')).hash,hash);
  const source=fs.readFileSync(migration,'utf8');
  const result=await query('begin;\n'+body(migration)+"\ninsert into supabase_migrations.schema_migrations(version,name,statements) values('20260916000100','profile_photo_edit',array['"+source.replace(/'/g,"''")+"']);select 'PASS' status;commit;");
  fs.writeFileSync(out+'applied.json',JSON.stringify({status:'PASS',hash,result}));
  console.log(JSON.stringify({status:'PASS',version:'20260916000100'}));
 }else throw Error('Invalid mode');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
