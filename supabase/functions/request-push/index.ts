// Backend only. No user-supplied destinations, recipients or event payloads are accepted.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2.112.3';

export function payloadFor(job: any) {
  const title = job.authorized ? '✅ Solicitud autorizada' : job.status === 'rejected' ? 'Solicitud rechazada' : job.status === 'cancelled' ? 'Solicitud cancelada' : 'Tu solicitud avanzó';
  const body = job.authorized ? `Tu solicitud ${job.folio} fue autorizada.` : job.status === 'rejected' ? 'Revisa el detalle en SutiApp.' : job.status === 'cancelled' ? `Tu solicitud ${job.folio} fue cancelada.` : job.stage ? `Ahora se encuentra en ${job.stage}.` : 'Revisa el avance en SutiApp.';
  return { v: 1, event_id: job.event_id, request_id: job.request_id, subscription_id: job.subscription_id, title, body };
}
export function validEndpoint(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password && !u.port && !u.hash && value.length <= 2048 &&
      /^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)$/.test(u.hostname);
  } catch { return false; }
}
async function sameSecret(left: string, right: string) {
  const digest = (s: string) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  const [a,b] = await Promise.all([digest(left),digest(right)]);
  const x = new Uint8Array(a), y = new Uint8Array(b); let diff = 0;
  for (let i=0;i<x.length;i++) diff |= x[i]^y[i];
  return right.length >= 32 && diff === 0;
}
export async function dispatch(client: any, vapid: any, transport = fetch) {
  const { data: jobs, error } = await client.rpc('claim_request_push_batch');
  if (error) throw new Error('CLAIM_FAILED');
  const counts = { claimed: (jobs || []).length, accepted: 0, deferred: 0 };
  // Six bounded concurrent requests finish comfortably inside the 90s database lease.
  for (let offset=0;offset<(jobs || []).length;offset+=6) {
    await Promise.all(jobs.slice(offset,offset+6).map(async (job: any) => {
      let status = 0;
      try {
        if (!validEndpoint(job.endpoint)) status = 400;
        else {
          const request = webpush.generateRequestDetails({ endpoint: job.endpoint, keys: job.keys },JSON.stringify(payloadFor(job)),{
            TTL: 86400, urgency: 'normal', topic: job.event_id.replace(/-/g,''), vapidDetails: vapid,
          });
          const response = await transport(request.endpoint,{method:'POST',headers:request.headers,body:request.body,redirect:'error',signal:AbortSignal.timeout(8000)});
          status = response.status;
          await response.body?.cancel();
        }
      } catch { status = 0; }
      const result = await client.rpc('finish_request_push',{p_id:job.id,p_lease_token:job.lease_token,p_http_status:status});
      if (result.error) throw new Error('RECEIPT_FAILED');
      if (result.data && status >= 200 && status < 300) counts.accepted++; else counts.deferred++;
    }));
  }
  return counts;
}
Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return new Response('Method not allowed',{status:405});
  const key = Deno.env.get('REQUEST_PUSH_WORKER_KEY') || '';
  if (!await sameSecret(request.headers.get('x-request-push-key') || '',key)) return new Response('Unauthorized',{status:401});
  try {
    const client = createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
    const result = await dispatch(client,{subject:'https://sutiapp.com',publicKey:Deno.env.get('REQUEST_PUSH_VAPID_PUBLIC_KEY'),privateKey:Deno.env.get('REQUEST_PUSH_VAPID_PRIVATE_KEY')});
    return Response.json(result,{headers:{'Cache-Control':'no-store'}});
  } catch { return Response.json({error:'PUSH_DISPATCH_FAILED'},{status:503,headers:{'Cache-Control':'no-store'}}); }
});
