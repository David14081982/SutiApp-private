'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const queryModule=fs.existsSync(path.join(root,'supabase.env'))?'./savings-admin-review-db':path.resolve(root,'../../../scripts/savings-admin-review-db');
const {query}=require(queryModule);
const envPath=fs.existsSync(path.join(root,'supabase.env'))?path.join(root,'supabase.env'):path.resolve(root,'../../../supabase.env');
const env={};for(const line of fs.readFileSync(envPath,'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m)env[m[1]]=m[2].trim().replace(/^["']|["']$/g,'');}
const body=file=>fs.readFileSync(path.join(root,file),'utf8').replace(/^\s*begin;\s*/i,'').replace(/\s*commit;\s*$/i,'');
const q=value=>"'"+String(value).replaceAll("'","''")+"'";
(async()=>{
 const installed=(await query(`select md5(pg_get_functiondef('farma_private.allowed(text)'::regprocedure)) hash`))[0].hash==='203f45e4175597e8b0738c6dc8e02641';
 const sql=`begin;
 ${installed?'':body('supabase/migrations/20260928000700_sutifarma_assisted_admin.sql')}
 do $test$ declare actor uuid; target uuid; affiliate uuid; context jsonb; denied boolean:=false; begin
  select id into actor from auth.users where lower(email)=lower(${q(env.H005_TEST_EMAIL)});
  select id into target from auth.users where lower(email)='marianafrancoq32@gmail.com';
  select id into affiliate from public.affiliates where auth_user_id=target and not is_archived;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','session_id','farma-assisted-rollback')::text,true);
  perform public.start_affiliate_impersonation(affiliate,'Rollback-only Farma assisted verification');
  context:=public.get_admin_access_context();
  if context->'module_keys'<>'["farma"]'::jsonb or not public.has_admin_permission('program_catalog.read') then raise exception 'FARMA_ASSISTED_CONTEXT_MISMATCH'; end if;
  if jsonb_array_length(public.farma_command('INVENTORY','{}'))<>50 then raise exception 'FARMA_ASSISTED_INVENTORY_MISMATCH'; end if;
  if not farma_private.allowed('update') then raise exception 'FARMA_ASSISTED_WRITE_CAPABILITY_MISSING'; end if;
 end $test$;
 ${installed?'':body('supabase/recovery/20260928000700_sutifarma_assisted_admin.sql')}
 ${installed?'':`
 do $recovered$ declare denied boolean:=false; begin
  begin perform public.farma_command('INVENTORY','{}'); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'FARMA_ASSISTED_RECOVERY_DID_NOT_RESTORE_DENIAL'; end if;
 end $recovered$;
 `}
 rollback;`;
 const rows=await query(sql);assert(Array.isArray(rows));
 console.log(JSON.stringify({status:'PASS',mode:installed?'APPLIED_POSTFLIGHT':'FORWARD_RECOVERY',assistedModules:['farma'],inventoryCount:50,writeCapability:true,recovery:installed?'PREAPPLY_PASS':'PASS',persistentWrites:0}));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
