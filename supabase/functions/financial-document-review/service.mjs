import { Buffer } from 'node:buffer';
import { evaluate } from './engine.mjs';
import { extractWithOpenAI } from './openai.mjs';
export async function rpc(client, name, args = {}) {
  const r = await client.rpc(name, args); if (r.error) throw r.error; return r.data;
}
async function attachment(service, d) {
  if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(d.mime) || d.asset_status !== 'READY' || !['private-assets'].includes(d.bucket) || d.size < 1 || d.size > 20 * 1024 * 1024) throw Error('DOCUMENT_NOT_ANALYZABLE');
  const r = await service.storage.from(d.bucket).download(d.path);
  if (r.error || !r.data) throw Error('DOCUMENT_UNAVAILABLE');
  const bytes = new Uint8Array(await r.data.arrayBuffer());
  const hash = Buffer.from(await crypto.subtle.digest('SHA-256', bytes)).toString('hex');
  if (bytes.length !== Number(d.size) || hash !== d.sha256) throw Error('DOCUMENT_INTEGRITY_MISMATCH');
  return { id: d.id, mime: d.mime, base64: Buffer.from(bytes).toString('base64') };
}
export async function purgeLinked(service) {
  const pending = await rpc(service, 'pending_financial_document_purges');
  for (const item of pending) {
    // Paths are server-issued; no caller chooses a bucket/path to delete.
    if (item.bucket !== 'private-assets' || !item.path.startsWith('affiliate-documents/')) continue;
    const removed = await service.storage.from(item.bucket).remove([item.path]);
    if (!removed.error) await rpc(service, 'finish_financial_document_purge', { p_id: item.id });
  }
}
export async function runOne(service, config, extract = extractWithOpenAI) {
  // Do not claim work or consume attempts before account/model configuration exists.
  if (!config.enabled || !config.apiKey || !config.model) return { processed: false, phase: 'NOT_CONFIGURED' };
  const job = await rpc(service, 'claim_financial_document_review');
  if (!job) return { processed: false, phase: 'IDLE' };
  const ctx = job.context;
  let result = null, error = null, usage = null;
  try {
    if (ctx.documents.length > 15 || ctx.documents.reduce((n, d) => n + Number(d.size), 0) > 24 * 1024 * 1024) throw Error('DOCUMENT_NOT_ANALYZABLE');
    const attachments = [];
    for (const d of ctx.documents) attachments.push(await attachment(service, d));
    if (ctx.signature_available) {
      const signature = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(ctx.signature_data || '');
      if (!signature || signature[2].length > 2 * 1024 * 1024) throw Error('SIGNATURE_NOT_ANALYZABLE');
      attachments.push({ id: 'signature', mime: 'image/' + signature[1], base64: signature[2] });
    }
    const read = await extract({ apiKey: config.apiKey, model: config.model, context: ctx, attachments });
    result = evaluate(ctx, read.extraction); result.analysis = read.analysis || null; usage = read.usage;
  } catch (e) {
    const allowed = ['DOCUMENT_NOT_ANALYZABLE', 'DOCUMENT_UNAVAILABLE', 'DOCUMENT_INTEGRITY_MISMATCH', 'SIGNATURE_NOT_ANALYZABLE', 'OPENAI_RATE_LIMIT', 'OPENAI_REQUEST_FAILED', 'OPENAI_INCOMPLETE', 'OPENAI_OUTPUT_INVALID', 'EXTRACTION_SCHEMA_INVALID'];
    error = allowed.includes(e?.message) ? e.message : 'REVIEW_UNAVAILABLE';
  }
  const saved = await rpc(service, 'finish_financial_document_review', { p_request_id: ctx.request_id, p_lease: job.lease, p_source_hash: job.source_hash, p_result: result, p_error: error, p_model: config.model, p_usage: usage });
  // Response contains no payroll, identity, private URLs, model text or signature.
  return { processed: true, saved, phase: error ? 'ERROR' : 'COMPLETE' };
}
export async function completeCorrection(user, service, operationId, verify) {
  const descriptor = await rpc(user, 'get_document_operation', { p_id: operationId });
  const receipt = await verify(service, descriptor);
  const linked = await rpc(service, 'complete_financial_document_correction', { p_id: operationId, p_receipt: receipt });
  if (linked.phase === 'LINKED') await purgeLinked(service);
  return { request_id: linked.request_id, phase: 'QUEUED' };
}
