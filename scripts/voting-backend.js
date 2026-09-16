'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const {query,body}=require('./savings-admin-review-db');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/voting-20260915');
const migration='supabase/migrations/20260915000200_voting.sql',source=fs.readFileSync(path.join(root,migration),'utf8'),hash=crypto.createHash('sha256').update(source).digest('hex');
async function main(){fs.mkdirSync(out,{recursive:true});const mode=process.argv[2]||'test';
 if(mode==='test'){
  const result=await query('begin;\n'+body(migration)+'\n'+fs.readFileSync(path.join(root,'scripts/test-voting.sql'),'utf8')+'\nrollback;');
  assert.equal(result[0]?.status,'PASS');fs.writeFileSync(path.join(out,'backend.json'),JSON.stringify({status:'PASS',hash,result,fixturesPersisted:0},null,2));console.log(JSON.stringify({status:'PASS',hash,fixturesPersisted:0}));
 }else if(mode==='apply'){
  assert.equal(JSON.parse(fs.readFileSync(path.join(out,'backend.json'),'utf8')).hash,hash);
  const result=await query('begin;\n'+body(migration)+"\ninsert into supabase_migrations.schema_migrations(version,name,statements) values('20260915000200','voting',array['"+source.replace(/'/g,"''")+"']);select 'PASS' status;commit;");
  fs.writeFileSync(path.join(out,'applied.json'),JSON.stringify({status:'PASS',hash,result},null,2));console.log(JSON.stringify({status:'PASS',version:'20260915000200'}));
 }else throw Error('Unknown mode');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
