/* H-008/H-009 Supabase Auth + RLS boundary for technical administration. */
(function () {
  'use strict';
  const listeners = new Set();
  let state = Object.freeze({ phase: 'loading', assignment: null, errorCode: null });
  let promise = null;
  const assetFields = 'id,asset_key,storage_bucket,storage_path,mime_type,alt_text,status';
  const managed = Object.freeze({
    banners: { table:'banners',section:'banners',permission:'banners.write',origin:'ADMIN_H009',fields:`id,placement,title,description,action_label,action_url,company_raw,category_raw,image_asset_id,enabled,start_at,end_at,sort_order,record_origin,image_asset:app_assets!image_asset_id(${assetFields})`,editable:['placement','title','description','action_label','action_url','company_raw','category_raw','image_asset_id','enabled','start_at','end_at','sort_order'] },
    popups: { table:'popups',section:'popups',permission:'popups.write',origin:'ADMIN_H009',fields:`id,title,body,image_asset_id,action_label,action_url,audience_raw,enabled,start_at,end_at,sort_order,record_origin,image_asset:app_assets!image_asset_id(${assetFields})`,editable:['title','body','image_asset_id','action_label','action_url','audience_raw','enabled','start_at','end_at','sort_order'] },
    companies: { table:'companies',section:'companies',permission:'companies.write',origin:'ADMIN_H009',fields:`id,display_name,description,logo_asset_id,enabled,sort_order,record_origin,logo_asset:app_assets!logo_asset_id(${assetFields}),company_assets(role,sort_order,asset:app_assets!asset_id(${assetFields}))`,editable:['display_name','description','logo_asset_id','enabled','sort_order'] },
    documents: { table:'institutional_documents',section:'documents',permission:'documents.write',origin:'ADMIN_H009',fields:`id,kind,title,description,image_asset_id,document_asset_id,enabled,sort_order,record_origin,image_asset:app_assets!institutional_documents_image_asset_id_fkey(${assetFields}),document_asset:app_assets!institutional_documents_document_asset_id_fkey(${assetFields})`,editable:['kind','title','description','image_asset_id','document_asset_id','enabled','sort_order'] },
    minutes: { table:'minutes',section:'minutes',permission:'documents.write',origin:'ADMIN_SECTION_ROLLOUT',fields:`id,title,description,source_date_raw,published_on,sort_order,image_asset_id,document_asset_id,enabled,record_origin,image_asset:app_assets!minutes_image_asset_id_fkey(${assetFields}),document_asset:app_assets!minutes_document_asset_id_fkey(${assetFields})`,editable:['title','description','source_date_raw','published_on','sort_order','image_asset_id','document_asset_id','enabled'] },
    programs: { table:'institutional_programs',section:'programs',permission:'documents.write',origin:'ADMIN_SECTION_ROLLOUT',fields:`id,category,description,phone_raw,whatsapp_raw,facebook_url,instagram_url,share_url,location_raw,whatsapp_url,tiktok_url,sort_order,primary_image_asset_id,enabled,record_origin,primary_image_asset:app_assets!institutional_programs_primary_image_asset_id_fkey(${assetFields})`,editable:['category','description','phone_raw','whatsapp_raw','facebook_url','instagram_url','share_url','location_raw','whatsapp_url','tiktok_url','sort_order','primary_image_asset_id','enabled'] },
    directory: { table:'directory_members',section:'documents',permission:'documents.write',origin:'ADMIN_SECTION_ROLLOUT',fields:`id,name,role,sort_order,image_asset_id,enabled,record_origin,image_asset:app_assets!image_asset_id(${assetFields})`,editable:['name','role','sort_order','image_asset_id','enabled'] },
    news: { table:'news_articles',section:'news',permission:'news.write',origin:'ADMIN_PHASE2',fields:`id,title,tag,body,image_asset_id,accent_hue,display_date,reading_minutes,published,publish_from,publish_until,sort_order,record_origin,image_asset:app_assets!image_asset_id(${assetFields})`,editable:['title','tag','body','image_asset_id','accent_hue','display_date','reading_minutes','published','publish_from','publish_until','sort_order'] },
    education: { table:'educational_resources',section:'education',permission:'content.write',origin:'ADMIN_PHASE2',fields:`id,resource_kind,title,description,image_asset_id,document_asset_id,external_url,published,sort_order,provenance,image_asset:app_assets!image_asset_id(${assetFields}),document_asset:app_assets!document_asset_id(${assetFields})`,editable:['resource_kind','title','description','image_asset_id','document_asset_id','external_url','published','sort_order'] },
  });

  function client() { return window.SutiSupabase.getClient(); }
  function publish(next) { state = Object.freeze(Object.assign({ phase:'denied', assignment:null, errorCode:null }, next)); listeners.forEach((fn)=>fn(state)); }
  function technical(permission) { return state.phase === 'authorized' && state.assignment.permissions.includes(permission); }
  function sectionAction(section,action) { return state.phase === 'authorized' && state.assignment.sectionActions.some((x)=>x.section_key===section&&x.action===action); }
  function has(permission) {
    if(state.phase!=='authorized')return false;
    if(technical(permission))return true;
    const match=/^(news|education|tutorials|companies|agreements|banners|popups|documents|minutes|programs|marketplace)\.(read|create|update|delete|publish|order|assets)$/.exec(permission);
    if(match){const fallback={news:'news',education:'content',tutorials:'content',companies:'companies',agreements:'companies',banners:'banners',popups:'popups',documents:'documents',minutes:'documents',programs:'documents',marketplace:'marketplace'}[match[1]];return technical(fallback+'.write')||technical(fallback+'.read')&&match[2]==='read'||sectionAction(match[1],match[2]);}
    return false;
  }
  function requirePermission(permission) { if (!has(permission)) throw new Error('ADMIN_DENIED'); }
  function requireAny(permissions){if(!permissions.some(has))throw new Error('ADMIN_DENIED');}
  function clean(row, keys) { const out={}; keys.forEach((key)=>{ if (Object.prototype.hasOwnProperty.call(row,key)) out[key]=row[key] === '' ? null : row[key]; }); return out; }
  function url(asset) { return window.AssetRepository.publicUrl(asset); }
  function project(kind,row) {
    if (kind==='companies') {
      const links=(row.company_assets||[]).slice().sort((a,b)=>a.sort_order-b.sort_order);
      const cover=links.find((x)=>x.role==='cover');
      return Object.assign({},row,{logo_url:url(row.logo_asset),cover_url:cover?url(cover.asset):null});
    }
    if (kind==='documents'||kind==='minutes') return Object.assign({},row,{image_url:url(row.image_asset),document_url:url(row.document_asset)});
    if (kind==='programs') return Object.assign({},row,{title:row.category,image_url:url(row.primary_image_asset)});
    if (kind==='directory') return Object.assign({},row,{title:row.name,image_url:url(row.image_asset)});
    if (kind==='news') return Object.assign({},row,{hue:row.accent_hue,date:row.display_date||'',read:row.reading_minutes?String(row.reading_minutes)+' min':'',visible:row.published,image_url:url(row.image_asset)});
    if (kind==='education') return Object.assign({},row,{image_url:url(row.image_asset),document_url:url(row.document_asset)});
    return Object.assign({},row,{image_url:url(row.image_asset)});
  }

  async function load() {
    try {
      const result=await client().rpc('get_admin_access_context');
      if(result.error) throw result.error;
      const context=result.data||{};const permissions=context.technical_permissions||[];const sectionActions=context.section_actions||[];
      publish(permissions.length||sectionActions.length?{phase:'authorized',assignment:Object.freeze({permissions:Object.freeze(permissions),sectionActions:Object.freeze(sectionActions)})}:{phase:'denied'});
    } catch(_){ publish({phase:'error',errorCode:'ADMIN_AUTHORITY_ERROR'}); }
    return state;
  }
  function bootstrap(){if(!promise)promise=load();return promise;}
  function retry(){promise=null;publish({phase:'loading'});return bootstrap();}
  function subscribe(fn){listeners.add(fn);fn(state);return()=>listeners.delete(fn);}

  async function updateSettings(values){
    requirePermission('assets.write');
    const allowed=['app_name','short_name','description','app_icon_asset_id','institutional_seal_asset_id','favicon_asset_id','apple_touch_asset_id','pwa_icon_192_asset_id','pwa_icon_512_asset_id','pwa_maskable_512_asset_id','install_screen_1_asset_id','install_screen_2_asset_id','install_screen_3_asset_id'];
    const result=await client().from('app_settings').update(clean(values,allowed)).eq('id','primary').select('id').single();
    if(result.error)throw result.error;return result.data;
  }

  function fileContract(file,bucket){
    const images={'image/png':'png','image/jpeg':'jpg','image/gif':'gif','image/webp':'webp','image/svg+xml':'svg','image/x-icon':'ico'};
    const allowed=bucket==='documents'?{'application/pdf':'pdf'}:images;
    const limit=bucket==='documents'?52428800:10485760;
    if(!file||!allowed[file.type]||file.size<1||file.size>limit)throw new Error('INVALID_ASSET');
    return allowed[file.type];
  }
  async function digestOf(file){const bytes=await file.arrayBuffer();return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map((x)=>x.toString(16).padStart(2,'0')).join('');}
  async function normalizedPng(file,size,errorCode='INVALID_PWA_ICON'){
    if(!file||!file.type.startsWith('image/'))throw new Error(errorCode);
    const bitmap=await createImageBitmap(file);
    try{
      if(bitmap.width!==bitmap.height||bitmap.width<size)throw new Error(errorCode);
      const canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;
      const context=canvas.getContext('2d',{alpha:true});if(!context)throw new Error('ICON_NORMALIZATION_FAILED');
      context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';context.clearRect(0,0,size,size);context.drawImage(bitmap,0,0,size,size);
      const blob=await new Promise((resolve)=>canvas.toBlob(resolve,'image/png'));
      if(!blob)throw new Error('ICON_NORMALIZATION_FAILED');
      return new File([blob],`sutiapp-icon-${size}.png`,{type:'image/png',lastModified:Date.now()});
    }finally{if(bitmap.close)bitmap.close();}
  }
  async function removeUnlinkedObject(db,bucket,path){
    const refs=await db.from('app_assets').select('id',{count:'exact',head:true}).eq('storage_bucket',bucket).eq('storage_path',path);
    if(!refs.error&&refs.count===0)await db.storage.from(bucket).remove([path]);
  }
  async function registerBrandingFiles(entries){
    const db=client();const uploaded=[];
    try{
      for(const entry of entries){
        const ext=fileContract(entry.file,'app-assets');const digest=await digestOf(entry.file);const safeKey=entry.assetKey.replace(/[^a-zA-Z0-9._-]/g,'-');const path=`branding/admin/${safeKey}/${digest}.${ext}`;
        const stored=await db.storage.from('app-assets').upload(path,entry.file,{upsert:true,contentType:entry.file.type});if(stored.error)throw stored.error;
        uploaded.push({asset_key:entry.assetKey,storage_path:path,mime_type:entry.file.type,file_size:entry.file.size,content_sha256:digest.toUpperCase()});
      }
      const registered=await db.rpc('register_branding_assets',{p_assets:uploaded});if(registered.error)throw registered.error;
      for(const previous of registered.data||[]){
        const current=uploaded.find((entry)=>entry.asset_key===previous.asset_key);
        if(previous.previous_storage_bucket&&previous.previous_storage_path&&current&&previous.previous_storage_path!==current.storage_path){
          await removeUnlinkedObject(db,previous.previous_storage_bucket,previous.previous_storage_path);
        }
      }
      return Object.freeze(registered.data||[]);
    }catch(error){
      for(const entry of uploaded)await removeUnlinkedObject(db,'app-assets',entry.storage_path);
      throw error;
    }
  }
  async function uploadManagedAsset(file,bucket,assetType,purpose){
    const section=String(purpose||'').split('.')[0];const sectionAsset=/^(news|education|tutorials|companies|banners|popups|documents|minutes|programs|marketplace|directory|sindicato)$/.test(section);
    const permission=bucket==='company-assets'?'companies.write':bucket==='documents'?'documents.write':'assets.write';
    if(section==='directory')requirePermission('documents.assets');
    else if(section==='sindicato')requirePermission('union_content.write');
    else if(sectionAsset)requirePermission(section+'.assets');
    else{requirePermission(permission);requirePermission('assets.write');}
    const ext=fileContract(file,bucket); const digest=await digestOf(file);const db=client();
    let path=`admin/${digest}.${ext}`;
    if(sectionAsset){const user=await db.auth.getUser();if(user.error||!user.data.user)throw user.error||new Error('AUTH_REQUIRED');path=`${section}/${user.data.user.id}/${digest}.${ext}`;}
    const existing=await db.from('app_assets').select(assetFields).eq('storage_bucket',bucket).eq('storage_path',path).maybeSingle();
    if(existing.error)throw existing.error;
    if(existing.data){
      if(existing.data.status!=='READY'){const ready=await db.from('app_assets').update({status:'READY'}).eq('id',existing.data.id);if(ready.error)throw ready.error;existing.data.status='READY';}
      return Object.freeze({id:existing.data.id,bucket,path,created:false,url:url(existing.data)});
    }
    const upload=await db.storage.from(bucket).upload(path,file,{upsert:false,contentType:file.type});
    if(upload.error)throw upload.error;
    let assetId=null;
    try{
      const key=`${sectionAsset?'admin.section':'admin.h009'}.${purpose}.${crypto.randomUUID()}`;
      const saved=await db.from('app_assets').insert({asset_key:key,asset_type:assetType,title:purpose,alt_text:purpose.replaceAll('.',' '),storage_bucket:bucket,storage_path:path,mime_type:file.type,file_size:file.size,content_sha256:digest.toUpperCase(),status:'READY'}).select('id').single();
      if(saved.error)throw saved.error;assetId=saved.data.id;
      const source=await db.from('asset_sources').insert({asset_id:assetId,source_sheet:sectionAsset?'ADMIN_SECTION_OWNER':'ADMIN_H009',source_column:purpose,source_snapshot_hash:digest.toUpperCase()});
      if(source.error)throw source.error;
      return Object.freeze({id:assetId,bucket,path,created:true,url:db.storage.from(bucket).getPublicUrl(path).data.publicUrl});
    }catch(error){
      if(assetId)await db.from('app_assets').delete().eq('id',assetId);
      await db.storage.from(bucket).remove([path]);throw error;
    }
  }
  async function discardAsset(asset){
    if(!asset||!asset.created)return;
    const db=client();const removed=await db.from('app_assets').delete().eq('id',asset.id).select('id');
    if(removed.error)throw removed.error;if(!removed.data||removed.data.length!==1)throw new Error('ASSET_CLEANUP_BLOCKED');
    const object=await db.storage.from(asset.bucket).remove([asset.path]);if(object.error)throw object.error;
  }
  async function uploadBrandingAsset(file,assetKey,settingsField){
    requirePermission('assets.write');
    const expected={
      'brand.pwa.512':'app_icon_asset_id','brand.institutional-seal':'institutional_seal_asset_id',
      'brand.favicon-pwa-192':'favicon_asset_id','brand.pwa.apple-touch':'apple_touch_asset_id',
      'brand.pwa.maskable-512':'pwa_maskable_512_asset_id','pwa.install-screen-1':'install_screen_1_asset_id',
      'pwa.install-screen-2':'install_screen_2_asset_id','pwa.install-screen-3':'install_screen_3_asset_id',
      'home.header.collapsed':null
    };
    if(!Object.prototype.hasOwnProperty.call(expected,assetKey)||expected[assetKey]!==settingsField)throw new Error('INVALID_BRANDING_TARGET');
    let entries=[{assetKey,file}];
    if(assetKey==='brand.pwa.512'){
      const variants=await Promise.all([normalizedPng(file,512,'INVALID_APP_ICON'),normalizedPng(file,192,'INVALID_APP_ICON'),normalizedPng(file,180,'INVALID_APP_ICON')]);
      entries=[
        {assetKey:'brand.pwa.512',file:variants[0]},
        {assetKey:'brand.favicon-pwa-192',file:variants[1]},
        {assetKey:'brand.pwa.apple-touch',file:variants[2]},
        {assetKey:'brand.pwa.maskable-512',file:variants[0]}
      ];
    }else{
      const technicalSize={'brand.favicon-pwa-192':192,'brand.pwa.apple-touch':180,'brand.pwa.maskable-512':512}[assetKey];
      if(technicalSize)entries=[{assetKey,file:await normalizedPng(file,technicalSize)}];
    }
    const registered=await registerBrandingFiles(entries);const primary=registered.find((row)=>row.asset_key===assetKey);
    return primary&&primary.asset_id;
  }
  async function clearAsset(settingsField){return updateSettings({[settingsField]:null});}

  const RESOURCE_ASSET_KEYS = new Set(['home.header.collapsed']);
  function requireResourceAssetKey(assetKey){if(!RESOURCE_ASSET_KEYS.has(assetKey))throw new Error('UNKNOWN_RESOURCE');}
  async function uploadResourceAsset(file,assetKey){requireResourceAssetKey(assetKey);return uploadBrandingAsset(file,assetKey,null);}
  async function resetResourceAsset(assetKey){
    requirePermission('assets.write');requireResourceAssetKey(assetKey);const db=client();
    const current=await db.from('app_assets').select('id').eq('asset_key',assetKey).maybeSingle();if(current.error)throw current.error;if(!current.data)return true;
    const result=await db.from('app_assets').update({status:'DISABLED'}).eq('id',current.data.id).select('id').single();if(result.error)throw result.error;return true;
  }

  async function listManaged(kind){
    const spec=managed[kind];if(!spec)throw new Error('UNKNOWN_RESOURCE');if(kind==='education')requireAny(['education.read','tutorials.read']);else if(kind==='companies')requireAny(['companies.read','agreements.read']);else requirePermission(spec.section+'.read');
    const result=await client().from(spec.table).select(spec.fields).order('sort_order',{ascending:true});if(result.error)throw result.error;
    return Object.freeze((result.data||[]).map((row)=>Object.freeze(project(kind,row))));
  }
  async function nextSort(table){const result=await client().from(table).select('sort_order').order('sort_order',{ascending:false}).limit(1);if(result.error)throw result.error;return result.data.length?result.data[0].sort_order+1:1;}
  async function saveManaged(kind,row){
    const spec=managed[kind];if(!spec)throw new Error('UNKNOWN_RESOURCE');
    const section=kind==='education'&&(row.resource_kind==='tutorial'||(!row.resource_kind&&row.id&&sectionAction('tutorials','update')))?'tutorials':spec.section;
    requirePermission(section+'.'+(row.id?'update':'create'));
    const values=clean(row,spec.editable);let result;
    if(row.id)result=await client().from(spec.table).update(values).eq('id',row.id).select('id').single();
    else{if(!values.sort_order)values.sort_order=await nextSort(spec.table);values[spec.table==='educational_resources'?'provenance':'record_origin']=spec.origin||'ADMIN_H009';result=await client().from(spec.table).insert(values).select('id').single();}
    if(result.error)throw result.error;return result.data;
  }
  async function setEnabled(kind,id,enabled){
    const field=(kind==='news'||kind==='education')?'published':'enabled';const spec=managed[kind];if(kind==='education')requireAny(['education.publish','tutorials.publish']);else requirePermission(spec.section+'.publish');
    return saveManaged(kind,{id,[field]:Boolean(enabled)});
  }
  async function removeManaged(kind,id){
    const spec=managed[kind];if(!spec)throw new Error('UNKNOWN_RESOURCE');if(kind==='education')requireAny(['education.delete','tutorials.delete']);else requirePermission(spec.section+'.delete');
    const result=await client().from(spec.table).delete().eq('id',id).select('id');
    if(result.error)throw result.error;if(!result.data||result.data.length!==1)throw new Error('DELETE_COUNT_MISMATCH');return true;
  }
  async function reorderManaged(kind,ids){
    const spec=managed[kind];if(!spec)throw new Error('UNKNOWN_RESOURCE');if(kind==='education')requireAny(['education.order','tutorials.order']);else requirePermission(spec.section+'.order');
    for(let index=0;index<ids.length;index+=1){const result=await client().from(spec.table).update({sort_order:index+1}).eq('id',ids[index]);if(result.error)throw result.error;}
    return true;
  }
  async function attachAsset(kind,id,field,assetId){
    const allow={banners:['image_asset_id'],popups:['image_asset_id'],documents:['image_asset_id','document_asset_id'],minutes:['image_asset_id','document_asset_id'],programs:['primary_image_asset_id'],directory:['image_asset_id'],companies:['logo_asset_id'],news:['image_asset_id'],education:['image_asset_id','document_asset_id']};
    if(!allow[kind]||!allow[kind].includes(field))throw new Error('INVALID_ASSET_TARGET');
    requirePermission(managed[kind].section+'.assets');const result=await client().from(managed[kind].table).update({[field]:assetId}).eq('id',id).select('id').single();if(result.error)throw result.error;return result.data;
  }
  async function replaceCompanyAsset(companyId,assetId,role){if(technical('companies.write')){const result=await client().rpc('replace_company_asset',{p_company_id:companyId,p_asset_id:assetId,p_role:role});if(result.error)throw result.error;return result.data;}requirePermission('companies.assets');const db=client(),current=await db.from('company_assets').select('id').eq('company_id',companyId).eq('role',role).maybeSingle();if(current.error)throw current.error;const result=current.data?await db.from('company_assets').update({asset_id:assetId}).eq('id',current.data.id):await db.from('company_assets').insert({company_id:companyId,asset_id:assetId,role,sort_order:1,record_origin:'ADMIN_SECTION_ROLLOUT'});if(result.error)throw result.error;return true;}

  async function getNewsSettings(){requirePermission('news.read');const result=await client().from('news_settings').select('id,responsible_name,responsible_title').eq('id','primary').single();if(result.error)throw result.error;return result.data;}
  async function updateNewsSettings(values){requirePermission('news.update');const result=await client().from('news_settings').update(clean(values,['responsible_name','responsible_title'])).eq('id','primary').select('id').single();if(result.error)throw result.error;return result.data;}
  async function resolveSectionResponsibility(email){requirePermission('authorization.write');const result=await client().rpc('resolve_section_responsibility_user',{p_email:String(email||'').trim()});if(result.error)throw result.error;return (result.data||[])[0]||null;}
  async function listSectionResponsibilities(section){requirePermission('authorization.read');const result=await client().rpc('list_section_responsibilities',{p_section_key:section});if(result.error)throw result.error;return Object.freeze(result.data||[]);}
  async function setSectionResponsibilities(email,section,actions){requirePermission('authorization.write');const result=await client().rpc('set_section_responsibilities',{p_email:String(email||'').trim(),p_section_key:section,p_actions:actions});if(result.error)throw result.error;return result.data;}
  async function revokeSectionResponsibilities(authUserId,section){requirePermission('authorization.write');const result=await client().rpc('revoke_section_responsibilities',{p_auth_user_id:authUserId,p_section_key:section});if(result.error)throw result.error;return true;}
  async function listSectionResponsibilityAudit(section){requirePermission('authorization.read');const result=await client().rpc('list_section_responsibility_audit',{p_section_key:section});if(result.error)throw result.error;return Object.freeze(result.data||[]);}
  async function searchAffiliates(query){if(state.phase!=='authorized')throw new Error('ADMIN_DENIED');const result=await client().rpc('search_affiliates_for_impersonation',{p_query:String(query||'').trim()});if(result.error)throw result.error;const rows=result.data||[];if(!has('assets.read')||!window.AffiliateRepository)return Object.freeze(rows);const enriched=await Promise.all(rows.map(async(row)=>{try{const photo=await window.AffiliateRepository.getProfilePhoto(row.id);return Object.freeze(Object.assign({},row,{profilePhotoUrl:photo&&photo.signedUrl||null}));}catch(_){return Object.freeze(Object.assign({},row,{profilePhotoUrl:null}));}}));return Object.freeze(enriched);}
  async function getAffiliateProfile(affiliateId){requirePermission('affiliates.read');const result=await client().rpc('get_affiliate_admin_profile',{p_affiliate_id:String(affiliateId)});if(result.error)throw result.error;return Object.freeze(result.data||{});}
  async function updateAffiliateProfile(affiliateId,expectedVersion,patch,reason){requirePermission('affiliates.write');const result=await client().rpc('update_affiliate_admin_profile',{p_affiliate_id:String(affiliateId),p_expected_version:Number(expectedVersion),p_patch:patch||{},p_reason:String(reason||'').trim()});if(result.error)throw result.error;return Object.freeze(result.data||{});}
  async function startImpersonation(affiliateId,reason){if(state.phase!=='authorized')throw new Error('ADMIN_DENIED');const result=await client().rpc('start_affiliate_impersonation',{p_affiliate_id:affiliateId,p_reason:String(reason||'').trim()});if(result.error)throw result.error;await window.AffiliateAuth.refreshContext();return (result.data||[])[0]||null;}
  async function stopImpersonation(){const result=await client().rpc('stop_affiliate_impersonation');if(result.error)throw result.error;await window.AffiliateAuth.refreshContext();return Boolean(result.data);}

  function useAdminAuth(){const[snapshot,setSnapshot]=React.useState(state);React.useEffect(()=>subscribe(setSnapshot),[]);React.useEffect(()=>{retry();},[]);return Object.assign({},snapshot,{retry,has});}
  window.AdminRepository=Object.freeze({bootstrap,retry,subscribe,getState:()=>state,has,updateSettings,uploadBrandingAsset,clearAsset,uploadResourceAsset,resetResourceAsset,listManaged,saveManaged,setEnabled,removeManaged,reorderManaged,uploadManagedAsset,discardAsset,attachAsset,replaceCompanyAsset,getNewsSettings,updateNewsSettings,resolveSectionResponsibility,listSectionResponsibilities,setSectionResponsibilities,revokeSectionResponsibilities,listSectionResponsibilityAudit,searchAffiliates,getAffiliateProfile,updateAffiliateProfile,startImpersonation,stopImpersonation});
  window.useAdminAuth=useAdminAuth;
})();
