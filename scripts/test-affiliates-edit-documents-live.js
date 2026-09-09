'use strict';
// Existing RPCs only, synthetic rows in a transaction that always rolls back.
const fs=require('fs'),path=require('path'),assert=require('assert').strict;
const root=path.resolve(__dirname,'..'),dir=path.join(root,'docs/qa/evidence/affiliates-edit-documents-20260909');
function env(){const out={};for(const line of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m)out[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}return out;}
async function main(){
 const e=env(),ref=new URL(e.SUPABASE_URL).hostname.split('.')[0];
 async function sql(query){const r=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:'Bearer '+e.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query}),signal:AbortSignal.timeout(60000)});const d=await r.json();if(!r.ok)throw Error(JSON.stringify(d));return d;}
 const marker='QA_EDIT_DOC_'+Date.now();
 const query=`begin;
 set local statement_timeout='30s';
 do $test$
 declare actor uuid; target uuid; kind uuid; work jsonb; stamp timestamptz; first_doc uuid; next_doc uuid; object_path text; snapshot jsonb;
 begin
 select aa.auth_user_id into actor from public.admin_assignments aa where aa.enabled
 and exists(select 1 from public.admin_role_permissions p where p.role_id=aa.role_id and p.permission='affiliates.write')
 and exists(select 1 from public.admin_role_permissions p where p.role_id=aa.role_id and p.permission='documents.write') limit 1;
 if actor is null then raise exception 'TEST_ADMIN_MISSING'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 perform set_config('request.jwt.claim.sub',actor::text,true);
 perform set_config('request.jwt.claim.role','authenticated',true);
 set local role authenticated;
 work:=public.create_admin_affiliate(jsonb_build_object('numero_control','${marker}','full_name','Persona de prueba aislada','affiliate_status_raw',(public.list_admin_affiliates(null,null,null,null,null,null,null,1,25,'name')->'filter_options'->'statuses'->>0)),'Prueba aislada con rollback');
 target:=(work->'profile'->>'id')::uuid;stamp:=(work->'profile'->>'updated_at')::timestamptz;
 work:=public.update_admin_affiliate(target,stamp,'{"display_name":"Nombre actualizado","phone_raw":"6620000000","address_raw":"Dirección de prueba"}','Corrección de información de prueba');
 if work->'profile'->>'display_name'<>'Nombre actualizado' or work->'profile'->>'phone_raw'<>'6620000000' then raise exception 'SAVE_READBACK_FAILED';end if;
 if work->'profile'->>'numero_control'<>'${marker}' or work->'profile'->>'auth_user_id' is not null then raise exception 'IDENTITY_CHANGED';end if;
 stamp:=(work->'profile'->>'updated_at')::timestamptz;
 begin perform public.update_admin_affiliate(target,stamp,'{"city_raw":"Test"}','');raise exception 'MISSING_REASON_ACCEPTED';exception when sqlstate '22023' then if sqlerrm<>'AFFILIATE_REASON_REQUIRED' then raise;end if;end;
 begin perform public.update_admin_affiliate(target,stamp-interval '1 second','{"city_raw":"Test"}','Prueba de versión obsoleta');raise exception 'STALE_VERSION_ACCEPTED';exception when sqlstate '40001' or sqlstate 'PT409' then null;end;
 reset role;
 if not exists(select 1 from public.affiliate_admin_events where affiliate_id=target and action='UPDATE') then raise exception 'AUDIT_MISSING';end if;
 select id into kind from public.document_types where enabled and file_upload_allowed and 'application/pdf'=any(accepted_mime_types) order by sort_order limit 1;
 if kind is null then raise exception 'UPLOAD_TYPE_MISSING';end if;
 object_path:='affiliate-documents/'||target::text||'/transaction-fixture.pdf';
 -- Only metadata inside this transaction; no physical Storage object is uploaded.
 insert into storage.objects(bucket_id,name,owner_id,metadata) values('private-assets',object_path,actor::text,'{"mimetype":"application/pdf","size":100}');
 set local role authenticated;
 work:=public.register_admin_affiliate_document(target,kind,object_path,'application/pdf',100,upper(md5('${marker}1')||md5('${marker}2')),'Carga aislada con rollback');
 first_doc:=(work->'document'->>'id')::uuid;
 reset role;
 update public.affiliate_documents set status='VERIFIED',reviewed_by_auth_user_id=actor,reviewed_at=now() where id=first_doc;
 select to_jsonb(d) into snapshot from public.affiliate_documents d where id=first_doc;
 set local role authenticated;
 work:=public.register_admin_affiliate_document(target,kind,object_path,'application/pdf',100,upper(md5('${marker}1')||md5('${marker}2')),'Reemplazo aislado con rollback');
 next_doc:=(work->'document'->>'id')::uuid;
 if next_doc=first_doc or work->'document'->>'replaces_document_id'<>first_doc::text or work->'document'->>'status'<>'PENDING_REVIEW' then raise exception 'REPLACEMENT_FAILED';end if;
 reset role;
 if (select to_jsonb(d) from public.affiliate_documents d where id=first_doc) is distinct from snapshot then raise exception 'VERIFIED_HISTORY_CHANGED';end if;
 if not exists(select 1 from public.sensitive_change_audit where target_id=next_doc and action='ADMIN_REPLACEMENT_UPLOAD') then raise exception 'REPLACEMENT_AUDIT_MISSING';end if;
 perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claims','{"role":"authenticated"}',true);
 set local role authenticated;
 begin perform public.update_admin_affiliate(target,stamp,'{"city_raw":"Test"}','Prueba sin autorización');raise exception 'UNAUTHORIZED_SAVE';exception when sqlstate '42501' then null;end;
 begin perform public.register_admin_affiliate_document(target,kind,object_path,'application/pdf',100,repeat('A',64),'Prueba sin autorización');raise exception 'UNAUTHORIZED_UPLOAD';exception when sqlstate '42501' then null;end;
 reset role;
 end $test$;
 rollback;`;
 await sql(query);
 const remaining=await sql(`select count(*)::int remaining from public.affiliates where numero_control='${marker}'`);
 assert.equal(remaining[0].remaining,0);
 const result={status:'PASS',profileSaveAndReadback:true,requiredReason:true,optimisticConflict:true,identityPreserved:true,documentRegistration:true,verifiedReplacementPreservesHistory:true,audit:true,unauthorizedDenied:true,persistedFixtureRows:0,physicalStorageUploadTested:false,scope:'Existing deployed RPCs under authenticated role, transaction rollback; Storage metadata fixture only'};
 fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'live-result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
