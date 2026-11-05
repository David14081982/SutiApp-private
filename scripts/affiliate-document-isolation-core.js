'use strict';
const quote=s=>"'"+String(s).replaceAll("'","''")+"'";
const json=value=>quote(JSON.stringify(value))+'::jsonb';
function switchSQL(plan,items){
 if(!items.length)throw Error('EMPTY_ISOLATION_BATCH');
 return "begin isolation level repeatable read;set local lock_timeout='3s';set local statement_timeout='90s';\n"+
 "lock table public.private_assets,public.affiliate_files,public.affiliate_documents in share row exclusive mode;\n"+
 "do $apply$ declare r jsonb;f jsonb;docs jsonb;source jsonb;begin\n"+
 "if not coalesce(admin_support_private.module_visible("+quote(plan.actorAuthUserId)+"::uuid,'affiliates'),false) then raise exception 'ISOLATION_ACTOR_NOT_AUTHORIZED';end if;\n"+
 "insert into document_isolation_private.batches(id,actor_auth_user_id,reason) values("+quote(plan.id)+"::uuid,"+quote(plan.actorAuthUserId)+"::uuid,'Owner-authorized H-AFFILIATE-DOCUMENT-ISOLATION-001: independent expediente files') on conflict(id) do nothing;\n"+
 "if not exists(select 1 from document_isolation_private.batches where id="+quote(plan.id)+"::uuid and actor_auth_user_id="+quote(plan.actorAuthUserId)+"::uuid) then raise exception 'ISOLATION_BATCH_ACTOR_MISMATCH';end if;\n"+
 "for r in select value from jsonb_array_elements("+json(items)+") loop\n"+
 "if exists(select 1 from document_isolation_private.items where batch_id="+quote(plan.id)+"::uuid and unit_kind=r->>'unit_kind' and unit_id=(r->>'unit_id')::uuid and new_asset_id=(r->>'new_asset_id')::uuid) then continue;end if;\n"+
 "select to_jsonb(p) into source from public.private_assets p where id=(r->'source_asset'->>'id')::uuid;\n"+
 "if source is distinct from r->'source_asset' then raise exception 'ISOLATION_SOURCE_CHANGED';end if;\n"+
 "if r->>'verified_sha256' is distinct from source->>'content_sha256' then raise exception 'ISOLATION_CONTENT_NOT_VERIFIED';end if;\n"+
 "if not exists(select 1 from storage.objects o where bucket_id='private-assets' and name=r->>'new_path' and (metadata->>'size')::bigint=(source->>'file_size')::bigint and metadata->>'mimetype'=source->>'mime_type') then raise exception 'ISOLATION_COPY_UNAVAILABLE';end if;\n"+
 "if r->>'unit_kind'='file' then\n"+
 "select to_jsonb(x) into f from public.affiliate_files x where id=(r->>'unit_id')::uuid;\n"+
 "if f is distinct from r->'before_file' then raise exception 'ISOLATION_FILE_CHANGED';end if;\n"+
 "select coalesce(jsonb_agg(to_jsonb(d) order by d.id),'[]') into docs from public.affiliate_documents d where affiliate_file_id=(r->>'unit_id')::uuid;\n"+
 "else select coalesce(jsonb_agg(to_jsonb(d) order by d.id),'[]') into docs from public.affiliate_documents d where id=(r->>'unit_id')::uuid;end if;\n"+
 "if docs is distinct from r->'before_documents' then raise exception 'ISOLATION_DOCUMENT_CHANGED';end if;\n"+
 "if exists(select 1 from jsonb_array_elements(docs) d where d->>'affiliate_id' is distinct from r->>'affiliate_id') then raise exception 'ISOLATION_CONTEXT_MISMATCH';end if;\n"+
 "insert into public.private_assets(id,asset_key,asset_type,title,storage_bucket,storage_path,mime_type,file_size,content_sha256,status,owner_affiliate_id)\n"+
 "values((r->>'new_asset_id')::uuid,'isolated_'||(r->>'new_asset_id'),source->>'asset_type',source->>'title','private-assets',r->>'new_path',source->>'mime_type',(source->>'file_size')::bigint,source->>'content_sha256',source->>'status',(r->>'affiliate_id')::uuid);\n"+
 "insert into document_isolation_private.items(batch_id,unit_kind,unit_id,affiliate_id,old_asset_id,new_asset_id,before_file,before_documents,source_hash) values("+quote(plan.id)+"::uuid,r->>'unit_kind',(r->>'unit_id')::uuid,(r->>'affiliate_id')::uuid,(source->>'id')::uuid,(r->>'new_asset_id')::uuid,r->'before_file',docs,source->>'content_sha256');\n"+
 "if r->>'unit_kind'='file' then update public.affiliate_files set private_asset_id=(r->>'new_asset_id')::uuid,storage_path=r->>'new_path' where id=(r->>'unit_id')::uuid;end if;\n"+
 "update public.affiliate_documents set private_asset_id=(r->>'new_asset_id')::uuid where id in(select (d->>'id')::uuid from jsonb_array_elements(docs) d) and private_asset_id is not null;\n"+
 "insert into public.sensitive_change_audit(actor_auth_user_id,affiliate_id,resource,action,target_id,metadata) values("+quote(plan.actorAuthUserId)+"::uuid,(r->>'affiliate_id')::uuid,case when r->>'unit_kind'='file' then 'affiliate_files' else 'affiliate_documents' end,'DOCUMENT_ASSET_ISOLATED',(r->>'unit_id')::uuid,jsonb_build_object('batch_id',"+quote(plan.id)+"::uuid,'old_asset_id',source->>'id','new_asset_id',r->>'new_asset_id','reason','Owner-authorized independent expediente storage; original content and history retained'));\n"+
 "end loop;end $apply$;\nselect count(*)::int applied from document_isolation_private.items where batch_id="+quote(plan.id)+"::uuid;commit;\n";
}
module.exports={switchSQL};
