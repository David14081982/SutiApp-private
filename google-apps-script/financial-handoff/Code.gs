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

function doPost(event) {
  try {
    const payload=JSON.parse(event&&event.postData&&event.postData.contents||'{}');
    if(payload.action==='visibility_initialize')return initializeVisibility_(payload);
    if(payload.action==='visibility_write')return writeVisibility_(payload);
    return receiveHandoff_(payload);
  }
  catch(error) {
    const allowed=['WORKBOOK_ID_MISMATCH','HANDOFF_MISSING','HANDOFF_SCHEMA_MISMATCH','TARGET_MISSING','TARGET_SCHEMA_MISMATCH','TARGET_SHEET_ID_MISMATCH',
      'REGISTRY_HASH_MISMATCH','REGISTRY_REFERENCE_INVALID','TARGET_RESERVED_ROW_MISMATCH','TARGET_VERIFICATION_FAILED','REGISTRY_STATE_INVALID',
      'CRITERIA_SHEET_MISSING','CRITERIA_SCHEMA_MISMATCH','VISIBILITY_HEADER_MISMATCH','VISIBILITY_COLUMN_NOT_UNUSED','VISIBILITY_HEADER_WRITE_FAILED',
      'CRITERION_ROW_NOT_FOUND','CRITERION_FINGERPRINT_MISMATCH','VISIBILITY_TARGET_FORMULA_PROTECTED','VISIBILITY_VALUE_INVALID','VISIBILITY_READBACK_FAILED'];
    const code=error&&allowed.includes(error.message)?error.message:'INVALID_REQUEST'; return failure_(code);
  }
}
function doGet() { return failure_('METHOD_NOT_ALLOWED'); }
