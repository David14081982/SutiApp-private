/* Derived documentary review. No local persistence or financial decision writer. */
(function () {
  'use strict';
  const db = () => window.SutiSupabase.getClient();
  const context = () => window.PrivateResourceDemand.context();
  async function rpc(name, args) {
    const before = context(), r = await db().rpc(name, args);
    if (before !== context()) throw Error('DOCUMENT_CONTEXT_CHANGED');
    if (r.error) throw r.error; return r.data;
  }
  async function list(ids) {
    if (!ids.length) return [];
    try { return await rpc('list_financial_document_reviews', { p_request_ids: ids }); }
    catch (error) {
      if (error.message === 'DOCUMENT_CONTEXT_CHANGED') throw error;
      // Missing feature is explicit. It never substitutes mock/payroll-declaration data.
      const phase = error.code === 'PGRST202' || error.code === '42883' ? 'NOT_CONFIGURED' : 'ERROR';
      return ids.map(request_id => ({ request_id, phase, result: null }));
    }
  }
  const self = id => rpc('get_self_financial_document_review', { p_request_id: id });
  const reject = (id, hash, comment, actionId) => rpc('reject_with_financial_document_review', { p_request_id: id, p_source_hash: hash, p_comment: comment, p_client_action_id: actionId });
  async function invoke(body) {
    const before = context(), r = await db().functions.invoke('financial-document-review', { body });
    if (before !== context()) throw Error('DOCUMENT_CONTEXT_CHANGED');
    if (r.error) { let code = r.data?.error; try { code ||= (await r.error.context.clone().json()).error; } catch (_) {} throw Error(code || 'DOCUMENT_REVIEW_OPERATION_UNAVAILABLE'); }
    return r.data;
  }
  async function replace(review, document, file, operationId, progress) {
    const before = context(), type = { ...document, id: document.document_type_id };
    const preparedFile = await window.DocumentWorkflowRepository.prepareFile(type, file, progress, 'file');
    if (before !== context()) throw Error('DOCUMENT_CONTEXT_CHANGED');
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await preparedFile.arrayBuffer())), b => b.toString(16).padStart(2, '0')).join('');
    const prepared = await invoke({ action: 'PREPARE_CORRECTION', operation_id: operationId, request_id: review.request_id, association_id: document.id, source_hash: review.source_hash, mime: preparedFile.type, size: preparedFile.size, sha256: digest });
    if (prepared.state !== 'COMPLETE') {
      progress('uploading');
      const r = await db().storage.from(prepared.bucket).upload(prepared.path, preparedFile, { upsert: false, contentType: preparedFile.type });
      if (before !== context()) throw Error('DOCUMENT_CONTEXT_CHANGED');
      if (r.error && !/already exists|duplicate/i.test(r.error.message || '')) throw r.error;
    }
    progress('verifying');
    const result = await invoke({ action: 'COMPLETE_CORRECTION', operation_id: prepared.operation_id });
    window.dispatchEvent(new Event('suti:request-changed'));
    return result;
  }
  function message(error) {
    const text = String(error?.message || '');
    if (text.includes('CORRECTION_SHARED_DOCUMENT')) return 'El documento también pertenece a otro expediente. Finanzas debe revisar su sustitución.';
    if (/CORRECTION_REQUEST_CLOSED/.test(text)) return 'La solicitud ya fue resuelta. Actualiza su seguimiento.';
    if (/CORRECTION_UPLOAD_ALREADY_PENDING/.test(text)) return 'Hay una carga pendiente. Vuelve a seleccionar el mismo archivo para completar la sustitución.';
    if (/CORRECTION_OBSERVATION_CHANGED|DOCUMENT_VERSION_CONFLICT/.test(text)) return 'El expediente cambió. Actualiza antes de sustituir el documento.';
    if (/INVALID_DOCUMENT_FILE/.test(text)) return 'El formato o tamaño del archivo no está permitido.';
    return 'No se pudo confirmar la sustitución. Puedes reintentar con el mismo archivo.';
  }
  window.FinancialDocumentReviewRepository = Object.freeze({ list, self, replace, message, reject });
})();
