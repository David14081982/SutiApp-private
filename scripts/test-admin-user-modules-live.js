'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {query}=require('./savings-admin-review-db');
const root=path.resolve(__dirname,'..'),name='20260914000200_admin_user_modules';
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const body=file=>{const sql=read(file).trim();assert(sql.startsWith('begin;')&&sql.endsWith('commit;'));return sql.slice(6,-7);};
async function main(){
 const forward=body('supabase/migrations/'+name+'.sql'),recovery=body('supabase/recovery/'+name+'.sql');
 const installed=process.argv.includes('--installed');
 const matrix=await query('begin;'+(installed?'':forward)+read('scripts/test-admin-user-modules.sql')+'rollback;');
 const rollback=installed?'NOT_RUN_INSTALLED':await query('begin;'+forward+recovery+"select 'PASS' as recovery; rollback;");
 const result={status:'PASS',matrix,recovery:rollback,persistedTestMutations:0,installed};
 fs.writeFileSync(path.join(root,'docs/qa/evidence/admin-user-modules-20260914/backend.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
