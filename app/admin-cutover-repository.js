/* Approved Admin decisions: the only Supabase boundary for authorization,
   segmentation, non-financial presentation/workflows and union content. */
(function () {
  'use strict';
  function client() { return window.SutiSupabase.getClient(); }
  const assetFields='id,asset_key,storage_bucket,storage_path,mime_type,alt_text,status';
  async function run(promise) { const out=await promise; if(out.error) throw out.error; return out.data||[]; }
  async function list(table,fields,configure){ let q=client().from(table).select(fields); if(configure) q=configure(q); return run(q); }
  async function upsert(table,row,conflict){ return run(client().from(table).upsert(row,{onConflict:conflict}).select()); }
  async function upsertSection(table,row,conflict){try{return await upsert(table,row,conflict);}catch(error){if(!String(error&&error.message||error).includes('ADMIN_ORIGIN_REQUIRED'))throw error;return upsert(table,Object.assign({},row,{record_origin:'ADMIN_SECTION_ROLLOUT'}),conflict);}}
  async function remove(table,id){ return run(client().from(table).delete().eq('id',id)); }
  const api={
    listRoles:()=>list('admin_roles','id,code,name,description,system_role,enabled,admin_role_permissions(permission)',q=>q.order('system_role',{ascending:false}).order('name')),
    saveRole:async(r)=>{const x=await run(client().rpc('save_admin_role',{p_role_id:r.id||null,p_name:r.name,p_description:r.desc||'',p_permissions:r.permissions||[]}));return x;},
    deleteRole:(id)=>run(client().rpc('delete_admin_role',{p_role_id:id})),
    assignRole:(authId,roleId,enabled)=>run(client().rpc('assign_admin_role',{p_auth_user_id:authId,p_role_id:roleId,p_enabled:enabled!==false})),
    listSegments:()=>list('segmentation_catalog_entries','id,catalog_type,code,label,enabled,sort_order,source_sheet,source_range,source_snapshot_hash',q=>q.order('catalog_type').order('sort_order')),
    saveSegment:(r)=>upsert('segmentation_catalog_entries',r,'catalog_type,code'),
    deleteSegment:(id)=>remove('segmentation_catalog_entries',id),
    listScreenAccess:()=>list('screen_access_policies','*',q=>q.order('screen_id')),
    saveScreenAccess:(r)=>upsert('screen_access_policies',r,'screen_id'),
    deleteScreenAccess:(id)=>run(client().from('screen_access_policies').delete().eq('screen_id',id)),
    canAccess:(id)=>run(client().rpc('can_access_app_screen',{p_screen_id:id})),
    listCompanyRules:()=>list('company_audience_rules','*',q=>q.order('company_id')),
    saveCompanyRule:(r)=>upsertSection('company_audience_rules',r,'company_id'),
    // `company_benefits` referencia a `companies`, no a `company_benefit_profiles`:
    // PostgREST no puede anidarlas. Se leen por separado y se unen por company_id.
    listCompanyProfiles:async()=>{
      const out=await Promise.all([
        list('company_benefit_profiles','*',q=>q.order('sort_order')),
        list('company_benefits','*',q=>q.order('company_id').order('sort_order'))]);
      const byCompany={};out[1].forEach(b=>{(byCompany[b.company_id]=byCompany[b.company_id]||[]).push(b);});
      return out[0].map(p=>Object.assign({},p,{company_benefits:byCompany[p.company_id]||[]}));
    },
    saveCompanyProfile:(r)=>upsertSection('company_benefit_profiles',r,'company_id'),
    saveCompanyBenefit:(r)=>upsertSection('company_benefits',r,'id'),
    deleteCompanyBenefit:(id)=>remove('company_benefits',id),
    listFinancePresentation:()=>list('finance_catalog_presentation','*',q=>q.order('group_key').order('sort_order')),
    saveFinancePresentation:(r)=>upsert('finance_catalog_presentation',r,'item_key'),
    listWorkflows:()=>list('operational_workflows','*,operational_workflow_stages(*)',q=>q.order('sort_order').order('sort_order',{referencedTable:'operational_workflow_stages'})),
    saveWorkflow:(r)=>upsert('operational_workflows',r,'id'),
    deleteWorkflow:(id)=>remove('operational_workflows',id),
    saveStage:(r)=>upsert('operational_workflow_stages',r,'id'),
    deleteStage:(id)=>remove('operational_workflow_stages',id),
    listTracking:()=>list('operational_request_tracking','*'),
    saveTracking:(r)=>upsert('operational_request_tracking',r,'request_id'),
    listUnion:()=>Promise.all([
      list('union_screen_content',`screen_key,title,description,published,header_asset_id,header_asset:app_assets!union_screen_content_header_asset_id_fkey(${assetFields})`,q=>q.order('screen_key')),
      list('union_content_blocks',`id,screen_key,block_type,title,body,external_url,asset_id,published,sort_order,audience_mode,union_codes,employment_category_codes,gender_codes,tag_codes,asset:app_assets!union_content_blocks_asset_id_fkey(${assetFields})`,q=>q.order('screen_key').order('sort_order'))]),
    saveUnionScreen:(r)=>upsert('union_screen_content',r,'screen_key'),
    saveUnionBlock:(r)=>upsert('union_content_blocks',r,'id'),
    deleteUnionBlock:(id)=>remove('union_content_blocks',id)
  };
  window.AdminCutoverRepository=Object.freeze(api);
})();
