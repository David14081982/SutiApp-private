import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const ACTION_KEYS: Record<string, Set<string>> = {
  initialize: new Set(["action"]),
  setVisibility: new Set(["action", "criterion_identity", "visibility_mode", "reason"]),
};

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
  const action = typeof body.action === "string" ? body.action : "";
  const keys = ACTION_KEYS[action];
  if (!keys || Object.keys(body).some((key) => !keys.has(key))) return false;
  if (action === "initialize") return true;
  const identity = String(body.criterion_identity || "");
  const mode = String(body.visibility_mode || "");
  const reason = String(body.reason || "").trim();
  return /^CRITERIA_V1:\d+:[A-F0-9]{64}$/.test(identity) &&
    ["AUTO", "MOSTRAR", "OCULTAR"].includes(mode) && reason.length <= 500 &&
    (mode === "AUTO" || reason.length >= 8);
}

async function permission(client: ReturnType<typeof createClient>, required: string) {
  const { data, error } = await client.rpc("has_admin_permission", { required_permission: required });
  return !error && data === true;
}

async function googleAccessToken() {
  const clientId = Deno.env.get("GOOGLE_VISIBILITY_OAUTH_CLIENT_ID") || "";
  const clientSecret = Deno.env.get("GOOGLE_VISIBILITY_OAUTH_CLIENT_SECRET") || "";
  const refreshToken = Deno.env.get("GOOGLE_VISIBILITY_OAUTH_REFRESH_TOKEN") || "";
  if (!clientId || !clientSecret || !refreshToken) throw new Error("VISIBILITY_GOOGLE_AUTH_NOT_CONFIGURED");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  let response: Response;
  try {
    response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, signal: controller.signal,
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret,
        refresh_token: refreshToken, grant_type: "refresh_token" }),
    });
  } catch { throw new Error("VISIBILITY_GOOGLE_AUTH_UNAVAILABLE"); }
  finally { clearTimeout(timer); }
  if (!response.ok) throw new Error("VISIBILITY_GOOGLE_AUTH_REJECTED");
  let result: Record<string, unknown>;
  try { result = await response.json(); } catch { throw new Error("VISIBILITY_GOOGLE_AUTH_INVALID_RESPONSE"); }
  if (typeof result.access_token !== "string" || !result.access_token) throw new Error("VISIBILITY_GOOGLE_AUTH_INVALID_RESPONSE");
  return result.access_token;
}

const CRITERIA_SPREADSHEET_ID = "1Vxy84N7mzbuioTmWhjRD2QFboDx--rG3iUwmLuyeY80";
const CRITERIA_SHEET_NAME = "Criterios de fondos";
const CRITERIA_VISIBILITY_HEADER = "VISIBILIDAD SUTIAPP";
const CRITERIA_BASE_HEADER = ["CATEGORIAS", "Sindicato", "Fondo", "Monto Maximo", "Tasa", "Plazos", "Concatenado", "Fecha",
  "Ícono", "Beneficiario", "Simulación Interes a pagar total", "Plazo para calculo AD. NÓMINA", "MOSTRAR PROGRAMA", "FECHA", "FECHA AÑO"];

function sheetRange(range: string) {
  return encodeURIComponent(`'${CRITERIA_SHEET_NAME}'!${range}`);
}

async function sheetsFetch(accessToken: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CRITERIA_SPREADSHEET_ID}${path}`, {
    ...init, headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (!response.ok) throw new Error(`VISIBILITY_SHEETS_HTTP_${response.status}`);
  try { return await response.json() as Record<string, unknown>; }
  catch { throw new Error("VISIBILITY_SHEETS_INVALID_RESPONSE"); }
}

function rowValues(payload: Record<string, unknown>) {
  const rows = Array.isArray(payload.values) ? payload.values as unknown[][] : [];
  const row = Array.isArray(rows[0]) ? [...rows[0]] : [];
  while (row.length < 16) row.push("");
  return row;
}

function dateIso(fund: string, primary: unknown, fallback: unknown) {
  const raw = String(primary ?? fallback ?? "").trim();
  const iso = raw.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const local = (`${raw} ${fund}`).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return local ? `${local[3]}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}` : "";
}

async function sha256Upper(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
}

async function criterionSnapshot(accessToken: string, rowNumber: number, requireVisibilityHeader = true) {
  const formatted = rowValues(await sheetsFetch(accessToken, `/values/${sheetRange(`A${rowNumber}:P${rowNumber}`)}?valueRenderOption=FORMATTED_VALUE`));
  const raw = rowValues(await sheetsFetch(accessToken, `/values/${sheetRange(`A${rowNumber}:P${rowNumber}`)}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`));
  const header = rowValues(await sheetsFetch(accessToken, `/values/${sheetRange("A1:P1")}?valueRenderOption=FORMATTED_VALUE`));
  if (CRITERIA_BASE_HEADER.some((value, index) => String(header[index] ?? "") !== value)) throw new Error("CRITERIA_SCHEMA_MISMATCH");
  if (requireVisibilityHeader && String(header[15] ?? "") !== CRITERIA_VISIBILITY_HEADER) throw new Error("VISIBILITY_HEADER_MISMATCH");
  const fund = String(formatted[2] ?? "").trim();
  const eventDate = dateIso(fund, raw[13] || formatted[13], raw[7] || formatted[7]);
  const canonical = [String(formatted[0] ?? "").trim(), String(formatted[1] ?? "").trim(), fund,
    String(Number(raw[3])), String(Number(raw[4])), String(formatted[5] ?? "").trim(), eventDate].join("\u001f");
  return { formatted, raw, header, identity: `CRITERIA_V1:${rowNumber}:${await sha256Upper(canonical)}` };
}

function normalizedVisibility(value: unknown) {
  const mode = String(value ?? "").trim().toUpperCase() || "AUTO";
  if (!["AUTO", "MOSTRAR", "OCULTAR"].includes(mode)) throw new Error("VISIBILITY_VALUE_INVALID");
  return mode;
}

async function updateValue(accessToken: string, range: string, value: unknown) {
  return await sheetsFetch(accessToken, `/values/${sheetRange(range)}?valueInputOption=RAW`, { method: "PUT",
    body: JSON.stringify({ range: `'${CRITERIA_SHEET_NAME}'!${range}`, majorDimension: "ROWS", values: [[value]] }) });
}

async function catalogRule(context: { supabaseUrl: string, anonKey: string, authHeader: string }, identity: string, rowNumber: number) {
  const response = await fetch(`${context.supabaseUrl}/functions/v1/financial-legacy`, { method: "POST", headers: {
    "apikey": context.anonKey, "Authorization": context.authHeader, "Content-Type": "application/json",
  }, body: JSON.stringify({ action: "catalog" }) });
  if (!response.ok) throw new Error("CRITERION_AUTHORITY_UNAVAILABLE");
  const body = await response.json();
  const rules = Array.isArray(body?.data?.rules) ? body.data.rules : [];
  const rule = rules.find((item: Record<string, unknown>) => item.criterion_identity === identity && item.sheet_row === rowNumber);
  if (!rule) throw new Error("CRITERION_FINGERPRINT_MISMATCH");
  return rule as Record<string, unknown>;
}

async function initializeVisibility(accessToken: string) {
  const header = rowValues(await sheetsFetch(accessToken, `/values/${sheetRange("A1:P1")}?valueRenderOption=FORMATTED_VALUE`));
  if (CRITERIA_BASE_HEADER.some((value, index) => String(header[index] ?? "") !== value)) throw new Error("CRITERIA_SCHEMA_MISMATCH");
  if (String(header[15] ?? "") === CRITERIA_VISIBILITY_HEADER) return { ok: true, action: "visibility_initialize", column: "P", header: CRITERIA_VISIBILITY_HEADER, idempotent: true };
  if (String(header[15] ?? "") !== "") throw new Error("VISIBILITY_COLUMN_NOT_UNUSED");
  const query = new URLSearchParams({ ranges: `'${CRITERIA_SHEET_NAME}'!P:Z`, includeGridData: "true",
    fields: "sheets(properties(title),merges,data(rowData(values(userEnteredValue,note,dataValidation))))" });
  const grid = await sheetsFetch(accessToken, `?${query.toString()}`) as { sheets?: Array<{ properties?: { title?: string }, merges?: Array<{ startColumnIndex?: number, endColumnIndex?: number }>, data?: Array<{ rowData?: Array<{ values?: Array<Record<string, unknown>> }> }> }> };
  const sheet = grid.sheets?.find((item) => item.properties?.title === CRITERIA_SHEET_NAME);
  if (!sheet) throw new Error("CRITERIA_SHEET_MISSING");
  if ((sheet.merges || []).some((merge) => Number(merge.startColumnIndex ?? 0) < 26 && Number(merge.endColumnIndex ?? 0) > 15)) throw new Error("VISIBILITY_COLUMN_NOT_UNUSED");
  const occupied = (sheet.data || []).some((block) => (block.rowData || []).some((row) => (row.values || []).some((cell) =>
    (cell.userEnteredValue && Object.keys(cell.userEnteredValue as object).length > 0) || cell.note != null || cell.dataValidation != null)));
  if (occupied) throw new Error("VISIBILITY_COLUMN_NOT_UNUSED");
  await updateValue(accessToken, "P1", CRITERIA_VISIBILITY_HEADER);
  const readBack = rowValues(await sheetsFetch(accessToken, `/values/${sheetRange("P1")}?valueRenderOption=FORMATTED_VALUE`));
  if (String(readBack[0] ?? "") !== CRITERIA_VISIBILITY_HEADER) throw new Error("VISIBILITY_HEADER_WRITE_FAILED");
  return { ok: true, action: "visibility_initialize", column: "P", header: CRITERIA_VISIBILITY_HEADER, idempotent: false };
}

async function writeVisibility(accessToken: string, payload: Record<string, unknown>, context: { supabaseUrl: string, anonKey: string, authHeader: string }) {
  const operationId = String(payload.operation_id || ""), identity = String(payload.criterion_identity || "");
  const mode = String(payload.visibility_mode || ""), rowNumber = Number(identity.split(":")[1]);
  if (!Number.isInteger(rowNumber) || rowNumber < 2) throw new Error("CRITERION_ROW_NOT_FOUND");
  const authoritativeRule = await catalogRule(context, identity, rowNumber);
  const before = await criterionSnapshot(accessToken, rowNumber, false);
  if (String(before.header[15] ?? "") !== CRITERIA_VISIBILITY_HEADER) throw new Error("VISIBILITY_HEADER_MISMATCH");
  const formula = rowValues(await sheetsFetch(accessToken, `/values/${sheetRange(`P${rowNumber}`)}?valueRenderOption=FORMULA`))[0];
  if (String(formula ?? "").startsWith("=")) throw new Error("VISIBILITY_TARGET_FORMULA_PROTECTED");
  const previousRaw = before.formatted[15] ?? "", previous = normalizedVisibility(previousRaw);
  await updateValue(accessToken, `P${rowNumber}`, mode);
  const readBack = rowValues(await sheetsFetch(accessToken, `/values/${sheetRange(`P${rowNumber}`)}?valueRenderOption=FORMATTED_VALUE`))[0];
  if (normalizedVisibility(readBack) !== mode) { await updateValue(accessToken, `P${rowNumber}`, previousRaw); throw new Error("VISIBILITY_READBACK_FAILED"); }
  const after = await criterionSnapshot(accessToken, rowNumber);
  const beforeAO = JSON.stringify({ formatted: before.formatted.slice(0, 15), raw: before.raw.slice(0, 15) });
  const afterAO = JSON.stringify({ formatted: after.formatted.slice(0, 15), raw: after.raw.slice(0, 15) });
  if (afterAO !== beforeAO) { await updateValue(accessToken, `P${rowNumber}`, previousRaw); throw new Error("CRITERION_FINGERPRINT_CHANGED_DURING_WRITE"); }
  await catalogRule(context, identity, rowNumber);
  return { ok: true, action: "visibility_write", operation_id: operationId, criterion_identity: identity,
    sheet_row: rowNumber, fund: String(authoritativeRule.fund ?? before.formatted[2] ?? ""), previous_visibility: previous,
    visibility_mode: mode, changed_at: new Date().toISOString(), source: "SUTIAPP_ADMIN_SHEETS_API" };
}

async function callGoogle(payload: Record<string, unknown>, context: { supabaseUrl: string, anonKey: string, authHeader: string }) {
  const accessToken = await googleAccessToken();
  return payload.action === "visibility_initialize" ? await initializeVisibility(accessToken) : await writeVisibility(accessToken, payload, context);
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
  if (!await permission(userClient, "financial_criteria.visibility.write")) return reply(403, { error: "VISIBILITY_WRITE_REQUIRED" }, origin || null);

  if (body.action === "initialize") {
    try {
      const result = await callGoogle({ action: "visibility_initialize" }, { supabaseUrl, anonKey, authHeader });
      return reply(200, { data: result }, origin || null);
    } catch (error) {
      return reply(502, { error: error instanceof Error ? error.message : "VISIBILITY_INITIALIZE_FAILED" }, origin || null);
    }
  }

  const privilegedKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY") || "";
  if (!privilegedKey) return reply(503, { error: "VISIBILITY_AUDIT_NOT_CONFIGURED" }, origin || null);
  const privileged = createClient(supabaseUrl, privilegedKey, { auth: { persistSession: false } });
  const operationId = crypto.randomUUID();
  const identity = String(body.criterion_identity);
  const mode = String(body.visibility_mode);
  const reason = String(body.reason || "").trim();
  const row = Number(identity.split(":")[1]);
  const { error: pendingError } = await privileged.from("financial_criteria_visibility_audit").insert({
    operation_id: operationId, actor_id: userData.user.id, criterion_identity: identity,
    fund: "PENDING_GOOGLE_CONFIRMATION", sheet_row: row, new_visibility: mode,
    reason, status: "PENDING", details: { requested_mode: mode },
  });
  if (pendingError) return reply(500, { error: "VISIBILITY_AUDIT_START_FAILED" }, origin || null);
  try {
    const result = await callGoogle({ action: "visibility_write", operation_id: operationId,
      criterion_identity: identity, visibility_mode: mode, reason }, { supabaseUrl, anonKey, authHeader });
    if (result.action !== "visibility_write" || result.operation_id !== operationId ||
        result.criterion_identity !== identity || result.visibility_mode !== mode ||
        result.sheet_row !== row || typeof result.fund !== "string") throw new Error("VISIBILITY_WRITER_CONTRACT_MISMATCH");
    const { error: confirmError } = await privileged.from("financial_criteria_visibility_audit").update({
      fund: result.fund, previous_visibility: result.previous_visibility,
      new_visibility: result.visibility_mode, status: "CONFIRMED", changed_at: result.changed_at,
      details: { read_back: true, column: "P", header: "VISIBILIDAD SUTIAPP" },
    }).eq("operation_id", operationId).eq("status", "PENDING");
    if (confirmError) return reply(500, { error: "VISIBILITY_AUDIT_CONFIRM_FAILED", operation_id: operationId }, origin || null);
    return reply(200, { data: result }, origin || null);
  } catch (error) {
    const code = error instanceof Error ? error.message : "VISIBILITY_WRITE_FAILED";
    await privileged.from("financial_criteria_visibility_audit").update({ status: "FAILED", error_code: code, changed_at: new Date().toISOString() })
      .eq("operation_id", operationId).eq("status", "PENDING");
    const status = code === "CRITERION_FINGERPRINT_MISMATCH" ? 409 : 502;
    return reply(status, { error: code, operation_id: operationId }, origin || null);
  }
});
