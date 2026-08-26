/* Supabase boundary for affiliate-declared payroll. No browser persistence or financial rules. */
(function () {
  function client() {
    const value = window.SutiSupabase && window.SutiSupabase.getClient();
    if (!value) throw new Error('SUPABASE_NOT_CONFIGURED');
    return value;
  }
  function assertDeclaration(value) {
    if (!value || typeof value !== 'object' || !['EMPTY', 'READY'].includes(value.status) ||
        value.source !== 'SUPABASE_DECLARED_PAYROLL') throw new Error('PAYROLL_DECLARATION_INVALID_RESPONSE');
    if (value.status === 'READY') {
      for (const field of ['grossPayPerFortnight', 'deductionsPerFortnight', 'netPayPerFortnight', 'version']) {
        if (typeof value[field] !== 'number' || !Number.isFinite(value[field])) throw new Error('PAYROLL_DECLARATION_INVALID_RESPONSE');
      }
    }
    return Object.freeze({ ...value });
  }
  async function get() {
    const { data, error } = await client().rpc('get_current_declared_payroll');
    if (error) throw new Error(error.message || 'PAYROLL_DECLARATION_UNAVAILABLE');
    return assertDeclaration(data);
  }
  async function save(input) {
    const gross = Number(input && input.grossPayPerFortnight);
    const deductions = Number(input && input.deductionsPerFortnight);
    const expected = Number(input && input.expectedVersion);
    if (!Number.isFinite(gross) || gross <= 0 || !Number.isFinite(deductions) || deductions < 0 || deductions >= gross) {
      throw new Error('PAYROLL_DECLARATION_INVALID');
    }
    const { data, error } = await client().rpc('save_current_declared_payroll', {
      p_gross_pay_per_fortnight: gross,
      p_deductions_per_fortnight: deductions,
      p_expected_version: Number.isInteger(expected) && expected >= 0 ? expected : 0,
    });
    if (error) throw new Error(error.message || 'PAYROLL_DECLARATION_SAVE_FAILED');
    return assertDeclaration(data);
  }
  window.PayrollDeclarationRepository = Object.freeze({ get, save, assertDeclaration });
})();
