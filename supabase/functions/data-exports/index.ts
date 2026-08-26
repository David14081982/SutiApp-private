import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import ExcelJS from "npm:exceljs@4.4.0";

type ExportFormat = "xlsx" | "csv";
type DomainSpec = {
  label: string;
  description: string;
  table: string;
  columns: string[];
  filters: Record<string, "text" | "boolean" | "date">;
  section?: string;
  reserved?: boolean;
  fixed?: Record<string, string | boolean>;
  sensitivePii?: boolean;
};

const MAX_ROWS = 20000;
const PAGE_SIZE = 1000;
const allowedOrigins = (Deno.env.get("ALLOWED_APP_ORIGINS") || "")
  .split(",").map((value) => value.trim()).filter(Boolean);

const domains: Record<string, DomainSpec> = {
  affiliates: {
    label: "Afiliados", description: "Padrón actual autorizado de public.affiliates.", table: "affiliates", reserved: true, sensitivePii: true,
    columns: ["id","numero_control","full_name","display_name","affiliate_status_raw","phone_raw","address_raw","birth_date_raw","gender_raw","marital_status_raw","children_count_raw","rfc_raw","curp_raw","unit_raw","city_raw","employment_position_raw","employment_entry_date_raw","occupation_raw","institute_entry_date_raw","employment_area_raw","employment_level_raw","pension_raw","subdirectorate_raw","union_enrollment_date_raw","affiliation_raw","union_position_raw","termination_date_raw","financial_union_code","financial_employee_category_code","financial_employee_type","financial_affiliation_status","financial_employment_status","created_at","updated_at"],
    filters: { affiliation_raw:"text", employment_level_raw:"text", affiliate_status_raw:"text", financial_affiliation_status:"text", financial_employment_status:"text" },
  },
  requests: {
    label: "Solicitudes", description: "Solicitudes operativas y financieras registradas en Supabase; sin firmas ni documentos.", table: "program_requests", reserved: true, sensitivePii: true,
    columns: ["id","folio","numero_control","program_id","program_item_id","product_id","company_id","request_type","status","quantity","notes","terms_accepted","financial_processing_status","legacy_reference","quoted_amount","quote_note","valid_until","responded_at","created_at","updated_at"],
    filters: { program_id:"text", request_type:"text", status:"text", financial_processing_status:"text", created_at:"date" },
  },
  companies: {
    label: "Empresas", description: "Directorio productivo de empresas.", table: "companies", section: "companies",
    columns: ["id","display_name","description","enabled","sort_order","record_origin","created_at","updated_at"], filters: { enabled:"boolean" },
  },
  agreements: {
    label: "Convenios", description: "Beneficios y segmentación autorizada; sin archivos.", table: "company_benefits", section: "agreements",
    columns: ["id","company_id","label","description","enabled","sort_order","audience_mode","union_codes","employment_category_codes","gender_codes","tag_codes","record_origin","created_at","updated_at"], filters: { company_id:"text", enabled:"boolean", audience_mode:"text" },
  },
  news: {
    label: "Noticias", description: "Artículos del sindicato.", table: "news_articles", section: "news",
    columns: ["id","title","tag","body","accent_hue","display_date","reading_minutes","published","publish_from","publish_until","sort_order","record_origin","created_at","updated_at"], filters: { tag:"text", published:"boolean" },
  },
  education: {
    label: "Educación", description: "Recursos educativos publicados o en preparación.", table: "educational_resources", section: "education", fixed: { resource_kind:"education" },
    columns: ["id","resource_kind","title","description","external_url","published","sort_order","created_at","updated_at"], filters: { published:"boolean" },
  },
  tutorials: {
    label: "Tutoriales", description: "Tutoriales separados del dominio Educación.", table: "educational_resources", section: "tutorials", fixed: { resource_kind:"tutorial" },
    columns: ["id","resource_kind","title","description","external_url","published","sort_order","created_at","updated_at"], filters: { published:"boolean" },
  },
  banners: {
    label: "Banners", description: "Campañas visuales sin binarios ni rutas Storage.", table: "banners", section: "banners",
    columns: ["id","placement","title","description","action_label","action_url","company_raw","category_raw","enabled","start_at","end_at","sort_order","record_origin","created_at","updated_at"], filters: { placement:"text", enabled:"boolean" },
  },
  popups: {
    label: "Pop-ups", description: "Avisos configurados; no incluye assets.", table: "popups", section: "popups",
    columns: ["id","title","body","action_label","action_url","audience_raw","enabled","start_at","end_at","sort_order","record_origin","created_at","updated_at"], filters: { enabled:"boolean" },
  },
  documents: {
    label: "Documentos", description: "Metadatos documentales; excluye binarios y URLs privadas.", table: "institutional_documents", section: "documents",
    columns: ["id","kind","title","description","enabled","sort_order","record_origin","created_at","updated_at"], filters: { kind:"text", enabled:"boolean" },
  },
  minutes: {
    label: "Minutas", description: "Metadatos de minutas; excluye binarios.", table: "minutes", section: "minutes",
    columns: ["id","title","description","source_date_raw","published_on","enabled","sort_order","record_origin","created_at","updated_at"], filters: { enabled:"boolean", published_on:"date" },
  },
  programs: {
    label: "Programas", description: "Contenido institucional no financiero.", table: "institutional_programs", section: "programs",
    columns: ["id","category","description","phone_raw","whatsapp_raw","facebook_url","instagram_url","share_url","location_raw","whatsapp_url","tiktok_url","enabled","sort_order","record_origin","created_at","updated_at"], filters: { category:"text", enabled:"boolean" },
  },
  memberships: {
    label: "Membresías", description: "Catálogo de membresías; no incluye solicitudes de nómina legacy.", table: "membership_offerings", reserved: true,
    columns: ["id","company_raw","concept","amount","installments","enabled","sort_order","record_origin","created_at","updated_at"], filters: { enabled:"boolean" },
  },
  marketplace: {
    label: "Marketplace", description: "Productos del catálogo, sin assets ni solicitudes.", table: "marketplace_products", section: "marketplace",
    columns: ["id","company_id","category_id","subcategory_id","category_raw","subcategory_raw","name","short_description","description","price","discount_percent","stock","rating","condition_raw","free_shipping","sizes","colors","requires_quote","badge","enabled","sort_order","record_origin","created_at","updated_at"], filters: { company_id:"text", enabled:"boolean", requires_quote:"boolean" },
  },
  program_catalog: {
    label: "Suti Farma y programas", description: "Catálogo maestro por programa; sin source_payload ni assets.", table: "program_catalog_items", reserved: true,
    columns: ["id","program_key","name","description","category_raw","quantity_raw","presentation_raw","contact_url_raw","price_cash","requires_quote","request_mode","legacy_boundary","enabled","sort_order","record_origin","created_at","updated_at"], filters: { program_key:"text", enabled:"boolean", request_mode:"text" },
  },
  audit: {
    label: "Auditoría de exportaciones", description: "Metadatos de exportaciones; no incluye las filas descargadas.", table: "data_export_audit_log", reserved: true,
    columns: ["export_id","actor_id","domain","filters","row_count","format","status","column_set","created_at"], filters: { domain:"text", format:"text", status:"text", created_at:"date" },
  },
  admin_audit: {
    label: "Auditoría administrativa", description: "Actividad administrativa sin payloads internos.", table: "admin_audit_log", reserved: true,
    columns: ["id","resource","action","target_id","result","created_at"], filters: { resource:"text", action:"text", result:"text", created_at:"date" },
  },
};

function cors(origin: string | null) {
  const allowed = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || "";
  return { "Access-Control-Allow-Origin": allowed, "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Vary": "Origin" };
}
function json(status: number, body: unknown, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(origin), "Content-Type":"application/json", "Cache-Control":"no-store" } });
}
function cell(value: unknown) {
  if (value === null || value === undefined) return "";
  const normalized=typeof value === "object" ? JSON.stringify(value) : value;
  return typeof normalized === "string" && /^[=+\-@\t\r]/.test(normalized) ? `'${normalized}` : normalized;
}
function csvValue(value: unknown) {
  const raw = String(cell(value));
  return /[",\r\n]/.test(raw) ? `"${raw.replaceAll('"','""')}"` : raw;
}
function safeFilePart(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]+/g,"_"); }

async function canExport(userClient: ReturnType<typeof createClient>, spec: DomainSpec) {
  const global = await userClient.rpc("has_admin_permission", { required_permission:"data_exports.read" });
  if (global.error) throw global.error;
  if (global.data) return true;
  if (spec.reserved || !spec.section) return false;
  const section = await userClient.rpc("has_section_action", { p_section_key:spec.section, p_action:"export" });
  if (section.error) throw section.error;
  return Boolean(section.data);
}

function applyFilters(query: any, spec: DomainSpec, input: unknown) {
  const filters = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  for (const [key,value] of Object.entries(filters)) {
    const type = spec.filters[key];
    if (!type || value === "" || value === null || value === undefined) continue;
    if (type === "boolean") {
      if (value !== true && value !== false) throw new Error("INVALID_FILTER");
      query = query.eq(key,value);
    } else if (type === "date") {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("INVALID_FILTER");
      const next=new Date(`${value}T00:00:00.000Z`);next.setUTCDate(next.getUTCDate()+1);
      query = query.gte(key,value).lt(key,next.toISOString().slice(0,10));
    } else {
      if (typeof value !== "string" || value.length > 160) throw new Error("INVALID_FILTER");
      query = query.eq(key,value);
    }
  }
  for (const [key,value] of Object.entries(spec.fixed || {})) query = query.eq(key,value);
  return { query, filters };
}

async function rowsFor(privileged: ReturnType<typeof createClient>, spec: DomainSpec, input: unknown) {
  const output: Record<string, unknown>[] = [];
  let auditFilters: Record<string, unknown> = {};
  for (let from=0; from<=MAX_ROWS; from+=PAGE_SIZE) {
    let query = privileged.from(spec.table).select(spec.columns.join(",")).order(spec.columns.includes("created_at")?"created_at":spec.columns[0],{ascending:true}).range(from,Math.min(from+PAGE_SIZE-1,MAX_ROWS));
    const applied=applyFilters(query,spec,input);query=applied.query;auditFilters=applied.filters;
    const result=await query;
    if(result.error)throw result.error;
    output.push(...(result.data||[]));
    if((result.data||[]).length<PAGE_SIZE)break;
  }
  if(output.length>MAX_ROWS)throw new Error("EXPORT_ROW_LIMIT_EXCEEDED");
  return { rows:output, filters:auditFilters };
}

async function fileFor(spec: DomainSpec, rows: Record<string, unknown>[], format: ExportFormat) {
  if(format==="csv") {
    const lines=[spec.columns.map(csvValue).join(","),...rows.map((row)=>spec.columns.map((key)=>csvValue(row[key])).join(","))];
    return { body:new TextEncoder().encode("\uFEFF"+lines.join("\r\n")), type:"text/csv; charset=utf-8" };
  }
  const workbook=new ExcelJS.Workbook();
  workbook.creator="SutiApp";workbook.created=new Date();
  const sheet=workbook.addWorksheet(spec.label.slice(0,31));
  sheet.columns=spec.columns.map((key)=>({header:key,key,width:Math.min(40,Math.max(14,key.length+2))}));
  sheet.getRow(1).font={bold:true,color:{argb:"FFFFFFFF"}};sheet.getRow(1).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF7B1634"}};sheet.views=[{state:"frozen",ySplit:1}];sheet.autoFilter={from:"A1",to:{row:1,column:spec.columns.length}};
  rows.forEach((row)=>sheet.addRow(Object.fromEntries(spec.columns.map((key)=>[key,cell(row[key])]))));
  const bytes=await workbook.xlsx.writeBuffer();
  // supabase-js preserves octet-stream as Blob; the XLSX filename still carries
  // the correct extension and the ZIP bytes reach the browser unchanged.
  return { body:new Uint8Array(bytes), type:"application/octet-stream" };
}

Deno.serve(async (req) => {
  const origin=req.headers.get("origin");
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors(origin)});
  if(!["GET","POST"].includes(req.method))return json(405,{error:"METHOD_NOT_ALLOWED"},origin);
  if(origin && !allowedOrigins.includes(origin))return json(403,{error:"ORIGIN_DENIED"},origin);
  const auth=req.headers.get("authorization");
  if(!auth?.startsWith("Bearer "))return json(401,{error:"AUTH_REQUIRED"},origin);
  const supabaseUrl=Deno.env.get("SUPABASE_URL")!;const anonKey=Deno.env.get("SUPABASE_ANON_KEY")!;const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userClient=createClient(supabaseUrl,anonKey,{global:{headers:{Authorization:auth}},auth:{persistSession:false}});
  const privileged=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false}});
  const user=await userClient.auth.getUser();
  if(user.error||!user.data.user)return json(401,{error:"AUTH_INVALID"},origin);
  try {
    if(req.method==="GET") {
      const available=[];
      for(const [key,spec] of Object.entries(domains))if(await canExport(userClient,spec)){
        let countQuery=privileged.from(spec.table).select("*",{count:"exact",head:true});
        countQuery=applyFilters(countQuery,spec,{}).query;const counted=await countQuery;
        available.push({key,label:spec.label,description:spec.description,filters:spec.filters,sensitive_pii:Boolean(spec.sensitivePii),record_count:counted.error?null:counted.count,formats:["xlsx","csv"]});
      }
      if(!available.length)return json(403,{error:"EXPORT_PERMISSION_REQUIRED"},origin);
      return json(200,{domains:available,technical_backup:{status:"SEPARATE_PROCESS",message:"Los backups técnicos se administran fuera de XLSX/CSV."}},origin);
    }
    const payload=await req.json().catch(()=>null) as Record<string,unknown>|null;
    const domain=typeof payload?.domain==="string"?payload.domain:"";const format=payload?.format as ExportFormat;const spec=domains[domain];
    if(!spec||!["xlsx","csv"].includes(format))return json(400,{error:"INVALID_EXPORT_REQUEST"},origin);
    if(!await canExport(userClient,spec))return json(403,{error:"EXPORT_PERMISSION_REQUIRED"},origin);
    const result=await rowsFor(privileged,spec,payload?.filters);
    const file=await fileFor(spec,result.rows,format);
    const saved=await privileged.from("data_export_audit_log").insert({actor_id:user.data.user.id,domain,filters:result.filters,row_count:result.rows.length,format,status:"SUCCESS",column_set:spec.columns}).select("export_id").single();
    if(saved.error)throw saved.error;
    const date=new Date().toISOString().slice(0,10);const name=`SutiApp_${safeFilePart(spec.label)}_${date}.${format}`;
    return new Response(file.body,{status:200,headers:{...cors(origin),"Content-Type":file.type,"Content-Disposition":`attachment; filename="${name}"`,"Cache-Control":"private, no-store, max-age=0","X-Content-Type-Options":"nosniff","X-Export-Id":saved.data.export_id}});
  } catch(error) {
    const code=error instanceof Error?error.message:"EXPORT_FAILED";
    return json(code==="INVALID_FILTER"?400:code==="EXPORT_ROW_LIMIT_EXCEEDED"?413:500,{error:code},origin);
  }
});
