import { createClient } from "https://esm.sh/@supabase/supabase-js@2.115.0";
import ExcelJS from "npm:exceljs@4.4.0";

// H-SAVINGS-JC-REPORT-001 · Reporte JC de Ahorro. User JWT only: the database validates
// savings.reports and reconciles every row with the ledger. No service role, no writes.
const origins = (Deno.env.get("ALLOWED_APP_ORIGINS") || "").split(",").map(s => s.trim()).filter(Boolean);
function headers(origin: string | null) {
  return { "Access-Control-Allow-Origin": origin && origins.includes(origin) ? origin : origins[0] || "",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin", "Cache-Control": "no-store" };
}

type Person = { folio: string; nombre: string; proceso: string | null; categoria: string | null; saldo: number;
  inicial: number; retiros: number; ajustes: number; celdas: Record<string, number> };
type Withdrawal = { origen: string; folio: string; proceso: string | null; nombre: string; fecha: string;
  categoria: string | null; continua: string | null; monto: number | null; estado: string | null; aplica: string };

const TIPO: Record<string, string> = { BASE: "Base", CONFIANZA: "Confianza", EVENTUALES: "Eventual",
  SUPLENTES_FIJOS: "Suplente fijo", SUPLENTES_VARIABLES: "Suplente variable", JUBILADOS_PENSIONADOS: "Jubilado/Pensionado" };
const APLICA: Record<string, string> = { INITIAL: "Ya incluido en saldo inicial", COLUMN: "Columna Retiros",
  PENDING: "No se descuenta (sin entregar)" };
const MONEY = '"$"#,##0.00;[Red]-"$"#,##0.00';
const ARIAL = "Arial";
const argb = (hex: string) => ({ argb: "FF" + hex });
const solid = (hex: string) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: argb(hex) });

class ReportError extends Error {}
function cents(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new ReportError("SAVINGS_JC_AMOUNT_INVALID");
  return Math.round(value * 100);
}
const iso = (v: unknown) => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new ReportError("SAVINGS_JC_FILE_INVALID");
  return v;
};
const ddmmyyyy = (d: string) => d.slice(8, 10) + "-" + d.slice(5, 7) + "-" + d.slice(0, 4);
function col(n: number) { let s = ""; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }

function build(data: { today: string; generated_at: string; dates: string[]; people: Person[]; withdrawals: Withdrawal[] }) {
  const dates = data.dates.map(iso), today = iso(data.today);
  if (!dates.length || !Array.isArray(data.people) || !Array.isArray(data.withdrawals)) throw new ReportError("SAVINGS_JC_FILE_INVALID");
  if (data.people.length > 20000 || data.withdrawals.length > 20000) throw new ReportError("SAVINGS_JC_ROW_LIMIT");
  const withdrawals = data.withdrawals.map(w => ({ ...w, fecha: iso(w.fecha), nombre: String(w.nombre || "").trim() }));
  const retirosPorFolio = new Map<string, number>();
  for (const w of withdrawals) {
    if (!APLICA[w.aplica] || typeof w.folio !== "string") throw new ReportError("SAVINGS_JC_FILE_INVALID");
    if (w.aplica === "COLUMN") retirosPorFolio.set(w.folio, (retirosPorFolio.get(w.folio) || 0) + cents(w.monto));
  }
  const collator = new Intl.Collator("es", { sensitivity: "base" });
  const people = data.people.map(p => ({ ...p, nombre: String(p.nombre || "").trim() }))
    .sort((a, b) => collator.compare(a.nombre, b.nombre) || a.folio.localeCompare(b.folio));
  const folios = new Set<string>();
  for (const p of people) {
    if (typeof p.folio !== "string" || folios.has(p.folio)) throw new ReportError("SAVINGS_JC_FILE_INVALID");
    folios.add(p.folio);
    const cells = dates.reduce((sum, d) => sum + cents(p.celdas?.[d] ?? 0), 0);
    if (Object.keys(p.celdas || {}).some(d => !dates.includes(d))) throw new ReportError("SAVINGS_JC_RECONCILIATION_FAILED");
    const retiros = retirosPorFolio.get(p.folio) || 0;
    // The Excel formula must reproduce the ledger balance exactly; otherwise no file is produced.
    if (retiros !== cents(p.retiros) || cents(p.inicial) + cells - retiros + cents(p.ajustes) !== cents(p.saldo))
      throw new ReportError("SAVINGS_JC_RECONCILIATION_FAILED");
  }
  for (const folio of retirosPorFolio.keys()) if (!folios.has(folio)) throw new ReportError("SAVINGS_JC_RECONCILIATION_FAILED");

  const wb = new ExcelJS.Workbook();
  wb.creator = "SutiApp";
  wb.calcProperties.fullCalcOnLoad = true;

  // ---- Hoja Ahorro ----
  const ws = wb.addWorksheet("Ahorro", { views: [{ state: "frozen", xSplit: 2, ySplit: 1 }] });
  const head = ["Folio", "Nombre agremiado", "Proceso", "Tipo de empleado", "Saldo (HOY)", "Saldo inicial (julio 2026)",
    ...dates.map(ddmmyyyy), "Retiros", "Ajustes"];
  const firstDate = 7, lastDate = 6 + dates.length, cRet = lastDate + 1, cAj = lastDate + 2;
  const nRet = withdrawals.length + 1;
  const thin = { style: "thin" as const, color: argb("D9D9D9") }, thick = { style: "medium" as const, color: argb("000000") };
  ws.addRow(head);
  head.forEach((_, i) => {
    const cell = ws.getCell(1, i + 1);
    cell.font = { name: ARIAL, bold: true, size: 10 };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.fill = solid(i === 4 ? "00FF00" : "F2F2F2");
    cell.border = { bottom: { style: "medium", color: argb("999999") }, ...(i === 5 ? { right: thick } : {}) };
  });
  ws.getRow(1).height = 32;
  const totals = new Array(cAj + 1).fill(0);
  people.forEach((p, k) => {
    const r = k + 2, retiros = retirosPorFolio.get(p.folio) || 0;
    const values: unknown[] = [p.folio, p.nombre, p.proceso || "", TIPO[p.categoria || ""] || "Sin dato",
      { formula: `F${r}+SUM(${col(firstDate)}${r}:${col(lastDate)}${r})-${col(cRet)}${r}+${col(cAj)}${r}`, result: cents(p.saldo) / 100 },
      cents(p.inicial) / 100, ...dates.map(d => cents(p.celdas?.[d] ?? 0) / 100),
      { formula: `SUMPRODUCT((Retiro!$A$2:$A$${nRet}=$A${r})*(Retiro!$I$2:$I$${nRet}="${APLICA.COLUMN}")*Retiro!$G$2:$G$${nRet})`, result: retiros / 100 },
      cents(p.ajustes) / 100];
    const row = ws.getRow(r);
    values.forEach((v, i) => {
      const c = i + 1, cell = row.getCell(c);
      cell.value = v as ExcelJS.CellValue;
      cell.font = { name: ARIAL, size: 9, bold: c === 1 || c === 5, ...(c === cRet ? { color: argb("008000") } : {}) };
      cell.border = { bottom: thin, right: c === 6 ? thick : thin };
      if (c >= 5) { cell.numFmt = MONEY; cell.alignment = { horizontal: "right" }; }
      else if (c === 1 || c === 3) cell.alignment = { horizontal: "center" };
      if (c === 1) cell.numFmt = "@";
    });
    totals[5] += cents(p.saldo); totals[6] += cents(p.inicial);
    dates.forEach((d, j) => totals[firstDate + j] += cents(p.celdas?.[d] ?? 0));
    totals[cRet] += retiros; totals[cAj] += cents(p.ajustes);
  });
  const last = people.length + 1, tr = ws.getRow(last + 1);
  tr.getCell(2).value = "TOTAL";
  for (let c = 1; c <= cAj; c++) {
    const cell = tr.getCell(c);
    if (c >= 5) { cell.value = { formula: `SUM(${col(c)}2:${col(c)}${last})`, result: totals[c] / 100 }; cell.numFmt = MONEY; }
    cell.font = { name: ARIAL, size: 9, bold: true };
    cell.border = { top: thick };
    cell.fill = solid("F2F2F2");
  }
  [8, 40, 9, 19, 14, 15, ...dates.map(() => 12), 13, 12].forEach((w, i) => ws.getColumn(i + 1).width = w);
  ws.autoFilter = `A1:${col(cAj)}${last}`;

  // ---- Hoja Retiro ----
  const wr = wb.addWorksheet("Retiro", { views: [{ state: "frozen", ySplit: 1 }] });
  const rh = ["Folio", "Proceso", "Nombre", "Fecha de retiro", "Categoria", "¿Continuará ahorrando?", "Monto a retirar", "Estado", "Se descuenta en"];
  wr.addRow(rh);
  rh.forEach((_, i) => {
    const cell = wr.getCell(1, i + 1);
    cell.font = { name: ARIAL, bold: true, size: 10, color: argb("FFFFFF") };
    cell.fill = solid("FF3B3B");
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
  wr.getRow(1).height = 34;
  let montoTotal = 0;
  withdrawals.forEach((w, k) => {
    const r = k + 2, [y, m, d] = w.fecha.split("-").map(Number), row = wr.getRow(r);
    const monto = w.monto == null ? null : cents(w.monto);
    if (monto != null) montoTotal += monto;
    const values = [w.folio, w.proceso || "", w.nombre, new Date(Date.UTC(y, m - 1, d)), w.categoria || null,
      w.continua || null, monto == null ? null : monto / 100, w.estado || "", APLICA[w.aplica]];
    values.forEach((v, i) => {
      const cell = row.getCell(i + 1);
      cell.value = v as ExcelJS.CellValue;
      cell.font = { name: ARIAL, size: 9 };
      if (r % 2 === 1) cell.fill = solid("FDE7E7");
      cell.alignment = { horizontal: [3, 8, 9].includes(i + 1) ? "left" : "center" };
    });
    row.getCell(1).numFmt = "@";
    row.getCell(4).numFmt = "d/m/yyyy";
    row.getCell(7).numFmt = "#,##0.00";
    const cat = row.getCell(5), cont = row.getCell(6), sigue = String(w.continua || "").toUpperCase();
    if (w.categoria === "Completo") { cat.fill = solid("4A86E8"); cat.font = { name: ARIAL, size: 9, color: argb("FFFFFF") }; }
    else if (w.categoria === "Parcial") { cat.fill = solid("FF6D01"); cat.font = { name: ARIAL, size: 9, color: argb("FFFFFF") }; }
    if (sigue === "SI") { cont.fill = solid("F6B73C"); cont.font = { name: ARIAL, size: 9, bold: true }; }
    else if (sigue === "NO") { cont.fill = solid("FF0000"); cont.font = { name: ARIAL, size: 9, bold: true, color: argb("FFFFFF") }; }
  });
  const rt = wr.getRow(nRet + 1);
  rt.getCell(3).value = "TOTAL";
  rt.getCell(7).value = { formula: `SUM(G2:G${nRet})`, result: montoTotal / 100 };
  rt.getCell(7).numFmt = "#,##0.00";
  for (let c = 1; c <= rh.length; c++) { rt.getCell(c).font = { name: ARIAL, size: 9, bold: true }; rt.getCell(c).border = { top: thick }; }
  [9, 9, 42, 14, 12, 14, 15, 22, 30].forEach((w, i) => wr.getColumn(i + 1).width = w);
  wr.autoFilter = `A1:I${nRet}`;

  // ---- Notas ----
  const generated = new Intl.DateTimeFormat("es-MX", { timeZone: "America/Hermosillo", day: "2-digit", month: "2-digit",
    year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(data.generated_at));
  const notes: [string, boolean][] = [
    ["Reporte JC de Ahorro", true],
    [`Fuente: Supabase (SutiApp). Generado el ${generated} (hora de Sonora).`, false],
    ["", false],
    ["Hoja Ahorro", true],
    ["Saldo (HOY) = Saldo inicial + suma de las fechas − Retiros + Ajustes. Coincide al centavo con el saldo de cada ahorrador en SutiApp.", false],
    ["Saldo inicial (julio 2026) = saldo justo antes del descuento del 05-07-2026, ya descontadas las entregas del cierre de junio.", false],
    ["   Cálculo: saldo de apertura certificado del 06-09-2026 − descuentos del 05-07 al 05-09 + retiros entregados entre el 05-07 y el 06-09.", false],
    ["   Ahorradores que entraron después del 06-09-2026 inician en $0.00.", false],
    ["Fechas hasta el 05-09-2026: historial de descuentos guardado en Supabase.", false],
    ["Fechas desde el 15-09-2026: descuentos registrados en SutiApp, ya con las correcciones de la encargada.", false],
    [`Las fechas llegan hasta el último descuento vencido al ${ddmmyyyy(today)}; no se muestran fechas futuras.`, false],
    ["Proceso 1 y 3 descuentan los días 15 y 30; jubilados (JUB) el día 5. En las fechas que no le corresponden a una persona aparece $0.00.", false],
    ["Retiros = suma de la hoja Retiro marcados «Columna Retiros» (fórmula, en verde).", false],
    ["Ajustes = correcciones de saldo hechas por la encargada que no corresponden a una fecha de descuento.", false],
    ["Tipo de empleado viene de Afiliados; jubilado y pensionado son una sola categoría.", false],
    ["", false],
    ["Hoja Retiro", true],
    ["Incluye los retiros importados (feb–jul 2026) y los registrados en SutiApp.", false],
    [`«${APLICA.INITIAL}»: retiros anteriores al 05-07-2026; ya están restados en el saldo inicial y no se vuelven a restar.`, false],
    [`«${APLICA.COLUMN}»: retiros desde el 05-07-2026; se restan en la columna Retiros de la hoja Ahorro.`, false],
    [`«${APLICA.PENDING}»: retiro solicitado o aprobado que aún no se entrega; la fecha es la de la solicitud.`, false],
    ["Cuando el proceso registrado en el retiro no era 1, 3 o JUB, se muestra el proceso actual del ahorrador.", false],
  ];
  const wn = wb.addWorksheet("Notas");
  notes.forEach(([text, bold], i) => { const cell = wn.getCell(i + 1, 1); cell.value = text; cell.font = { name: ARIAL, size: bold ? 11 : 10, bold }; });
  wn.getColumn(1).width = 140;
  return { wb, today };
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
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } }, auth: { persistSession: false }
  });
  try {
    const user = await client.auth.getUser();
    if (user.error || !user.data.user) return json(401, "AUTH_INVALID");
    const { data, error } = await client.rpc("get_admin_savings_jc_report");
    if (error) {
      const safe = /^SAVINGS_(JC_[A-Z_]+|REPORT_DENIED)$/.test(error.message) ? error.message : "SAVINGS_JC_UNAVAILABLE";
      return json(error.code === "42501" ? 403 : safe === "SAVINGS_JC_UNAVAILABLE" ? 503 : 422, safe);
    }
    if (!data || !Array.isArray(data.people)) return json(503, "SAVINGS_JC_UNAVAILABLE");
    const { wb, today } = build(data);
    const bytes = await wb.xlsx.writeBuffer();
    return new Response(new Uint8Array(bytes), { headers: { ...headers(origin),
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="Reporte_JC_Ahorro_${today}.xlsx"`,
      "X-Content-Type-Options": "nosniff"
    } });
  } catch (e) {
    if (e instanceof ReportError) return json(422, e.message);
    return json(503, "SAVINGS_JC_UNAVAILABLE");
  }
});
