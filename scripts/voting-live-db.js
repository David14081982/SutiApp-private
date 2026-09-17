'use strict';
// Local management transport only. Never included in the browser artifact.
// Reads supabase.env from SUTIAPP_ENV_FILE or the nearest parent folder (release worktrees live under the workspace).
const fs=require('fs'),path=require('path');
function envFile(){
 if(process.env.SUTIAPP_ENV_FILE)return process.env.SUTIAPP_ENV_FILE;
 for(let dir=path.resolve(__dirname,'..');;dir=path.dirname(dir)){
  const candidate=path.join(dir,'supabase.env');if(fs.existsSync(candidate))return candidate;
  if(path.dirname(dir)===dir)throw Error('SUPABASE_ENV_NOT_FOUND');
 }
}
function env(){
 const values={};
 for(const line of fs.readFileSync(envFile(),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){
  const match=line.match(/^([A-Z0-9_]+)=(.*)$/);if(match)values[match[1]]=match[2].trim().replace(/^['"]|['"]$/g,'');
 }
 return values;
}
async function query(sql){
 const values=env(),ref=new URL(values.SUPABASE_URL).hostname.split('.')[0];
 const response=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{
  method:'POST',headers:{Authorization:`Bearer ${values.SUPABASE_ACCESS_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql}),
 });
 const result=await response.json();if(!response.ok)throw Error(`SQL_${response.status}: ${JSON.stringify(result).slice(0,2400)}`);return result;
}
const body=file=>fs.readFileSync(path.resolve(__dirname,'..',file),'utf8').replace(/^\uFEFF/,'').replace(/^\s*begin;/i,'').replace(/commit;\s*$/i,'');
module.exports={query,body,env};
