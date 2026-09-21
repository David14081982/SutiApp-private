import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { readLoanSource, evaluateLoans } from './loan-status.js';

// Authentication is verified before reading Google. Identity always comes from the
// request's participant, resolved in SQL, never from a browser-supplied affiliate.
Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin') || '';
  const allowed = ['https://sutiapp.com', 'https://www.sutiapp.com', 'http://localhost:8080', 'http://127.0.0.1:8080'];
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin' };
  if (allowed.includes(origin)) Object.assign(headers, { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' });
  const reply = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers });
  if (origin && !allowed.includes(origin)) return reply(403, { error: 'ORIGIN_DENIED' });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return reply(405, { error: 'METHOD_NOT_ALLOWED' });
  try {
    const authorization = req.headers.get('authorization') || '';
    const url = Deno.env.get('SUPABASE_URL')!, user = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const { data: auth, error: authError } = await user.auth.getUser();
    if (authError || !auth.user) return reply(401, { error: 'AUTH_REQUIRED' });
    const body = await req.json();
    if (!['PREVIEW', 'OVERRIDE', 'SETTLE'].includes(body.action) || typeof body.request_id !== 'string' || Object.keys(body).some(k => !['action', 'request_id', 'command', 'key'].includes(k))) return reply(400, { error: 'SAVINGS_COMMAND_INVALID' });
    const { data: context, error } = await user.rpc('get_admin_savings_settlement_context', { p_request_id: body.request_id });
    if (error || context?.actor !== auth.user.id) return reply(403, { error: 'SAVINGS_READ_DENIED' });
    if ((body.action === 'SETTLE' && !context.can_approve) || (body.action === 'OVERRIDE' && !context.can_override)) return reply(403, { error: 'SAVINGS_OVERRIDE_DENIED' });
    const source = await readLoanSource((name: string) => Deno.env.get(name));
    const loans = evaluateLoans(source.rows, context.folio);
    const privileged = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const { data, error: operationError } = await privileged.rpc('service_savings_settlement', {
      p_actor: auth.user.id, p_session: context.session, p_effective_affiliate: context.effective_affiliate,
      p_request_id: body.request_id, p_action: body.action, p_command: body.command || {}, p_key: body.key || null,
      p_observation: { source: source.source, observed_at: source.observed_at, scanned_rows: source.scanned_rows, folio: context.folio, loans },
    });
    if (operationError) throw Error(operationError.message);
    return reply(200, { data });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const safe = /^(SAVINGS_[A-Z_]+|WITHDRAWAL_BLOCKED_BY_OVERDUE_LOAN|LOAN_STATUS_DATA_INCONSISTENCY)$/.test(message) ? message : 'SAVINGS_LOAN_VERIFICATION_UNAVAILABLE';
    return reply(409, { error: safe });
  }
});
