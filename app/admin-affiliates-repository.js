/* Admin Affiliates boundary: UI -> permission-gated RPCs -> public.affiliates. */
(function(){
  'use strict';
  function db(){return window.SutiSupabase.getClient();}
  const MAX_DOCUMENT_SIZE=100*1024*1024;
  function requirePermission(permission){if(!window.AdminRepository||!window.AdminRepository.has(permission))throw new Error('ADMIN_DENIED');}
  function clean(value){return value===undefined||value===''?null:value;}
  function extension(file){const value=String(file&&file.name||'').split('.').pop().toLowerCase();return /^[a-z0-9]{1,8}$/.test(value)?'.'+value:'';}
  function hex(buffer){return Array.from(new Uint8Array(buffer)).map((value)=>value.toString(16).padStart(2,'0')).join('').toUpperCase();}
  async function list(filters){
    requirePermission('affiliates.read');const f=filters||{};
    const archived=f.archived===true;
    const result=archived?await db().rpc('list_admin_archived_affiliates',{
      p_query:clean(f.query),p_page:Number(f.page)||1,p_page_size:Number(f.pageSize)||25,p_sort:f.sort||'recent'
    }):await db().rpc('list_admin_affiliates',{
      p_query:clean(f.query),p_status:clean(f.status),p_auth_linked:f.authLinked===''||f.authLinked===undefined?null:Boolean(f.authLinked),
      p_document_state:clean(f.documentState),p_has_pending_documents:f.pendingDocuments===''||f.pendingDocuments===undefined?null:Boolean(f.pendingDocuments),
      p_union_code:clean(f.unionCode),p_category_code:clean(f.categoryCode),p_page:Number(f.page)||1,p_page_size:Number(f.pageSize)||25,p_sort:f.sort||'name'
    });
    if(result.error)throw result.error;return Object.freeze(result.data||{items:[],total:0,page:1,page_size:25,filter_options:{}});
  }
  async function detail(id){
    requirePermission('affiliates.read');const result=await db().rpc('get_admin_affiliate_workbench',{p_affiliate_id:id});if(result.error)throw result.error;
    const data=result.data||{};
    if(window.AdminRepository.has('documents.read')&&window.DocumentWorkflowRepository){
      const canonical=await window.DocumentWorkflowRepository.listAdminDocuments(id,'ADMIN_AFFILIATE_PROFILE');
      const prior=new Map((data.documents||[]).map((row)=>[row.id,row]));
      const versions=new Map();
      canonical.slice().sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at))).forEach((row)=>{const next=(versions.get(row.document_type_id)||0)+1;versions.set(row.document_type_id,next);versions.set(row.id,next);});
      let ordinals=null;if(window.DocumentIntegration&&window.DocumentIntegration.enabled()){const result=await db().rpc('list_document_version_ordinals',{p_affiliate:id});if(result.error)throw result.error;ordinals=new Map((result.data||[]).map(r=>[r.document_id,Number(r.version)]));}
      data.documents=canonical.map((row)=>Object.freeze(Object.assign({},prior.get(row.id)||{},row,{
        type_id:row.document_type_id,type_code:row.document_type.code,type_label:row.document_type.label,
        type_description:row.document_type.description,mime_type:row.mimeType,version:ordinals?ordinals.get(row.id):versions.get(row.id)||1
      })));
    }
    return Object.freeze(data);
  }
  async function duplicates(values,excludeId){requirePermission('affiliates.read');const result=await db().rpc('find_admin_affiliate_duplicates',{p_values:values||{},p_exclude_id:excludeId||null});if(result.error)throw result.error;return Object.freeze(result.data||[]);}
  async function create(values,reason){requirePermission('affiliates.write');const result=await db().rpc('create_admin_affiliate',{p_values:values||{},p_reason:String(reason||'').trim()});if(result.error)throw result.error;return Object.freeze(result.data||{});}
  async function update(id,expectedUpdatedAt,patch,reason){requirePermission('affiliates.write');const result=await db().rpc('update_admin_affiliate',{p_affiliate_id:id,p_expected_updated_at:expectedUpdatedAt,p_patch:patch||{},p_reason:String(reason||'').trim()});if(result.error)throw result.error;return Object.freeze(result.data||{});}
  async function changeStatus(id,expectedUpdatedAt,status,reason){requirePermission('affiliates.write');const result=await db().rpc('change_admin_affiliate_status',{p_affiliate_id:id,p_expected_updated_at:expectedUpdatedAt,p_new_status:status,p_reason:String(reason||'').trim()});if(result.error)throw result.error;return Object.freeze(result.data||{});}
  async function controlRpc(name,args){requirePermission('affiliates.read');requirePermission('affiliates.write');const result=await db().rpc(name,args);if(result.error)throw result.error;if(!result.data)throw new Error('AFFILIATE_CONTROL_RESPONSE_MISSING');return Object.freeze(result.data);}
  function previewControl(id,value){return controlRpc('preview_admin_affiliate_control',{p_affiliate_id:id,p_new_control:value});}
  function changeControl(report,reason,actionId){return controlRpc('change_admin_affiliate_control',{p_affiliate_id:report.affiliate_id,p_new_control:report.new_control,p_expected_updated_at:report.expected_updated_at,p_expected_fingerprint:report.fingerprint,p_reason:reason||'',p_client_action_id:actionId});}
  function controlHistory(id){return controlRpc('list_admin_affiliate_control_changes',{p_affiliate_id:id});}
  async function archive(id,expectedUpdatedAt,reason){requirePermission('affiliates.write');const result=await db().rpc('archive_admin_affiliate',{p_affiliate_id:id,p_expected_updated_at:expectedUpdatedAt,p_reason:String(reason||'').trim()});if(result.error)throw result.error;return Object.freeze(result.data||{});}
  async function restore(id,expectedUpdatedAt,reason){requirePermission('affiliates.write');const result=await db().rpc('restore_admin_affiliate',{p_affiliate_id:id,p_expected_updated_at:expectedUpdatedAt,p_reason:String(reason||'').trim()});if(result.error)throw result.error;return Object.freeze(result.data||{});}
  async function accessDiagnosis(id){requirePermission('affiliates.read');const result=await db().rpc('get_admin_affiliate_access_diagnosis',{p_affiliate_id:id});if(result.error)throw result.error;return Object.freeze(result.data||{});}
  async function accessIssues(){requirePermission('affiliates.read');const result=await db().rpc('list_admin_affiliate_access_issues');if(result.error)throw result.error;return Object.freeze(result.data||[]);}
  async function accessRepair(action,id,expectedUpdatedAt,reason){
    requirePermission('affiliates.write');
    const name={relink:'admin_relink_affiliate_account',release:'admin_release_affiliate_account',recalculate:'admin_recalculate_affiliate_access'}[action];if(!name)throw new Error('ACCESS_ACTION_INVALID');
    const result=await db().rpc(name,{p_affiliate_id:id,p_expected_updated_at:expectedUpdatedAt,p_reason:String(reason||'').trim()});if(result.error)throw result.error;return Object.freeze(result.data||{});
  }
  async function documentTypes(){requirePermission('documents.write');const result=await db().from('document_types').select('id,code,label,description,accepted_mime_types,file_upload_allowed,max_file_size_bytes,sort_order').eq('enabled',true).eq('file_upload_allowed',true).order('sort_order',{ascending:true});if(result.error)throw result.error;return Object.freeze(result.data||[]);}
  async function documentVersion(affiliateId,documentId){requirePermission('documents.read');if(!affiliateId||!documentId)throw new Error('DOCUMENT_VERSION_UNAVAILABLE');const result=await db().rpc('list_document_version_ordinals',{p_affiliate:affiliateId});if(result.error)throw result.error;const row=(result.data||[]).find(value=>value.document_id===documentId),version=Number(row&&row.version);if(!Number.isSafeInteger(version)||version<1)throw new Error('DOCUMENT_VERSION_UNAVAILABLE');return version;}
  async function previewDocument(documentId,affiliateId){requirePermission('documents.read');if(!window.DocumentWorkflowRepository)throw new Error('DOCUMENT_PREVIEW_UNAVAILABLE');return window.DocumentWorkflowRepository.adminPreview(documentId,affiliateId,'ADMIN_AFFILIATE_PROFILE');}
  async function uploadDocument(affiliateId,type,file,reason){
    requirePermission('documents.write');if(!affiliateId||!type||!file)throw new Error('DOCUMENT_FILE_REQUIRED');
    if(window.DocumentIntegration?.enabled())file=window.DocumentIntegration.normalizeFile(file);
    const accepted=Array.isArray(type.accepted_mime_types)?type.accepted_mime_types:[];
    const limit=Math.min(MAX_DOCUMENT_SIZE,Number(type.max_file_size_bytes)||MAX_DOCUMENT_SIZE);
    if(file.size<1||file.size>limit||!accepted.includes(file.type))throw new Error('INVALID_DOCUMENT_FILE');
    if(window.DocumentIntegration&&window.DocumentIntegration.enabled())return window.DocumentWorkflowRepository.upload(type,file,{mode:'ADMIN',affiliateId,reason:reason||''});
    const digest=hex(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()));
    const path='affiliate-documents/'+affiliateId+'/'+crypto.randomUUID()+extension(file);
    const stored=await db().storage.from('private-assets').upload(path,file,{contentType:file.type,upsert:false});if(stored.error)throw stored.error;
    try{
      const result=await db().rpc('register_admin_affiliate_document',{p_affiliate_id:affiliateId,p_document_type_id:type.id,p_storage_path:path,p_mime_type:file.type,p_file_size:file.size,p_sha256:digest,p_reason:String(reason||'').trim()});
      if(result.error)throw result.error;
      const cleanup=result.data&&result.data.cleanup_storage_path;if(cleanup)await db().storage.from('private-assets').remove([cleanup]).catch(()=>{});
      return Object.freeze(result.data&&result.data.document||{});
    }catch(error){await db().storage.from('private-assets').remove([path]).catch(()=>{});throw error;}
  }
  async function profilePhoto(id){if(!window.AdminRepository.has('assets.read')||!window.AffiliateRepository)return null;try{return await window.AffiliateRepository.getProfilePhoto(id);}catch(_){return null;}}
  async function exportXlsx(filters){requirePermission('data_exports.read');const f=filters||{},exportFilters={};if(f.status)exportFilters.affiliate_status_raw=f.status;return window.DataExportRepository.download('affiliates','xlsx',exportFilters,'Afiliados');}
  /* H-AFFILIATES-GOOGLE-SHEET-001: the Edge Function rewrites the read-only SUTISSSTESON tab; the browser only opens it.
     The URL is fixed here: only the numeric tab id comes from the server. */
  const GOOGLE_SHEET_URL='https://docs.google.com/spreadsheets/d/1a9Qc8Zu2OZGNsCWCwOkWClCJfYvDem4Zlio3GNK1SLA/edit';
  async function refreshGoogleSheet(){
    requirePermission('data_exports.read');const result=await db().functions.invoke('affiliates-google-sheet',{body:{}});
    if(result.error){let code='SHEET_REFRESH_FAILED';try{const value=await result.error.context.json();code=value.error||code;}catch(_){}throw new Error(code);}
    const data=result.data||{};if(data.status!=='OK'||!Number.isInteger(data.sheet_gid)||data.sheet_gid<0||!Number.isInteger(data.rows))throw new Error('SHEET_REFRESH_FAILED');
    return Object.freeze({rows:data.rows,refreshedAt:data.refreshed_at,url:GOOGLE_SHEET_URL+'#gid='+data.sheet_gid});
  }
  async function previewDocumentDelete(affiliateId,documentId){
    requirePermission('affiliates.read');const result=await db().rpc('preview_admin_affiliate_document_delete',{p_affiliate_id:affiliateId,p_document_id:documentId});
    if(result.error)throw result.error;if(!result.data)throw new Error('DOCUMENT_DELETE_UNAVAILABLE');return Object.freeze(result.data);
  }
  async function deleteDocument(body){
    requirePermission('affiliates.read');if(window.DocumentIntegration&&window.DocumentIntegration.enabled()&&body.action==='DELETE')return window.DocumentIntegration.withdraw(body.document_id,body.operation_id,body.reason);const result=await db().functions.invoke('affiliate-document-delete',{body});
    if(result.error){let code='DOCUMENT_DELETE_UNAVAILABLE';try{const value=await result.error.context.json();code=value.error||code;}catch(_){}throw new Error(code);}
    if(!result.data||!['COMPLETE','PENDING_STORAGE'].includes(result.data.status))throw new Error('DOCUMENT_DELETE_UNAVAILABLE');return Object.freeze(result.data);
  }
  /* H-AFFILIATE-EXPEDIENTE-MODAL-001 — expediente completo y descarga ZIP.
     Solo lectura: cada lista y cada URL firmada las autoriza el backend con las consultas existentes
     (list_document_evidence / list_generated_document_evidence / document-access). Nada se guarda ni se registra. */
  function requireIntegration(){if(!window.DocumentIntegration||!window.DocumentIntegration.enabled())throw new Error('LOAN_DOSSIER_UNAVAILABLE');}
  // entries: [{domain:'program'|'savings',request}]. Cada solicitud lista sus documentos con la consulta de su dominio.
  async function requestDossier(entries){
    requirePermission('affiliates.read');requireIntegration();
    const list=(entries||[]).filter((entry)=>entry&&entry.request&&entry.request.id&&['program','savings'].includes(entry.domain)),out=[];
    for(let index=0;index<list.length;index+=4){
      out.push(...await Promise.all(list.slice(index,index+4).map(async({domain,request})=>{
        try{const[evidence,generated]=await Promise.all([window.DocumentIntegration.evidence(request.id,domain==='savings'?'SAVINGS':'REQUEST','ADMIN'),window.DocumentIntegration.generated(request.id,domain,'ADMIN')]);return Object.freeze({domain,request,evidence:Object.freeze(evidence||[]),generated:Object.freeze(generated||[]),error:false});}
        catch(_){return Object.freeze({domain,request,evidence:Object.freeze([]),generated:Object.freeze([]),error:true});}
      })));
    }
    return Object.freeze(out);
  }
  async function dossierFileUrl(kind,id,affiliateId){
    requirePermission('affiliates.read');
    if(kind==='BASE'){const preview=await previewDocument(id,affiliateId);if(!preview||!preview.signedUrl)throw new Error('DOCUMENT_PREVIEW_UNAVAILABLE');return preview.signedUrl;}
    requireIntegration();const access=await window.DocumentIntegration.access(['GENERATED','SAVINGS'].includes(kind)?kind:'REQUEST',id,'ADMIN');
    if(!access||!access.signedUrl)throw new Error('DOCUMENT_PREVIEW_UNAVAILABLE');return access.signedUrl;
  }
  async function fileBytes(file,affiliateId){const response=await fetch(await dossierFileUrl(file.kind,file.id,affiliateId),{credentials:'omit',cache:'no-store'});if(!response.ok)throw new Error('DOCUMENT_DOWNLOAD_FAILED');return response.blob();}
  function saveBlob(blob,name){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.rel='noopener';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}
  async function downloadDossierFile(file,affiliateId){requirePermission('affiliates.write');saveBlob(await fileBytes(file,affiliateId),file.fileName);}
  function pdfText(value){return String(value).replace(/[‐-―]/g,'-').replace(/[›»]/g,'>').replace(/…/g,'...').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/[^\x20-\x7E\xA0-\xFF]/g,'?').replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');}
  // Índice PDF mínimo (Helvetica, WinAnsi): texto plano, sin dependencias.
  function indexPdf(title,lines){
    const wrapped=[];[title,''].concat(lines).forEach((line,index)=>{let rest=String(line);const width=index===0?80:112;do{wrapped.push(rest.slice(0,width));rest=rest.slice(width);}while(rest.length);});
    const pages=[];for(let index=0;index<wrapped.length;index+=52)pages.push(wrapped.slice(index,index+52));
    const objects=[];objects[1]='<< /Type /Catalog /Pages 2 0 R >>';objects[3]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';objects[4]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    const kids=[];let next=5;
    pages.forEach((page,pageIndex)=>{const pageId=next++,contentId=next++;let y=752,stream='BT\n';kids.push(pageId+' 0 R');
      page.forEach((line,lineIndex)=>{const heading=pageIndex===0&&lineIndex===0;stream+=(heading?'/F2 12':'/F1 9')+' Tf\n1 0 0 1 40 '+y+' Tm\n('+pdfText(line)+') Tj\n';y-=heading?20:13.5;});
      stream+='ET';objects[pageId]='<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents '+contentId+' 0 R >>';objects[contentId]='<< /Length '+stream.length+' >>\nstream\n'+stream+'\nendstream';});
    objects[2]='<< /Type /Pages /Kids ['+kids.join(' ')+'] /Count '+kids.length+' >>';
    let out='%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';const offsets=[];
    for(let id=1;id<objects.length;id++){offsets[id]=out.length;out+=id+' 0 obj\n'+objects[id]+'\nendobj\n';}
    const xref=out.length;out+='xref\n0 '+objects.length+'\n0000000000 65535 f \n';for(let id=1;id<objects.length;id++)out+=String(offsets[id]).padStart(10,'0')+' 00000 n \n';
    out+='trailer\n<< /Size '+objects.length+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';
    const bytes=new Uint8Array(out.length);for(let index=0;index<out.length;index++)bytes[index]=out.charCodeAt(index)&255;return bytes;
  }
  // ZIP en el navegador con los archivos que la cuenta ya puede abrir. Sin compresión (imágenes/PDF ya comprimidos).
  async function downloadDossierZip({zipName,folder,files,affiliateId,index,onProgress}){
    requirePermission('affiliates.write');if(!window.JSZip)throw new Error('ZIP_UNAVAILABLE');if(!files||!files.length)throw new Error('ZIP_EMPTY');
    const zip=new window.JSZip(),queue=files.slice(),failed=[];let done=0;
    const worker=async()=>{for(;;){const file=queue.shift();if(!file)return;try{zip.file(file.path,await fileBytes(file,affiliateId),{binary:true});}catch(_){failed.push(file);}done++;if(onProgress)onProgress(done,files.length);}};
    await Promise.all([worker(),worker(),worker()]);
    if(failed.length===files.length)throw new Error('ZIP_FILES_UNAVAILABLE');
    if(index)zip.file(index.name,indexPdf(index.title,index.lines(failed)),{binary:true});
    if(failed.length)zip.file((folder?folder+'/':'')+'ARCHIVOS_NO_INCLUIDOS.txt','No se pudieron descargar estos archivos al preparar el ZIP:\r\n'+failed.map((file)=>file.path).join('\r\n')+'\r\n');
    saveBlob(await zip.generateAsync({type:'blob',compression:'STORE'}),zipName);
    return Object.freeze({included:files.length-failed.length,failed:failed.length});
  }
  window.AdminAffiliatesRepository=Object.freeze({list,detail,duplicates,create,update,changeStatus,previewControl,changeControl,controlHistory,archive,restore,accessDiagnosis,accessIssues,accessRepair,documentTypes,documentVersion,uploadDocument,previewDocument,previewDocumentDelete,deleteDocument,profilePhoto,exportXlsx,refreshGoogleSheet,requestDossier,dossierFileUrl,downloadDossierFile,downloadDossierZip,MAX_DOCUMENT_SIZE});
})();

