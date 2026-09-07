'use strict';
// Local management transport only. Never included in the browser artifact.
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
async function query(sql){
 const env={};
 for(const line of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){
  const match=line.match(/^([A-Z0-9_]+)=(.*)$/);if(match)env[match[1]]=match[2].trim().replace(/^['"]|['"]$/g,'');
 }
 const ref=new URL(env.SUPABASE_URL).hostname.split('.')[0];
 const response=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{
  method:'POST',headers:{Authorization:`Bearer ${env.SUPABASE_ACCESS_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql}),
 });
 const result=await response.json();if(!response.ok)throw Error(`SQL_${response.status}: ${JSON.stringify(result).slice(0,1400)}`);return result;
}
const body=file=>fs.readFileSync(path.join(root,file),'utf8').replace(/^\s*begin;/i,'').replace(/commit;\s*$/i,'');
module.exports={query,body};
