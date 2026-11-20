// H-AFFILIATES-GOOGLE-SHEET-001 — "Abrir en Google Sheets" (Admin › Afiliados).
// Read-only over Supabase: SELECT on public.affiliates + get_data_export_auth_emails. No insert, update,
// delete or audit row (owner decision 2026-11-19). Writes only the dedicated Google tab.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.115.0";
import { COLUMNS, MAX_ROWS, SERVICE_ACCOUNT_SECRET, SheetError, UNION_CODE, publishSnapshot } from "./affiliates-sheet.mjs";

const PAGE_SIZE = 1000;
const allowedOrigins = (Deno.env.get("ALLOWED_APP_ORIGINS") || "")
  .split(",").map((value) => value.trim()).filter(Boolean);
const KEYS: string[] = COLUMNS.map(([key]: readonly string[]) => key);
const SELECT = [...KEYS.filter((key) => key !== "auth_email"), "auth_user_id"].join(",");

function cors(origin: string | null) {
  const allowed = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || "";
  return { "Access-Control-Allow-Origin": allowed, "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" };
}
function json(status: number, body: unknown, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(origin), "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

// Paged read ordered by (created_at, id): created_at alone repeats across imported rows, and an
// unstable order could skip or duplicate rows between pages. Completeness is proven against an exact count.
async function snapshotRows(privileged: ReturnType<typeof createClient>) {
  const counted = await privileged.from("affiliates").select("id", { count: "exact", head: true }).eq("financial_union_code", UNION_CODE);
  if (counted.error || typeof counted.count !== "number") throw new SheetError("AFFILIATES_READ_FAILED");
  if (counted.count > MAX_ROWS) throw new SheetError("SHEET_ROW_LIMIT_EXCEEDED");
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; from < counted.count; from += PAGE_SIZE) {
    const page = await privileged.from("affiliates").select(SELECT).eq("financial_union_code", UNION_CODE)
      .order("created_at", { ascending: true }).order("id", { ascending: true }).range(from, from + PAGE_SIZE - 1);
    if (page.error) throw new SheetError("AFFILIATES_READ_FAILED");
    rows.push(...((page.data || []) as Record<string, unknown>[]));
    if ((page.data || []).length < PAGE_SIZE) break;
  }
  if (rows.length !== counted.count || new Set(rows.map((row) => row.id)).size !== rows.length) throw new SheetError("AFFILIATES_READ_INCONSISTENT");

  const authIds = [...new Set(rows.map((row) => row.auth_user_id).filter((value): value is string => typeof value === "string" && value.length > 0))];
  const authEmails = new Map<string, string>();
  for (let from = 0; from < authIds.length; from += PAGE_SIZE) {
    const ids = authIds.slice(from, from + PAGE_SIZE), expected = new Set(ids);
    const found = await privileged.rpc("get_data_export_auth_emails", { p_auth_user_ids: ids });
    if (found.error || !Array.isArray(found.data) || found.data.length !== ids.length) throw new SheetError("AUTH_EMAIL_LOOKUP_FAILED");
    for (const row of found.data) {
      if (!expected.delete(row.auth_user_id) || typeof row.email !== "string") throw new SheetError("AUTH_EMAIL_LOOKUP_FAILED");
      authEmails.set(row.auth_user_id, row.email);
    }
    if (expected.size) throw new SheetError("AUTH_EMAIL_LOOKUP_FAILED");
  }
  return rows.map((row) => {
    const projected: Record<string, unknown> = { ...row, auth_email: typeof row.auth_user_id === "string" ? authEmails.get(row.auth_user_id) || "" : "" };
    delete projected.auth_user_id;
    return projected;
  });
}

const STATUS: Record<string, number> = {
  GOOGLE_NOT_CONFIGURED: 503, GOOGLE_AUTH_FAILED: 502, GOOGLE_ACCESS_DENIED: 502, GOOGLE_UNAVAILABLE: 502, GOOGLE_RESPONSE_INVALID: 502,
  SHEET_ROW_LIMIT_EXCEEDED: 413, SHEET_PAYLOAD_TOO_LARGE: 413,
};

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" }, origin);
  if (origin && !allowedOrigins.includes(origin)) return json(403, { error: "ORIGIN_DENIED" }, origin);
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return json(401, { error: "AUTH_REQUIRED" }, origin);
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!; const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!; const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const user = await userClient.auth.getUser();
  if (user.error || !user.data.user) return json(401, { error: "AUTH_INVALID" }, origin);
  const allowed = await userClient.rpc("has_admin_permission", { required_permission: "data_exports.read" });
  if (allowed.error) return json(500, { error: "PERMISSION_CHECK_FAILED" }, origin);
  if (allowed.data !== true) return json(403, { error: "EXPORT_PERMISSION_REQUIRED" }, origin);
  try {
    const privileged = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const rows = await snapshotRows(privileged);
    const result = await publishSnapshot({ fetchFn: fetch, secretJson: Deno.env.get(SERVICE_ACCOUNT_SECRET) || "", rows });
    return json(200, { status: "OK", rows: result.rowCount, sheet_gid: result.sheetId, refreshed_at: new Date().toISOString() }, origin);
  } catch (error) {
    const code = error instanceof SheetError ? error.code : "SHEET_REFRESH_FAILED";
    return json(STATUS[code] || 500, { error: code }, origin);
  }
});
