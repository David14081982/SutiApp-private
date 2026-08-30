import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

type AccessMode = "SELF_SERVICE" | "ADMIN";
type PreviewRequest = {
  mode: AccessMode;
  purpose: string;
  document_id: string;
  target_affiliate_id?: string;
};

const TTL_SECONDS = 300;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SELF_PURPOSES = new Set(["SELF_SERVICE_EXPEDIENTE", "SELF_SERVICE_LOAN", "SELF_SERVICE_MEMBERSHIP"]);
const ADMIN_PURPOSES = new Set(["ADMIN_DOCUMENT_REVIEW", "ADMIN_AFFILIATE_PROFILE", "ADMIN_FINANCIAL_REQUEST"]);
const allowedOrigins = (Deno.env.get("ALLOWED_APP_ORIGINS") || "")
  .split(",").map((value) => value.trim()).filter(Boolean);

function cors(origin: string | null) {
  const allowed = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || "";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin",
  };
}

function reply(status: number, body: unknown, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json", "Cache-Control": "private, no-store, max-age=0" },
  });
}

function validPayload(value: unknown): value is PreviewRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const body = value as Record<string, unknown>;
  const keys = Object.keys(body);
  if (keys.some((key) => !["mode", "purpose", "document_id", "target_affiliate_id"].includes(key))) return false;
  if (!UUID.test(String(body.document_id || ""))) return false;
  if (body.mode === "SELF_SERVICE") {
    return SELF_PURPOSES.has(String(body.purpose || "")) && body.target_affiliate_id === undefined;
  }
  if (body.mode === "ADMIN") {
    return ADMIN_PURPOSES.has(String(body.purpose || "")) && UUID.test(String(body.target_affiliate_id || ""));
  }
  return false;
}

function publicError(error: { message?: string; code?: string } | null) {
  const code = String(error?.message || error?.code || "DOCUMENT_PREVIEW_UNAVAILABLE");
  if (/DENIED|AUTH_REQUIRED|AFFILIATE_IDENTITY_REQUIRED/.test(code)) return { status: 403, code: "DOCUMENT_CONTEXT_DENIED" };
  if (/OBJECT_MISSING/.test(code)) return { status: 404, code: "DOCUMENT_OBJECT_MISSING" };
  return { status: 409, code: "DOCUMENT_PREVIEW_UNAVAILABLE" };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    if (!origin || !allowedOrigins.includes(origin)) return reply(403, { error: "ORIGIN_DENIED" }, origin);
    return new Response(null, { status: 204, headers: cors(origin) });
  }
  if (req.method !== "POST") return reply(405, { error: "METHOD_NOT_ALLOWED" }, origin);
  if (origin && !allowedOrigins.includes(origin)) return reply(403, { error: "ORIGIN_DENIED" }, origin);
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return reply(401, { error: "AUTH_REQUIRED" }, origin);
  const body = await req.json().catch(() => null);
  if (!validPayload(body)) return reply(400, { error: "INVALID_DOCUMENT_PREVIEW_REQUEST" }, origin);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY") || "";
  if (!supabaseUrl || !anonKey || !serviceKey) return reply(503, { error: "DOCUMENT_ACCESS_NOT_CONFIGURED" }, origin);
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: auth } }, auth: { persistSession: false },
  });
  const privileged = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const user = await userClient.auth.getUser(auth.slice(7));
  if (user.error || !user.data.user) return reply(401, { error: "AUTH_INVALID" }, origin);

  const rpc = body.mode === "SELF_SERVICE"
    ? await userClient.rpc("authorize_self_document_preview", { p_document_id: body.document_id, p_purpose: body.purpose })
    : await userClient.rpc("authorize_admin_document_preview", {
      p_document_id: body.document_id,
      p_target_affiliate_id: body.target_affiliate_id,
      p_purpose: body.purpose,
    });
  const authorized = Array.isArray(rpc.data) ? rpc.data[0] : null;
  if (rpc.error || !authorized) {
    const error = publicError(rpc.error);
    return reply(error.status, { error: error.code }, origin);
  }

  const signed = await privileged.storage.from(authorized.storage_bucket)
    .createSignedUrl(authorized.storage_path, TTL_SECONDS);
  if (signed.error || !signed.data?.signedUrl) {
    const missing = /not.?found|404/i.test(String(signed.error?.message || ""));
    return reply(missing ? 404 : 503, { error: missing ? "DOCUMENT_OBJECT_MISSING" : "DOCUMENT_PREVIEW_UNAVAILABLE" }, origin);
  }
  const audit = await privileged.from("document_access_audit_log").insert({
    actor_auth_user_id: authorized.actor_auth_user_id,
    effective_affiliate_id: authorized.effective_affiliate_id,
    target_affiliate_id: authorized.target_affiliate_id,
    document_id: authorized.authorized_document_id,
    action: "SIGN_PREVIEW",
    purpose: body.purpose,
    context_mode: body.mode,
    impersonation_session_id: authorized.impersonation_session_id,
    access_context: { source: "document-access", result: "SIGNED", ttl_seconds: TTL_SECONDS },
  }).select("access_id").single();
  if (audit.error || !audit.data) return reply(503, { error: "DOCUMENT_ACCESS_AUDIT_FAILED" }, origin);

  return reply(200, {
    signedUrl: signed.data.signedUrl,
    expiresIn: TTL_SECONDS,
    documentId: authorized.authorized_document_id,
  }, origin);
});
