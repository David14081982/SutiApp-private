// Derived classification, not a new balance/credit authority. Exact aliases only.
// H-LOAN-HISTORICAL-FUND-RESOLUTION-COMPLETE-001. Never edit historical rows.
export const HISTORICAL_OBLIGATION_MAP_VERSION = 1;
export const normalizeObligationName = value => String(value ?? '').trim().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').toUpperCase();
const reportEvidence = 'supabase/functions/reports-jc/report.mjs#fundGroup/payrollCode; sha256(LF):fc561c4aaa9b1be98463e324fefac47d14bddb390b144e5068ac6bb5ce2d4354';
export const HISTORICAL_OBLIGATION_MAP = Object.freeze([
  { historical_value: 'Vales y membresias', program_classification: 'membership', canonical_fund_id: null,
    evidence: 'supabase/migrations/20260910000100_membership_payment_contract.sql#MEMBERSHIP_PAYMENT_V1; ' + reportEvidence, reason: 'Membership obligation; payroll 577/611.' },
  { historical_value: 'Seguro Colectivo Suti', program_classification: 'insurance', canonical_fund_id: null,
    evidence: reportEvidence, reason: 'Collective insurance obligation; payroll 644.' },
  { historical_value: 'Suti Terrenos', program_classification: 'terrenos', canonical_fund_id: null,
    evidence: reportEvidence, reason: 'Land product/project obligation; payroll 645.' },
  { historical_value: 'Suti Auto', program_classification: 'auto', canonical_fund_id: null,
    evidence: reportEvidence, reason: 'Auto product/project obligation; payroll 645.' },
  { historical_value: 'Panel Solar', program_classification: 'solar', canonical_fund_id: null,
    evidence: reportEvidence, reason: 'Solar product/project obligation; payroll 645.' },
  { historical_value: 'Suti Cirugias', program_classification: 'cirugias', canonical_fund_id: null,
    evidence: reportEvidence, reason: 'Surgery service/project obligation; payroll 645.' },
  { historical_value: 'Suti Tours', program_classification: 'tours', canonical_fund_id: null,
    evidence: reportEvidence, reason: 'Historical travel obligation; payroll 646. An explicit canonical financing contract takes precedence.' },
].map(Object.freeze));
// Canonical IDs from program definitions, never inferred from fuzzy labels.
export const NON_LOAN_PROGRAM_IDS = Object.freeze(['membership', 'aires', 'casa', 'auto',
  'farma', 'renta', 'donativos', 'tours', 'terrenos', 'solar', 'puertas', 'computo', 'cirugias']);
export function historicalObligation(value) {
  const name = normalizeObligationName(value);
  return HISTORICAL_OBLIGATION_MAP.find(row => normalizeObligationName(row.historical_value) === name) || null;
}
