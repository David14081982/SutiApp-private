import { createClient } from "https://esm.sh/@supabase/supabase-js@2.115.0";
import ExcelJS from "npm:exceljs@4.4.0";

const columns = ["Clave", "Proceso", "Folio", "Nombre", "Monto", "Inicio", "Final"];
const origins = (Deno.env.get("ALLOWED_APP_ORIGINS") || "").split(",").map(s => s.trim()).filter(Boolean);
function headers(origin: string | null) {
  return { "Access-Control-Allow-Origin": origin && origins.includes(origin) ? origin : origins[0] || "",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin", "Cache-Control": "no-store" };
}
Deno.serve(async req => {
  const origin = req.headers.get("origin");
  const json = (status: number, error: string) => new Response(JSON.stringify({ error }), {
    status, headers: { ...headers(origin), "Content-Type": "application/json" }
  });
  if (origin && !origins.includes(origin)) return json(403, "ORIGIN_DENIED");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(origin) });
  if (req.method !== "POST") return json(405, "METHOD_NOT_ALLOWED");
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return json(401, "AUTH_REQUIRED");
  // User JWT only: the database validates savings.reports. No service-role client.
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } }, auth: { persistSession: false }
  });
  try {
    const user = await client.auth.getUser();
    if (user.error || !user.data.user) return json(401, "AUTH_INVALID");
    const input = await req.json().catch(() => null);
    if (!input || !["mensual", "anual"].includes(input.type) || !Number.isInteger(input.year) || input.year < 2000 || input.year > 2100)
      return json(400, "SAVINGS_RH_SELECTION_INVALID");
    if (input.type === "mensual" && (!Number.isInteger(input.month) || input.month < 1 || input.month > 12 || ![5, 15, 28, 30].includes(input.day)))
      return json(400, "SAVINGS_RH_DATE_INVALID");
    const { data, error } = await client.rpc("get_admin_savings_rh_report", {
      p_type: input.type, p_year: input.year, p_month: input.type === "mensual" ? input.month : null,
      p_day: input.type === "mensual" ? input.day : null
    });
    if (error) {
      const safe = /^SAVINGS_(RH_[A-Z_]+|REPORT_DENIED)$/.test(error.message) ? error.message : "SAVINGS_RH_UNAVAILABLE";
      return json(error.code === "42501" ? 403 : safe === "SAVINGS_RH_UNAVAILABLE" ? 503 : 422, safe);
    }
    if (!data || !Array.isArray(data.rows)) return json(503, "SAVINGS_RH_UNAVAILABLE");
    if (!data.rows.length) return json(422, "SAVINGS_RH_EMPTY");
    if (data.rows.length > 20000) return json(422, "SAVINGS_RH_ROW_LIMIT");
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "SutiApp";
    const sheet = workbook.addWorksheet("Reporte RH");
    sheet.columns = columns.map((key, index) => ({ header: key, key, width: [12, 15, 15, 48, 15, 16, 16][index] }));
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = "A1:G1";
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF910022" } };
    for (const key of columns.filter(key => key !== "Monto")) sheet.getColumn(key).numFmt = "@";
    sheet.getColumn("Monto").numFmt = "0.00";
    for (const row of data.rows) {
      if (typeof row.Monto !== "number" || !Number.isFinite(row.Monto) || row.Monto <= 0 || Math.abs(row.Monto * 100 - Math.round(row.Monto * 100)) > 0.00001)
        return json(422, "SAVINGS_RH_AMOUNT_INVALID");
      if (columns.some(key => key !== "Monto" && typeof row[key] !== "string")) return json(422, "SAVINGS_RH_FILE_INVALID");
      // Explicit string cells preserve Folio leading zeros. Strings are never formulas.
      sheet.addRow(columns.map(key => key === "Monto" ? row[key] : String(row[key])));
    }
    const bytes = await workbook.xlsx.writeBuffer();
    return new Response(new Uint8Array(bytes), { headers: { ...headers(origin),
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="Reporte_RH_${input.type}_${input.year}.xlsx"`,
      "X-Content-Type-Options": "nosniff"
    } });
  } catch (_) {
    return json(503, "SAVINGS_RH_UNAVAILABLE");
  }
});
