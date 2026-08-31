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
  async function listItems(options){
    const admin=Boolean(options&&options.admin);
    if(admin&&(!window.AdminRepository||!window.AdminRepository.has('program_catalog.read')))throw new Error('PROGRAM_CATALOG_READ_REQUIRED');
    const api=db();
    let itemQuery=api.from('program_catalog_items').select('id,program_key,name,description,category_raw,quantity_raw,presentation_raw,contact_url_raw,price_cash,requires_quote,request_mode,legacy_boundary,enabled,sort_order,record_origin,source_sheet,source_row_ordinal,source_snapshot_hash,created_at,updated_at').order('program_key',{ascending:true}).order('sort_order',{ascending:true});
    if(!admin)itemQuery=itemQuery.eq('enabled',true);
    const [rows,links]=await Promise.all([
      itemQuery,
      api.from('program_catalog_item_assets').select(`id,item_id,public_asset_id,private_asset_id,role,sort_order,enabled,source_column,source_column_letter,public_asset:app_assets!public_asset_id(${publicFields}),private_asset:private_assets!private_asset_id(${privateFields})`).eq('enabled',true).order('sort_order',{ascending:true}),
    ]);
    if(rows.error)throw rows.error;
    if(links.error)throw links.error;
    const allLinks=links.data||[],assetUrls=await resolveAssetUrls(allLinks),byItem=new Map();
    for(const link of allLinks){if(!byItem.has(link.item_id))byItem.set(link.item_id,[]);byItem.get(link.item_id).push(link);}
    const projected=[];
    for(const row of rows.data||[]){
      const itemLinks=(byItem.get(row.id)||[]),urls=itemLinks.map((link)=>assetUrls.get(link)).filter(Boolean);
      const imageAssets=itemLinks.map((link)=>Object.freeze({link_id:link.id,public_asset_id:link.public_asset_id||null,private_asset_id:link.private_asset_id||null,role:link.role,sort_order:link.sort_order,source_column:link.source_column,source_column_letter:link.source_column_letter,url:assetUrls.get(link)||null}));
      const detail=[row.quantity_raw&&('Existencia: '+row.quantity_raw),row.presentation_raw&&('Presentación: '+row.presentation_raw)].filter(Boolean).join(' · ');
      projected.push(Object.freeze(Object.assign({},row,{nombre:row.name,ficha:detail||row.category_raw||'',desc:row.description||'',precio:row.price_cash==null?null:Number(row.price_cash),cotiza:Boolean(row.requires_quote),activo:row.enabled!==false,orden:row.sort_order,scope:'fin',scopeId:row.program_key,imagenes:urls,imagenAssets:imageAssets,catalogSource:'program',requestMode:row.request_mode,legacyBoundary:Boolean(row.legacy_boundary)})));
    }
    return Object.freeze(projected);
  }
  async function createRequest(itemId,quantity,message,signature,terms,idempotencyKey,documentIds){
    return window.ProgramRequestRepository.create({programItemId:itemId,quantity,notes:message,signature,terms,idempotencyKey,documentIds:documentIds||[]});
  }
  async function listFavorites(){const r=await db().from('program_catalog_favorites').select('item_id');if(r.error)throw r.error;return Object.freeze((r.data||[]).map((row)=>row.item_id));}
  async function setFavorite(itemId,on){const api=db(),user=(await api.auth.getUser()).data.user;if(!user)throw new Error('AUTH_REQUIRED');const r=on?await api.from('program_catalog_favorites').upsert({auth_user_id:user.id,item_id:itemId},{onConflict:'auth_user_id,item_id'}):await api.from('program_catalog_favorites').delete().eq('item_id',itemId);if(r.error)throw r.error;}
  function assertAdminWrite(){if(!window.AdminRepository||!window.AdminRepository.has('program_catalog.write'))throw new Error('PROGRAM_CATALOG_WRITE_REQUIRED');}
  async function digest(file){const bytes=await file.arrayBuffer();return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map((x)=>x.toString(16).padStart(2,'0')).join('');}
  async function uploadAdminAsset(file,altText){
    assertAdminWrite();
    const extensions={'image/png':'png','image/jpeg':'jpg','image/gif':'gif','image/webp':'webp'};
    if(!file||!extensions[file.type]||file.size<1||file.size>10485760)throw new Error('PROGRAM_CATALOG_ASSET_INVALID');
    const api=db(),user=(await api.auth.getUser()).data.user;if(!user)throw new Error('AUTH_REQUIRED');
    const sha=await digest(file),path=`program-products/${user.id}/${sha}.${extensions[file.type]}`;
    const stored=await api.storage.from('app-assets').upload(path,file,{upsert:false,contentType:file.type});
    if(stored.error&&String(stored.error.message||'').toLowerCase().indexOf('already exists')<0)throw stored.error;
    const registered=await api.rpc('register_program_catalog_asset',{p_storage_path:path,p_mime_type:file.type,p_file_size:file.size,p_content_sha256:sha,p_alt_text:String(altText||'').trim()||null});
    if(registered.error){if(!stored.error)await api.storage.from('app-assets').remove([path]);throw registered.error;}
    const publicUrl=api.storage.from('app-assets').getPublicUrl(path,{transform:{width:640,height:640,resize:'cover',quality:82}}).data.publicUrl;
    return Object.freeze({public_asset_id:registered.data,path,url:publicUrl,uploaded:true});
  }
  async function discardAdminAsset(asset){
    if(!asset||!asset.public_asset_id||!asset.uploaded)return;
    const api=db();if(asset.path)await api.storage.from('app-assets').remove([asset.path]);
    const out=await api.rpc('discard_unlinked_program_catalog_asset',{p_asset_id:asset.public_asset_id});if(out.error)throw out.error;
  }
  async function saveAdminItem(item,assets){
    assertAdminWrite();
    const payload={program_key:item.program_key||item.scopeId,name:String(item.nombre||item.name||'').trim(),description:String(item.desc||item.description||'').trim()||null,category_raw:String(item.category_raw||'').trim()||null,price_cash:item.precio==null?null:Number(item.precio),requires_quote:Boolean(item.cotiza),enabled:item.activo!==false,sort_order:Number(item.orden||item.sort_order)};
    const links=(assets||[]).map((asset)=>asset.link_id?{link_id:asset.link_id}:{public_asset_id:asset.public_asset_id});
    const out=await db().rpc('save_program_catalog_item',{p_item_id:item.id||null,p_payload:payload,p_asset_links:links});if(out.error)throw out.error;return Object.freeze(out.data||{});
  }
  async function reorderAdminItems(programKey,itemIds){assertAdminWrite();const out=await db().rpc('reorder_program_catalog_items',{p_program_key:programKey,p_item_ids:itemIds});if(out.error)throw out.error;return Boolean(out.data);}
  window.ProgramCatalogRepository=Object.freeze({listItems,createRequest,listFavorites,setFavorite,uploadAdminAsset,discardAdminAsset,saveAdminItem,reorderAdminItems});
})();
