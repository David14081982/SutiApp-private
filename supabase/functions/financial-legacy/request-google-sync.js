// Projection/delivery only. No workflow or financial decision is made here.
export const REQUEST_REGISTER_VERSION = 'REQUEST_REGISTER_V2';
// Owner instruction: AH and all following columns are outside this register's write boundary.
export const REQUEST_REGISTER_WIDTH = 33;
export const REQUEST_REGISTER_HEADERS = ['ID','Número de control','Nombre','Proceso','Fondo','Tasa','Plazo','Monto a solicitar','Total a Pagar','Fecha solicitud','CATEGORIA EMPLEADO','SINDICATO','AFILIADO NO AFILIADO','Monto Maximo','Fotografía rostro','INE Frente','INE Reverso','Talón Penultima quincena','Talón Ultima quincena','Foto aval','INE Frente (aval)','INE Reverso (aval)','Talón última quincena aval','Acepta Términos y condiciones','Estado','Observaciones','PDF','Comprobante de transferencia','Comprobante de transferencia copy','Constancia de no adeudo','Folio Interbancario','Firma del solicitante','Whatsapp Bot','Interes Quincenal','Tota Intereses a Pagar','Monto capital + Interes','Gasto Admon','TGA'];
const number = value => value != null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : '';
const normalize = value => String(value || '').trim().toUpperCase();
export function capturedDocumentReferences(documents) {
  const result = {};
  for (const document of documents || []) {
    const code = document.document_type?.code;
    if (!code) continue;
    if (result[code]) throw Error('REQUEST_DOCUMENT_AMBIGUOUS');
    if (!/^[0-9a-f-]{36}$/i.test(document.private_asset_id || '') || !/^[A-F0-9]{64}$/i.test(document.asset_sha256 || '')) throw Error('PRIVATE_DOCUMENT_CONTRACT_INVALID');
    result[code] = `supabase-private-asset:${document.private_asset_id}:${document.asset_sha256.toUpperCase()}`;
  }
  return result;
}
export function buildRequestRegisterRow(request, documents, signatureHash) {
  const financial = request.financial_submission_snapshot?.financialResult || {}, profile = request.financial_profile_snapshot || {}, affiliate = request.affiliate || {};
  const category = profile.financial_employee_category || request.category_label || '', union = profile.financial_union || request.union_label || '';
  const process = { 'SUPLENTES VARIABLES':'3','SUPLENTES FIJOS':'1','EVENTUALES':'1','BASE':'1','JUBILADOS Y PENS.':'JUB','JUBILADOS Y PENS':'JUB','CONFIANZA':'Confianza' }[normalize(category)] || '';
  const affiliation = {SUTISSSTESON:'AFILIADO',SUEISSSTESON:'NO AFILIADO',SITISSSTESON:'NO AFILIADO','EMPLEADOS DE CONFIANZA':'NO AFILIADO'}[normalize(union)] || '';
  const refs = capturedDocumentReferences(documents), amount = number(financial.amount ?? request.requested_amount), payments = number(financial.paymentCount);
  const row = Array(REQUEST_REGISTER_WIDTH).fill('');
  Object.assign(row, {0:request.id,1:request.numero_control || '',2:request.applicant_profile_snapshot?.full_name || affiliate.full_name || affiliate.display_name || '',3:process,
    4:financial.fund || '',5:financial.rate != null ? Number(financial.rate)/100 : '',6:payments || number(request.requested_term),7:amount,8:number(financial.total),9:request.created_at,
    10:category,11:union,12:affiliation,13:number(financial.maxAmount),23:request.terms_accepted == null ? '' : request.terms_accepted,24:'PENDIENTE',25:request.notes || '',
    31:signatureHash ? `supabase-request-signature:${request.id}:${signatureHash}` : '',32:request.deposit_notification_phone || request.applicant_profile_snapshot?.phone || affiliate.phone_raw || ''});
  ['profile_photo','ine_front','ine_back','payroll_previous','payroll_latest','guarantor_photo','guarantor_ine_front','guarantor_ine_back','guarantor_payroll_latest'].forEach((code,index)=>{row[14+index]=refs[code]||'';});
  return row;
}

export async function loadRequestRegisterSource(client, requestId) {
  const {data:request,error} = await client.from('program_requests').select('id,folio,affiliate_id,numero_control,program_id,program_item_id,product_id,request_type,status,created_at,requested_amount,requested_term,financial_processing_status,financial_submission_snapshot,financial_profile_snapshot,applicant_profile_snapshot,signature_data,terms_accepted,notes,affiliate:affiliates!affiliate_id(full_name,display_name,phone_raw,financial_union_code,financial_employee_category_code)').eq('id',requestId).single();
  if(error||!request)throw Error('REQUEST_SYNC_SOURCE_UNAVAILABLE');
  const {data:documents,error:documentError}=await client.from('request_documents').select('private_asset_id,asset_sha256,document_type:document_types!document_type_id(code)').eq('request_id',requestId);
  if(documentError)throw Error('REQUEST_SYNC_DOCUMENTS_UNAVAILABLE');
  if(request.program_id==='prestamo'){
    const {data:deposit,error:depositError}=await client.from('loan_request_deposit_snapshots').select('notification_phone').eq('request_id',requestId).maybeSingle();
    if(depositError)throw Error('REQUEST_SYNC_DEPOSIT_UNAVAILABLE');
    request.deposit_notification_phone=deposit?.notification_phone||'';
  }
  const affiliate=request.affiliate||{};
  const codes=[affiliate.financial_union_code,affiliate.financial_employee_category_code].filter(Boolean);
  const {data:catalog,error:catalogError}=codes.length?await client.from('segmentation_catalog_entries').select('catalog_type,code,label').in('catalog_type',['union','employment_category']).in('code',codes).eq('enabled',true):{data:[],error:null};
  if(catalogError)throw Error('REQUEST_SYNC_PROFILE_UNAVAILABLE');
  request.category_label=(catalog||[]).find(row=>row.catalog_type==='employment_category'&&row.code===affiliate.financial_employee_category_code)?.label||'';
  request.union_label=(catalog||[]).find(row=>row.catalog_type==='union'&&row.code===affiliate.financial_union_code)?.label||'';
  return {request,documents};
}

let oauthPromise=null,oauthExpires=0;
async function googleToken(env) {
  if(oauthPromise&&oauthExpires>Date.now())return oauthPromise;
  oauthExpires=Date.now()+45*60*1000;
  oauthPromise=(async()=>{
    const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env('GOOGLE_VISIBILITY_OAUTH_CLIENT_ID')||'',client_secret:env('GOOGLE_VISIBILITY_OAUTH_CLIENT_SECRET')||'',refresh_token:env('GOOGLE_VISIBILITY_OAUTH_REFRESH_TOKEN')||'',grant_type:'refresh_token',scope:'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/script.webapp.deploy'}),signal:AbortSignal.timeout(15000)});
    const data=await response.json();if(!response.ok||!data.access_token)throw Error('REQUEST_SYNC_GOOGLE_AUTH_FAILED');return data.access_token;
  })().catch(error=>{oauthPromise=null;oauthExpires=0;throw error;});
  return oauthPromise;
}
export async function deliverRequestRegister(client, requestId, env, sha256) {
  const {data:job,error:claimError}=await client.rpc('claim_program_request_google_sync',{p_request_id:requestId||null});
  if(claimError)throw Error('REQUEST_SYNC_CLAIM_FAILED');
  if(!job)return null;
  let initialRow=job.initial_row||null,googleRow=null,errorCode=null;
  try {
    const {request,documents}=await loadRequestRegisterSource(client,job.request_id);
    if(!initialRow)initialRow=buildRequestRegisterRow(request,documents,request.signature_data?await sha256(String(request.signature_data)):null);
    const status=job.request_status;
    // Folio is presentation metadata; never change the immutable UUID/ISO row or its hash.
    if(!/^SR-\d{4}-\d{6,}$/.test(request.folio||''))throw Error('REQUEST_SYNC_FOLIO_INVALID');
    const payload={action:'sync_request',secret:env('FINANCIAL_LEGACY_API_TOKEN'),contract_version:REQUEST_REGISTER_VERSION,program_request_id:request.id,affiliate_id:request.affiliate_id,numero_control:request.numero_control,program:request.program_id,product_id:request.product_id||request.program_item_id||null,request_type:request.request_type,request_status:status,requested_amount:request.requested_amount,request_created_at:request.created_at,revision:job.revision,desired_status:job.desired_status,row:initialRow,payload_sha256:await sha256(initialRow)};
    payload.request_folio=request.folio;
    const url=env('FINANCIAL_LEGACY_API_URL');if(!url||!payload.secret)throw Error('REQUEST_SYNC_BRIDGE_NOT_CONFIGURED');
    const token=await googleToken(env);
    const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(payload),signal:AbortSignal.timeout(30000)});
    const responseText=await response.text();let result=null;
    try{result=JSON.parse(responseText);}catch{if(/<title[^>]*>Authorization needed<\/title>/i.test(responseText))throw Error('REQUEST_SYNC_GOOGLE_AUTHORIZATION_REQUIRED');}
    if(!response.ok||!result?.ok)throw Error(result?.error&&/^[A-Z0-9_]{3,100}$/.test(result.error)?result.error:'REQUEST_SYNC_BRIDGE_FAILED');
    if(result.action!=='sync_request'||result.program_request_id!==request.id||!Number.isInteger(result.google_row)||result.google_row<2||!Number.isSafeInteger(result.revision)||result.revision<job.revision||(result.revision===job.revision&&result.desired_status!==job.desired_status))throw Error('REQUEST_SYNC_RESPONSE_INVALID');
    googleRow=result.google_row;
  }catch(error){const message=String(error?.message||'');errorCode=/^[A-Z0-9_]{3,100}$/.test(message)?message:'REQUEST_SYNC_UNAVAILABLE';}
  const {data:finished,error:finishError}=await client.rpc('finish_program_request_google_sync',{p_request_id:job.request_id,p_revision:job.revision,p_initial_row:initialRow,p_google_row:googleRow,p_error_code:errorCode});
  if(finishError)throw Error('REQUEST_SYNC_FINISH_FAILED');
  return {request_id:job.request_id,...finished};
}
