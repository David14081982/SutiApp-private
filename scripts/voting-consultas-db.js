'use strict';
// Local management transport only (direct Postgres over verified TLS). Never included in the browser artifact.
// supabase.env: SUTIAPP_ENV_FILE or the nearest parent folder. pg module and Supabase CA: SUTIAPP_PG_DIR or the nearest
// parent .tmp/inversores (release worktrees live under the workspace). Read-only unless {write:true}. Never prints rows.
const fs=require('fs'),path=require('path');
function up(relative){
 for(let dir=path.resolve(__dirname,'..');;dir=path.dirname(dir)){
  const candidate=path.join(dir,relative);if(fs.existsSync(candidate))return candidate;
  if(path.dirname(dir)===dir)throw Error('NOT_FOUND:'+relative);
 }
}
function env(){
 const values={},file=process.env.SUTIAPP_ENV_FILE||up('supabase.env');
 for(const line of fs.readFileSync(file,'utf8').replace(/^﻿/,'').split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m)values[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}
 return values;
}
async function query(sql,{write=false}={}){
 const values=env(),dir=process.env.SUTIAPP_PG_DIR||up('.tmp/inversores');
 const {Client}=require(path.join(dir,'deps/node_modules/pg')),ref=new URL(values.SUPABASE_URL).hostname.split('.')[0];
 const client=new Client({host:'db.'+ref+'.supabase.co',port:5432,user:'postgres',database:'postgres',password:values.SUPABASE_DB_PASSWORD,
  ssl:{rejectUnauthorized:true,ca:fs.readFileSync(path.join(dir,'prod-ca-2021.crt'),'utf8')},connectionTimeoutMillis:15000,query_timeout:180000});
 await client.connect();
 try{
  if(!write)await client.query('set default_transaction_read_only=on');
  const result=await client.query(sql);
  return (Array.isArray(result)?result:[result]).flatMap(r=>r.rows||[]);
 }catch(error){
  // An aborted multi-statement transaction is rolled back explicitly before the connection closes.
  try{await client.query('rollback');}catch(_){}
  throw error;
 }finally{await client.end();}
}
const body=file=>fs.readFileSync(path.resolve(__dirname,'..',file),'utf8').replace(/^﻿/,'').replace(/\r\n/g,'\n').replace(/^\s*begin;/i,'').replace(/commit;\s*$/i,'');
module.exports={query,body,env};
