import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const MODES = new Set(["AUTO", "MOSTRAR", "OCULTAR"]);

function reply(status: number, body: Record<string, unknown>, origin?: string | null) {
  const headers: Record<string, string> = { ...JSON_HEADERS, "Vary": "Origin" };
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  return new Response(JSON.stringify(body), { status, headers });
}

function allowedOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return null;
  const allowed = (Deno.env.get("ALLOWED_APP_ORIGINS") || "").split(",").map((value) => value.trim()).filter(Boolean);
  return allowed.includes(origin) ? origin : false;
}

function validBody(body: Record<string, unknown>) {
  if (body.action === "initialize") return Object.keys(body).every((key) => key === "action");
  if (body.action !== "setVisibility" || Object.keys(body).some((key) => !["action", "criterion_identity", "visibility_mode", "reason"].includes(key))) return false;
  return typeof body.criterion_identity === "string" && /^CRITERIA_V1:[0-9]+:[A-F0-9]{64}$/i.test(body.criterion_identity) &&
    typeof body.visibility_mode === "string" && MODES.has(body.visibility_mode) &&
    typeof body.reason === "string" && body.reason.trim().length >= 8 && body.reason.length <= 500;
}

Deno.serve(async (req) => {
  const origin = allowedOrigin(req);
  if (origin === false) return reply(403, { error: "ORIGIN_NOT_ALLOWED" });
  if (req.method === "OPTIONS") {
    if (!origin) return reply(403, { error: "ORIGIN_REQUIRED" });
    return new Response(null, { status: 204, headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
      "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Max-Age": "600", "Vary": "Origin",
    }});
  }
  if (req.method !== "POST") return reply(405, { error: "METHOD_NOT_ALLOWED" }, origin || null);
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return reply(401, { error: "AUTH_REQUIRED" }, origin || null);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return reply(400, { error: "INVALID_JSON" }, origin || null); }
  if (!validBody(body)) return reply(400, { error: "INVALID_REQUEST" }, origin || null);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const { data: userData, error: userError } = await userClient.auth.getUser(authHeader.slice(7));
  if (userError || !userData.user) return reply(401, { error: "AUTH_INVALID" }, origin || null);
  const { data: catalog, error: catalogError } = await userClient.rpc("get_financial_admin_catalog");
  if (catalogError) return reply(403, { error: "ADMIN_READ_REQUIRED" }, origin || null);
  if (catalog?.authority !== "SUPABASE") return reply(503, { error: "FINANCIAL_CRITERIA_NOT_CONFIGURED" }, origin || null);
  if (body.action === "initialize") return reply(200, { data: { ok: true, action: "initialize", authority: "SUPABASE", idempotent: true } }, origin || null);

  const { data, error } = await userClient.rpc("set_financial_rule_visibility", {
    p_criterion_identity: body.criterion_identity,
    p_visibility_mode: body.visibility_mode,
    p_reason: String(body.reason).trim(),
  });
  if (error || !data) {
    const message = String(error?.message || "VISIBILITY_WRITE_FAILED");
    const code = ["VISIBILITY_WRITE_REQUIRED", "CRITERION_FINGERPRINT_MISMATCH", "VISIBILITY_CHANGE_INVALID"]
      .find((candidate) => message.includes(candidate)) || "VISIBILITY_WRITE_FAILED";
    const status = code === "VISIBILITY_WRITE_REQUIRED" ? 403 : code === "CRITERION_FINGERPRINT_MISMATCH" ? 409 : 422;
    return reply(status, { error: code }, origin || null);
  }
  return reply(200, { data }, origin || null);
});
