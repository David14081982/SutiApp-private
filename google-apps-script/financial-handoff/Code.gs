/* Final approved-loan export. The technical registry is the idempotency/recovery boundary. */
const HANDOFF_SPREADSHEET_ID = '1Vxy84N7mzbuioTmWhjRD2QFboDx--rG3iUwmLuyeY80';
const HANDOFF_SHEET_NAME = 'SutiApp Financial Handoff';
const TARGET_SHEET_NAME = 'Historial de solicitudes';
const TARGET_SHEET_ID = 10616270;
const HANDOFF_SECRET_PROPERTY = 'FINANCIAL_HANDOFF_SECRET';
const CONTRACT_VERSION = 'FINAL_APPROVED_LOAN_EXPORT_V1';
const CRITERIA_SHEET_NAME = 'Criterios de fondos';
const CRITERIA_VISIBILITY_COLUMN = 16;
const CRITERIA_VISIBILITY_HEADER = 'VISIBILIDAD SUTIAPP';
const CRITERIA_BASE_HEADER = ['CATEGORIAS','Sindicato','Fondo','Monto Maximo','Tasa','Plazos','Concatenado','Fecha','Ícono','Beneficiario','Simulación Interes a pagar total','Plazo para calculo AD. NÓMINA','MOSTRAR PROGRAMA','FECHA','FECHA AÑO'];
const VISIBILITY_KEYS = new Set(['action','secret','operation_id','criterion_identity','visibility_mode','reason']);
const HANDOFF_HEADERS = [
  'program_request_id', 'affiliate_id', 'numero_control', 'program', 'product_id',
  'request_type', 'request_status', 'requested_amount', 'request_created_at',
  'received_at', 'processing_status', 'legacy_reference', 'legacy_result_status',
  'last_processed_at', 'error_code', 'error_message'
];
const TARGET_HEADERS = [
  'ID','Número de control','Nombre','Proceso','Fondo','Tasa','Plazo','Monto a solicitar','Total a Pagar','Fecha solicitud',
  'CATEGORIA EMPLEADO','SINDICATO','AFILIADO NO AFILIADO','Monto Maximo','Fotografía rostro','INE Frente','INE Reverso',
  'Talón Penultima quincena','Talón Ultima quincena','Foto aval','INE Frente (aval)','INE Reverso (aval)',
  'Talón última quincena aval','Acepta Términos y condiciones','Estado','Observaciones','PDF','Comprobante de transferencia',
  'Comprobante de transferencia copy','Constancia de no adeudo','Folio Interbancario','Firma del solicitante','Whatsapp Bot',
  'Interes Quincenal','Tota Intereses a Pagar','Monto capital + Interes','Gasto Admon','TGA'
];
const HANDOFF_KEYS = new Set([
  'action','secret','contract_version','program_request_id','affiliate_id','numero_control','program','product_id',
  'request_type','request_status','requested_amount','request_created_at','payload_sha256','row'
]);

function jsonResponse_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
function failure_(code) { return jsonResponse_({ ok:false, action:'handoff', error:code }); }
function constantTimeEqual_(left,right) {
  left=String(left||''); right=String(right||''); let mismatch=left.length^right.length;
  const length=Math.max(left.length,right.length);
  for(let index=0;index<length;index+=1) mismatch|=(left.charCodeAt(index%Math.max(1,left.length))||0)^(right.charCodeAt(index%Math.max(1,right.length))||0);
  return mismatch===0;
}
function validUuid_(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value||'')); }
function privateAssetRef_(value) { return /^supabase-private-asset:[0-9a-f-]{36}:[A-F0-9]{64}$/i.test(String(value||'')); }
function signatureRef_(value) { return /^supabase-request-signature:[0-9a-f-]{36}:[A-F0-9]{64}$/i.test(String(value||'')); }
function finite_(value) { return typeof value==='number' && isFinite(value); }
function blank_(value) { return value==='' || value===null; }
function sameRow_(left,right) { return left.length===right.length && left.every(function(value,index){ return String(value)===String(right[index]); }); }
function hexDigest_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(value),Utilities.Charset.UTF_8)
    .map(function(byte){return ((byte<0?byte+256:byte).toString(16).padStart(2,'0'));}).join('').toUpperCase();
}
function criteriaDateIso_(spreadsheet,fund,primary,fallback) {
  const value=primary!==''&&primary!==null?primary:fallback;
  if(Object.prototype.toString.call(value)==='[object Date]'&&!isNaN(value.getTime())) return Utilities.formatDate(value,spreadsheet.getSpreadsheetTimeZone()||'America/Phoenix','yyyy-MM-dd');
  const raw=String(value==null?'':value).trim();
  const serialized=raw.match(/^Date\((\d{4}),(\d{1,2}),(\d{1,2})/);
  if(serialized)return serialized[1]+'-'+String(Number(serialized[2])+1).padStart(2,'0')+'-'+String(Number(serialized[3])).padStart(2,'0');
  const match=(raw+' '+fund).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return match?match[3]+'-'+String(Number(match[2])).padStart(2,'0')+'-'+String(Number(match[1])).padStart(2,'0'):'';
}
function criterionIdentity_(spreadsheet,rowNumber,values,display) {
  const fund=String(display[2]||'').trim();
  const eventDate=criteriaDateIso_(spreadsheet,fund,values[13],values[7]);
  const canonical=[String(display[0]||'').trim(),String(display[1]||'').trim(),fund,String(Number(values[3])),String(Number(values[4])),String(display[5]||'').trim(),eventDate].join('\u001f');
  return 'CRITERIA_V1:'+rowNumber+':'+hexDigest_(canonical);
}
function normalizeVisibility_(value) {
  const mode=String(value==null?'':value).trim().toUpperCase()||'AUTO';
  if(!['AUTO','MOSTRAR','OCULTAR'].includes(mode))throw new Error('VISIBILITY_VALUE_INVALID');
  return mode;
}
function criteriaSheet_(spreadsheet,requireVisibilityHeader) {
  if(String(spreadsheet.getId())!==HANDOFF_SPREADSHEET_ID)throw new Error('WORKBOOK_ID_MISMATCH');
  const sheet=spreadsheet.getSheetByName(CRITERIA_SHEET_NAME);
  if(!sheet)throw new Error('CRITERIA_SHEET_MISSING');
  const base=sheet.getRange(1,1,1,CRITERIA_BASE_HEADER.length).getDisplayValues()[0];
  if(base.some(function(value,index){return value!==CRITERIA_BASE_HEADER[index];}))throw new Error('CRITERIA_SCHEMA_MISMATCH');
  if(requireVisibilityHeader&&sheet.getRange(1,CRITERIA_VISIBILITY_COLUMN).getDisplayValue()!==CRITERIA_VISIBILITY_HEADER)throw new Error('VISIBILITY_HEADER_MISMATCH');
  return sheet;
}

function initializeVisibility_(payload) {
  const expectedSecret=PropertiesService.getScriptProperties().getProperty(HANDOFF_SECRET_PROPERTY);
  if(!expectedSecret||!constantTimeEqual_(payload.secret,expectedSecret))return failure_('UNAUTHORIZED');
  if(Object.keys(payload).some(function(key){return !['action','secret'].includes(key);}))return failure_('INVALID_FIELD');
  const lock=LockService.getScriptLock();if(!lock.tryLock(20000))return failure_('VISIBILITY_BUSY');
  try {
    const spreadsheet=SpreadsheetApp.openById(HANDOFF_SPREADSHEET_ID),sheet=criteriaSheet_(spreadsheet,false),lastRow=Math.max(1,sheet.getLastRow());
    const candidate=sheet.getRange(1,CRITERIA_VISIBILITY_COLUMN,lastRow,11);
    const currentHeader=sheet.getRange(1,CRITERIA_VISIBILITY_COLUMN).getDisplayValue();
    if(currentHeader===CRITERIA_VISIBILITY_HEADER)return jsonResponse_({ok:true,action:'visibility_initialize',column:'P',header:CRITERIA_VISIBILITY_HEADER,idempotent:true});
    const hasValue=candidate.getDisplayValues().some(function(row){return row.some(function(value){return value!=='';});});
    const hasFormula=candidate.getFormulas().some(function(row){return row.some(function(value){return value!=='';});});
    const hasNote=candidate.getNotes().some(function(row){return row.some(function(value){return value!=='';});});
    const hasValidation=candidate.getDataValidations().some(function(row){return row.some(function(value){return value!==null;});});
    const hasMerge=sheet.getRange(1,CRITERIA_VISIBILITY_COLUMN,lastRow,11).getMergedRanges().length>0;
    if(hasValue||hasFormula||hasNote||hasValidation||hasMerge)throw new Error('VISIBILITY_COLUMN_NOT_UNUSED');
    sheet.getRange(1,CRITERIA_VISIBILITY_COLUMN).setValue(CRITERIA_VISIBILITY_HEADER);SpreadsheetApp.flush();
    if(sheet.getRange(1,CRITERIA_VISIBILITY_COLUMN).getDisplayValue()!==CRITERIA_VISIBILITY_HEADER)throw new Error('VISIBILITY_HEADER_WRITE_FAILED');
    return jsonResponse_({ok:true,action:'visibility_initialize',column:'P',header:CRITERIA_VISIBILITY_HEADER,idempotent:false});
  } finally {lock.releaseLock();}
}

function writeVisibility_(payload) {
  const expectedSecret=PropertiesService.getScriptProperties().getProperty(HANDOFF_SECRET_PROPERTY);
  if(!expectedSecret||!constantTimeEqual_(payload.secret,expectedSecret))return failure_('UNAUTHORIZED');
  if(Object.keys(payload).some(function(key){return !VISIBILITY_KEYS.has(key);}))return failure_('INVALID_FIELD');
  const operationId=String(payload.operation_id||''),identity=String(payload.criterion_identity||''),mode=String(payload.visibility_mode||''),reason=String(payload.reason||'').trim();
  if(!validUuid_(operationId)||!/^CRITERIA_V1:\d+:[A-F0-9]{64}$/.test(identity)||!['AUTO','MOSTRAR','OCULTAR'].includes(mode)||reason.length>500||(mode!=='AUTO'&&reason.length<8))return failure_('INVALID_VISIBILITY_REQUEST');
  const rowNumber=Number(identity.split(':')[1]);
  const lock=LockService.getScriptLock();if(!lock.tryLock(20000))return failure_('VISIBILITY_BUSY');
  try {
    const spreadsheet=SpreadsheetApp.openById(HANDOFF_SPREADSHEET_ID),sheet=criteriaSheet_(spreadsheet,true);
    if(rowNumber<2||rowNumber>sheet.getLastRow())throw new Error('CRITERION_ROW_NOT_FOUND');
    const values=sheet.getRange(rowNumber,1,1,CRITERIA_VISIBILITY_COLUMN).getValues()[0],display=sheet.getRange(rowNumber,1,1,CRITERIA_VISIBILITY_COLUMN).getDisplayValues()[0];
    if(criterionIdentity_(spreadsheet,rowNumber,values,display)!==identity)throw new Error('CRITERION_FINGERPRINT_MISMATCH');
    const target=sheet.getRange(rowNumber,CRITERIA_VISIBILITY_COLUMN);
    if(target.getFormula())throw new Error('VISIBILITY_TARGET_FORMULA_PROTECTED');
    const previous=normalizeVisibility_(display[15]);
    target.setValue(mode);SpreadsheetApp.flush();
    if(normalizeVisibility_(target.getDisplayValue())!==mode)throw new Error('VISIBILITY_READBACK_FAILED');
    return jsonResponse_({ok:true,action:'visibility_write',operation_id:operationId,criterion_identity:identity,
      sheet_row:rowNumber,fund:String(display[2]),previous_visibility:previous,visibility_mode:mode,
      changed_at:new Date().toISOString(),source:'SUTIAPP_ADMIN'});
  } finally {lock.releaseLock();}
}

function validatePayload_(payload) {
  if(!payload||payload.action!=='handoff') return 'INVALID_ACTION';
  if(Object.keys(payload).some(function(key){return !HANDOFF_KEYS.has(key);})) return 'INVALID_FIELD';
  if(payload.contract_version!==CONTRACT_VERSION) return 'CONTRACT_VERSION_MISMATCH';
  if(!validUuid_(payload.program_request_id)||!validUuid_(payload.affiliate_id)) return 'INVALID_UUID';
  if(payload.product_id!=null&&payload.product_id!==''&&!validUuid_(payload.product_id)) return 'INVALID_PRODUCT_ID';
  if(payload.request_status!=='approved') return 'NON_APPROVED_REQUEST';
  if(!/^[A-F0-9]{64}$/.test(String(payload.payload_sha256||''))) return 'INVALID_PAYLOAD_HASH';
  if(!String(payload.numero_control||'').trim()||!String(payload.program||'').trim()) return 'REQUIRED_FIELD_MISSING';
  if(!Array.isArray(payload.row)||payload.row.length!==TARGET_HEADERS.length) return 'INVALID_ROW_LENGTH';
  const row=payload.row;
  if(row.some(function(value){return /UNKNOWN|#N\/A/i.test(String(value==null?'':value));})) return 'UNRESOLVED_VALUE';
  if(!blank_(row[0])||String(row[1])!==String(payload.numero_control)||!String(row[2]||'').trim()) return 'ROW_IDENTITY_MISMATCH';
  if(!['1','3','JUB','Confianza'].includes(String(row[3]))||!String(row[4]||'').trim()) return 'INVALID_PROCESS_OR_FUND';
  if(!finite_(row[5])||row[5]<0||row[5]>1||!Number.isInteger(row[6])||row[6]<=0) return 'INVALID_RATE_OR_TERM';
  if(![7,8,13].every(function(index){return finite_(row[index])&&row[index]>=0;})) return 'INVALID_AMOUNT';
  if(isNaN(Date.parse(String(row[9]||'')))||![10,11,12].every(function(index){return String(row[index]||'').trim();})) return 'INVALID_PROFILE';
  if(!['AFILIADO','NO AFILIADO'].includes(String(row[12]))) return 'INVALID_AFFILIATION';
  if(![14,15,16,17,18].every(function(index){return privateAssetRef_(row[index]);})) return 'REQUIRED_PRIVATE_DOCUMENT_MISSING';
  const guarantor=[19,20,21,22].map(function(index){return row[index];});
  if(!(guarantor.every(blank_)||guarantor.every(privateAssetRef_))) return 'GUARANTOR_DOCUMENT_SET_INCOMPLETE';
  if(row[23]!==true||row[24]!=='Iniciado'||![25,26,27,28,29,30].every(function(index){return blank_(row[index]);})) return 'INVALID_INITIAL_STATE';
  if(!signatureRef_(row[31])||!String(row[32]||'').trim()||![33,34,35,36,37].every(function(index){return blank_(row[index]);})) return 'INVALID_SIGNATURE_OR_RESERVED_FIELDS';
  return '';
}

function validateSheet_(sheet,headers,errorCode) {
  if(!sheet) throw new Error(errorCode+'_MISSING');
  const actual=sheet.getRange(1,1,1,headers.length).getDisplayValues()[0];
  if(actual.some(function(value,index){return value!==headers[index];})) throw new Error(errorCode+'_SCHEMA_MISMATCH');
}
function findRegistry_(sheet,requestId) {
  const height=Math.max(1,sheet.getLastRow()-1);
  return sheet.getRange(2,1,height,1).createTextFinder(requestId).matchEntireCell(true).findNext();
}
function finishRegistry_(registry,rowNumber,now) {
  registry.getRange(rowNumber,11,1,6).setValues([['processed',registry.getRange(rowNumber,12).getDisplayValue(),registry.getRange(rowNumber,13).getDisplayValue(),now,'','']]);
}

function receiveHandoff_(payload) {
  const expectedSecret=PropertiesService.getScriptProperties().getProperty(HANDOFF_SECRET_PROPERTY);
  if(!expectedSecret||!constantTimeEqual_(payload.secret,expectedSecret)) return failure_('UNAUTHORIZED');
  const validationError=validatePayload_(payload); if(validationError) return failure_(validationError);
  const lock=LockService.getScriptLock(); if(!lock.tryLock(20000)) return failure_('HANDOFF_BUSY');
  try {
    const spreadsheet=SpreadsheetApp.openById(HANDOFF_SPREADSHEET_ID);
    if(String(spreadsheet.getId())!==HANDOFF_SPREADSHEET_ID) throw new Error('WORKBOOK_ID_MISMATCH');
    const registry=spreadsheet.getSheetByName(HANDOFF_SHEET_NAME),target=spreadsheet.getSheetByName(TARGET_SHEET_NAME);
    validateSheet_(registry,HANDOFF_HEADERS,'HANDOFF'); validateSheet_(target,TARGET_HEADERS,'TARGET');
    if(Number(target.getSheetId())!==TARGET_SHEET_ID) throw new Error('TARGET_SHEET_ID_MISMATCH');
    const requestId=String(payload.program_request_id).toLowerCase(),now=new Date().toISOString();
    let registryMatch=findRegistry_(registry,requestId),registryRow,targetRow,idempotent=false;
    const lockedValidationError=validatePayload_(payload); if(lockedValidationError) return failure_(lockedValidationError);
    if(registryMatch) {
      registryRow=registryMatch.getRow(); const saved=registry.getRange(registryRow,1,1,HANDOFF_HEADERS.length).getDisplayValues()[0];
      if(saved[12]!=='PAYLOAD_SHA256:'+payload.payload_sha256) throw new Error('REGISTRY_HASH_MISMATCH');
      const match=String(saved[11]||'').match(/^Historial de solicitudes!A(\d+)$/); if(!match) throw new Error('REGISTRY_REFERENCE_INVALID');
      targetRow=Number(match[1]); const existing=target.getRange(targetRow,1,1,TARGET_HEADERS.length).getValues()[0];
      if(existing.some(function(value){return !blank_(value);})&&!sameRow_(existing,payload.row)) throw new Error('TARGET_RESERVED_ROW_MISMATCH');
      if(saved[10]==='processed') {
        if(!sameRow_(existing,payload.row)) throw new Error('TARGET_VERIFICATION_FAILED');
        return jsonResponse_({ok:true,action:'handoff',accepted:true,idempotent:true,program_request_id:requestId,
          processing_status:'exported',google_row:targetRow,legacy_reference:saved[11],payload_sha256:payload.payload_sha256});
      }
      if(saved[10]!=='processing') throw new Error('REGISTRY_STATE_INVALID');
      idempotent=existing.some(function(value){return !blank_(value);});
    } else {
      targetRow=target.getLastRow()+1; registryRow=registry.getLastRow()+1;
      const reference=TARGET_SHEET_NAME+'!A'+targetRow;
      registry.getRange(registryRow,1,1,HANDOFF_HEADERS.length).setValues([[
        requestId,String(payload.affiliate_id).toLowerCase(),String(payload.numero_control),String(payload.program),
        payload.product_id==null?'':String(payload.product_id).toLowerCase(),String(payload.request_type||''),String(payload.request_status),
        payload.requested_amount==null?'':payload.requested_amount,new Date(payload.request_created_at).toISOString(),now,'processing',
        reference,'PAYLOAD_SHA256:'+payload.payload_sha256,now,'',''
      ]]);
      registry.getRange(registryRow,1,1,5).setNumberFormat('@'); SpreadsheetApp.flush();
    }
    const existing=target.getRange(targetRow,1,1,TARGET_HEADERS.length).getValues()[0];
    if(existing.every(blank_)) {
      target.getRange(targetRow,1,1,TARGET_HEADERS.length).setValues([payload.row]);
      target.getRange(targetRow,1,1,5).setNumberFormat('@');
    }
    SpreadsheetApp.flush();
    const verified=target.getRange(targetRow,1,1,TARGET_HEADERS.length).getValues()[0];
    if(!sameRow_(verified,payload.row)) throw new Error('TARGET_VERIFICATION_FAILED');
    finishRegistry_(registry,registryRow,now); SpreadsheetApp.flush();
    return jsonResponse_({ok:true,action:'handoff',accepted:true,idempotent:idempotent,program_request_id:requestId,
      processing_status:'exported',google_row:targetRow,legacy_reference:TARGET_SHEET_NAME+'!A'+targetRow,payload_sha256:payload.payload_sha256});
  } finally { lock.releaseLock(); }
}

// Keep UUID/ISO in the immutable transport; render folio and a native date in A/J.
function requestRegisterDate_(value) {
  const match=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})T/);
  if(!match)throw new Error('REQUEST_SYNC_DATE_INVALID');
  const day=match[1]+'-'+match[2]+'-'+match[3],ms=Date.parse(day+'T00:00:00Z');
  if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,10)!==day)throw new Error('REQUEST_SYNC_DATE_INVALID');
  return {serial:ms/86400000+25569,display:match[3]+'/'+match[2]+'/'+match[1]};
}
function requestRegisterStatus_(status) { return status==='APROBADO'?'Aprobado':status; }

// Same workbook, registry, authentication and lock. No workflow or financial decisions.
function receiveRequestSync_(payload) {
  const registerHeaders=TARGET_HEADERS.slice(0,33); // A:AG only; owner excludes AH onward.
  // A newly inserted row inherits the sheet's unchecked terms checkbox in X.
  // Only an otherwise empty reserved row may be initialized; no identified row is overwritten.
  const emptyReservedRow=function(values){return values.every(function(value,index){return blank_(value)||(index===23&&value===false);});};
  const expected=PropertiesService.getScriptProperties().getProperty(HANDOFF_SECRET_PROPERTY);
  if(!expected||!constantTimeEqual_(payload.secret,expected))return failure_('UNAUTHORIZED');
  const keys=new Set(['action','secret','contract_version','program_request_id','affiliate_id','numero_control','program','product_id','request_type','request_status','requested_amount','request_created_at','revision','desired_status','row','payload_sha256','request_folio']);
  if(Object.keys(payload).some(function(key){return !keys.has(key);})||!['REQUEST_REGISTER_V1','REQUEST_REGISTER_V2'].includes(payload.contract_version))return failure_('INVALID_REQUEST_SYNC_CONTRACT');
  const suppliedFolio=payload.request_folio;
  if((payload.contract_version==='REQUEST_REGISTER_V2'||suppliedFolio!=null)&&!/^SR-\d{4}-\d{6,}$/.test(suppliedFolio||''))return failure_('REQUEST_SYNC_FOLIO_INVALID');
  const id=String(payload.program_request_id||'').toLowerCase(),row=payload.row;
  const desired=payload.request_status==='approved'?'APROBADO':['rejected','cancelled'].includes(payload.request_status)?'Rechazado':'PENDIENTE';
  if(!validUuid_(id)||!validUuid_(payload.affiliate_id)||!Number.isSafeInteger(payload.revision)||payload.revision<1||
    !['submitted','requires_financial_processing','in_review','approved','rejected','cancelled'].includes(payload.request_status)||payload.desired_status!==desired||
    !Array.isArray(row)||row.length!==registerHeaders.length||row[0]!==id||row[1]!==payload.numero_control||row[24]!=='PENDIENTE'||
    row.some(function(value){return value!==null&&!['string','number','boolean'].includes(typeof value);})||
    hexDigest_(JSON.stringify(row))!==payload.payload_sha256)return failure_('INVALID_REQUEST_SYNC_PAYLOAD');
  const lock=LockService.getScriptLock();if(!lock.tryLock(20000))return failure_('HANDOFF_BUSY');
  try {
    const book=SpreadsheetApp.openById(HANDOFF_SPREADSHEET_ID),target=book.getSheetByName(TARGET_SHEET_NAME),registry=book.getSheetByName(HANDOFF_SHEET_NAME);
    validateSheet_(target,registerHeaders,'TARGET');validateSheet_(registry,HANDOFF_HEADERS,'HANDOFF');
    if(String(book.getId())!==HANDOFF_SPREADSHEET_ID||Number(target.getSheetId())!==TARGET_SHEET_ID)throw new Error('TARGET_SHEET_ID_MISMATCH');
    const registrations=registry.getRange(2,1,Math.max(1,registry.getLastRow()-1),1).createTextFinder(id).matchEntireCell(true).findAll();
    if(registrations.length>1)throw new Error('REQUEST_SYNC_DUPLICATE_ID');
    const registryRow=registrations.length?registrations[0].getRow():registry.getLastRow()+1;
    let saved=registrations.length?registry.getRange(registryRow,1,1,HANDOFF_HEADERS.length).getValues()[0]:null,meta=null;
    if(saved){
      if(!String(saved[12]).startsWith('REQUEST_SYNC_V1:'))throw new Error('REQUEST_SYNC_LEGACY_REGISTRY_REQUIRES_REVIEW');
      meta=JSON.parse(String(saved[12]).slice('REQUEST_SYNC_V1:'.length));
      if(meta.initial_sha256!==payload.payload_sha256)throw new Error('REGISTRY_HASH_MISMATCH');
    }
    if(meta&&meta.folio&&suppliedFolio&&meta.folio!==suppliedFolio)throw new Error('REQUEST_SYNC_FOLIO_INVALID');
    const folio=suppliedFolio||(meta&&meta.folio)||null,date=folio?requestRegisterDate_(row[9]):null;
    const identityRange=target.getRange(2,1,Math.max(1,target.getLastRow()-1),1);
    const matches=identityRange.createTextFinder(id).matchEntireCell(true).findAll().concat(folio?identityRange.createTextFinder(folio).matchEntireCell(true).findAll():[]);
    if(matches.length>1)throw new Error('REQUEST_SYNC_DUPLICATE_ID');
    let targetRow=matches.length?matches[0].getRow():null;
    if(saved){
      const reference=String(saved[11]).match(/^Historial de solicitudes!A(\d+)$/);
      if(!reference||Number(reference[1])<2)throw new Error('REGISTRY_REFERENCE_INVALID');
      // A confirmed row that disappeared must never be recreated at a reused position.
      if(!targetRow&&Number(meta.revision||0)>0)throw new Error('REQUEST_SYNC_TARGET_MISSING');
      if(!targetRow){
        if(Number(reference[1])>target.getMaxRows()+1)throw new Error('REGISTRY_REFERENCE_INVALID');
        targetRow=Number(reference[1]);if(targetRow<=target.getMaxRows()){const reserved=target.getRange(targetRow,1,1,registerHeaders.length).getValues()[0];if(!emptyReservedRow(reserved))throw new Error('TARGET_RESERVED_ROW_MISMATCH');}
      }
    }
    if(!targetRow)targetRow=target.getLastRow()+1;
    if(targetRow>target.getMaxRows())target.insertRowsAfter(target.getMaxRows(),targetRow-target.getMaxRows());
    if(registryRow>registry.getMaxRows())registry.insertRowsAfter(registry.getMaxRows(),registryRow-registry.getMaxRows());
    const now=new Date().toISOString(),reference=TARGET_SHEET_NAME+'!A'+targetRow;
    if(!saved){
      meta={revision:0,initial_sha256:payload.payload_sha256};if(folio)meta.folio=folio;
      registry.getRange(registryRow,1,1,5).setNumberFormat('@');
      registry.getRange(registryRow,1,1,HANDOFF_HEADERS.length).setValues([[id,payload.affiliate_id,payload.numero_control,payload.program,payload.product_id||'',payload.request_type,payload.request_status,payload.requested_amount==null?'':payload.requested_amount,payload.request_created_at,now,'processing',reference,'REQUEST_SYNC_V1:'+JSON.stringify(meta),now,'','']]);
      registry.getRange(registryRow,1,1,5).setNumberFormat('@');SpreadsheetApp.flush();
    }
    const existing=target.getRange(targetRow,1,1,registerHeaders.length).getValues()[0];
    if(emptyReservedRow(existing)){
      if(meta.initial_sha256!==payload.payload_sha256)throw new Error('REGISTRY_HASH_MISMATCH');
      if(target.getRange(targetRow,1,1,registerHeaders.length).getFormulas()[0].some(Boolean))throw new Error('TARGET_RESERVED_ROW_MISMATCH');
      const visible=row.slice();if(folio){visible[0]=folio;visible[9]=date.serial;}
      const range=target.getRange(targetRow,1,1,registerHeaders.length);range.setNumberFormat('@');range.setValues([visible.map(function(value){return typeof value==='string'&&/^[=+@]/.test(value)?"'"+value:value;})]);
      SpreadsheetApp.flush();
      if(!sameRow_(range.getValues()[0],visible))throw new Error('TARGET_VERIFICATION_FAILED');
      if(folio)target.getRange(targetRow,10).setNumberFormat('dd/MM/yyyy');
    }
    const identityCell=target.getRange(targetRow,1),dateCell=target.getRange(targetRow,10),currentId=identityCell.getDisplayValue();
    if(![id,folio].includes(currentId)||String(target.getRange(targetRow,2).getValue())!==String(payload.numero_control))throw new Error('TARGET_VERIFICATION_FAILED');
    if(folio){
      if(identityCell.getFormula()||dateCell.getFormula())throw new Error('REQUEST_SYNC_PRESENTATION_FORMULA_PROTECTED');
      const currentDate=dateCell.getValue(),dateDisplay=dateCell.getDisplayValue();
      if(String(currentDate)!==String(row[9])&&currentDate!==date.serial&&dateDisplay!==date.display)throw new Error('REQUEST_SYNC_DATE_INVALID');
      // Save the folio before changing A so an interrupted retry (including V1) can find it.
      if(!meta.folio){meta.folio=folio;registry.getRange(registryRow,13).setValue('REQUEST_SYNC_V1:'+JSON.stringify(meta));SpreadsheetApp.flush();}
      if(currentId!==folio)identityCell.setValue(folio);
      if(dateDisplay!==date.display){dateCell.setValue(date.serial);dateCell.setNumberFormat('dd/MM/yyyy');SpreadsheetApp.flush();}
      if(identityCell.getDisplayValue()!==folio||dateCell.getDisplayValue()!==date.display)throw new Error('TARGET_VERIFICATION_FAILED');
    }
    // Only after unique identity, control, date and hash verification may the locator move.
    if(saved&&(String(saved[11])!==reference||['error','failed'].includes(saved[10]))){
      const referenceCell=registry.getRange(registryRow,12);
      if(referenceCell.getFormula())throw new Error('REGISTRY_REFERENCE_INVALID');
      registry.getRange(registryRow,11,1,6).setValues([['processed',reference,'REQUEST_SYNC_V1:'+JSON.stringify(meta),now,'','']]);SpreadsheetApp.flush();
      if(referenceCell.getDisplayValue()!==reference)throw new Error('TARGET_VERIFICATION_FAILED');
    }
    if(payload.revision>Number(meta.revision||0)){
      const stateCell=target.getRange(targetRow,25);
      if(stateCell.getFormula())throw new Error('REQUEST_SYNC_STATUS_FORMULA_PROTECTED');
      const visibleStatus=requestRegisterStatus_(desired);
      stateCell.setValue(visibleStatus);SpreadsheetApp.flush();
      if(stateCell.getDisplayValue()!==visibleStatus)throw new Error('TARGET_VERIFICATION_FAILED');
      meta.revision=payload.revision;meta.status=desired;
      registry.getRange(registryRow,7).setValue(payload.request_status);
      registry.getRange(registryRow,11,1,6).setValues([['processed',reference,'REQUEST_SYNC_V1:'+JSON.stringify(meta),now,'','']]);SpreadsheetApp.flush();
    }
    return jsonResponse_({ok:true,action:'sync_request',accepted:true,program_request_id:id,google_row:targetRow,revision:meta.revision,desired_status:meta.status,idempotent:matches.length>0});
  }finally{lock.releaseLock();}
}

function doPost(event) {
  try {
    const payload=JSON.parse(event&&event.postData&&event.postData.contents||'{}');
    if(payload.action==='sync_request')return receiveRequestSync_(payload);
    if(payload.action==='visibility_initialize')return initializeVisibility_(payload);
    if(payload.action==='visibility_write')return writeVisibility_(payload);
    return receiveHandoff_(payload);
  }
  catch(error) {
    const allowed=['WORKBOOK_ID_MISMATCH','HANDOFF_MISSING','HANDOFF_SCHEMA_MISMATCH','TARGET_MISSING','TARGET_SCHEMA_MISMATCH','TARGET_SHEET_ID_MISMATCH',
      'REGISTRY_HASH_MISMATCH','REGISTRY_REFERENCE_INVALID','TARGET_RESERVED_ROW_MISMATCH','TARGET_VERIFICATION_FAILED','REGISTRY_STATE_INVALID',
      'CRITERIA_SHEET_MISSING','CRITERIA_SCHEMA_MISMATCH','VISIBILITY_HEADER_MISMATCH','VISIBILITY_COLUMN_NOT_UNUSED','VISIBILITY_HEADER_WRITE_FAILED',
      'CRITERION_ROW_NOT_FOUND','CRITERION_FINGERPRINT_MISMATCH','VISIBILITY_TARGET_FORMULA_PROTECTED','VISIBILITY_VALUE_INVALID','VISIBILITY_READBACK_FAILED',
      'REQUEST_SYNC_DUPLICATE_ID','REQUEST_SYNC_LEGACY_REGISTRY_REQUIRES_REVIEW','REQUEST_SYNC_STATUS_FORMULA_PROTECTED',
      'REQUEST_SYNC_DATE_INVALID','REQUEST_SYNC_FOLIO_INVALID','REQUEST_SYNC_PRESENTATION_FORMULA_PROTECTED','REQUEST_SYNC_TARGET_MISSING'];
    const code=error&&allowed.includes(error.message)?error.message:'INVALID_REQUEST'; return failure_(code);
  }
}
function doGet() { return failure_('METHOD_NOT_ALLOWED'); }
