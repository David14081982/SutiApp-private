// Access policy only; the existing engine remains the mathematical authority.
export async function filterSavingsLoanRules<T extends { id: string; fund: string }>(
  privileged: { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> },
  rules: T[], affiliateId: string,
): Promise<T[]> {
  // Runtime id contains the immutable fund code. Administrators may rename a
  // fund; a display-name edit must never remove its eligibility requirement.
  const isSavings = (rule: T) => rule.id.split('--')[1] === 'caja-de-ahorro';
  if (!rules.some(isSavings)) return rules;
  if (!affiliateId) throw new Error('AFFILIATE_CONTEXT_UNAVAILABLE');
  const { data, error } = await privileged.rpc('savings_loan_eligibility', { p_affiliate_id: affiliateId });
  if (error || !data || typeof (data as { eligible?: unknown }).eligible !== 'boolean') throw new Error('SAVINGS_LOAN_ELIGIBILITY_UNAVAILABLE');
  return (data as { eligible: boolean }).eligible ? rules : rules.filter((rule) => !isSavings(rule));
}
