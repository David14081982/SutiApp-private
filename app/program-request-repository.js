/* Unified initial-request boundary. Supabase program_requests is authoritative after cutover. */
(function(){
  'use strict';
  const db=()=>window.SutiSupabase.getClient();
  const fields=`id,folio,actor_real_auth_user_id,affiliate_id,usuario_contexto_affiliate_id,impersonation_session_id,impersonation_reason,numero_control,program_id,program_item_id,product_id,membership_offering_id,terms_version_id,applicant_profile_snapshot,company_id,request_type,status,quantity,notes,terms_accepted,financial_processing_status,legacy_reference,requested_amount,requested_term,requested_term_semantics,financial_profile_snapshot,financial_submission_snapshot,financial_approval_snapshot,financial_approved_at,quoted_amount,quote_note,valid_until,responded_at,created_at,updated_at,affiliate:affiliates!affiliate_id(full_name,display_name,numero_control),program_item:program_catalog_items!program_item_id(name,program_key,price_cash),product:marketplace_products!product_id(name,price),membership:membership_offerings!membership_offering_id(company_raw,concept,amount),company:companies!company_id(display_name),financial_export:financial_request_export_audit(export_status,attempt_count,error_code,updated_at)`;
  const queueFields=`id,folio,affiliate_id,numero_control,program_id,program_item_id,product_id,company_id,request_type,status,quantity,financial_processing_status,quoted_amount,created_at,updated_at,affiliate:affiliates!affiliate_id(full_name,display_name,numero_control),program_item:program_catalog_items!program_item_id(name,program_key,price_cash),product:marketplace_products!product_id(name,price),company:companies!company_id(display_name)`;
  const detailFields=`id,folio,affiliate_id,numero_control,program_id,program_item_id,product_id,company_id,request_type,status,quantity,notes,terms_accepted,financial_processing_status,quoted_amount,quote_note,valid_until,responded_at,created_at,updated_at,affiliate:affiliates!affiliate_id(full_name,display_name,numero_control),program_item:program_catalog_items!program_item_id(name,program_key,price_cash),product:marketplace_products!product_id(name,price),company:companies!company_id(display_name)`;
  const historyFields=`id,folio,affiliate_id,numero_control,program_id,program_item_id,product_id,company_id,request_type,status,quantity,notes,financial_processing_status,quoted_amount,quote_note,valid_until,responded_at,created_at,updated_at,program_item:program_catalog_items!program_item_id(name,program_key,price_cash),product:marketplace_products!product_id(name,price),company:companies!company_id(display_name)`;
  const mobileFields=`id,folio,affiliate_id,numero_control,program_id,program_item_id,product_id,company_id,request_type,status,quantity,notes,terms_accepted,financial_processing_status,legacy_reference,quoted_amount,quote_note,valid_until,responded_at,created_at,updated_at,affiliate:affiliates!affiliate_id(full_name,display_name,numero_control),program_item:program_catalog_items!program_item_id(name,program_key,price_cash),product:marketplace_products!product_id(name,price),company:companies!company_id(display_name),financial_export:financial_request_export_audit(export_status,attempt_count,error_code,updated_at)`;
  const benefitState={submitted:'pendiente',in_review:'revision',approved:'aprobada',rejected:'rechazada',cancelled:'cancelada',requires_financial_processing:'revision'};
  const quoteState={submitted:'solicitada',in_review:'solicitada',approved:'cotizada',rejected:'vencida',cancelled:'vencida',requires_financial_processing:'solicitada'};
  function key(){return crypto.randomUUID();}
  function project(row){
    const quote=row.request_type==='quote',product=row.product||row.program_item||(row.membership&&{name:row.membership.company_raw,price:row.membership.amount})||null,affiliate=row.affiliate||null;
    const productName=product&&product.name||row.program_id;
    const companyName=row.company&&row.company.display_name||'';
    const amount=product&&(product.price==null?product.price_cash:product.price);
    return Object.freeze(Object.assign({},row,{
      estado:(quote?quoteState:benefitState)[row.status]||row.status,
      productoId:row.product_id||row.program_item_id,
      productoNombre:productName,
      empresaId:row.company_id,
      empresaNombre:companyName,
      importe:amount==null?null:Number(amount),
      fecha:new Date(row.created_at).toLocaleDateString('es-MX'),
      fechaHora:new Date(row.created_at).toLocaleString('es-MX'),
      ts:new Date(row.created_at).getTime(),
      message:row.notes||'',
      company_notes:row.notes||'',
      nombre:affiliate&&(affiliate.display_name||affiliate.full_name)||'Afiliado',
      usuario:{id:row.affiliate_id,nombre:affiliate&&(affiliate.display_name||affiliate.full_name)||'Afiliado',numAfiliado:row.numero_control,sindicato:'—',categoria:'—'},
      item:productName,
      visto:false,
      cotizacion:quote&&row.quoted_amount!=null?{monto:Number(row.quoted_amount),nota:row.quote_note||'',vigencia:row.valid_until||'',fechaHora:row.responded_at?new Date(row.responded_at).toLocaleString('es-MX'):'',actor:companyName||'Área responsable'}:null,
    }));
  }
  async function create(values){
    const v=values||{};
    const r=await db().rpc('create_program_request',{
      p_program_item_id:v.programItemId||null,p_product_id:v.productId||null,p_quantity:Number(v.quantity)||1,
      p_notes:v.notes||'',p_signature_data:v.signature||null,p_terms_accepted:Boolean(v.terms),p_idempotency_key:v.idempotencyKey||key()
    });
    if(r.error)throw r.error;return project(r.data);
  }
  async function createMembership(values){const v=values||{};const r=await db().rpc('create_membership_request',{p_membership_offering_id:v.membershipOfferingId,p_document_ids:v.documentIds||[],p_phone:v.phone,p_rfc:v.rfc,p_curp:v.curp,p_terms_version_id:v.termsVersionId,p_idempotency_key:v.idempotencyKey||key()});if(r.error)throw r.error;return project(r.data);}
  async function list(filters){
    const f=filters||{};let q=db().from('program_requests').select(fields).order('created_at',{ascending:false});
    if(f.programId)q=q.eq('program_id',f.programId);if(f.companyId)q=q.eq('company_id',f.companyId);if(f.requestType)q=q.eq('request_type',f.requestType);
    const r=await q;if(r.error)throw r.error;return Object.freeze((r.data||[]).map(project));
  }
  async function listGeneralQueue(){
    const r=await db().from('program_requests').select(queueFields).is('financial_processing_status',null).order('created_at',{ascending:false}).limit(250);
    if(r.error)throw r.error;return Object.freeze((r.data||[]).map(project));
  }
  async function listHistory(){
    const r=await db().from('program_requests').select(historyFields).order('created_at',{ascending:false});
    if(r.error)throw r.error;return Object.freeze((r.data||[]).map(project));
  }
  async function listMobile(){
    const r=await db().from('program_requests').select(mobileFields).order('created_at',{ascending:false});
    if(r.error)throw r.error;return Object.freeze((r.data||[]).map(project));
  }
  async function detail(id){
    const base=await db().from('program_requests').select(detailFields).eq('id',id).is('financial_processing_status',null).single();
    if(base.error)throw base.error;
    const row=base.data,documents=db().from('request_documents').select('id,status_at_submission,created_at,document_type:document_types!document_type_id(id,code,label)').eq('request_id',id).order('created_at',{ascending:true});
    const requirements=row.program_id==='membership'?Promise.resolve({data:[],error:{code:'MEMBERSHIP_SCOPE_NOT_EXPOSED'}}):db().from('program_document_requirements').select('id,required,allow_verified_reuse,sort_order,document_type:document_types!document_type_id(id,code,label)').eq('program_id',row.program_id).is('membership_offering_id',null).eq('enabled',true).order('sort_order',{ascending:true});
    const tracking=db().from('operational_request_tracking').select('request_id,current_stage_id,stage_dates,updated_at,workflow:operational_workflows!workflow_id(id,name,operational_workflow_stages(id,name,description,responsible,status_reference,sort_order))').eq('request_id',id).maybeSingle();
    const parts=await Promise.all([documents,requirements,tracking]),trackingRow=parts[2].error?null:parts[2].data,workflow=trackingRow&&trackingRow.workflow;
    const trackingView=trackingRow?Object.freeze(Object.assign({},trackingRow,{workflow_name:workflow&&workflow.name||'',stages:Object.freeze((workflow&&workflow.operational_workflow_stages||[]).slice().sort((a,b)=>a.sort_order-b.sort_order))})):null;
    return Object.freeze(Object.assign({},project(row),{request_documents:Object.freeze(parts[0].error?[]:parts[0].data||[]),documents_available:!parts[0].error,tracking:trackingView,tracking_available:!parts[2].error,requirements:Object.freeze(parts[1].error?[]:parts[1].data||[]),requirements_available:!parts[1].error,terms_version:null}));
  }
  async function update(id,status,notes){const r=await db().rpc('update_program_request',{p_request_id:id,p_status:status,p_notes:notes||''});if(r.error)throw r.error;return project(r.data);}
  async function respondQuote(id,amount,note,validUntil){const r=await db().rpc('respond_program_request_quote',{p_request_id:id,p_amount:Number(amount),p_note:note||'',p_valid_until:validUntil||null});if(r.error)throw r.error;return project(r.data);}
  window.ProgramRequestRepository=Object.freeze({create,createMembership,list,listGeneralQueue,listHistory,listMobile,detail,update,respondQuote,newIdempotencyKey:key,project});
})();
