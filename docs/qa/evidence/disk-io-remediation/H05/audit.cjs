'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto');
const base=require('../H04/audit.cjs'),{env,raw,query}=base;
const dir=__dirname,save=(name,value)=>fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify(value,null,2)+'\n');
const catalog={
 functions:base.catalog.functions,
 policies:base.catalog.policies,
 tables:"select c.relname,c.relrowsecurity,c.relforcerowsecurity,c.relowner::regrole::text owner,c.relacl::text acl from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname like 'savings_%' order by 1",
 columns:"select table_name,column_name,data_type,udt_name,is_nullable,column_default from information_schema.columns where table_schema='public' and table_name like 'savings_%' order by table_name,ordinal_position",
 constraints:"select conrelid::regclass::text relation,conname,contype,pg_get_constraintdef(oid) definition from pg_constraint where connamespace='public'::regnamespace and conrelid::regclass::text like 'savings_%' order by 1,2",
 indexes:"select i.tablename,i.indexname,i.indexdef,x.indisvalid,x.indisready from pg_indexes i join pg_class c on c.relname=i.indexname join pg_namespace n on n.oid=c.relnamespace and n.nspname=i.schemaname join pg_index x on x.indexrelid=c.oid where i.schemaname='public' and i.tablename like 'savings_%' order by 1,2",
 triggers:"select t.tgrelid::regclass::text relation,t.tgname,pg_get_triggerdef(t.oid) definition from pg_trigger t where not t.tgisinternal and t.tgrelid::regclass::text like 'savings_%' order by 1,2",
};
async function baseline(){
 if(fs.existsSync(dir+'/BASELINE.json'))throw Error('BASELINE_ALREADY_CAPTURED');
 const hashes={};for(const f of new Set(cp.execFileSync('git',['ls-files','-co','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean))){if(f.startsWith('docs/qa/evidence/disk-io-remediation/H05/'))continue;try{hashes[f]=crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');}catch(_){}}
 save('workspace-before',{at:new Date().toISOString(),hashes});
 const data={at:new Date().toISOString()};for(const [key,sql]of Object.entries(catalog)){data[key]=await query(sql);console.log(key+': '+data[key].length);}
 save('BASELINE',data);
 for(const f of ['app/savings-repository.js','app/savings-store.jsx']){const name=path.basename(f);fs.mkdirSync(dir+'/before/workspace',{recursive:true});fs.mkdirSync(dir+'/before/published',{recursive:true});fs.copyFileSync(f,dir+'/before/workspace/'+name);fs.writeFileSync(dir+'/before/published/'+name,cp.execFileSync('git',['show','19eb53d:'+f]));}
}
if(require.main===module)baseline().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={env,raw,query,dir,save,catalog,planSummary:base.planSummary};
