/* Supabase boundary for company-authored popup proposals and admin review. */
(function(){
  'use strict';
  const db=()=>window.SutiSupabase.getClient();
  const fields='id,company_id,popup_id,title,body,action_label,action_type,action_target,custom_screen,image_asset_id,audience_raw,accent_hue,start_at,end_at,status,rejection_reason,created_at,reviewed_at,company:companies!company_id(display_name)';
  function project(row){return Object.freeze(Object.assign({},row,{titulo:row.title,contenido:row.body||'',ctaText:row.action_label||'',actionType:row.action_type,actionTarget:row.action_target||'',custom:row.custom_screen||null,audience:row.audience_raw||{mode:'all',cargos:[],sindicatos:[],niveles:[]},hue:row.accent_hue||345,startDate:row.start_at?row.start_at.slice(0,10):'',endDate:row.end_at?row.end_at.slice(0,10):'',ownerCompany:row.company_id,empresaNombre:row.company&&row.company.display_name||'',rejectReason:row.rejection_reason||'',slotId:'company_popup_'+row.id}));}
  async function list(companyId){let q=db().from('company_popup_proposals').select(fields).order('created_at',{ascending:false});if(companyId)q=q.eq('company_id',companyId);const r=await q;if(r.error)throw r.error;return Object.freeze((r.data||[]).map(project));}
  async function submit(companyId,row){const v={company_id:companyId,title:String(row.titulo||'').trim(),body:row.contenido||'',action_label:row.ctaText||null,action_type:row.actionType||'none',action_target:row.actionTarget||null,custom_screen:row.custom||null,image_asset_id:row.image_asset_id||null,audience_raw:row.audience||{mode:'all',cargos:[],sindicatos:[],niveles:[]},accent_hue:Number(row.hue)||345,start_at:row.startDate?row.startDate+'T00:00:00Z':null,end_at:row.endDate?row.endDate+'T23:59:59Z':null};const r=await db().from('company_popup_proposals').insert(v).select(fields).single();if(r.error)throw r.error;return project(r.data);}
  async function review(id,approve,reason){const r=await db().rpc('review_company_popup_proposal',{p_proposal_id:id,p_approve:Boolean(approve),p_reason:reason||null});if(r.error)throw r.error;return project(r.data);}
  window.PopupProposalRepository=Object.freeze({list,submit,review});
})();
