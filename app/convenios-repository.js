/* Unified public view, preserving each Supabase master and original UUID. */
(function(){
  'use strict';
  const db=()=>window.SutiSupabase.getClient(),listeners=new Set();
  const assetFields='id,asset_key,storage_bucket,storage_path,mime_type,alt_text,status';
  const invalidate=()=>listeners.forEach(fn=>fn());
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
    const api=db(),u=await api.auth.getUser();if(u.error||!u.data.user)throw u.error||new Error('AUTH_REQUIRED');
    const r=on?await api.from('educational_resource_favorites').insert({auth_user_id:u.data.user.id,resource_id:row.id}):await api.from('educational_resource_favorites').delete().eq('resource_id',row.id);
    if(r.error)throw r.error;invalidate();
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
  window.ConveniosRepository=Object.freeze({list,key,invalidate,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},favorite,saveCompany,saveAgreement,uploadImage,attachImage,activity:id=>rpc('get_company_activity',{p_company_id:id})});
  window.useConvenios=function(){
    const epoch=window.PrivateResourceDemand.useContext();
    const[state,setState]=React.useState({phase:'loading',rows:[],favorites:[],error:null});
    const[version,setVersion]=React.useState(0);
    React.useEffect(()=>{const reload=()=>setVersion(v=>v+1);const off=window.ConveniosRepository.subscribe(reload);window.addEventListener('focus',reload);return()=>{off();window.removeEventListener('focus',reload);};},[]);
    React.useEffect(()=>{let live=true;setState({phase:'loading',rows:[],favorites:[],error:null});Promise.all([list(),listEducationFavorites()]).then(([rows,favorites])=>{if(live)setState({phase:'loaded',rows,favorites,error:null});}).catch(error=>{if(live)setState({phase:'error',rows:[],favorites:[],error});});return()=>{live=false;};},[epoch,version]);
    return {...state,retry:()=>setVersion(v=>v+1)};
  };
})();
