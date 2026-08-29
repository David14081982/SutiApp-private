/* H-DATA-CUTOVER-001: non-financial program catalogs from Supabase only. */
(function () {
  'use strict';
  function db(){return window.SutiSupabase.getClient();}
  const publicFields='id,asset_key,storage_bucket,storage_path,mime_type,alt_text,status';
  const privateFields='id,storage_bucket,storage_path,mime_type,status';
  async function resolveAssetUrls(links){
    const urls=new Map(),privateByBucket=new Map();
    for(const link of links){
      if(link.public_asset){urls.set(link,window.AssetRepository.publicUrl(link.public_asset,{width:640,height:640,resize:'cover',quality:82}));continue;}
      if(!link.private_asset)continue;
      const bucket=link.private_asset.storage_bucket;
      if(!privateByBucket.has(bucket))privateByBucket.set(bucket,[]);
      privateByBucket.get(bucket).push(link);
    }
    await Promise.all(Array.from(privateByBucket.entries()).map(async([bucket,bucketLinks])=>{
      const paths=bucketLinks.map((link)=>link.private_asset.storage_path);
      const r=await db().storage.from(bucket).createSignedUrls(paths,3600);
      if(r.error)throw r.error;
      (r.data||[]).forEach((signed,index)=>{if(signed&&signed.signedUrl)urls.set(bucketLinks[index],signed.signedUrl);});
    }));
    return urls;
  }
  async function listItems(){
    const api=db();
    const [rows,links]=await Promise.all([
      api.from('program_catalog_items').select('id,program_key,name,description,category_raw,quantity_raw,presentation_raw,contact_url_raw,price_cash,requires_quote,request_mode,legacy_boundary,enabled,sort_order,record_origin,source_sheet,source_row_ordinal').eq('enabled',true).order('sort_order',{ascending:true}),
      api.from('program_catalog_item_assets').select(`item_id,role,sort_order,public_asset:app_assets!public_asset_id(${publicFields}),private_asset:private_assets!private_asset_id(${privateFields})`).order('sort_order',{ascending:true}),
    ]);
    if(rows.error)throw rows.error;
    if(links.error)throw links.error;
    const allLinks=links.data||[],assetUrls=await resolveAssetUrls(allLinks),byItem=new Map();
    for(const link of allLinks){if(!byItem.has(link.item_id))byItem.set(link.item_id,[]);byItem.get(link.item_id).push(link);}
    const projected=[];
    for(const row of rows.data||[]){
      const urls=(byItem.get(row.id)||[]).map((link)=>assetUrls.get(link)).filter(Boolean);
      const detail=[row.quantity_raw&&('Existencia: '+row.quantity_raw),row.presentation_raw&&('Presentación: '+row.presentation_raw)].filter(Boolean).join(' · ');
      projected.push(Object.freeze(Object.assign({},row,{nombre:row.name,ficha:detail||row.category_raw||'',desc:row.description||'',precio:row.price_cash==null?null:Number(row.price_cash),cotiza:Boolean(row.requires_quote),activo:row.enabled!==false,orden:row.sort_order,scope:'fin',scopeId:row.program_key,imagenes:urls,imagenAssets:[],catalogSource:'program',requestMode:row.request_mode,legacyBoundary:Boolean(row.legacy_boundary)})));
    }
    return Object.freeze(projected);
  }
  async function createRequest(itemId,quantity,message,signature,terms,idempotencyKey){
    return window.ProgramRequestRepository.create({programItemId:itemId,quantity,notes:message,signature,terms,idempotencyKey});
  }
  async function listFavorites(){const r=await db().from('program_catalog_favorites').select('item_id');if(r.error)throw r.error;return Object.freeze((r.data||[]).map((row)=>row.item_id));}
  async function setFavorite(itemId,on){const api=db(),user=(await api.auth.getUser()).data.user;if(!user)throw new Error('AUTH_REQUIRED');const r=on?await api.from('program_catalog_favorites').upsert({auth_user_id:user.id,item_id:itemId},{onConflict:'auth_user_id,item_id'}):await api.from('program_catalog_favorites').delete().eq('item_id',itemId);if(r.error)throw r.error;}
  window.ProgramCatalogRepository=Object.freeze({listItems,createRequest,listFavorites,setFavorite});
})();
