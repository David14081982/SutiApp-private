import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { BUSINESS_TIME_ZONE, evaluateVisibility } from "./visibility-policy.js";

// Supabase is intentionally schema-untyped in this standalone Edge bundle; database
// contracts are enforced by migrations/RLS/RPCs and validated again at this boundary.
type SupabaseClientLike = any;

const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const ACTION_KEYS: Record<string, Set<string>> = {
  loanSessionOpen: new Set(["action"]),
  loanSessionValidate: new Set(["action", "snapshot_id"]),
  loanSessionQuote: new Set(["action", "snapshot_id", "program_id", "amount", "term"]),
  loanSessionConfirm: new Set(["action", "snapshot_id", "program_id", "amount", "term", "program_item_id",
    "notes", "signature_data", "terms_accepted", "terms_version_id", "document_ids", "idempotency_key"]),
  overview: new Set(["action"]),
  resolveEligibility: new Set(["action"]),
  resolveAvailableFunds: new Set(["action"]),
  catalog: new Set(["action"]),
  quote: new Set(["action", "program_id", "amount", "term"]),
  resolveSimulation: new Set(["action", "program_id", "amount", "term"]),
  approve: new Set(["action", "request_id", "comment"]),
  handoff: new Set(["action", "request_id"]),
};

function reply(status: number, body: Record<string, unknown>, origin?: string | null) {
  const headers: Record<string, string> = { ...JSON_HEADERS, "Vary": "Origin" };
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  return new Response(JSON.stringify(body), { status, headers });
}

function allowedOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return null;
  const allowed = (Deno.env.get("ALLOWED_APP_ORIGINS") || "")
    .split(",").map((value) => value.trim()).filter(Boolean);
  return allowed.includes(origin) ? origin : false;
}

function validPayload(body: Record<string, unknown>) {
  const action = typeof body.action === "string" ? body.action : "";
  const allowed = ACTION_KEYS[action];
  if (!allowed || Object.keys(body).some((key) => !allowed.has(key))) return false;
  if (["quote", "resolveSimulation", "loanSessionQuote"].includes(action)) {
    if (action === "loanSessionQuote" && (typeof body.snapshot_id !== "string" || !UUID_PATTERN.test(body.snapshot_id))) return false;
    return typeof body.program_id === "string" && body.program_id.length > 0 &&
      typeof body.amount === "number" && Number.isFinite(body.amount) && body.amount > 0 &&
      typeof body.term === "number" && Number.isInteger(body.term) && body.term > 0;
  }
  if (action === "loanSessionValidate") {
    return typeof body.snapshot_id === "string" && UUID_PATTERN.test(body.snapshot_id);
  }
  if (action === "loanSessionConfirm") {
    return typeof body.snapshot_id === "string" && UUID_PATTERN.test(body.snapshot_id) &&
      typeof body.program_id === "string" && body.program_id.length > 0 &&
      typeof body.amount === "number" && Number.isFinite(body.amount) && body.amount > 0 &&
      typeof body.term === "number" && Number.isInteger(body.term) && body.term > 0 &&
      typeof body.program_item_id === "string" && UUID_PATTERN.test(body.program_item_id) &&
      typeof body.notes === "string" && body.notes.length <= 2000 &&
      typeof body.signature_data === "string" && body.signature_data.trim().length > 0 &&
      body.terms_accepted === true && typeof body.terms_version_id === "string" && UUID_PATTERN.test(body.terms_version_id) &&
      Array.isArray(body.document_ids) && body.document_ids.length <= 50 && body.document_ids.every((id) => typeof id === "string" && UUID_PATTERN.test(id)) &&
      typeof body.idempotency_key === "string" && UUID_PATTERN.test(body.idempotency_key);
  }
  if (action === "handoff" || action === "approve") {
    return typeof body.request_id === "string" && (body.comment === undefined ||
      typeof body.comment === "string" && body.comment.length <= 2000) &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.request_id);
  }
  return true;
}

type FinancialProfile = {
  affiliate_id?: string | null;
  numero_control: string;
  financial_union_code?: string | null;
  financial_union?: string | null;
  financial_employee_category_code?: string | null;
  financial_employee_category?: string | null;
  financial_employee_type?: string | null;
  financial_affiliation_status?: string | null;
  financial_employment_status?: string | null;
  financial_profile_version?: number | null;
};

type CriteriaRule = {
  rule_id?: string;
  id: string;
  program_id: string;
  fund: string;
  category: string;
  union: string;
  max_amount: number;
  rate_factor: number;
  rate: number;
  payment_count: number;
  payment_period: "quincenal";
  max_term: number;
  term_label: string;
  status: "AVAILABLE" | "SCHEDULED" | "UNAVAILABLE";
  available_on: string | null;
  criterion_identity: string;
  sheet_row: number;
  visibility_mode: "AUTO" | "MOSTRAR" | "OCULTAR";
  automatic_visibility: "VISIBLE" | "HIDDEN";
  effective_visibility: "VISIBLE" | "HIDDEN";
  visibility_window_start: string;
  visibility_window_end: string;
  permanent: boolean;
  financial_union_code?: string;
  financial_employee_category_code?: string;
  lifecycle_status?: string;
  review_required?: boolean;
  review_signals?: string[];
};

type TermPolicy = {
  source: "SUPABASE_LOAN_TERM_POLICY";
  standardTerms: number[];
  customMinTerm: number;
  customStep: number;
  decisionReference?: string;
};

const normalize = (value: unknown) => String(value ?? "").trim().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").toUpperCase();
const EXPORT_CONTRACT_VERSION = "FINAL_APPROVED_LOAN_EXPORT_V1";
const LOAN_SESSION_TTL_MS = 15 * 60 * 1000;
const LOAN_CALCULATION_CONTRACT_VERSION = "SUTI_LOAN_QUOTE_V1";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function processForCategory(value: string) {
  const key = normalize(value);
  if (key === "SUPLENTES VARIABLES") return "3";
  if (["SUPLENTES FIJOS", "EVENTUALES", "BASE"].includes(key)) return "1";
  if (key === "JUBILADOS Y PENS." || key === "JUBILADOS Y PENS") return "JUB";
  if (key === "CONFIANZA") return "Confianza";
  throw new Error("EMPLOYEE_CATEGORY_PROCESS_UNRESOLVED");
}

function affiliationForUnion(value: string) {
  const key = normalize(value);
  if (key === "SUTISSSTESON") return "AFILIADO";
  if (["SUEISSSTESON", "SITISSSTESON", "EMPLEADOS DE CONFIANZA"].includes(key)) return "NO AFILIADO";
  throw new Error("UNION_AFFILIATION_UNRESOLVED");
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function sha256(value: unknown) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalJson(value)));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function privateAssetReference(file: Record<string, unknown>) {
  const id = String(file.private_asset_id || "");
  const hash = String(file.sha256 || "").toUpperCase();
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[A-F0-9]{64}$/.test(hash) || file.classification !== "PRIVATE" || file.status !== "READY") {
    throw new Error("PRIVATE_DOCUMENT_CONTRACT_INVALID");
  }
  return `supabase-private-asset:${id.toLowerCase()}:${hash}`;
}

async function requireExportPermission(userClient: SupabaseClientLike) {
  for (const permission of ["program_requests.write", "workflow.write"]) {
    const { data, error } = await userClient.rpc("has_admin_permission", { required_permission: permission });
    if (error || data !== true) return false;
  }
  return true;
}

async function readCriteriaRules(privileged: SupabaseClientLike): Promise<CriteriaRule[]> {
  const rpcName = "get_financial_runtime_rules";
  const { data, error } = await privileged.rpc(rpcName);
  if (error || !Array.isArray(data) || data.length < 1) {
    const message = String(error?.message || "");
    console.error("financial criteria RPC failed", { rpc: rpcName, code: String(error?.code || "RPC_SHAPE"),
      details: message.slice(0, 120), isArray: Array.isArray(data), rows: Array.isArray(data) ? data.length : 0 });
    if (message.includes("FINANCIAL_CRITERIA_NOT_CONFIGURED")) throw new Error("FINANCIAL_CRITERIA_NOT_CONFIGURED");
    throw new Error("FINANCIAL_CRITERIA_UNAVAILABLE");
  }
  return data.map((raw: Record<string, unknown>) => {
    const availableOn = raw.available_on ? String(raw.available_on) : null;
    const visibility = evaluateVisibility(availableOn, raw.visibility_mode, new Date(), BUSINESS_TIME_ZONE);
    const rule: CriteriaRule = {
      rule_id: String(raw.rule_id || ""), id: String(raw.id), program_id: String(raw.program_id), fund: String(raw.fund),
      category: String(raw.category), union: String(raw.union), max_amount: Number(raw.max_amount),
      rate_factor: Number(raw.rate_factor), rate: Number(raw.rate), payment_count: Number(raw.payment_count),
      payment_period: "quincenal", max_term: Number(raw.max_term), term_label: String(raw.term_label),
      status: visibility.status as CriteriaRule["status"], available_on: availableOn,
      criterion_identity: String(raw.criterion_identity), sheet_row: Number(raw.sheet_row),
      visibility_mode: visibility.visibilityMode as CriteriaRule["visibility_mode"],
      automatic_visibility: visibility.automaticVisibility as CriteriaRule["automatic_visibility"],
      effective_visibility: visibility.effectiveVisibility as CriteriaRule["effective_visibility"],
      visibility_window_start: visibility.windowStart, visibility_window_end: visibility.windowEnd,
      permanent: visibility.permanent,
      financial_union_code: String(raw.financial_union_code || ""),
      financial_employee_category_code: String(raw.financial_employee_category_code || ""),
      lifecycle_status: String(raw.lifecycle_status || "PUBLISHED"),
      review_required: raw.review_required === true,
      review_signals: Array.isArray(raw.review_signals) ? raw.review_signals.map(String) : [],
    };
    if (!rule.id || !rule.program_id || !rule.fund || !rule.category || !rule.union ||
        !Number.isFinite(rule.max_amount) || !Number.isFinite(rule.rate_factor) || !Number.isFinite(rule.rate) ||
        !Number.isInteger(rule.payment_count) || !Number.isInteger(rule.max_term)) throw new Error("FINANCIAL_CRITERIA_INVALID_RESPONSE");
    return rule;
  });
}

function rulesForProfile(rules: CriteriaRule[], profile: FinancialProfile) {
  const category = normalize(profile.financial_employee_category);
  const union = normalize(profile.financial_union);
  if (!category || !union) return [];
  return rules.filter((rule) => normalize(rule.category) === category && normalize(rule.union) === union);
}

function allowedTerms(rule: CriteriaRule, policy: TermPolicy) {
  return policy.standardTerms.filter((term) => term >= policy.customMinTerm && term <= rule.payment_count);
}

function publicProgram(rule: CriteriaRule, policy: TermPolicy) {
  return {
    id: rule.id, program_id: rule.program_id, label: rule.fund, fund: rule.fund, status: rule.status,
    min_amount: 1, max_amount: rule.max_amount, suggested_amount: Math.min(5000, rule.max_amount),
    allowed_terms: allowedTerms(rule, policy), payment_period: rule.payment_period,
    custom_term: { min: policy.customMinTerm, max: rule.payment_count, step: policy.customStep },
    rate: rule.rate, rate_period: rule.payment_period, term_label: rule.term_label,
    available_on: rule.available_on,
    visibility_mode: rule.visibility_mode, automatic_visibility: rule.automatic_visibility,
    effective_visibility: rule.effective_visibility, visibility_window_start: rule.visibility_window_start,
    visibility_window_end: rule.visibility_window_end, permanent: rule.permanent,
  };
}

function resolveOverview(rules: CriteriaRule[], profile: FinancialProfile, policy: TermPolicy) {
  const complete = !!(profile.financial_union && profile.financial_employee_category);
  const matched = complete ? rulesForProfile(rules, profile) : [];
  // Suggested terms are optional shortcuts, not an eligibility gate. A legacy
  // rule remains selectable when it can satisfy the owner-approved custom
  // minimum, including rules whose only valid term is one payment.
  const selectable = matched.filter((rule) => rule.payment_count >= policy.customMinTerm);
  const available = selectable.filter((rule) => rule.status === "AVAILABLE");
  const scheduled = selectable.filter((rule) => rule.status === "SCHEDULED");
  const status = !complete ? "UNAVAILABLE" : available.length ? "AVAILABLE" : scheduled.length ? "SCHEDULED" : "NOT_ELIGIBLE";
  return {
    status, reason: !complete ? "INCOMPLETE_FINANCIAL_PROFILE" : !matched.length ? "NO_MATCHING_CRITERIA" : !selectable.length ? "NO_VALID_LOAN_TERMS" : null,
    eligibility: { status, eligible: available.length > 0 }, eligibility_label: status === "AVAILABLE" ? "DISPONIBLE" : status,
    profile_version: profile.financial_profile_version ?? null,
    available_credit: available.length ? Math.max(...available.map((rule) => rule.max_amount)) : null,
    programs: available.map((rule) => publicProgram(rule, policy)),
    available_funds: available.map((rule) => publicProgram(rule, policy)), scheduled_funds: scheduled.map((rule) => publicProgram(rule, policy)),
    source: "SUPABASE_FINANCIAL_CRITERIA", resolved_at: new Date().toISOString(),
  };
}

async function resolveQuote(
  privileged: SupabaseClientLike, rules: CriteriaRule[], profile: FinancialProfile,
  body: Record<string, unknown>, policy: TermPolicy,
) {
  if (!profile.financial_union || !profile.financial_employee_category) throw new Error("AFFILIATE_FINANCIAL_PROFILE_INCOMPLETE");
  const { data, error } = await privileged.rpc("resolve_suti_loan_quote_contract", {
    p_eligible_rules: rules,
    p_financial_union: profile.financial_union,
    p_financial_employee_category: profile.financial_employee_category,
    p_program_id: String(body.program_id),
    p_amount: Number(body.amount),
    p_term: Number(body.term),
    p_policy: policy,
  });
  if (error || !data) {
    const message = String(error?.message || "FINANCIAL_RESOLUTION_FAILED");
    for (const code of ["AFFILIATE_FINANCIAL_PROFILE_INCOMPLETE", "FINANCIAL_PROGRAM_NOT_ELIGIBLE",
      "FINANCIAL_REQUEST_OUT_OF_RANGE", "LOAN_TERM_POLICY_UNAVAILABLE", "FINANCIAL_RULES_INVALID"]) {
      if (message.includes(code)) throw new Error(code);
    }
    throw new Error("FINANCIAL_RESOLUTION_FAILED");
  }
  return data as Record<string, unknown>;
}

async function readTermPolicy(userClient: SupabaseClientLike): Promise<TermPolicy> {
  const { data, error } = await userClient.rpc("get_current_loan_term_policy");
  if (error || !data || data.source !== "SUPABASE_LOAN_TERM_POLICY" || !Array.isArray(data.standardTerms) ||
      !Number.isInteger(data.customMinTerm) || !Number.isInteger(data.customStep)) {
    throw new Error("LOAN_TERM_POLICY_UNAVAILABLE");
  }
  return data as TermPolicy;
}

type LoanSessionContext = {
  actorId: string;
  affiliateId: string;
  impersonationSessionId: string | null;
  profile: FinancialProfile;
};

type LoanSessionSnapshot = {
  id: string;
  affiliate_id: string;
  actor_real_auth_user_id: string;
  impersonation_session_id: string | null;
  financial_profile_version: number;
  profile_fingerprint: string;
  eligible_rules: CriteriaRule[];
  criteria_source_fingerprint: string;
  term_policy_fingerprint: string;
  calculation_contract_version: string;
  created_at: string;
  expires_at: string;
  invalidated_at: string | null;
};

async function currentLoanSessionContext(userClient: SupabaseClientLike, actorId: string): Promise<LoanSessionContext> {
  const [profileResult, impersonationResult] = await Promise.all([
    userClient.rpc("get_current_affiliate_financial_context"),
    userClient.rpc("get_impersonation_context"),
  ]);
  const profile = profileResult.data as FinancialProfile | null;
  if (profileResult.error || !profile?.affiliate_id || !profile.numero_control) throw new Error("AFFILIATE_CONTEXT_UNAVAILABLE");
  const rawContext = Array.isArray(impersonationResult.data) ? impersonationResult.data[0] : impersonationResult.data;
  return {
    actorId,
    affiliateId: String(profile.affiliate_id),
    impersonationSessionId: rawContext?.session_id ? String(rawContext.session_id) : null,
    profile,
  };
}

function profileFingerprintPayload(context: LoanSessionContext) {
  const profile = context.profile;
  return {
    affiliate_id: context.affiliateId,
    actor_real_auth_user_id: context.actorId,
    impersonation_session_id: context.impersonationSessionId,
    financial_union_code: profile.financial_union_code ?? null,
    financial_union: profile.financial_union ?? null,
    financial_employee_category_code: profile.financial_employee_category_code ?? null,
    financial_employee_category: profile.financial_employee_category ?? null,
    financial_employee_type: profile.financial_employee_type ?? null,
    financial_affiliation_status: profile.financial_affiliation_status ?? null,
    financial_employment_status: profile.financial_employment_status ?? null,
    financial_profile_version: profile.financial_profile_version ?? null,
  };
}

const criteriaFingerprintPayload = (rules: CriteriaRule[]) => rules.map((rule) => ({
  id: rule.id, program_id: rule.program_id, fund: rule.fund, category: rule.category, union: rule.union,
  max_amount: rule.max_amount, rate_factor: rule.rate_factor, rate: rule.rate,
  payment_count: rule.payment_count, payment_period: rule.payment_period, max_term: rule.max_term,
  term_label: rule.term_label, status: rule.status, available_on: rule.available_on,
  criterion_identity: rule.criterion_identity, sheet_row: rule.sheet_row,
  visibility_mode: rule.visibility_mode, automatic_visibility: rule.automatic_visibility,
  effective_visibility: rule.effective_visibility, visibility_window_start: rule.visibility_window_start,
  visibility_window_end: rule.visibility_window_end, permanent: rule.permanent,
}));

async function termPolicyFingerprint(policy: TermPolicy) {
  return await sha256({ source: policy.source, standardTerms: policy.standardTerms,
    customMinTerm: policy.customMinTerm, customStep: policy.customStep,
    decisionReference: policy.decisionReference ?? null });
}

function privilegedClient(supabaseUrl: string) {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY") || "";
  if (!key) throw new Error("FINANCIAL_SESSION_WRITER_NOT_CONFIGURED");
  return createClient(supabaseUrl, key, { auth: { persistSession: false } });
}

async function invalidateLoanSession(privileged: SupabaseClientLike, id: string, reason: string) {
  await privileged.from("financial_session_snapshots").update({
    invalidated_at: new Date().toISOString(), invalidation_reason: reason.slice(0, 100),
  }).eq("id", id).is("invalidated_at", null);
}

async function openPersonalizedLoanSession(
  userClient: SupabaseClientLike, privileged: SupabaseClientLike, context: LoanSessionContext,
) {
  const [rules, policy] = await Promise.all([readCriteriaRules(privileged), readTermPolicy(userClient)]);
  const matched = rulesForProfile(rules, context.profile)
    .filter((rule) => rule.payment_count >= policy.customMinTerm);
  const overview = resolveOverview(rules, context.profile, policy);
  if (!matched.length) return { ...overview, loanSession: null, googleResolutionCount: 0 };
  const profileFingerprint = await sha256(profileFingerprintPayload(context));
  const criteriaFingerprint = await sha256(criteriaFingerprintPayload(matched));
  const policyFingerprint = await termPolicyFingerprint(policy);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LOAN_SESSION_TTL_MS);
  await privileged.from("financial_session_snapshots").update({ invalidated_at: now.toISOString(), invalidation_reason: "SESSION_REPLACED" })
    .eq("affiliate_id", context.affiliateId).eq("actor_real_auth_user_id", context.actorId).is("invalidated_at", null);
  await privileged.from("financial_session_snapshots").delete().lt("expires_at", now.toISOString());
  const { data: saved, error } = await privileged.from("financial_session_snapshots").insert({
    affiliate_id: context.affiliateId,
    actor_real_auth_user_id: context.actorId,
    impersonation_session_id: context.impersonationSessionId,
    financial_profile_version: Number(context.profile.financial_profile_version),
    profile_fingerprint: profileFingerprint,
    eligible_rules: matched,
    criteria_source_fingerprint: criteriaFingerprint,
    term_policy_fingerprint: policyFingerprint,
    calculation_contract_version: LOAN_CALCULATION_CONTRACT_VERSION,
    created_at: now.toISOString(), expires_at: expiresAt.toISOString(),
  }).select("id,expires_at,financial_profile_version").single();
  if (error || !saved) throw new Error("FINANCIAL_SESSION_SNAPSHOT_WRITE_FAILED");
  return { ...overview, loanSession: { id: saved.id, expires_at: saved.expires_at,
    financial_profile_version: saved.financial_profile_version }, googleResolutionCount: 0 };
}

async function loadPersonalizedLoanSession(
  privileged: SupabaseClientLike, context: LoanSessionContext, policy: TermPolicy, snapshotId: string,
): Promise<LoanSessionSnapshot> {
  const { data, error } = await privileged.from("financial_session_snapshots").select("*").eq("id", snapshotId).maybeSingle();
  if (error || !data) throw new Error("SNAPSHOT_INVALID");
  const snapshot = data as LoanSessionSnapshot;
  const currentProfileFingerprint = await sha256(profileFingerprintPayload(context));
  const currentPolicyFingerprint = await termPolicyFingerprint(policy);
  const ownsSnapshot = snapshot.affiliate_id === context.affiliateId && snapshot.actor_real_auth_user_id === context.actorId &&
    String(snapshot.impersonation_session_id || "") === String(context.impersonationSessionId || "");
  if (!ownsSnapshot) throw new Error("SNAPSHOT_INVALID");
  const invalid = snapshot.invalidated_at || new Date(snapshot.expires_at).getTime() <= Date.now() ||
    snapshot.financial_profile_version !== Number(context.profile.financial_profile_version) ||
    snapshot.profile_fingerprint !== currentProfileFingerprint || snapshot.term_policy_fingerprint !== currentPolicyFingerprint ||
    snapshot.calculation_contract_version !== LOAN_CALCULATION_CONTRACT_VERSION || !Array.isArray(snapshot.eligible_rules) ||
    rulesForProfile(snapshot.eligible_rules, context.profile).length !== snapshot.eligible_rules.length;
  if (invalid) {
    if (!snapshot.invalidated_at) await invalidateLoanSession(privileged, snapshot.id,
      new Date(snapshot.expires_at).getTime() <= Date.now() ? "SESSION_EXPIRED" : "SESSION_CONTEXT_CHANGED");
    throw new Error("SNAPSHOT_INVALID");
  }
  return snapshot;
}

async function quoteWithPayroll(userClient: SupabaseClientLike, quote: Record<string, unknown>) {
  const { data: payrollImpact, error } = await userClient.rpc("get_current_declared_payroll_impact",
    { p_payment_per_period: quote.paymentPerPeriod });
  return { ...quote, payrollImpact: error
    ? { status: "ERROR", source: "SUPABASE_DECLARED_PAYROLL", guidelinePercent: 30 }
    : payrollImpact };
}

async function confirmPersonalizedLoanSession(
  body: Record<string, unknown>, userClient: SupabaseClientLike, privileged: SupabaseClientLike,
  context: LoanSessionContext,
) {
  const { data: existing, error: existingError } = await privileged.from("program_requests")
    .select("id,folio,actor_real_auth_user_id,affiliate_id,impersonation_session_id,program_id,program_item_id,requested_amount,requested_term,financial_submission_snapshot")
    .eq("affiliate_id", context.affiliateId).eq("idempotency_key", String(body.idempotency_key)).maybeSingle();
  if (existingError) return { status: 500, body: { error: "FINANCIAL_REQUEST_LOOKUP_FAILED" } };
  if (existing) {
    const sameContract = existing.actor_real_auth_user_id === context.actorId &&
      String(existing.impersonation_session_id || "") === String(context.impersonationSessionId || "") &&
      existing.program_id === "prestamo" &&
      existing.program_item_id === String(body.program_item_id) && Number(existing.requested_amount) === Number(body.amount) &&
      Number(existing.requested_term) === Number(body.term) && existing.financial_submission_snapshot?.financialResult;
    if (!sameContract) return { status: 409, body: { error: "IDEMPOTENCY_CONTRACT_MISMATCH" } };
    return { status: 200, body: { data: { request_id: existing.id, folio: existing.folio,
      financialResult: existing.financial_submission_snapshot.financialResult,
      googleResolutionCount: 0, idempotent: true } } };
  }
  const policy = await readTermPolicy(userClient);
  let snapshot: LoanSessionSnapshot;
  try { snapshot = await loadPersonalizedLoanSession(privileged, context, policy, String(body.snapshot_id)); }
  catch { return { status: 409, body: { error: "CONDITIONS_CHANGED" } }; }
  let currentRules: CriteriaRule[];
  try { currentRules = await readCriteriaRules(privileged); }
  catch (error) { return { status: 502, body: { error: error instanceof Error ? error.message : "FINANCIAL_CRITERIA_UNAVAILABLE" } }; }
  const matched = rulesForProfile(currentRules, context.profile).filter((rule) => rule.payment_count >= policy.customMinTerm);
  const currentSourceFingerprint = await sha256(criteriaFingerprintPayload(matched));
  if (currentSourceFingerprint !== snapshot.criteria_source_fingerprint) {
    await invalidateLoanSession(privileged, snapshot.id, "AUTHORITATIVE_CONDITIONS_CHANGED");
    return { status: 409, body: { error: "CONDITIONS_CHANGED", googleResolutionCount: 0 } };
  }
  let result: Record<string, unknown>;
  try { result = await resolveQuote(privileged, currentRules, context.profile, body, policy); }
  catch {
    await invalidateLoanSession(privileged, snapshot.id, "AUTHORITATIVE_CONDITIONS_CHANGED");
    return { status: 409, body: { error: "CONDITIONS_CHANGED", googleResolutionCount: 0 } };
  }
  const selectedRule = matched.find((rule) => rule.id === String(body.program_id)) ||
    (matched.filter((rule) => rule.program_id === String(body.program_id)).length === 1
      ? matched.find((rule) => rule.program_id === String(body.program_id)) : undefined);
  if (!selectedRule) return { status: 409, body: { error: "CONDITIONS_CHANGED", googleResolutionCount: 0 } };
  const submissionSnapshot = {
    affiliate_id: context.affiliateId,
    actor_real_auth_user_id: context.actorId,
    impersonation_session_id: context.impersonationSessionId,
    profile_version: Number(context.profile.financial_profile_version),
    profile_fingerprint: snapshot.profile_fingerprint,
    criteria_source_fingerprint: currentSourceFingerprint,
    term_policy_fingerprint: snapshot.term_policy_fingerprint,
    calculation_contract_version: LOAN_CALCULATION_CONTRACT_VERSION,
    criterion_identity: selectedRule.criterion_identity,
    financialResult: result,
    confirmed_at: new Date().toISOString(),
  };
  const { data: request, error } = await privileged.rpc("create_validated_financial_program_request", {
    p_actor_real_auth_user_id: context.actorId, p_affiliate_id: context.affiliateId,
    p_impersonation_session_id: context.impersonationSessionId,
    p_program_item_id: body.program_item_id, p_notes: body.notes, p_signature_data: body.signature_data,
    p_terms_version_id: body.terms_version_id, p_document_ids: body.document_ids,
    p_idempotency_key: body.idempotency_key, p_amount: body.amount, p_term: body.term,
    p_term_semantics: result.paymentPeriod, p_expected_profile_version: Number(context.profile.financial_profile_version),
    p_financial_submission_snapshot: submissionSnapshot,
  });
  if (error || !request) {
    const code = String(error?.message || "");
    if (code.includes("CONDITIONS_CHANGED")) {
      await invalidateLoanSession(privileged, snapshot.id, "PROFILE_CHANGED_DURING_CONFIRMATION");
      return { status: 409, body: { error: "CONDITIONS_CHANGED", googleResolutionCount: 0 } };
    }
    return { status: 409, body: { error: code.includes("REQUIRED_DOCUMENTS") ? "REQUIRED_DOCUMENTS_MISSING" : "FINANCIAL_REQUEST_CREATE_FAILED",
      googleResolutionCount: 0 } };
  }
  await invalidateLoanSession(privileged, snapshot.id, "REQUEST_CONFIRMED");
  return { status: 200, body: { data: { request_id: request.id, folio: request.folio,
    financialResult: result, googleResolutionCount: 0 } } };
}

async function approveRequest(body: Record<string, unknown>, supabaseUrl: string, authHeader: string, approvedBy: string) {
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || "", {
    global: { headers: { Authorization: authHeader } }, auth: { persistSession: false },
  });
  if (!await requireExportPermission(userClient)) return { status: 403, body: { error: "ADMIN_APPROVAL_REQUIRED" } };
  const privilegedKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY") || "";
  if (!privilegedKey) return { status: 503, body: { error: "APPROVAL_WRITER_NOT_CONFIGURED" } };
  const privileged = createClient(supabaseUrl, privilegedKey, { auth: { persistSession: false } });
  const { data: request, error: requestError } = await privileged.from("program_requests")
    .select("id,affiliate_id,numero_control,program_id,program_item_id,product_id,request_type,status,financial_processing_status,requested_amount,requested_term,requested_term_semantics,financial_approval_snapshot,signature_data,terms_accepted,created_at")
    .eq("id", String(body.request_id)).maybeSingle();
  if (requestError) return { status: 500, body: { error: "REQUEST_LOOKUP_FAILED" } };
  if (!request || request.financial_processing_status == null) return { status: 404, body: { error: "FINANCIAL_REQUEST_NOT_FOUND" } };
  if (request.financial_approval_snapshot) return { status: 200, body: { data: { request_id: request.id, status: request.status, processing_status: request.financial_processing_status, idempotent: true } } };
  if (!["prestamo", "caja", "nomina"].includes(request.program_id) || !["benefit", "quote", "interest"].includes(request.request_type)) {
    return { status: 409, body: { error: "NON_LOAN_REQUEST" } };
  }
  if (request.terms_accepted !== true || !String(request.signature_data || "").trim()) {
    return { status: 409, body: { error: "SIGNATURE_AND_TERMS_REQUIRED" } };
  }
  if (request.requested_amount == null || request.requested_term == null || !request.requested_term_semantics) {
    return { status: 409, body: { error: "REQUESTED_AMOUNT_TERM_CONTRACT_REQUIRED" } };
  }
  const { data: affiliate, error: affiliateError } = await privileged.from("affiliates")
    .select("id,numero_control,full_name,phone_raw,financial_union_code,financial_employee_category_code,financial_employee_type,financial_affiliation_status,financial_employment_status,financial_profile_version")
    .eq("id", request.affiliate_id).maybeSingle();
  if (affiliateError || !affiliate || affiliate.numero_control !== request.numero_control) return { status: 409, body: { error: "AFFILIATE_CONTEXT_INVALID" } };
  const { data: catalog, error: catalogError } = await privileged.from("segmentation_catalog_entries")
    .select("catalog_type,code,label").in("catalog_type", ["union", "employment_category"]).in("code", [affiliate.financial_union_code, affiliate.financial_employee_category_code]).eq("enabled", true);
  if (catalogError) return { status: 500, body: { error: "FINANCIAL_PROFILE_LOOKUP_FAILED" } };
  const union = (catalog || []).find((row) => row.catalog_type === "union" && row.code === affiliate.financial_union_code)?.label;
  const category = (catalog || []).find((row) => row.catalog_type === "employment_category" && row.code === affiliate.financial_employee_category_code)?.label;
  if (!union || !category || !String(affiliate.full_name || "").trim() || !String(affiliate.phone_raw || "").trim()) {
    return { status: 409, body: { error: "AFFILIATE_FINANCIAL_PROFILE_INCOMPLETE" } };
  }
  let result: Record<string, unknown>;
  let process: string;
  let affiliation: string;
  try {
    process = processForCategory(category);
    affiliation = affiliationForUnion(union);
    if (process === "3") throw new Error("GUARANTOR_DOCUMENTS_NOT_AVAILABLE");
    const rules = await readCriteriaRules(privileged);
    const termPolicy = await readTermPolicy(userClient);
    result = await resolveQuote(privileged, rules, {
      numero_control: request.numero_control, financial_union: union,
      financial_employee_category: category, financial_profile_version: affiliate.financial_profile_version,
    }, { action: "quote", program_id: request.program_id, amount: Number(request.requested_amount), term: Number(request.requested_term) }, termPolicy);
  } catch (error) {
    const code = error instanceof Error ? error.message : "FINANCIAL_RESOLUTION_FAILED";
    return { status: code === "FINANCIAL_CRITERIA_NOT_CONFIGURED" ? 503 : 409, body: { error: code } };
  }
  const requiredDocuments = [
    ["Photo", "DK"], ["INE FRENTE", "AG"], ["INE REVERSO", "AH"],
    ["TALON PENULTIMA QUINCENA", "DM"], ["TALON ULTIMA QUINCENA", "AI"],
  ];
  const { data: files, error: filesError } = await privileged.from("affiliate_files")
    .select("private_asset_id,classification,source_column,source_column_letter,sha256,status")
    .eq("affiliate_id", request.affiliate_id).eq("classification", "PRIVATE").eq("status", "READY")
    .in("source_column", requiredDocuments.map(([column]) => column));
  if (filesError) return { status: 500, body: { error: "PRIVATE_DOCUMENT_LOOKUP_FAILED" } };
  const documentRefs: string[] = [];
  try {
    for (const [column, letter] of requiredDocuments) {
      const matches = (files || []).filter((file) => file.source_column === column && file.source_column_letter === letter);
      if (matches.length !== 1) throw new Error(matches.length ? "PRIVATE_DOCUMENT_AMBIGUOUS" : "REQUIRED_PRIVATE_DOCUMENT_MISSING");
      documentRefs.push(privateAssetReference(matches[0] as Record<string, unknown>));
    }
  } catch (error) {
    return { status: 409, body: { error: error instanceof Error ? error.message : "PRIVATE_DOCUMENT_CONTRACT_INVALID" } };
  }
  const signatureHash = await sha256(String(request.signature_data));
  const signatureRef = `supabase-request-signature:${request.id}:${signatureHash}`;
  const googleRow: unknown[] = [
    "", request.numero_control, String(affiliate.full_name), process!, String(result.fund), Number(result.rate) / 100,
    Number(result.paymentCount), Number(request.requested_amount), Number(result.total), new Date(request.created_at).toISOString(),
    category, union, affiliation!, Number(result.maxAmount), ...documentRefs,
    "", "", "", "", true, "Iniciado", "", "", "", "", "", "", signatureRef, String(affiliate.phone_raw),
    "", "", "", "", "",
  ];
  const exportPayload = {
    contract_version: EXPORT_CONTRACT_VERSION, program_request_id: request.id, affiliate_id: request.affiliate_id,
    numero_control: request.numero_control, program: request.program_id,
    product_id: request.product_id || request.program_item_id || null, request_type: request.request_type,
    request_status: "approved", requested_amount: Number(request.requested_amount),
    request_created_at: new Date(request.created_at).toISOString(), row: googleRow,
  };
  const payloadHash = await sha256(exportPayload);
  const snapshot = {
    affiliate_id: request.affiliate_id, numero_control: request.numero_control, financial_union: union,
    financial_employee_category: category, affiliation_status: affiliate.financial_affiliation_status,
    employment_status: affiliate.financial_employment_status, employee_type: affiliate.financial_employee_type,
    profile_version: affiliate.financial_profile_version, fund: result.fund, rate: result.rate,
    term: { value: request.requested_term, semantics: request.requested_term_semantics, payment_count: result.paymentCount, payment_period: result.paymentPeriod },
    maxAmount: result.maxAmount, requestedAmount: request.requested_amount,
    administrativeFee: { rule: result.administrativeFeeRule, version: result.administrativeFeeVersion, per_payment: result.administrativeFeePerPayment, total: result.administrativeFeeTotal },
    financialResult: result, approved_by: approvedBy, approved_at: new Date().toISOString(),
    google_export: { contract_version: EXPORT_CONTRACT_VERSION, row: googleRow, payload_sha256: payloadHash },
  };
  const { data: updated, error: updateError } = await privileged.rpc("approve_financial_program_request", {
    p_request_id: request.id, p_snapshot: snapshot, p_approved_by: approvedBy,
    p_comment: typeof body.comment === "string" ? body.comment : "",
  });
  if (updateError || !updated) return { status: 500, body: { error: "APPROVAL_SNAPSHOT_WRITE_FAILED" } };
  return { status: 200, body: { data: { request_id: request.id, status: updated.status, processing_status: updated.financial_processing_status, idempotent: false } } };
}

async function handoffRequest(
  body: Record<string, unknown>,
  supabaseUrl: string,
  authHeader: string,
  actorId: string,
) {
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || "", {
    global: { headers: { Authorization: authHeader } }, auth: { persistSession: false },
  });
  if (!await requireExportPermission(userClient)) return { status: 403, body: { error: "ADMIN_APPROVAL_REQUIRED" } };

  const privilegedKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY") || "";
  if (!privilegedKey) return { status: 503, body: { error: "HANDOFF_METADATA_WRITER_NOT_CONFIGURED" } };
  const privileged = createClient(supabaseUrl, privilegedKey, { auth: { persistSession: false } });
  const { data: request, error: requestError } = await privileged.from("program_requests")
    .select("id,affiliate_id,numero_control,program_id,program_item_id,product_id,request_type,status,requested_amount,created_at,financial_processing_status,legacy_reference,financial_approval_snapshot")
    .eq("id", String(body.request_id)).maybeSingle();
  if (requestError) return { status: 500, body: { error: "REQUEST_LOOKUP_FAILED" } };
  if (!request) return { status: 404, body: { error: "REQUEST_NOT_FOUND" } };
  if (request.status !== "approved" || !["ready_for_handoff", "in_progress", "failed", "handed_off"].includes(request.financial_processing_status)) {
    return { status: 409, body: { error: "APPROVED_PENDING_EXPORT_REQUIRED" } };
  }

  const exportSnapshot = request.financial_approval_snapshot?.google_export;
  if (!exportSnapshot || exportSnapshot.contract_version !== EXPORT_CONTRACT_VERSION ||
      !Array.isArray(exportSnapshot.row) || exportSnapshot.row.length !== 38 ||
      !/^[A-F0-9]{64}$/.test(String(exportSnapshot.payload_sha256 || ""))) {
    return { status: 409, body: { error: "APPROVAL_EXPORT_SNAPSHOT_INVALID" } };
  }
  const payloadBase = {
    contract_version: EXPORT_CONTRACT_VERSION, program_request_id: request.id, affiliate_id: request.affiliate_id,
    numero_control: request.numero_control, program: request.program_id,
    product_id: request.product_id || request.program_item_id || null, request_type: request.request_type,
    request_status: "approved", requested_amount: Number(request.requested_amount),
    request_created_at: new Date(request.created_at).toISOString(), row: exportSnapshot.row,
  };
  const payloadHash = await sha256(payloadBase);
  if (payloadHash !== exportSnapshot.payload_sha256) return { status: 409, body: { error: "APPROVAL_EXPORT_HASH_MISMATCH" } };

  const { data: started, error: startError } = await privileged.rpc("begin_financial_request_export", {
    p_request_id: request.id, p_payload_sha256: payloadHash, p_actor: actorId,
  });
  if (startError) return { status: 409, body: { error: "EXPORT_STATE_TRANSITION_REJECTED" } };
  if (started?.idempotent === true) return { status: 200, body: { data: {
    action: "handoff", request_id: request.id, processing_status: "handed_off", idempotent: true,
    google_row: started.google_row, legacy_reference: started.legacy_reference,
  } } };

  const handoffUrl = Deno.env.get("FINANCIAL_LEGACY_API_URL") || "";
  const handoffSecret = Deno.env.get("FINANCIAL_LEGACY_API_TOKEN") || "";
  const failExport = async (code: string, message = "") => {
    await privileged.rpc("fail_financial_request_export", {
      p_request_id: request.id, p_payload_sha256: payloadHash, p_error_code: code,
      p_error_message: message.slice(0, 500), p_actor: actorId,
    });
  };
  if (!handoffUrl || !handoffSecret) {
    await failExport("HANDOFF_NOT_CONFIGURED");
    return { status: 503, body: { error: "HANDOFF_NOT_CONFIGURED" } };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  let upstream: Response;
  try {
    upstream = await fetch(handoffUrl, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "handoff", secret: handoffSecret, ...payloadBase, payload_sha256: payloadHash }), signal: controller.signal,
    });
  } catch {
    clearTimeout(timer);
    await failExport("HANDOFF_UNAVAILABLE");
    return { status: 502, body: { error: "HANDOFF_UNAVAILABLE" } };
  }
  clearTimeout(timer);
  if (!upstream.ok) { await failExport("HANDOFF_REJECTED", `HTTP_${upstream.status}`); return { status: 502, body: { error: "HANDOFF_REJECTED" } }; }
  let result: Record<string, unknown>;
  try { result = await upstream.json(); } catch { await failExport("HANDOFF_INVALID_RESPONSE"); return { status: 502, body: { error: "HANDOFF_INVALID_RESPONSE" } }; }
  if (result.ok !== true || result.action !== "handoff" || result.accepted !== true ||
      result.program_request_id !== request.id || result.processing_status !== "exported" ||
      result.payload_sha256 !== payloadHash || !Number.isInteger(result.google_row) || Number(result.google_row) <= 1 ||
      result.legacy_reference !== `Historial de solicitudes!A${result.google_row}`) {
    await failExport("HANDOFF_CONTRACT_MISMATCH");
    return { status: 502, body: { error: "HANDOFF_CONTRACT_MISMATCH" } };
  }

  const { data: completed, error: updateError } = await privileged.rpc("complete_financial_request_export", {
    p_request_id: request.id, p_payload_sha256: payloadHash, p_google_row: result.google_row,
    p_legacy_reference: result.legacy_reference, p_actor: actorId,
  });
  if (updateError || !completed) return { status: 500, body: { error: "HANDOFF_METADATA_UPDATE_FAILED" } };
  return { status: 200, body: { data: {
    action: "handoff", request_id: request.id, processing_status: "handed_off",
    idempotent: result.idempotent === true || completed.idempotent === true,
    google_row: result.google_row, legacy_reference: result.legacy_reference,
  } } };
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
  if (!validPayload(body)) return reply(400, { error: "INVALID_REQUEST" }, origin || null);
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } }, auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(authHeader.slice(7));
  if (userError || !userData.user) return reply(401, { error: "AUTH_INVALID" }, origin || null);

  if (body.action === "handoff") {
    const outcome = await handoffRequest(body, supabaseUrl, authHeader, userData.user.id);
    return reply(outcome.status, outcome.body, origin || null);
  }
  if (body.action === "approve") {
    const approval = await approveRequest(body, supabaseUrl, authHeader, userData.user.id);
    if (approval.status !== 200) return reply(approval.status, approval.body, origin || null);
    const outcome = await handoffRequest(body, supabaseUrl, authHeader, userData.user.id);
    return reply(outcome.status, outcome.body, origin || null);
  }

  if (["loanSessionOpen", "loanSessionValidate", "loanSessionQuote", "loanSessionConfirm"].includes(String(body.action))) {
    let context: LoanSessionContext;
    let privileged: SupabaseClientLike;
    try {
      context = await currentLoanSessionContext(supabase, userData.user.id);
      privileged = privilegedClient(supabaseUrl);
    } catch (error) {
      const code = error instanceof Error ? error.message : "AFFILIATE_CONTEXT_UNAVAILABLE";
      return reply(code === "FINANCIAL_SESSION_WRITER_NOT_CONFIGURED" ? 503 : 409, { error: code }, origin || null);
    }

    if (body.action === "loanSessionOpen") {
      try {
        return reply(200, { data: await openPersonalizedLoanSession(supabase, privileged, context) }, origin || null);
      } catch (error) {
        const code = error instanceof Error ? error.message : "FINANCIAL_SESSION_OPEN_FAILED";
        const status = code === "FINANCIAL_CRITERIA_NOT_CONFIGURED" || code === "LOAN_TERM_POLICY_UNAVAILABLE" ? 503 : 502;
        return reply(status, { error: code }, origin || null);
      }
    }

    if (body.action === "loanSessionQuote") {
      try {
        const policy = await readTermPolicy(supabase);
        const snapshot = await loadPersonalizedLoanSession(privileged, context, policy, String(body.snapshot_id));
        const quote = await resolveQuote(privileged, snapshot.eligible_rules, context.profile, body, policy);
        return reply(200, { data: {
          ...await quoteWithPayroll(supabase, quote),
          loanSession: { id: snapshot.id, expires_at: snapshot.expires_at,
            financial_profile_version: snapshot.financial_profile_version },
          googleResolutionCount: 0,
        } }, origin || null);
      } catch (error) {
        const code = error instanceof Error ? error.message : "FINANCIAL_RESOLUTION_FAILED";
        const status = code === "SNAPSHOT_INVALID" ? 409
          : code === "AFFILIATE_FINANCIAL_PROFILE_INCOMPLETE" ? 409
          : code === "FINANCIAL_PROGRAM_NOT_ELIGIBLE" ? 403 : 422;
        return reply(status, { error: code }, origin || null);
      }
    }

    if (body.action === "loanSessionValidate") {
      try {
        const policy = await readTermPolicy(supabase);
        const snapshot = await loadPersonalizedLoanSession(privileged, context, policy, String(body.snapshot_id));
        return reply(200, { data: { loanSession: { id: snapshot.id, expires_at: snapshot.expires_at,
          financial_profile_version: snapshot.financial_profile_version }, googleResolutionCount: 0 } }, origin || null);
      } catch {
        return reply(409, { error: "SNAPSHOT_INVALID" }, origin || null);
      }
    }

    const outcome = await confirmPersonalizedLoanSession(body, supabase, privileged, context);
    return reply(outcome.status, outcome.body, origin || null);
  }

  let rules: CriteriaRule[];
  try { rules = await readCriteriaRules(privilegedClient(supabaseUrl)); }
  catch (error) {
    const code = error instanceof Error ? error.message : "FINANCIAL_CRITERIA_UNAVAILABLE";
    return reply(code === "FINANCIAL_CRITERIA_NOT_CONFIGURED" ? 503 : 502, { error: code }, origin || null);
  }

  if (body.action === "catalog") {
    const { data: allowed, error: permissionError } = await supabase.rpc("has_admin_permission", { required_permission: "financial_criteria.visibility.read" });
    if (permissionError || allowed !== true) return reply(403, { error: "ADMIN_READ_REQUIRED" }, origin || null);
    return reply(200, { data: { source: "SUPABASE_FINANCIAL_CRITERIA", read_only: false, rules: rules.map((rule) => ({
      id: rule.id, rule_id: rule.rule_id, program_id: rule.program_id, fund: rule.fund, category: rule.category, union: rule.union,
      max_amount: rule.max_amount, rate: rule.rate, rate_period: rule.payment_period,
      payment_count: rule.payment_count, payment_period: rule.payment_period, term_label: rule.term_label,
      status: rule.status, available_on: rule.available_on,
      criterion_identity: rule.criterion_identity, sheet_row: rule.sheet_row,
      visibility_mode: rule.visibility_mode, automatic_visibility: rule.automatic_visibility,
      effective_visibility: rule.effective_visibility, visibility_window_start: rule.visibility_window_start,
      visibility_window_end: rule.visibility_window_end, permanent: rule.permanent,
      financial_union_code: rule.financial_union_code, financial_employee_category_code: rule.financial_employee_category_code,
      lifecycle_status: rule.lifecycle_status, review_required: rule.review_required, review_signals: rule.review_signals,
    })) } }, origin || null);
  }

  const { data: affiliate, error: affiliateError } = await supabase.rpc("get_current_affiliate_financial_context");
  if (affiliateError || !affiliate || !affiliate.numero_control) {
    return reply(409, { error: "NUMERO_CONTROL_UNAVAILABLE" }, origin || null);
  }
  const profile = affiliate as FinancialProfile;
  let termPolicy: TermPolicy;
  try { termPolicy = await readTermPolicy(supabase); }
  catch { return reply(503, { error: "LOAN_TERM_POLICY_UNAVAILABLE" }, origin || null); }
  if (["overview", "resolveEligibility", "resolveAvailableFunds"].includes(String(body.action))) {
    return reply(200, { data: resolveOverview(rules, profile, termPolicy) }, origin || null);
  }
  try {
    const quote = await resolveQuote(privilegedClient(supabaseUrl), rules, profile, body, termPolicy);
    const { data: payrollImpact, error: payrollImpactError } = await supabase.rpc(
      "get_current_declared_payroll_impact",
      { p_payment_per_period: quote.paymentPerPeriod },
    );
    return reply(200, { data: {
      ...quote,
      payrollImpact: payrollImpactError
        ? { status: "ERROR", source: "SUPABASE_DECLARED_PAYROLL", guidelinePercent: 30 }
        : payrollImpact,
    } }, origin || null);
  }
  catch (error) {
    const code = error instanceof Error ? error.message : "FINANCIAL_RESOLUTION_FAILED";
    const status = code === "AFFILIATE_FINANCIAL_PROFILE_INCOMPLETE" ? 409 : code === "FINANCIAL_PROGRAM_NOT_ELIGIBLE" ? 403 : 422;
    return reply(status, { error: code }, origin || null);
  }
});
