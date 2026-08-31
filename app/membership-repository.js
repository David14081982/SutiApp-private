/* Phase 4 membership catalog. Supabase is the only runtime authority. */
(function(){
  const fields='id,company_raw,concept,amount,installments,logo_asset_id,enabled,sort_order,record_origin,logo_asset:app_assets!logo_asset_id(id,storage_bucket,storage_path,status,alt_text)';
  const db=()=>{const c=window.SutiSupabase&&window.SutiSupabase.getClient();if(!c)throw new Error('SUPABASE_NOT_CONFIGURED');return c;};
  const url=(a)=>a&&a.status==='READY'?db().storage.from(a.storage_bucket).getPublicUrl(a.storage_path).data.publicUrl:null;
  const project=(r)=>Object.freeze(Object.assign({},r,{empresa:r.company_raw,concepto:r.concept,monto:Number(r.amount),pagos:r.installments,activo:r.enabled,logo:url(r.logo_asset)}));
  async function list(){const r=await db().from('membership_offerings').select(fields).order('sort_order',{ascending:true});if(r.error)throw r.error;return Object.freeze((r.data||[]).map(project));}
  const enabledFrom=(row)=>row.activo===undefined?row.enabled!==false:row.activo!==false;
  async function save(row){const values={company_raw:String(row.empresa||row.company_raw||'').trim(),concept:String(row.concepto||row.concept||'').trim(),amount:Number(row.monto??row.amount),installments:Number(row.pagos??row.installments),logo_asset_id:row.logo_asset_id||null,enabled:enabledFrom(row),sort_order:Number(row.sort_order||1)};let q;if(row.id)q=db().from('membership_offerings').update(values).eq('id',row.id);else{values.record_origin='ADMIN_PHASE4';q=db().from('membership_offerings').insert(values);}const r=await q.select('id').single();if(r.error)throw r.error;return r.data;}
  async function setEnabled(id,enabled){if(!id)throw new Error('MEMBERSHIP_ID_REQUIRED');const next=enabled===true;const r=await db().from('membership_offerings').update({enabled:next}).eq('id',id).select('id,enabled').single();if(r.error)throw r.error;if(!r.data||r.data.enabled!==next)throw new Error('MEMBERSHIP_ENABLED_MISMATCH');return r.data;}
  async function remove(id){const r=await db().from('membership_offerings').delete().eq('id',id).select('id');if(r.error)throw r.error;if(!r.data||r.data.length!==1)throw new Error('MEMBERSHIP_DELETE_COUNT_MISMATCH');}
  async function uploadLogo(file){return window.AdminRepository.uploadManagedAsset(file,'app-assets','MEMBERSHIP_LOGO','membership.logo');}
  window.MembershipRepository=Object.freeze({list,save,setEnabled,remove,uploadLogo});
})();
