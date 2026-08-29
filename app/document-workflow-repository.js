/* Canonical document workflow over private Supabase Storage. */
(function(){
  'use strict';
  const db=()=>window.SutiSupabase.getClient();
  const MAX=10*1024*1024;
  const hex=(buffer)=>Array.from(new Uint8Array(buffer)).map((b)=>b.toString(16).padStart(2,'0')).join('').toUpperCase();
  const ext=(file)=>{const value=String(file.name||'').split('.').pop().toLowerCase();return /^[a-z0-9]{1,8}$/.test(value)?'.'+value:'';};
  async function catalog(filters){const f=filters||{};let q=db().from('document_types').select('id,code,label,description,icon,required_by_default,accepted_mime_types,enabled,sort_order,system_type').order('sort_order',{ascending:true});if(f.includeDisabled!==true)q=q.eq('enabled',true);const r=await q;if(r.error)throw r.error;return Object.freeze(r.data||[]);}
  async function requirements(programId,membershipOfferingId){let q=db().from('program_document_requirements').select('id,program_id,membership_offering_id,document_type_id,required,allow_verified_reuse,sort_order,enabled,document_type:document_types(id,code,label,description,icon,accepted_mime_types)').eq('program_id',programId).eq('enabled',true).order('sort_order',{ascending:true});q=membershipOfferingId?q.eq('membership_offering_id',membershipOfferingId):q.is('membership_offering_id',null);const r=await q;if(r.error)throw r.error;return Object.freeze(r.data||[]);}
  async function list(affiliateId){let q=db().from('affiliate_documents').select('id,affiliate_id,document_type_id,affiliate_file_id,private_asset_id,status,review_observation,reviewed_at,created_at,updated_at,document_type:document_types(id,code,label,description,icon,accepted_mime_types),affiliate_file:affiliate_files(id,private_asset_id,storage_bucket,storage_path,mime_type,sha256),private_asset:private_assets(id,storage_bucket,storage_path,mime_type,content_sha256)');if(affiliateId)q=q.eq('affiliate_id',affiliateId);const r=await q.order('created_at',{ascending:false});if(r.error)throw r.error;const raw=r.data||[],privateRows=raw.map((row)=>({row,asset:row.private_asset||row.affiliate_file})).filter((entry)=>entry.asset&&entry.asset.storage_bucket==='private-assets'),signedByPath=new Map();if(privateRows.length){const paths=Array.from(new Set(privateRows.map((entry)=>entry.asset.storage_path))),signed=await db().storage.from('private-assets').createSignedUrls(paths,300);if(!signed.error)(signed.data||[]).forEach((entry,index)=>{if(entry&&entry.signedUrl)signedByPath.set(paths[index],entry.signedUrl);});}const rows=raw.map((row)=>{const a=row.private_asset||row.affiliate_file,signedUrl=a&&signedByPath.get(a.storage_path)||null;return Object.freeze(Object.assign({},row,{mimeType:a&&a.mime_type,sha256:a&&(a.content_sha256||a.sha256),signedUrl,previewUnavailable:!!(a&&a.storage_bucket==='private-assets'&&!signedUrl)}));});return Object.freeze(rows);}
  async function upload(type,file){if(!type||!file)throw new Error('DOCUMENT_FILE_REQUIRED');if(file.size<1||file.size>MAX||!type.accepted_mime_types.includes(file.type))throw new Error('INVALID_DOCUMENT_FILE');const affiliate=await db().rpc('get_effective_affiliate_id');if(affiliate.error||!affiliate.data)throw affiliate.error||new Error('AFFILIATE_REQUIRED');const sha=hex(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()));const path='affiliate-documents/'+affiliate.data+'/'+crypto.randomUUID()+ext(file);const stored=await db().storage.from('private-assets').upload(path,file,{contentType:file.type,upsert:false});if(stored.error)throw stored.error;try{const r=await db().rpc('register_affiliate_document',{p_document_type_id:type.id,p_storage_path:path,p_mime_type:file.type,p_file_size:file.size,p_sha256:sha});if(r.error)throw r.error;return r.data;}catch(error){await db().storage.from('private-assets').remove([path]).catch(()=>{});throw error;}}
  async function review(id,status,observation){const r=await db().rpc('review_affiliate_document',{p_document_id:id,p_status:status,p_observation:observation||null});if(r.error)throw r.error;return r.data;}
  const reviewFields='id,affiliate_id,document_type_id,status,review_observation,reviewed_at,created_at,updated_at,document_type:document_types(id,code,label,icon),affiliate:affiliates(display_name,full_name,numero_control),affiliate_file:affiliate_files(id,private_asset_id,mime_type),private_asset:private_assets(id,mime_type)';
  const previewFields='id,affiliate_id,document_type_id,status,review_observation,reviewed_at,created_at,updated_at,document_type:document_types(id,code,label,icon),affiliate:affiliates(display_name,full_name,numero_control),affiliate_file:affiliate_files(id,private_asset_id,storage_bucket,storage_path,mime_type,sha256),private_asset:private_assets(id,storage_bucket,storage_path,mime_type,content_sha256)';
  async function reviewPreview(id){
    const r=await db().from('affiliate_documents').select(previewFields).eq('id',id).single();
    if(r.error)throw r.error;
    const row=r.data,asset=row.private_asset||row.affiliate_file;
    let signedUrl=null,previewUnavailable=false;
    if(asset&&asset.storage_bucket==='private-assets'){
      const signed=await db().storage.from(asset.storage_bucket).createSignedUrl(asset.storage_path,300);
      signedUrl=!signed.error&&signed.data&&signed.data.signedUrl||null;
      previewUnavailable=!signedUrl;
    }
    return Object.freeze(Object.assign({},row,{signedUrl,mimeType:asset&&asset.mime_type,previewUnavailable}));
  }
  async function reviewQueue(options){
    const settings=options||{};
    const r=await db().from('affiliate_documents').select(reviewFields).in('status',['PENDING_REVIEW','UNDER_REVIEW','REUPLOAD_REQUIRED']).order('created_at',{ascending:true}).limit(100);
    if(r.error)throw r.error;
    const metadata=(r.data||[]).map((row)=>Object.freeze(Object.assign({},row,{signedUrl:null,mimeType:(row.private_asset||row.affiliate_file||{}).mime_type||null})));
    if(settings.includePreviews!==true)return Object.freeze(metadata);
    return Object.freeze(await Promise.all(metadata.map((row)=>reviewPreview(row.id))));
  }
  async function saveRequirement(row){const r=await db().rpc('save_program_document_requirement',{p_program_id:row.program_id,p_membership_offering_id:row.membership_offering_id||null,p_document_type_id:row.document_type_id,p_required:row.required!==false,p_allow_reuse:row.allow_verified_reuse!==false,p_sort_order:Number(row.sort_order),p_enabled:row.enabled!==false});if(r.error)throw r.error;return r.data;}
  async function saveType(row){const values={code:String(row.code||'').trim().toLowerCase(),label:String(row.label||'').trim(),description:String(row.description||''),icon:row.icon||'doc',required_by_default:!!row.required_by_default,accepted_mime_types:row.accepted_mime_types,enabled:row.enabled!==false,sort_order:Number(row.sort_order),system_type:!!row.system_type};let q=row.id?db().from('document_types').update(values).eq('id',row.id):db().from('document_types').insert(values);const r=await q.select().single();if(r.error)throw r.error;return r.data;}
  async function removeType(id){const r=await db().from('document_types').delete().eq('id',id).select('id');if(r.error)throw r.error;if(!r.data||r.data.length!==1)throw new Error('DOCUMENT_TYPE_DELETE_DENIED');}
  async function attach(requestId,ids){const r=await db().rpc('attach_request_documents',{p_request_id:requestId,p_affiliate_document_ids:ids});if(r.error)throw r.error;return r.data;}
  window.DocumentWorkflowRepository=Object.freeze({catalog,requirements,list,upload,review,reviewQueue,reviewPreview,saveType,removeType,saveRequirement,attach,MAX_FILE_SIZE:MAX});
})();
