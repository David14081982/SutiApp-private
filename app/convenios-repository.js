/* Unified public view, preserving each Supabase master and original UUID. */
(function(){
  'use strict';
  const db=()=>window.SutiSupabase.getClient(),listeners=new Set();
  const assetFields='id,asset_key,storage_bucket,storage_path,mime_type,alt_text,status';
  const invalidate=()=>{refreshView(true);listeners.forEach(fn=>fn());};
  async function rpc(name,args){const r=await db().rpc(name,args);if(r.error)throw r.error;return r.data;}
  function key(row){return row.source_kind==='education'?'education:'+row.id:row.id;}
  async function list(){
    const rows=await rpc('list_public_convenios');
    if(!Array.isArray(rows))throw new Error('INVALID_CONVENIOS_PROJECTION');
    const ids=[...new Set(rows.flatMap(r=>[r.logo_asset_id,r.cover_asset_id,r.document_asset_id,...(r.gallery_asset_ids||[]),...(r.promotions||[]).map(p=>p.image_asset_id)]).filter(Boolean))];
    let assets=[];if(ids.length){const r=await db().from('app_assets').select(assetFields).in('id',ids);if(r.error)throw r.error;assets=r.data||[];}
    const urls=new Map(assets.map(a=>[a.id,window.AssetRepository.publicUrl(a)]));
    return rows.map(r=>Object.freeze({...r,public_key:key(r),logo_url:urls.get(r.logo_asset_id)||null,cover_url:urls.get(r.cover_asset_id)||null,document_url:urls.get(r.document_asset_id)||null,gallery_urls:(r.gallery_asset_ids||[]).map(id=>urls.get(id)).filter(Boolean),promotions:(r.promotions||[]).map(p=>({...p,image_url:urls.get(p.image_asset_id)||null}))}));
  }
  async function listEducationFavorites(){const r=await db().from('educational_resource_favorites').select('resource_id');if(r.error)throw r.error;return (r.data||[]).map(r=>r.resource_id);}
  async function favorite(row,on){
    if(row.source_kind!=='education')return window.catalogStore.toggleCompanyFavorite(row.id);
    const view=currentView();
    if(view.snapshot.favoritesPhase!=='loaded')throw new Error('CONVENIOS_FAVORITES_NOT_READY');
    const api=db(),u=await api.auth.getUser();if(u.error||!u.data.user)throw u.error||new Error('AUTH_REQUIRED');
    if(!isCurrent(view))throw new Error('PRIVATE_RESOURCE_CONTEXT_CHANGED');
    const r=on?await api.from('educational_resource_favorites').insert({auth_user_id:u.data.user.id,resource_id:row.id}):await api.from('educational_resource_favorites').delete().eq('resource_id',row.id);
    if(r.error)throw r.error;
    if(isCurrent(view))await readView(view,'favorites',true);
  }
  async function saveCompany(id,fields){const saved=await rpc('save_company_ficha',{p_company_id:id||null,p_fields:fields});invalidate();return {id:saved};}
  async function saveAgreement(row){const saved=await rpc('save_agreement_ficha',{p_fields:row});invalidate();return saved;}
  async function uploadImage(file,companyId){
    const mimeExt={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif'};
    if(!mimeExt[file.type]||file.size<1||file.size>10485760)throw new Error('INVALID_COMPANY_IMAGE');
    const api=db(),u=await api.auth.getUser();if(u.error||!u.data.user)throw u.error||new Error('AUTH_REQUIRED');
    const bytes=await file.arrayBuffer(),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
    const existing=await api.from('app_assets').select(assetFields).eq('owner_company_id',companyId).eq('content_sha256',hash.toUpperCase()).eq('status','READY').limit(1);
    if(existing.error)throw existing.error;
    if(existing.data?.length)return {id:existing.data[0].id,url:window.AssetRepository.publicUrl(existing.data[0])};
    const path='convenios/'+u.data.user.id+'/'+companyId+'/'+hash+'.'+mimeExt[file.type];
    const up=await api.storage.from('company-assets').upload(path,file,{upsert:false,contentType:file.type});if(up.error)throw up.error;
    const id=await rpc('register_company_ficha_image',{p_company_id:companyId,p_path:path,p_sha256:hash,p_mime:file.type,p_size:file.size});
    return {id,url:api.storage.from('company-assets').getPublicUrl(path).data.publicUrl};
  }
  async function attachImage(companyId,assetId,role){await rpc('attach_company_ficha_image',{p_company_id:companyId,p_asset_id:assetId,p_role:role});invalidate();}
  // One ephemeral projection for the mounted Convenios list/detail. No settled
  // state survives the last consumer or an Auth/impersonation context change.
  const viewListeners=new Set();let viewState=null,offContext=null;
  function currentView(){
    const epoch=window.PrivateResourceDemand.context();
    if(!viewState||viewState.epoch!==epoch)viewState={epoch,content:null,favorites:null,snapshot:{phase:'loading',rows:[],error:null,refreshing:false,favoritesPhase:'loading',favorites:[],favoritesError:null}};
    return viewState;
  }
  function isCurrent(view){return window.PrivateResourceDemand.context()===view.epoch&&viewState===view;}
  function emitView(){viewListeners.forEach(fn=>fn());}
  function updateView(view,patch){if(!isCurrent(view))return;view.snapshot={...view.snapshot,...patch};emitView();}
  function readView(view,part,force=false){
    if(view.epoch===null||!isCurrent(view))return Promise.resolve();
    if(view[part]&&!force)return view[part].promise;
    const request={};view[part]=request;
    const content=part==='content';
    updateView(view,content?{phase:view.snapshot.phase==='loaded'?'loaded':'loading',refreshing:true,error:null}:{favoritesPhase:'loading',favoritesError:null});
    request.promise=Promise.resolve().then(()=>{
      if(!isCurrent(view)||view[part]!==request)return;
      return content?list():listEducationFavorites();
    }).then(rows=>{
      if(!isCurrent(view)||view[part]!==request)return;
      updateView(view,content?{phase:'loaded',rows,error:null,refreshing:false}:{favoritesPhase:'loaded',favorites:rows,favoritesError:null});
    }).catch(error=>{
      if(!isCurrent(view)||view[part]!==request)return;
      // A failed authority never falls back to the previous projection.
      updateView(view,content?{phase:'error',rows:[],error,refreshing:false}:{favoritesPhase:'error',favorites:[],favoritesError:error});
    }).finally(()=>{if(view[part]===request)view[part]=null;});
    return request.promise;
  }
  function refreshView(force=false){
    if(!viewListeners.size){viewState=null;return;}
    const view=currentView();return Promise.all([readView(view,'content',force),readView(view,'favorites',force)]);
  }
  function onViewFocus(){refreshView();}
  function onViewContext(){currentView();emitView();refreshView();}
  function subscribeView(fn){
    viewListeners.add(fn);
    if(viewListeners.size===1){offContext=window.PrivateResourceDemand.subscribe(onViewContext);window.addEventListener('focus',onViewFocus);}
    const view=currentView();
    if(view.snapshot.phase==='loading')readView(view,'content');
    if(view.snapshot.favoritesPhase==='loading')readView(view,'favorites');
    return()=>{
      viewListeners.delete(fn);
      if(!viewListeners.size){if(offContext)offContext();offContext=null;window.removeEventListener('focus',onViewFocus);viewState=null;}
    };
  }
  const snapshot=()=>currentView().snapshot;
  const retryFavorites=()=>readView(currentView(),'favorites');
  window.ConveniosRepository=Object.freeze({list,key,invalidate,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},favorite,saveCompany,saveAgreement,uploadImage,attachImage,activity:id=>rpc('get_company_activity',{p_company_id:id})});
  window.useConvenios=function(){
    const state=React.useSyncExternalStore(subscribeView,snapshot);
    return {...state,retry:onViewFocus,retryFavorites};
  };
})();
