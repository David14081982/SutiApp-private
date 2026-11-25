'use strict';
// Local operational helpers. Credentials and private verification artifacts never enter the site.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'../..');
function environment(){const env={};for(const line of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m)env[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}return env;}
function connection(env,{readonly=true}={}){const{Client}=require(process.env.SUTIAPP_PG_PATH||path.join(root,'.tmp/document-architecture-lab/deps/node_modules/pg'));return new Client({host:'db.'+new URL(env.SUPABASE_URL).hostname.split('.')[0]+'.supabase.co',port:5432,user:'postgres',database:'postgres',password:env.SUPABASE_DB_PASSWORD,ssl:{rejectUnauthorized:true,ca:fs.readFileSync(process.env.SUTIAPP_PG_CA||path.join(root,'.tmp/inversores/prod-ca-2021.crt'),'utf8')},options:'-c default_transaction_read_only='+(readonly?'on':'off')+' -c statement_timeout=60000',connectionTimeoutMillis:15000});}
module.exports={fs,path,root,environment,connection,sha:value=>crypto.createHash('sha256').update(value).digest('hex')};
