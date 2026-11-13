import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { verifyStoredDocument } from '../_shared/document-stream.mjs';
import { rpc, runOne, completeCorrection, purgeLinked } from './service.mjs';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const allowedKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).every(k => keys.includes(k));
Deno.serve(async req => {
  const allowed = (Deno.env.get('ALLOWED_APP_ORIGINS') || '').split(',').map(x => x.trim()).filter(Boolean);
  const origin = req.headers.get('origin') || '';
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', 'Vary': 'Origin', 'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : '', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info,x-review-worker-key', 'Access-Control-Allow-Methods': 'POST,OPTIONS' };
  const out = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
  if (origin && !allowed.includes(origin)) return out(403, { error: 'ORIGIN_DENIED' });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return out(405, { error: 'METHOD_NOT_ALLOWED' });
  const text = await req.text(); if (text.length > 12000) return out(413, { error: 'BODY_TOO_LARGE' });
  let body; try { body = JSON.parse(text); } catch (_) { return out(400, { error: 'INVALID_BODY' }); }
  if (!body || Array.isArray(body)) return out(400, { error: 'INVALID_BODY' });
  const url = Deno.env.get('SUPABASE_URL') || '';
  const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '', { auth: { persistSession: false } });
  try {
    if (body.action === 'RUN') {
      const secret = Deno.env.get('FINANCIAL_REVIEW_WORKER_SECRET');
      if (!secret || req.headers.get('x-review-worker-key') !== secret || !allowedKeys(body, ['action'])) return out(403, { error: 'WORKER_DENIED' });
      await purgeLinked(service);
      return out(200, await runOne(service, { enabled: Deno.env.get('FINANCIAL_REVIEW_ENABLED') === 'true', apiKey: Deno.env.get('OPENAI_API_KEY'), model: Deno.env.get('FINANCIAL_REVIEW_OPENAI_MODEL') }));
    }
    const auth = req.headers.get('authorization') || '';
    if (!auth.startsWith('Bearer ')) return out(401, { error: 'AUTH_REQUIRED' });
    const user = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') || '', { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const identity = await user.auth.getUser(auth.slice(7));
    if (identity.error || !identity.data.user) return out(401, { error: 'AUTH_INVALID' });
    if (body.action === 'PREPARE_CORRECTION' && allowedKeys(body, ['action', 'operation_id', 'request_id', 'association_id', 'source_hash', 'mime', 'size', 'sha256']) && [body.operation_id, body.request_id, body.association_id].every(v => UUID.test(v || '')) && /^[a-f0-9]{64}$/.test(body.source_hash || '') && /^[a-f0-9]{64}$/.test(body.sha256 || '')) {
      return out(200, await rpc(user, 'prepare_financial_document_correction', { p_id: body.operation_id, p_request_id: body.request_id, p_association_id: body.association_id, p_source_hash: body.source_hash, p_mime: body.mime, p_size: body.size, p_sha: body.sha256 }));
    }
    if (body.action === 'COMPLETE_CORRECTION' && allowedKeys(body, ['action', 'operation_id']) && UUID.test(body.operation_id || '')) {
      return out(200, await completeCorrection(user, service, body.operation_id, verifyStoredDocument));
    }
    return out(400, { error: 'INVALID_OPERATION' });
  } catch (e) {
    const failure = e && typeof e === 'object' ? e as { message?: unknown; code?: unknown } : {};
    const code = String(failure.message || '');
    const safe = ['CORRECTION_SHARED_DOCUMENT', 'CORRECTION_REQUEST_CLOSED', 'CORRECTION_OBSERVATION_CHANGED', 'CORRECTION_NATIVE_FILE_REQUIRED', 'CORRECTION_UPLOAD_ALREADY_PENDING', 'DOCUMENT_VERSION_CONFLICT', 'INVALID_DOCUMENT_FILE', 'DOCUMENT_UNAVAILABLE'].find(c => code.includes(c));
    return out(failure.code === '42501' ? 403 : 409, { error: safe || 'DOCUMENT_REVIEW_OPERATION_UNAVAILABLE' });
  }
});
