'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),cat=JSON.parse(fs.readFileSync(path.join(root,'scripts/fixtures/affiliate-document-isolation-schema.json'),'utf8').replace(/^\uFEFF/,''));
const version='20261105000100',name='affiliate_document_isolation',target=path.join(root,'supabase/migrations/'+version+'_'+name+'.sql');
const selected=['register_admin_affiliate_document','register_affiliate_document','set_self_profile_photo'].map(n=>cat.functions.find(f=>f.name===n));
let sql=fs.readFileSync(target,'utf8').replace(/^\uFEFF/,'').split('-- GENERATED_WRITERS')[0]+'-- GENERATED_WRITERS\n';
for(const f of selected){
 let def=f.definition;const owner=f.name==='register_admin_affiliate_document'?'p_affiliate_id':f.name==='register_affiliate_document'?'v_affiliate':'v_affiliate.id';
 const isProfile=f.name==='set_self_profile_photo';
 const start=def.indexOf('  select * into v_asset from public.private_assets where content_sha256=upper(p_sha256)');
 const end=def.indexOf(isProfile?'  select id into v_previous':'  update public.affiliate_documents',start);assert(start>0&&end>start);
 const insert=isProfile
 ? "  insert into public.private_assets(asset_key,asset_type,title,storage_bucket,storage_path,mime_type,file_size,content_sha256,owner_affiliate_id)\n  values('profile_photo_'||extensions.gen_random_uuid()::text,'AFFILIATE_DOCUMENT','Foto de perfil','private-assets',p_storage_path,p_mime_type,p_file_size,upper(p_sha256),v_affiliate.id) returning * into v_asset;\n"
 : "  insert into public.private_assets(asset_key,asset_type,title,storage_bucket,storage_path,mime_type,file_size,content_sha256,owner_affiliate_id)\n  values('affiliate_document_'||replace(extensions.gen_random_uuid()::text,'-',''),'AFFILIATE_DOCUMENT',v_type.label,'private-assets',v_path,p_mime_type,p_file_size,upper(p_sha256),"+owner+") returning * into v_asset;\n";
 def=def.slice(0,start)+insert+def.slice(end);
 if(!isProfile){
 const anchor='  select d.id into v_replaced',ret=f.name==='register_admin_affiliate_document'?"jsonb_build_object('document',to_jsonb(v_doc),'cleanup_storage_path',null)":"v_doc";
 const retry="  perform 1 from storage.objects where bucket_id='private-assets' and name=v_path and owner_id=auth.uid()::text for update;\n  select d.* into v_doc from public.affiliate_documents d join public.private_assets a on a.id=d.private_asset_id where a.storage_bucket='private-assets' and a.storage_path=v_path and a.owner_affiliate_id="+owner+" and d.affiliate_id="+owner+" and d.document_type_id=p_document_type_id and a.content_sha256=upper(p_sha256) and a.mime_type=p_mime_type and a.file_size=p_file_size and public.affiliate_document_is_active(d.id);\n  if v_doc.id is not null then return "+ret+";end if;\n";
 assert(def.includes(anchor));def=def.replace(anchor,retry+anchor);
 }
 assert(!def.includes('where content_sha256=upper(p_sha256)'));
 sql+="\ndo $check$ begin if md5(pg_get_functiondef('"+f.signature+"'::regprocedure))<>'"+f.md5+"' then raise exception 'ISOLATION_BASE_DRIFT:"+f.name+"';end if;end $check$;\n";
 sql+="insert into document_isolation_private.function_backup(signature,definition) select '"+f.signature+"',pg_get_functiondef('"+f.signature+"'::regprocedure);\n"+def+";\n";
 sql+="update document_isolation_private.function_backup set applied_md5=md5(pg_get_functiondef(signature::regprocedure)) where signature='"+f.signature+"';\n";
}
fs.writeFileSync(target,sql+'\ncommit;\n');
console.log(JSON.stringify({migration:version,changedFunctions:selected.map(f=>f.signature),existingBusinessDml:0}));
