/* Admin Affiliates boundary: UI -> permission-gated RPCs -> public.affiliates. */
(function(){
  'use strict';
  function db(){return window.SutiSupabase.getClient();}
  function requirePermission(permission){if(!window.AdminRepository||!window.AdminRepository.has(permission))throw new Error('ADMIN_DENIED');}
  function clean(value){return value===undefined||value===''?null:value;}
  async function list(filters){
    requirePermission('affiliates.read');const f=filters||{};
    const result=await db().rpc('list_admin_affiliates',{
      p_query:clean(f.query),p_status:clean(f.status),p_auth_linked:f.authLinked===''||f.authLinked===undefined?null:Boolean(f.authLinked),
      p_document_state:clean(f.documentState),p_has_pending_documents:f.pendingDocuments===''||f.pendingDocuments===undefined?null:Boolean(f.pendingDocuments),
      p_union_code:clean(f.unionCode),p_category_code:clean(f.categoryCode),p_page:Number(f.page)||1,p_page_size:Number(f.pageSize)||25,p_sort:f.sort||'name'
    });
    if(result.error)throw result.error;return Object.freeze(result.data||{items:[],total:0,page:1,page_size:25,filter_options:{}});
  }
  async function detail(id){requirePermission('affiliates.read');const result=await db().rpc('get_admin_affiliate_workbench',{p_affiliate_id:id});if(result.error)throw result.error;return Object.freeze(result.data||{});}
  async function duplicates(values,excludeId){requirePermission('affiliates.read');const result=await db().rpc('find_admin_affiliate_duplicates',{p_values:values||{},p_exclude_id:excludeId||null});if(result.error)throw result.error;return Object.freeze(result.data||[]);}
  async function create(values,reason){requirePermission('affiliates.write');const result=await db().rpc('create_admin_affiliate',{p_values:values||{},p_reason:String(reason||'').trim()});if(result.error)throw result.error;return Object.freeze(result.data||{});}
  async function update(id,expectedUpdatedAt,patch,reason){requirePermission('affiliates.write');const result=await db().rpc('update_admin_affiliate',{p_affiliate_id:id,p_expected_updated_at:expectedUpdatedAt,p_patch:patch||{},p_reason:String(reason||'').trim()});if(result.error)throw result.error;return Object.freeze(result.data||{});}
  async function changeStatus(id,expectedUpdatedAt,status,reason){requirePermission('affiliates.write');const result=await db().rpc('change_admin_affiliate_status',{p_affiliate_id:id,p_expected_updated_at:expectedUpdatedAt,p_new_status:status,p_reason:String(reason||'').trim()});if(result.error)throw result.error;return Object.freeze(result.data||{});}
  async function profilePhoto(id){if(!window.AdminRepository.has('assets.read')||!window.AffiliateRepository)return null;try{return await window.AffiliateRepository.getProfilePhoto(id);}catch(_){return null;}}
  async function exportXlsx(filters){requirePermission('data_exports.read');const f=filters||{},exportFilters={};if(f.status)exportFilters.affiliate_status_raw=f.status;return window.DataExportRepository.download('affiliates','xlsx',exportFilters,'Afiliados');}
  window.AdminAffiliatesRepository=Object.freeze({list,detail,duplicates,create,update,changeStatus,profilePhoto,exportXlsx});
})();
