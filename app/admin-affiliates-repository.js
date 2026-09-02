/* Admin Affiliates boundary: UI -> permission-gated RPCs -> public.affiliates. */
(function(){
  'use strict';
  function db(){return window.SutiSupabase.getClient();}
  const MAX_DOCUMENT_SIZE=10*1024*1024;
  function requirePermission(permission){if(!window.AdminRepository||!window.AdminRepository.has(permission))throw new Error('ADMIN_DENIED');}
  function clean(value){return value===undefined||value===''?null:value;}
  function extension(file){const value=String(file&&file.name||'').split('.').pop().toLowerCase();return /^[a-z0-9]{1,8}$/.test(value)?'.'+value:'';}
  function hex(buffer){return Array.from(new Uint8Array(buffer)).map((value)=>value.toString(16).padStart(2,'0')).join('').toUpperCase();}
  async function list(filters){
    requirePermission('affiliates.read');const f=filters||{};
    const archived=f.archived===true;
    const result=archived?await db().rpc('list_admin_archived_affiliates',{
      p_query:clean(f.query),p_page:Number(f.page)||1,p_page_size:Number(f.pageSize)||25,p_sort:f.sort||'recent'
    }):await db().rpc('list_admin_affiliates',{
      p_query:clean(f.query),p_status:clean(f.status),p_auth_linked:f.authLinked===''||f.authLinked===undefined?null:Boolean(f.authLinked),
      p_document_state:clean(f.documentState),p_has_pending_documents:f.pendingDocuments===''||f.pendingDocuments===undefined?null:Boolean(f.pendingDocuments),
      p_union_code:clean(f.unionCode),p_category_code:clean(f.categoryCode),p_page:Number(f.page)||1,p_page_size:Number(f.pageSize)||25,p_sort:f.sort||'name'
    });
    if(result.error)throw result.error;return Object.freeze(result.data||{items:[],total:0,page:1,page_size:25,filter_options:{}});
  }
  async function detail(id){
    requirePermission('affiliates.read');const result=await db().rpc('get_admin_affiliate_workbench',{p_affiliate_id:id});if(result.error)throw result.error;
    const data=result.data||{};
    if(window.AdminRepository.has('documents.read')&&window.DocumentWorkflowRepository){
      const canonical=await window.DocumentWorkflowRepository.listAdminDocuments(id,'ADMIN_AFFILIATE_PROFILE');
      const prior=new Map((data.documents||[]).map((row)=>[row.id,row]));
      const versions=new Map();
      canonical.slice().sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at))).forEach((row)=>{const next=(versions.get(row.document_type_id)||0)+1;versions.set(row.document_type_id,next);versions.set(row.id,next);});
      data.documents=canonical.map((row)=>Object.freeze(Object.assign({},prior.get(row.id)||{},row,{
        type_id:row.document_type_id,type_code:row.document_type.code,type_label:row.document_type.label,
        type_description:row.document_type.description,mime_type:row.mimeType,version:versions.get(row.id)||1
      })));
    }
    return Object.freeze(data);
  }
  async function duplicates(values,excludeId){requirePermission('affiliates.read');const result=await db().rpc('find_admin_affiliate_duplicates',{p_values:values||{},p_exclude_id:excludeId||null});if(result.error)throw result.error;return Object.freeze(result.data||[]);}
  async function create(values,reason){requirePermission('affiliates.write');const result=await db().rpc('create_admin_affiliate',{p_values:values||{},p_reason:String(reason||'').trim()});if(result.error)throw result.error;return Object.freeze(result.data||{});}
  async function update(id,expectedUpdatedAt,patch,reason){requirePermission('affiliates.write');const result=await db().rpc('update_admin_affiliate',{p_affiliate_id:id,p_expected_updated_at:expectedUpdatedAt,p_patch:patch||{},p_reason:String(reason||'').trim()});if(result.error)throw result.error;return Object.freeze(result.data||{});}
  async function changeStatus(id,expectedUpdatedAt,status,reason){requirePermission('affiliates.write');const result=await db().rpc('change_admin_affiliate_status',{p_affiliate_id:id,p_expected_updated_at:expectedUpdatedAt,p_new_status:status,p_reason:String(reason||'').trim()});if(result.error)throw result.error;return Object.freeze(result.data||{});}
  async function archive(id,expectedUpdatedAt,reason){requirePermission('affiliates.write');const result=await db().rpc('archive_admin_affiliate',{p_affiliate_id:id,p_expected_updated_at:expectedUpdatedAt,p_reason:String(reason||'').trim()});if(result.error)throw result.error;return Object.freeze(result.data||{});}
  async function restore(id,expectedUpdatedAt,reason){requirePermission('affiliates.write');const result=await db().rpc('restore_admin_affiliate',{p_affiliate_id:id,p_expected_updated_at:expectedUpdatedAt,p_reason:String(reason||'').trim()});if(result.error)throw result.error;return Object.freeze(result.data||{});}
  async function documentTypes(){requirePermission('documents.write');const result=await db().from('document_types').select('id,code,label,description,accepted_mime_types,file_upload_allowed,max_file_size_bytes,sort_order').eq('enabled',true).eq('file_upload_allowed',true).order('sort_order',{ascending:true});if(result.error)throw result.error;return Object.freeze(result.data||[]);}
  async function previewDocument(documentId,affiliateId){requirePermission('documents.read');if(!window.DocumentWorkflowRepository)throw new Error('DOCUMENT_PREVIEW_UNAVAILABLE');return window.DocumentWorkflowRepository.adminPreview(documentId,affiliateId,'ADMIN_AFFILIATE_PROFILE');}
  async function uploadDocument(affiliateId,type,file,reason){
    requirePermission('documents.write');if(!affiliateId||!type||!file)throw new Error('DOCUMENT_FILE_REQUIRED');
    const accepted=Array.isArray(type.accepted_mime_types)?type.accepted_mime_types:[];
    const limit=Math.min(MAX_DOCUMENT_SIZE,Number(type.max_file_size_bytes)||MAX_DOCUMENT_SIZE);
    if(file.size<1||file.size>limit||!accepted.includes(file.type))throw new Error('INVALID_DOCUMENT_FILE');
    const digest=hex(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()));
    const path='affiliate-documents/'+affiliateId+'/'+crypto.randomUUID()+extension(file);
    const stored=await db().storage.from('private-assets').upload(path,file,{contentType:file.type,upsert:false});if(stored.error)throw stored.error;
    try{
      const result=await db().rpc('register_admin_affiliate_document',{p_affiliate_id:affiliateId,p_document_type_id:type.id,p_storage_path:path,p_mime_type:file.type,p_file_size:file.size,p_sha256:digest,p_reason:String(reason||'').trim()});
      if(result.error)throw result.error;
      const cleanup=result.data&&result.data.cleanup_storage_path;if(cleanup)await db().storage.from('private-assets').remove([cleanup]).catch(()=>{});
      return Object.freeze(result.data&&result.data.document||{});
    }catch(error){await db().storage.from('private-assets').remove([path]).catch(()=>{});throw error;}
  }
  async function profilePhoto(id){if(!window.AdminRepository.has('assets.read')||!window.AffiliateRepository)return null;try{return await window.AffiliateRepository.getProfilePhoto(id);}catch(_){return null;}}
  async function exportXlsx(filters){requirePermission('data_exports.read');const f=filters||{},exportFilters={};if(f.status)exportFilters.affiliate_status_raw=f.status;return window.DataExportRepository.download('affiliates','xlsx',exportFilters,'Afiliados');}
  window.AdminAffiliatesRepository=Object.freeze({list,detail,duplicates,create,update,changeStatus,archive,restore,documentTypes,uploadDocument,previewDocument,profilePhoto,exportXlsx,MAX_DOCUMENT_SIZE});
})();
